import { describe, expect, it } from 'vitest';
import * as math from '../math';
import { createCell16, createCell24, createPolytope, createTesseract, type Polytope4 } from '../math';
import { CHAPTERS } from '../puzzle/chapters';
import { LEVELS } from '../puzzle/levels';
import { PuzzleSession } from '../puzzle/PuzzleSession';
import type { LevelDef } from '../puzzle/types';

const d2r = (x: number) => (x * Math.PI) / 180;
const sig = (P: Polytope4, rot: Partial<math.Rotation4D>, w0: number) =>
  math.sectionSignature(P, math.sliceHyperplane(P, math.rotateAll(P.vertices, { ...math.identityRotation(), ...rot }), w0));

describe('第五章 正多胞体生成', () => {
  const cases: Array<[string, Polytope4, number, number, number, number, number, number]> = [
    // name, poly, V, E, F, C, 每顶点边数, 每胞面数
    ['tesseract', createTesseract(), 16, 32, 24, 8, 4, 6],
    ['cell16', createCell16(), 8, 24, 32, 16, 6, 4],
    ['cell24', createCell24(), 24, 96, 96, 24, 8, 8],
  ];

  it.each(cases)('%s：V/E/F/C 与欧拉示性数 V − E + F − C = 0', (_n, P, V, E, F, C) => {
    expect(P.vertices.length).toBe(V);
    expect(P.edges.length).toBe(E);
    expect(P.faces.length).toBe(F);
    expect(P.cells.length).toBe(C);
    expect(V - E + F - C).toBe(0);
  });

  it.each(cases)('%s：顶点度数一致；每个胞的面数一致；每个面恰属于两个胞', (_n, P, _V, _E, _F, _C, deg, facesPerCell) => {
    const degree = new Array(P.vertices.length).fill(0);
    for (const [i, j] of P.edges) {
      degree[i]++;
      degree[j]++;
    }
    expect(new Set(degree)).toEqual(new Set([deg]));
    expect(new Set(P.cells.map((c) => c.length))).toEqual(new Set([facesPerCell]));
    const count = new Array(P.faces.length).fill(0);
    for (const c of P.cells) for (const fi of c) count[fi]++;
    expect(new Set(count)).toEqual(new Set([2]));
  });

  it('所有顶点等距原点（正多胞体外接球）；16-cell 顶点间距 √2 或 2，24-cell 边长 √2', () => {
    for (const P of [createCell16(), createCell24()]) {
      const r = new Set(P.vertices.map((v) => +Math.hypot(...v).toFixed(9)));
      expect(r.size).toBe(1);
    }
    const C16 = createCell16();
    for (let i = 0; i < 8; i++) for (let j = i + 1; j < 8; j++) {
      const d = Math.hypot(...C16.vertices[i].map((c, k) => c - C16.vertices[j][k]));
      expect([Math.SQRT2, 2].some((x) => Math.abs(x - d) < 1e-9)).toBe(true);
    }
  });

  it('createPolytope 按 kind 分发', () => {
    expect(createPolytope('tesseract').name).toBe('tesseract');
    expect(createPolytope('cell16').name).toBe('cell16');
    expect(createPolytope('cell24').name).toBe('cell24');
  });
});

