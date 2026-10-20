import type { Polytope4 } from './hypercube';
import { lerp4, type Vec4 } from './vec4';

/** 超平面 w = w0 与多胞体的截面。 */
export interface Slice4 {
  /** 截面顶点（四维坐标，w 分量恒为 w0），来自边与超平面的交点。 */
  points: Vec4[];
  /** 每条边对应的截面顶点下标；无交点为 -1。 */
  edgePoint: Int32Array;
  /** 截面线段：由每个正方形面上的两个交点连成，存的是 points 的下标。 */
  segments: Array<readonly [number, number]>;
}

const EPS = 1e-9;

/**
 * 边 (a,b) 与超平面 w = w0 的交点参数 t ∈ [0,1]，无交点返回 null。
 * 端点恰好落在超平面上也视为相交（t = 0 或 1），但整条边都在平面内时返回 null
 * （这种边本身就是截面的一部分，由调用方按需处理）。
 */
export function edgeHyperplaneT(a: Vec4, b: Vec4, w0: number): number | null {
  const da = a[3] - w0;
  const db = b[3] - w0;
  if (Math.abs(da) < EPS && Math.abs(db) < EPS) return null; // 整条边在平面内
  if (da * db > 0) return null; // 同侧
  const t = da / (da - db);
  if (t < -EPS || t > 1 + EPS) return null;
  return Math.min(1, Math.max(0, t));
}

/**
 * 计算已旋转顶点集合的 w = w0 截面。
 * 1. 每条边与超平面求交 → 截面顶点。
 * 2. 每个正方形面最多有两条边被切 → 连成一条截面线段。
 * 结果是截面多面体的线框，对 tesseract 在 |w0| < 1 时为（可能倾斜的）多面体轮廓。
 */
export function sliceHyperplane(poly: Polytope4, rotatedVertices: readonly Vec4[], w0: number): Slice4 {
  const points: Vec4[] = [];
  const edgePoint = new Int32Array(poly.edges.length).fill(-1);

  // 用 "顶点下标对" 做键，避免同一条边在面遍历时重复求交
  const edgeIndexByKey = new Map<number, number>();
  poly.edges.forEach(([i, j], ei) => {
    const key = i < j ? i * 1024 + j : j * 1024 + i;
    edgeIndexByKey.set(key, ei);
    const a = rotatedVertices[i];
    const b = rotatedVertices[j];
    const t = edgeHyperplaneT(a, b, w0);
    if (t !== null) {
      const p = lerp4(a, b, t);
      edgePoint[ei] = points.length;
      points.push([p[0], p[1], p[2], w0]);
    }
  });

  const segments: Array<readonly [number, number]> = [];
  for (const face of poly.faces) {
    const hits: number[] = [];
    for (let k = 0; k < 4; k++) {
      const i = face[k];
      const j = face[(k + 1) % 4];
      const key = i < j ? i * 1024 + j : j * 1024 + i;
      const ei = edgeIndexByKey.get(key);
      if (ei === undefined) continue;
      const pi = edgePoint[ei];
      if (pi >= 0 && !hits.includes(pi)) hits.push(pi);
    }
    // 一个凸四边形被超平面切，交点要么 0 个、要么 2 个（经过顶点时可能重合为 1 个）
    if (hits.length === 2) segments.push([hits[0], hits[1]]);
  }

  return { points, edgePoint, segments };
}

/** 截面中去重后的顶点数（经过顶点时多条边会产生同一位置的点）。 */
export function countDistinctPoints(points: readonly Vec4[], tol = 1e-6): number {
  const kept: Vec4[] = [];
  outer: for (const p of points) {
    for (const q of kept) {
      if (
        Math.abs(p[0] - q[0]) < tol &&
        Math.abs(p[1] - q[1]) < tol &&
        Math.abs(p[2] - q[2]) < tol
      ) {
        continue outer;
      }
    }
    kept.push(p);
  }
  return kept.length;
}

// ---------------------------------------------------------------------------
// 截面形状识别（第三章）
// ---------------------------------------------------------------------------

/** 截面多面体的组合签名：顶点数、边数、面数与各面边数（升序）。 */
export interface SectionSignature {
  vertices: number;
  edges: number;
  faces: number;
  /** 每个面的边数，升序；如三棱柱 [3,3,4,4,4] */
  faceSizes: number[];
}

/**
 * 从截面线框得到组合签名。
 * - 顶点：去重后的交点。
 * - 边：去重后的非退化线段。
 * - 面：每个三维胞（cell）被超平面切出一个多边形；胞 = 某一坐标固定为 ±1 的全部顶点。
 */
