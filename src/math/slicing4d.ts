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
