import { describe, expect, it } from 'vitest';
import * as math from '../math';
import { createPolytope, createTesseract } from '../math';
import { CHAPTERS, isLastInChapter, nextChapter } from '../puzzle/chapters';
import { LEVEL_19, LEVEL_20, LEVEL_21, LEVELS } from '../puzzle/levels';
import { PuzzleSession } from '../puzzle/PuzzleSession';
import { Trail, trailColor, trailStats, trailTopDown, trailWProfile } from '../puzzle/trail';

const d2r = (x: number) => (x * Math.PI) / 180;
const I = math.identityRotation();
const T4 = createTesseract();
type Frame = { dt: number; rotation: math.Rotation4D; playerPosition: math.Vec3; sliceW0: number | null; rotatedW: boolean; playerW: number; projectionMode?: 'perspective' | 'orthographic'; projectionBlend?: number };
const frame = (o: Partial<Frame> & { rotation: math.Rotation4D }): Frame => ({ dt: 0.1, playerPosition: [0, 0, 0], sliceW0: null, rotatedW: true, playerW: 0, ...o });
const sig = (P: math.Polytope4, rot: math.Rotation4D, w0: number) => math.sectionSignature(P, math.sliceHyperplane(P, math.rotateAll(P.vertices, rot), w0));

describe('第七章 章节结构', () => {
  it('第七章是最后一章：三关、无后续章；LEVELS 共 21 关且序号连续', () => {
    const ch = CHAPTERS[6];
    expect(CHAPTERS.length).toBe(7);
    expect(ch.index).toBe(7);
    expect(ch.id).toBe('nexus');
    expect(ch.levels.map((l) => l.id)).toEqual(['echo', 'twolights', 'nexus']);
    expect(nextChapter(ch)).toBeUndefined();
    expect(isLastInChapter(LEVEL_21)).toBe(true);
    expect(LEVELS.length).toBe(21);
    LEVELS.forEach((l, i) => expect(l.index).toBe(i + 1));
  });

  it('终章每关都同时用到至少三章的机制（桥 / 截面节点或闸门 / W 层 / 投影）', () => {
    for (const l of CHAPTERS[6].levels) {
      const mech = [
        l.bridges.length > 0,
        l.nodes.some((n) => n.trigger.kind === 'shape'),
        !!l.playerW?.enabled && [...l.platforms, ...(l.gates ?? []).map((g) => g.walkable)].some((p) => (p.w ?? 0) !== 0),
        !!l.core.projection?.switchable,
      ].filter(Boolean).length;
      expect(mech).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('第七章 Echo（L19）', () => {
  it('双旋桥锁定后 YW ±30° 且 |w₀| ≈ 1.3 是三棱柱；回声室闸门开在 w = +1；出口要求 w = 0', () => {
    const s = new PuzzleSession(LEVEL_19, T4);
    const sol = LEVEL_19.bridges[0].solution;
    for (let i = 0; i < 5; i++) s.update(frame({ rotation: sol, playerPosition: [0, 0, 5] }));
    expect(s.bridges[0].locked).toBe(true);
    // 单独一个 W 平面（XW 已锁，YW = 0）：边缘仍是长方体，不是三棱柱
    for (let i = 0; i < 8; i++) s.update(frame({ rotation: sol, sliceW0: 1.3, playerPosition: [0, 0, -4] }));
    expect(s.nodes[0].active).toBe(false);
    const rot = { ...sol, YW: d2r(30) };
    for (let i = 0; i < 8; i++) s.update(frame({ rotation: rot, sliceW0: 1.3, playerPosition: [0, 0, -4] }));
    expect(math.sectionName(s.section as math.SectionSignature)).toBe('三棱柱');
    expect(s.nodes[0].active).toBe(true);
    expect(s.gates[0].open).toBe(true);
    expect(s.gates[0].def.walkable.w).toBe(1);
    // 回声节点在 w = +1：w = 0 站在同一位置不触发
    s.update(frame({ rotation: rot, sliceW0: 1.3, playerPosition: [0, 0, -6], playerW: 0 }));
    expect(s.nodes[1].active).toBe(false);
    s.update(frame({ rotation: rot, sliceW0: 1.3, playerPosition: [0, 0, -6], playerW: 1 }));
    expect(s.nodes[1].active).toBe(true);
    expect(s.exitReady).toBe(true);
    expect(s.update(frame({ rotation: rot, sliceW0: 1.3, playerPosition: LEVEL_19.exit.position, playerW: 1 })).some((e) => e.type === 'levelComplete')).toBe(false);
    expect(s.update(frame({ rotation: rot, sliceW0: 1.3, playerPosition: LEVEL_19.exit.position, playerW: 0 })).some((e) => e.type === 'levelComplete')).toBe(true);
  });
});

describe('第七章 Two Lights（L20）', () => {
  it('24-cell：立方体截面 → 闸门；w = −1 钥匙 → 桥出现；桥只在正交投影下可解', () => {
    const P = createPolytope('cell24');
    const s = new PuzzleSession(LEVEL_20, P);
    const cubeRot = { ...I, XW: d2r(45) };
    for (let i = 0; i < 8; i++) s.update(frame({ rotation: cubeRot, sliceW0: 1.1, playerPosition: [0, 0, 6], projectionMode: 'perspective', projectionBlend: math.blendOf('perspective') }));
    expect(s.nodes[0].active).toBe(true);
    expect(s.gates[0].open).toBe(true);
    expect(s.bridges[0].visible).toBe(false);
    s.update(frame({ rotation: cubeRot, sliceW0: 1.1, playerPosition: [0, 0, 0], playerW: -1, projectionMode: 'perspective', projectionBlend: math.blendOf('perspective') }));
    expect(s.nodes[1].active).toBe(true);
    const b = LEVEL_20.bridges[0];
    expect(b.projection).toBe('orthographic');
    expect(b.anyVertex).toBe(true);
    expect(s.evaluate(b, b.solution, math.blendOf('orthographic')).satisfied).toBe(true);
    expect(s.evaluate(b, b.solution, math.blendOf('perspective')).satisfied).toBe(false);
  });
});

describe('第七章 The Nexus（L21）', () => {
  const base = LEVEL_21.core.initialRotation;
  const north = LEVEL_21.bridges[0];
  const south = LEVEL_21.bridges[1];
  const locked = north.solution;

  it('五棱柱 10v · 15e：北桥锁定前（只有 YW）找不到；锁定后 YW ±20–30°、|w₀| ≤ 0.5 可找到', () => {
    let found = false;
    for (let yw = -90; yw <= 90; yw += 5) for (let w0 = -2; w0 <= 2; w0 += 0.1) if (math.sectionName(sig(T4, { ...base, YW: d2r(yw) }, w0)) === '五棱柱') found = true;
    expect(found).toBe(false);
    for (const yw of [-30, -20, 20, 30]) {
      const ws = [];
      for (let w0 = -1; w0 <= 1; w0 += 0.05) if (math.sectionName(sig(T4, { ...locked, YW: d2r(yw) }, w0)) === '五棱柱') ws.push(w0);
      expect(ws.length).toBeGreaterThan(10);
      expect(Math.max(...ws.map(Math.abs))).toBeLessThanOrEqual(0.8);
    }
    // 南桥解姿态下（YW −75 / ZW −45）截面仍然存在（8v12e 的楔形，未命名），不影响流程
    expect(sig(T4, south.solution, 1.3)?.vertices).toBe(8);
  });

  it('完整流程：北桥 → n-node → 五棱柱 → 西闸门 → w-node；东走廊 w=+1 → e-node（w=−1）；正交下 YW/ZW 双旋南桥 → 出口', () => {
    const s = new PuzzleSession(LEVEL_21, T4);
    const persp = { projectionMode: 'perspective' as const, projectionBlend: math.blendOf('perspective') };
    const ortho = { projectionMode: 'orthographic' as const, projectionBlend: math.blendOf('orthographic') };
    // 1. 北桥
    for (let i = 0; i < 5; i++) s.update(frame({ rotation: locked, playerPosition: [0, 0, 0], ...persp }));
    expect(s.bridges[0].locked).toBe(true);
    expect(s.nodes.find((n) => n.def.id === 'penta')!.visible).toBe(true);
    s.update(frame({ rotation: locked, playerPosition: [0, 0, -7], ...persp }));
    expect(s.nodes.find((n) => n.def.id === 'n-node')!.active).toBe(true);
    // 2. 西：五棱柱
    const pentaRot = { ...locked, YW: d2r(25) };
    for (let i = 0; i < 8; i++) s.update(frame({ rotation: pentaRot, sliceW0: 0.2, playerPosition: [0, 0, 0], ...persp }));
    expect(math.sectionName(s.section as math.SectionSignature)).toBe('五棱柱');
    expect(s.gates[0].open).toBe(true);
    s.update(frame({ rotation: pentaRot, sliceW0: 0.2, playerPosition: [-7, 0, 0], ...persp }));
    expect(s.nodes.find((n) => n.def.id === 'w-node')!.active).toBe(true);
    // 3. 东：走廊在 w=+1，节点在 w=−1
    expect(s.isWalkable([4, 0, 0], 0, 1)).toBe(true);
    expect(s.isWalkable([4, 0, 0], 0, 0)).toBe(false);
    expect(s.isWalkable([7, 0, 0], 0, -1)).toBe(true);
    expect(s.bridges[1].visible).toBe(false);
    s.update(frame({ rotation: pentaRot, sliceW0: 0.2, playerPosition: [7, 0, 0], playerW: 0, ...persp }));
    expect(s.nodes.find((n) => n.def.id === 'e-node')!.active).toBe(false);
    s.update(frame({ rotation: pentaRot, sliceW0: 0.2, playerPosition: [7, 0, 0], playerW: -1, ...persp }));
    expect(s.nodes.find((n) => n.def.id === 'e-node')!.active).toBe(true);
    s.update(frame({ rotation: pentaRot, sliceW0: 0.2, playerPosition: [7, 0, 0], playerW: -1, ...persp })); // 桥的可见性在下一帧刷新
    expect(s.bridges[1].visible).toBe(true);
    // 4. 南桥：透视下不行，正交下行
    for (let i = 0; i < 5; i++) s.update(frame({ rotation: south.solution, playerPosition: [0, 0, 0], ...persp }));
    expect(s.bridges[1].locked).toBe(false);
    for (let i = 0; i < 5; i++) s.update(frame({ rotation: south.solution, playerPosition: [0, 0, 0], ...ortho }));
    expect(s.bridges[1].locked).toBe(true);
    expect(s.exitReady).toBe(true);
    expect(s.update(frame({ rotation: south.solution, playerPosition: LEVEL_21.exit.position, ...ortho })).some((e) => e.type === 'levelComplete')).toBe(true);
  });
});

describe('第七章 轨迹（trail）', () => {
  it('Trail 按最小步长采样；统计路程、W 位移、层数、时长', () => {
    const tr = new Trail();
    tr.push([0, 0, 0], 0, 0);
    tr.push([0.05, 0, 0], 0, 0.1); // 太近，不记
    tr.push([1, 0, 0], 0, 0.5);
    tr.push([1, 0, 0], 1, 1.0); // 只有 w 变
    tr.push([1, 0, 3], 1, 2.0);
    tr.push([1, 0, 3], -1, 3.0);
    expect(tr.samples.length).toBe(5);
    const st = tr.stats();
    expect(st.length3).toBeCloseTo(4, 6);
    expect(st.wTravel).toBeCloseTo(3, 6);
    expect(st.layers).toBe(3);
    expect(st.duration).toBeCloseTo(3, 6);
    expect(st.wMin).toBe(-1);
    expect(st.wMax).toBe(1);
    tr.reset();
    expect(tr.samples.length).toBe(0);
    expect(trailStats([]).layers).toBe(0);
  });

  it('俯视图映射等比缩放并居中；W 剖面横轴归一化到 [0,1]；颜色随 w 符号变化', () => {
    const samples = [
      { x: -4, y: 0, z: -2, w: 0, t: 0 },
      { x: 4, y: 0, z: -2, w: 1, t: 1 },
      { x: 4, y: 0, z: 2, w: -1, t: 2 },
    ];
    const { points, d, scale } = trailTopDown(samples, 200, 100, 10);
    expect(points.length).toBe(3);
    expect(scale).toBeCloseTo(Math.min(180 / 8, 80 / 4), 6); // = 20，z 方向是瓶颈
    // z 方向占满（80 高、上下各留 10），x 方向 8 × 20 = 160 宽、左右各留 20 居中
    expect(points[0].x).toBeCloseTo(20, 6);
    expect(points[1].x).toBeCloseTo(180, 6);
    expect(points[0].y).toBeCloseTo(10, 6);
    expect(points[2].y).toBeCloseTo(90, 6);
    expect(d.startsWith('M')).toBe(true);
    expect(trailTopDown([], 10, 10).points.length).toBe(0);
    const prof = trailWProfile(samples);
    expect(prof[0].s).toBe(0);
    expect(prof[prof.length - 1].s).toBeCloseTo(1, 9);
    expect(prof.map((p) => p.w)).toEqual([0, 1, -1]);
    expect(trailColor(0)).toBe('rgb(0,229,255)');
    expect(trailColor(1.5)).toBe('rgb(185,103,255)');
    expect(trailColor(-1.5)).toBe('rgb(255,209,102)');
  });
});