export function sectionSignature(poly: Polytope4, slice: Slice4, tol = 1e-6): SectionSignature {
  // 顶点去重 → 映射
  const kept: Vec4[] = [];
  const remap: number[] = [];
  for (const p of slice.points) {
    let found = -1;
    for (let i = 0; i < kept.length; i++) {
      const q = kept[i];
      if (Math.abs(p[0] - q[0]) < tol && Math.abs(p[1] - q[1]) < tol && Math.abs(p[2] - q[2]) < tol) {
        found = i;
        break;
      }
    }
    if (found < 0) {
      found = kept.length;
      kept.push(p);
    }
    remap.push(found);
  }
  const edgeKeys = new Set<string>();
  for (const [a, b] of slice.segments) {
    const i = remap[a];
    const j = remap[b];
    if (i === j) continue;
    edgeKeys.add(i < j ? `${i}-${j}` : `${j}-${i}`);
  }

  // 面：按胞分组。胞由 (轴 k, 符号 s) 标识；一个正方形面属于某胞当其 4 个顶点在轴 k 上都等于 s。
  const faceSizes: number[] = [];
  const dims = poly.vertices[0]?.length ?? 4;
  for (let k = 0; k < dims; k++) {
    for (const s of [-1, 1]) {
      const sides = new Set<string>();
      poly.faces.forEach((face, fi) => {
        if (!face.every((vi) => Math.abs(poly.vertices[vi][k] - s) < 1e-9)) return;
        const seg = slice.segments[faceSegmentIndex(slice, poly, fi)];
        if (!seg) return;
        const i = remap[seg[0]];
        const j = remap[seg[1]];
        if (i === j) return;
        sides.add(i < j ? `${i}-${j}` : `${j}-${i}`);
      });
      if (sides.size >= 3) faceSizes.push(sides.size);
    }
  }
  faceSizes.sort((a, b) => a - b);
  return { vertices: kept.length, edges: edgeKeys.size, faces: faceSizes.length, faceSizes };
}

/**
 * sliceHyperplane 的 segments 按 poly.faces 顺序生成，但只为有两个交点的面生成；
 * 这里重新对应"面下标 → 线段下标"。为保持 Slice4 结构不变，用一次线性扫描重建映射并缓存。
 */
const faceSegCache = new WeakMap<Slice4, Int32Array>();
function faceSegmentIndex(slice: Slice4, poly: Polytope4, faceIndex: number): number {
  let map = faceSegCache.get(slice);
  if (!map) {
    map = new Int32Array(poly.faces.length).fill(-1);
    // 重放 sliceHyperplane 的面遍历逻辑，确定哪些面产生了线段
    const edgeIndexByKey = new Map<number, number>();
    poly.edges.forEach(([i, j], ei) => edgeIndexByKey.set(i < j ? i * 1024 + j : j * 1024 + i, ei));
    let si = 0;
    poly.faces.forEach((face, fi) => {
      const hits: number[] = [];
      for (let k = 0; k < 4; k++) {
        const i = face[k];
        const j = face[(k + 1) % 4];
        const ei = edgeIndexByKey.get(i < j ? i * 1024 + j : j * 1024 + i);
        if (ei === undefined) continue;
        const pi = slice.edgePoint[ei];
        if (pi >= 0 && !hits.includes(pi)) hits.push(pi);
      }
      if (hits.length === 2) map![fi] = si++;
    });
    faceSegCache.set(slice, map);
  }
  return map[faceIndex];
}

/** 已知形状的中文名；未知时返回 null。 */
export function sectionName(sig: SectionSignature): string | null {
  const { vertices: v, edges: e, faceSizes } = sig;
  const fs = faceSizes.join(',');
  if (v === 0) return null;
  if (v === 4 && e === 6) return '四面体';
  if (v === 6 && e === 9) return '三棱柱';
  if (v === 8 && e === 12) return fs === '4,4,4,4,4,4' ? '长方体' : null;
  if (v === 6 && e === 12) return '八面体';
  if (v === 10 && e === 15) return '五棱柱';
  // 三个 W 平面一般姿态下，中段 12v18e 的面型会在截角四面体与六棱柱之间连续变化（如 3,3,3,4,4,5,6,6）
  if (v === 12 && e === 18) return fs === '3,3,3,3,6,6,6,6' ? '截角四面体' : fs === '4,4,4,4,4,4,6,6' ? '六棱柱' : '十二顶点体';
  return null;
}

/** 一个形状要求是否被当前签名满足。 */
export interface ShapeRequirement {
  vertices?: number;
  edges?: number;
  /** 顶点数下限（用于"够深"的要求） */
  minVertices?: number;
}
export function matchesShape(sig: SectionSignature, req: ShapeRequirement): boolean {
  if (req.vertices !== undefined && sig.vertices !== req.vertices) return false;
  if (req.edges !== undefined && sig.edges !== req.edges) return false;
  if (req.minVertices !== undefined && sig.vertices < req.minVertices) return false;
  return true;
}
