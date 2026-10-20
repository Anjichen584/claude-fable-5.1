import type { Vec4 } from './vec4';

/** 一条边：两个顶点下标。 */
export type Edge = readonly [number, number];
/** 一个正方形面：四个顶点下标，按环绕顺序排列。 */
export type Face = readonly [number, number, number, number];

/**
 * 泛型四维多胞体骨架。tesseract 是其中一种；
 * 未来的 16-cell / 24-cell 共用同一接口，旋转/投影/切片对它们一视同仁。
 */
export interface Polytope4 {
  readonly name: string;
  readonly vertices: readonly Vec4[];
  readonly edges: readonly Edge[];
  readonly faces: readonly Face[];
}

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
  return {
    name: 'tesseract',
    vertices,
    edges: generateEdges(vertices),
    faces: generateTesseractFaces(),
  };
}

/** 顶点下标是否属于"内"立方体（w = -1）。投影距离 d>1 时它投影得更小。 */
export function isInnerVertex(index: number): boolean {
  return (index & 8) === 0;
}
