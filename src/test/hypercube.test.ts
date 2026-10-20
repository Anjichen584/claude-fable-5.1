import { describe, expect, it } from 'vitest';
import { createTesseract, generateEdges, generateTesseractVertices, isInnerVertex } from '../math/hypercube';
import { distance4 } from '../math/vec4';

describe('tesseract 生成', () => {
  const t = createTesseract();

  it('有 16 个顶点、32 条边、24 个面', () => {
    expect(t.vertices).toHaveLength(16);
    expect(t.edges).toHaveLength(32);
    expect(t.faces).toHaveLength(24);
  });

  it('每个顶点坐标都是 ±1 且互不相同', () => {
    const seen = new Set<string>();
    for (const v of t.vertices) {
      for (const c of v) expect(Math.abs(c)).toBe(1);
      seen.add(v.join(','));
    }
    expect(seen.size).toBe(16);
  });

  it('每条边连接恰好一个坐标不同的两个顶点，长度为 2', () => {
    for (const [i, j] of t.edges) {
      const a = t.vertices[i];
      const b = t.vertices[j];
      const diff = a.filter((c, k) => c !== b[k]).length;
      expect(diff).toBe(1);
      expect(distance4(a, b)).toBeCloseTo(2);
    }
  });

  it('每个顶点度数为 4', () => {
    const deg = new Array(16).fill(0);
    for (const [i, j] of t.edges) {
      deg[i]++;
      deg[j]++;
    }
    expect(deg.every((d) => d === 4)).toBe(true);
  });

  it('每个面的 4 条边都是真实的边，且面互不重复', () => {
    const edgeSet = new Set(t.edges.map(([i, j]) => `${Math.min(i, j)}-${Math.max(i, j)}`));
    const faceKeys = new Set<string>();
    for (const f of t.faces) {
      for (let k = 0; k < 4; k++) {
        const i = f[k];
        const j = f[(k + 1) % 4];
        expect(edgeSet.has(`${Math.min(i, j)}-${Math.max(i, j)}`)).toBe(true);
      }
      faceKeys.add([...f].sort((a, b) => a - b).join(','));
    }
    expect(faceKeys.size).toBe(24);
  });

  it('每条边恰好属于 3 个面', () => {
    const count = new Map<string, number>();
    for (const f of t.faces) {
      for (let k = 0; k < 4; k++) {
        const i = f[k];
        const j = f[(k + 1) % 4];
        const key = `${Math.min(i, j)}-${Math.max(i, j)}`;
        count.set(key, (count.get(key) ?? 0) + 1);
      }
    }
    expect(count.size).toBe(32);
    for (const c of count.values()) expect(c).toBe(3);
  });

  it('generateEdges 是通用的：对 3 维立方体嵌入（w 固定）也给出 12 条边', () => {
    const cube = generateTesseractVertices().filter((v) => v[3] === -1);
    expect(cube).toHaveLength(8);
    expect(generateEdges(cube)).toHaveLength(12);
  });

  it('内/外立方体各 8 个顶点', () => {
    const inner = t.vertices.filter((_, i) => isInnerVertex(i));
    expect(inner).toHaveLength(8);
    expect(inner.every((v) => v[3] === -1)).toBe(true);
  });
});