describe('第五章 截面行为', () => {
  const C16 = createCell16();
  const C24 = createCell24();

  it('十六胞体顶点正对 W：每个截面（0 < |w₀| < 1）都是正八面体 6v12e8f', () => {
    for (const w0 of [-0.9, -0.5, -0.1, 0.1, 0.5, 0.9]) {
      const s = sig(C16, {}, w0);
      expect([s.vertices, s.edges, s.faces]).toEqual([6, 12, 8]);
      expect(math.sectionName(s)).toBe('八面体');
    }
  });

  it('十六胞体一般姿态：顶端附近仍是八面体（顶点形），正中不是', () => {
    expect(math.sectionName(sig(C16, { XW: d2r(30), YW: d2r(20) }, 0.8))).toBe('八面体');
    const mid = sig(C16, { XW: d2r(30), YW: d2r(20) }, 0.1);
    expect(mid.vertices).not.toBe(6);
  });

  it('二十四胞体胞正对 W（单位姿态）：截面是截角八面体 24v36e14f（6 个四边形 + 8 个六边形）', () => {
    const s = sig(C24, {}, 0.4);
    expect([s.vertices, s.edges, s.faces]).toEqual([24, 36, 14]);
    expect(s.faceSizes).toEqual([4, 4, 4, 4, 4, 4, 6, 6, 6, 6, 6, 6, 6, 6]);
  });

  it('二十四胞体顶点正对 W（XW 45°）：顶端附近截面是立方体 8v12e6f（顶点形）', () => {
    for (const w0 of [0.9, 1.1, 1.3]) {
      const s = sig(C24, { XW: d2r(45) }, w0);
      expect([s.vertices, s.edges]).toEqual([8, 12]);
      expect(s.faceSizes).toEqual([4, 4, 4, 4, 4, 4]);
    }
    // 胞正对 W 时任何 w₀ 都不是立方体
    for (let w0 = 0.05; w0 < 1; w0 += 0.1) expect(sig(C24, {}, w0).vertices).not.toBe(8);
  });

  it('超立方体的截面签名在泛型胞实现下不变（回归）', () => {
    const T = createTesseract();
    expect(math.sectionName(sig(T, {}, 0))).toBe('长方体');
    expect(math.sectionName(sig(T, { YW: d2r(40), ZW: d2r(30) }, 1.2))).toBe('三棱柱');
    expect(math.sectionName(sig(T, { XW: d2r(35), YW: d2r(40), ZW: d2r(30) }, -1.6))).toBe('四面体');
  });
});

describe('第五章 关卡与状态机', () => {
  const L13 = LEVELS.find((l) => l.id === 'sixteen') as LevelDef;
  const L15 = LEVELS.find((l) => l.id === 'symmetry') as LevelDef;
  const I = math.identityRotation();
  const frame = (rotation: math.Rotation4D, sliceW0: number | null, playerPosition: math.Vec3 = [0, 0, 5]) => ({ dt: 0.1, rotation, playerPosition, sliceW0, rotatedW: true });

  it('第五章结构：三关、每关指定多胞体、至少一关 16-cell 与一关 24-cell、章末关有 anyVertex 桥', () => {
    const ch = CHAPTERS[4];
    expect(ch.index).toBe(5);
    expect(ch.levels.map((l) => l.id)).toEqual(['sixteen', 'twentyfour', 'symmetry']);
    const kinds = new Set(ch.levels.map((l) => l.core.polytope));
    expect(kinds.has('cell16')).toBe(true);
    expect(kinds.has('cell24')).toBe(true);
    expect(L15.bridges[0].anyVertex).toBe(true);
    for (const lv of ch.levels) expect(lv.slice?.enabled).toBe(true);
  });

  it('Sixteen：初始姿态顶端是八面体但 w₀ 不在正中 → 不激活；转回单位姿态后正中八面体激活、闸门开', () => {
    const P = createCell16();
    const s = new PuzzleSession(L13, P);
    const start = L13.core.initialRotation;
    for (let i = 0; i < 6; i++) s.update(frame(start, 0.8));
    expect(math.sectionName(s.section as math.SectionSignature)).toBe('八面体');
    expect(s.nodes[0].active).toBe(false);
    for (let i = 0; i < 6; i++) s.update(frame(start, 0.1));
    expect(s.nodes[0].active).toBe(false);
    for (let i = 0; i < 6; i++) s.update(frame(I, 0.1));
    expect(s.nodes[0].active).toBe(true);
    expect(s.gates[0].open).toBe(true);
    expect(s.exitReady).toBe(true);
  });

  it('Sixteen：XW = 90° 也是顶点正对 W（另一个顶点），同样可解', () => {
    const s = new PuzzleSession(L13, createCell16());
    for (let i = 0; i < 6; i++) s.update(frame({ ...I, XW: d2r(90) }, 0.15));
    expect(s.nodes[0].active).toBe(true);
  });

  it('Symmetry：anyVertex 桥在 YZ 多转 90° 后仍然可解（另一个顶点落到锚点）', () => {
    const P = createCell24();
    const s = new PuzzleSession(L15, P);
    const sol = L15.bridges[0].solution;
    const alt = { ...sol, YZ: sol.YZ + Math.PI / 2 };
    expect(s.evaluate(L15.bridges[0], sol).satisfied).toBe(true);
    expect(s.evaluate(L15.bridges[0], alt).satisfied).toBe(true);
    // 但不是任意角度都行
    expect(s.evaluate(L15.bridges[0], { ...sol, YZ: sol.YZ + d2r(45) }).satisfied).toBe(false);
  });
});
