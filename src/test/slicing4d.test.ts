import { describe, expect, it } from 'vitest';
import { createTesseract } from '../math/hypercube';
import { identityRotation, rotateAll } from '../math/rotation4d';
import { countDistinctPoints, edgeHyperplaneT, matchesShape, sectionName, sectionSignature, sliceHyperplane } from '../math/slicing4d';

const T = createTesseract();

describe('edgeHyperplaneT', () => {
  it('跨越平面的边给出正确 t', () => {
    expect(edgeHyperplaneT([0, 0, 0, -1], [0, 0, 0, 1], 0)).toBeCloseTo(0.5);
    expect(edgeHyperplaneT([0, 0, 0, -1], [0, 0, 0, 1], 0.5)).toBeCloseTo(0.75);
  });
  it('同侧的边无交点', () => {
    expect(edgeHyperplaneT([0, 0, 0, 1], [0, 0, 0, 2], 0)).toBeNull();
  });
  it('整条边在平面内返回 null', () => {
    expect(edgeHyperplaneT([0, 0, 0, 0], [1, 0, 0, 0], 0)).toBeNull();
  });
});

describe('sliceHyperplane（未旋转 tesseract）', () => {
  it('w0 = 0：截面是一个立方体（8 个点、12 条线段），所有点 w = 0', () => {
    const s = sliceHyperplane(T, T.vertices, 0);
    expect(s.points).toHaveLength(8);
    expect(s.segments).toHaveLength(12);
    for (const p of s.points) {
      expect(p[3]).toBe(0);
      expect(Math.abs(p[0])).toBe(1);
      expect(Math.abs(p[1])).toBe(1);
      expect(Math.abs(p[2])).toBe(1);
    }
  });

  it('|w0| > 1：截面为空', () => {
    expect(sliceHyperplane(T, T.vertices, 1.5).points).toHaveLength(0);
    expect(sliceHyperplane(T, T.vertices, -1.2).segments).toHaveLength(0);
  });

  it('w0 = ±1：截面恰好是一个胞（立方体），去重后 8 个点', () => {
    for (const w0 of [1, -1]) {
      const s = sliceHyperplane(T, T.vertices, w0);
      expect(countDistinctPoints(s.points)).toBe(8);
    }
  });

  it('截面随 w0 连续变化且保持立方体拓扑', () => {
    for (const w0 of [-0.9, -0.3, 0.4, 0.95]) {
      const s = sliceHyperplane(T, T.vertices, w0);
      expect(s.points).toHaveLength(8);
      expect(s.segments).toHaveLength(12);
    }
  });
});

describe('sliceHyperplane（旋转后的 tesseract）', () => {
  it('绕 XW 旋转 45° 后，w0=0 的截面不再是 8 点立方体（形状真的变了）', () => {
    const r = { ...identityRotation(), XW: Math.PI / 4 };
    const s = sliceHyperplane(T, rotateAll(T.vertices, r), 0);
    // 此时顶点 w 取值为 0 或 ±√2：有 8 个顶点正好落在平面上，截面经过这些顶点
    expect(s.points.length).toBeGreaterThan(0);
    const distinct = countDistinctPoints(s.points);
    expect(distinct).toBe(8);
    // 每条线段两端点都是有效下标
    for (const [a, b] of s.segments) {
      expect(a).toBeGreaterThanOrEqual(0);
      expect(b).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThan(s.points.length);
      expect(b).toBeLessThan(s.points.length);
    }
  });

  it('沿对角方向（XW+YW+ZW 各一点角度）切出的截面点数不是 8，证明截面形状依赖姿态', () => {
    const r = { ...identityRotation(), XW: 0.6, YW: 0.5, ZW: 0.4 };
    const s = sliceHyperplane(T, rotateAll(T.vertices, r), 0.2);
    const n = countDistinctPoints(s.points);
    expect(n).toBeGreaterThan(0);
    expect(n).not.toBe(8);
    // 截面是一个闭合多面体线框：每个点至少连两条线段
    const deg = new Array(s.points.length).fill(0);
    for (const [a, b] of s.segments) {
      deg[a]++;
      deg[b]++;
    }
    expect(deg.every((d) => d >= 2)).toBe(true);
  });

  it('截面上的所有点都严格位于超平面上', () => {
    const r = { ...identityRotation(), XW: 1.1, YZ: 0.3, ZW: -0.7 };
    const rv = rotateAll(T.vertices, r);
    for (const w0 of [-0.5, 0, 0.33]) {
      const s = sliceHyperplane(T, rv, w0);
      for (const p of s.points) expect(p[3]).toBe(w0);
    }
  });
});

describe('截面签名 sectionSignature / sectionName', () => {
  const T = createTesseract();
  const sig = (rot: Partial<ReturnType<typeof identityRotation>>, w0: number) =>
    sectionSignature(T, sliceHyperplane(T, rotateAll(T.vertices, { ...identityRotation(), ...rot }), w0));
  const d2r = (x: number) => (x * Math.PI) / 180;

  it('0 个 W 旋转：立方体 8v12e6f，全是四边形', () => {
    const s = sig({}, 0);
    expect([s.vertices, s.edges, s.faces]).toEqual([8, 12, 6]);
    expect(s.faceSizes).toEqual([4, 4, 4, 4, 4, 4]);
    expect(sectionName(s)).toBe('长方体');
  });

  it('1 个 W 旋转：任意角度、任意 w₀（核心内，|w₀| ≤ cos a）都是长方体', () => {
    for (const a of [10, 35, 60, 80]) for (let w0 = -0.9; w0 <= 0.9; w0 += 0.3) {
      expect(sectionName(sig({ ZW: d2r(a) }, w0))).toBe('长方体');
    }
  });

  it('2 个 W 旋转：边缘三棱柱，中段六棱柱', () => {
    expect(sectionName(sig({ YW: d2r(40), ZW: d2r(30) }, 1.2))).toBe('三棱柱');
    expect(sectionName(sig({ YW: d2r(40), ZW: d2r(30) }, 0))).toBe('六棱柱');
  });

  it('3 个 W 旋转：顶点附近四面体；精确顶点朝前姿态的正中是正八面体 6v12e8f', () => {
    const t = sig({ XW: d2r(35), YW: d2r(40), ZW: d2r(30) }, -1.6);
    expect(sectionName(t)).toBe('四面体');
    expect(t.faceSizes).toEqual([3, 3, 3, 3]);
    const o = sig({ XW: Math.PI / 4, YW: Math.atan(1 / Math.SQRT2), ZW: Math.PI / 6 }, 0);
    expect([o.vertices, o.edges, o.faces]).toEqual([6, 12, 8]);
    expect(sectionName(o)).toBe('八面体');
  });

  it('空截面 0v；matchesShape 按顶点/边数匹配', () => {
    const e = sig({}, 1.5);
    expect(e.vertices).toBe(0);
    expect(sectionName(e)).toBeNull();
    const p = sig({ YW: d2r(40), ZW: d2r(30) }, 1.2);
    expect(matchesShape(p, { vertices: 6, edges: 9 })).toBe(true);
    expect(matchesShape(p, { vertices: 4 })).toBe(false);
    expect(matchesShape(p, { minVertices: 6 })).toBe(true);
  });
});
