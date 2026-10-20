import type { Vec4 } from './vec4';

/** 一条边：两个顶点下标。 */
export type Edge = readonly [number, number];
/** 一个多边形面：顶点下标按环绕顺序排列（tesseract 为正方形，16-cell / 24-cell 为三角形）。 */
export type Face = readonly number[];
/** 一个三维胞：它包含的面下标。 */
export type Cell = readonly number[];

/**
 * 泛型四维多胞体骨架。tesseract 是其中一种；
 * 16-cell / 24-cell 共用同一接口，旋转/投影/切片/截面签名对它们一视同仁。
 */
export interface Polytope4 {
  readonly name: string;
  readonly vertices: readonly Vec4[];
  readonly edges: readonly Edge[];
  readonly faces: readonly Face[];
  /** 胞（面下标集合）；截面签名按胞分组得到每个截面多边形 */
  readonly cells: readonly Cell[];
}

export type PolytopeKind = 'tesseract' | 'cell16' | 'cell24';

/**
 * 生成标准超立方体：顶点坐标 ∈ {-1, +1}^4。
 * 顶点下标 i 的第 k 个坐标 = (i >> k) & 1 ? +1 : -1，k = 0..3 对应 x,y,z,w。
 */
export function generateTesseractVertices(): Vec4[] {
  const out: Vec4[] = [];
  for (let i = 0; i < 16; i++) {
    out.push([
      i & 1 ? 1 : -1,
      i & 2 ? 1 : -1,
      i & 4 ? 1 : -1,
      i & 8 ? 1 : -1,
    ]);
  }
  return out;
}

/** 两个顶点恰好一个坐标不同 → 连边。对 {-1,+1}^n 顶点集通用。 */
export function generateEdges(vertices: readonly Vec4[]): Edge[] {
  const edges: Edge[] = [];
  for (let i = 0; i < vertices.length; i++) {
    for (let j = i + 1; j < vertices.length; j++) {
      let diff = 0;
      for (let k = 0; k < 4; k++) {
        if (vertices[i][k] !== vertices[j][k]) diff++;
        if (diff > 1) break;
      }
      if (diff === 1) edges.push([i, j]);
    }
  }
  return edges;
}

/**
 * 正方形面：固定两个坐标轴的取值，另两个坐标自由变化。
 * 顶点按环绕顺序 (-,-) → (+,-) → (+,+) → (-,+) 排列，便于切片时按边遍历。
 */
export function generateTesseractFaces(): Face[] {
  const faces: Face[] = [];
  const indexOf = (coords: readonly number[]): number =>
    (coords[0] > 0 ? 1 : 0) | (coords[1] > 0 ? 2 : 0) | (coords[2] > 0 ? 4 : 0) | (coords[3] > 0 ? 8 : 0);

  // 选两个自由轴 a < b，剩下两个轴 c, d 固定取 ±1
  for (let a = 0; a < 4; a++) {
    for (let b = a + 1; b < 4; b++) {
      const fixed = [0, 1, 2, 3].filter((k) => k !== a && k !== b);
      for (const sc of [-1, 1]) {
        for (const sd of [-1, 1]) {
          const base = [0, 0, 0, 0];
          base[fixed[0]] = sc;
          base[fixed[1]] = sd;
          const corner = (sa: number, sb: number): number => {
            const c = base.slice();
            c[a] = sa;
            c[b] = sb;
            return indexOf(c);
          };
          faces.push([corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1)]);
        }
      }
    }
  }
  return faces;
}

export function createTesseract(): Polytope4 {
  const vertices = generateTesseractVertices();
  const faces = generateTesseractFaces();
  // 8 个立方体胞：坐标 k 固定为 s 的全部面
  const cells: Cell[] = [];
  for (let k = 0; k < 4; k++) {
    for (const s of [-1, 1]) {
      const fs: number[] = [];
      faces.forEach((f, fi) => {
        if (f.every((vi) => vertices[vi][k] === s)) fs.push(fi);
      });
      cells.push(fs);
    }
  }
  return { name: 'tesseract', vertices, edges: generateEdges(vertices), faces, cells };
}

/** 顶点下标是否属于"内"立方体（w = -1）。投影距离 d>1 时它投影得更小。 */
export function isInnerVertex(index: number): boolean {
  return (index & 8) === 0;
}

// ---------------------------------------------------------------------------
// 其他正多胞体（第五章）
// ---------------------------------------------------------------------------

const near = (a: number, b: number, tol = 1e-9) => Math.abs(a - b) < tol;
const dist2 = (a: Vec4, b: Vec4) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2 + (a[3] - b[3]) ** 2;

/** 两两距离恰为 d 的顶点对连边。 */
export function edgesByDistance(vertices: readonly Vec4[], d: number): Edge[] {
  const edges: Edge[] = [];
  const d2 = d * d;
  for (let i = 0; i < vertices.length; i++) for (let j = i + 1; j < vertices.length; j++) if (near(dist2(vertices[i], vertices[j]), d2)) edges.push([i, j]);
  return edges;
}

/** 三角形面：三条边两两相连的顶点三元组。 */
export function trianglesFromEdges(vertexCount: number, edges: readonly Edge[]): Face[] {
  const adj = Array.from({ length: vertexCount }, () => new Set<number>());
  for (const [i, j] of edges) {
    adj[i].add(j);
    adj[j].add(i);
  }
  const faces: Face[] = [];
  for (let i = 0; i < vertexCount; i++) for (const j of adj[i]) if (j > i) for (const k of adj[j]) if (k > j && adj[i].has(k)) faces.push([i, j, k]);
  return faces;
}

/** 胞 = 给定顶点集合内的全部面。 */
export function cellsFromVertexSets(faces: readonly Face[], vertexSets: readonly (readonly number[])[]): Cell[] {
  return vertexSets.map((vs) => {
    const set = new Set(vs);
    const out: number[] = [];
    faces.forEach((f, fi) => {
      if (f.every((v) => set.has(v))) out.push(fi);
    });
    return out;
  });
}

/**
 * 正十六胞体（16-cell，超立方体的对偶）：8 个顶点 ±e_k，24 条边（非对径顶点两两相连），
 * 32 个三角形面，16 个四面体胞（每个坐标轴各取一个符号）。
 */
export function createCell16(): Polytope4 {
  const vertices: Vec4[] = [];
  for (let k = 0; k < 4; k++) {
    for (const s of [1, -1]) {
      const v: number[] = [0, 0, 0, 0];
      v[k] = s;
      vertices.push(v as unknown as Vec4);
    }
  }
  const edges = edgesByDistance(vertices, Math.SQRT2);
  const faces = trianglesFromEdges(vertices.length, edges);
  const sets: number[][] = [];
  for (let m = 0; m < 16; m++) sets.push([0, 1, 2, 3].map((k) => k * 2 + ((m >> k) & 1)));
  return { name: 'cell16', vertices, edges, faces, cells: cellsFromVertexSets(faces, sets) };
}

/**
 * 正二十四胞体（24-cell，自对偶）：24 个顶点 = (±1, ±1, 0, 0) 的全部排列，96 条边（距离 √2），
 * 96 个三角形面，24 个正八面体胞。胞心为 ±e_k 与 (±½, ±½, ±½, ±½)，胞 = 与胞心内积为 1 的 6 个顶点。
 */
export function createCell24(): Polytope4 {
  const vertices: Vec4[] = [];
  for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) for (const sa of [1, -1]) for (const sb of [1, -1]) {
    const v: number[] = [0, 0, 0, 0];
    v[a] = sa;
    v[b] = sb;
    vertices.push(v as unknown as Vec4);
  }
  const edges = edgesByDistance(vertices, Math.SQRT2);
  const faces = trianglesFromEdges(vertices.length, edges);
  const centers: Vec4[] = [];
  for (let k = 0; k < 4; k++) for (const s of [1, -1]) {
    const c: number[] = [0, 0, 0, 0];
    c[k] = s;
    centers.push(c as unknown as Vec4);
  }
  for (let m = 0; m < 16; m++) centers.push([m & 1 ? 0.5 : -0.5, m & 2 ? 0.5 : -0.5, m & 4 ? 0.5 : -0.5, m & 8 ? 0.5 : -0.5]);
  const sets = centers.map((c) => vertices.map((v, i) => (near(v[0] * c[0] + v[1] * c[1] + v[2] * c[2] + v[3] * c[3], 1) ? i : -1)).filter((i) => i >= 0));
  return { name: 'cell24', vertices, edges, faces, cells: cellsFromVertexSets(faces, sets) };
}

export function createPolytope(kind: PolytopeKind): Polytope4 {
  return kind === 'cell16' ? createCell16() : kind === 'cell24' ? createCell24() : createTesseract();
}

/** 中文名 */
export const POLYTOPE_NAMES: Record<PolytopeKind, string> = { tesseract: '超立方体', cell16: '正十六胞体', cell24: '正二十四胞体' };
