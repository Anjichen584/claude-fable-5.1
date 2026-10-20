import { describe, expect, it } from 'vitest';
import * as math from '../math';
import { createTesseract } from '../math';
import { CHAPTERS } from '../puzzle/chapters';
import { LEVEL_16, LEVEL_17, LEVEL_18, LEVELS } from '../puzzle/levels';
import { PuzzleSession } from '../puzzle/PuzzleSession';
import { boxesAtW, footprintWalkable, nearestLayer, settleW, slideW } from '../puzzle/PuzzleRules';
import { W_LAYER_HALF, type AABB, type LevelDef } from '../puzzle/types';

const d2r = (x: number) => (x * Math.PI) / 180;
const I = math.identityRotation();
const P = createTesseract();

describe('第六章 W 层规则', () => {
  const boxes: AABB[] = [
    { min: [-1, -0.2, -1], max: [1, 0, 1] },
    { min: [-1, -0.2, -1], max: [1, 0, 1], w: 1 },
    { min: [-1, -0.2, -1], max: [1, 0, 1], w: -2 },
  ];

  it('boxesAtW：|w − box.w| ≤ 0.5 视为同层；未声明 w 的盒子在 w = 0 层', () => {
    expect(boxesAtW(boxes, 0).length).toBe(1);
    expect(boxesAtW(boxes, 0.5).length).toBe(2); // 0 与 1 都在半层内
    expect(boxesAtW(boxes, 1).map((b) => b.w)).toEqual([1]);
    expect(boxesAtW(boxes, -1.4).length).toBe(0);
    expect(boxesAtW(boxes, -2).map((b) => b.w)).toEqual([-2]);
    expect(W_LAYER_HALF).toBe(0.5);
  });

  it('session.walkableAt / isWalkable 按层过滤；reach 节点与出口都要求同层', () => {
    const s = new PuzzleSession(LEVEL_17, P);
    // 中间平台 (0,0,0)：w=0 有、w=−1 有（暗室）、w=+1 有（走廊末端）
    expect(s.isWalkable([0, 0, 0], 0, 0)).toBe(true);
    expect(s.isWalkable([0, 0, 0], 0, -1)).toBe(true);
    expect(s.isWalkable([0, 0, 0], 0, 1)).toBe(true);
    // 起点平台只有 w=0 与 w=+1 走廊（x ∈ [−1,1]）
    expect(s.isWalkable([0, 0, 4.5], 0, -1)).toBe(false);
    expect(s.isWalkable([1.8, 0, 4.5], 0, 1)).toBe(false);
    expect(s.walkableAt(-1).length).toBe(1);

    const frame = (playerW: number, playerPosition: math.Vec3) => ({ dt: 0.1, rotation: I, playerPosition, sliceW0: null, rotatedW: false, playerW });
    // 站在节点位置但在 w = 0 → 不触发；w = −1 → 触发
    for (let i = 0; i < 3; i++) s.update(frame(0, [0, 0, 0]));
    expect(s.nodes[0].active).toBe(false);
    s.update(frame(-1, [0, 0, 0]));
    expect(s.nodes[0].active).toBe(true);
    // 桥锁定后出口就绪；在 w = 1 层到达出口位置不算，w = 0 才完成
    const sol = LEVEL_17.bridges[0].solution;
    for (let i = 0; i < 5; i++) s.update({ ...frame(0, [0, 0, 0]), rotation: sol, rotatedW: true });
    expect(s.exitReady).toBe(true);
    const evWrong = s.update(frame(1, LEVEL_17.exit.position));
    expect(evWrong.some((e) => e.type === 'levelComplete')).toBe(false);
    const evRight = s.update(frame(0, LEVEL_17.exit.position));
    expect(evRight.some((e) => e.type === 'levelComplete')).toBe(true);
  });
});

describe('第六章 沿 W 滑动（slideW，与 PlayerController 同一逻辑）', () => {
  const R = 0.22;
  const SPEED = 1.4;
  /** 模拟按住 I（dir=+1）或 K（dir=−1）frames 帧（60fps），返回最终 w 与是否被挡 */
  const hold = (level: LevelDef, pos: math.Vec3, w: number, dir: 1 | -1, frames: number) => {
    const all = new PuzzleSession(level, P).walkable();
    const [lo, hi] = level.playerW!.range;
    let blocked = false;
    for (let i = 0; i < frames; i++) {
      const target = Math.min(hi, Math.max(lo, w + (dir * SPEED) / 60));
      const r = slideW(pos, R, w, target, all);
      w = r.w;
      blocked = r.blocked;
    }
    return { w, blocked };
  };

  it('起点平台后端（无 w=+1 覆盖）按 I 只能在本层的半层带内挪动（≤ 0.5），随后 blocked', () => {
    const r = hold(LEVEL_16, [0, 0, 6.5], 0, 1, 60);
    expect(r.w).toBeLessThanOrEqual(0.5 + 1e-9);
    expect(r.w).toBeGreaterThan(0.4);
    expect(r.blocked).toBe(true);
    // 即使停在 0.5，也仍然只属于 w=0 层
    const all = new PuzzleSession(LEVEL_16, P).walkable();
    expect(boxesAtW(all, r.w).map((b) => b.w ?? 0)).toEqual([0, 0]);
  });

  it('走廊覆盖处按 I 滑到 w = +1 层（最多 1.5，上面没有 w=2 地面）；按 K 滑回并吸附到 0', () => {
    const up = hold(LEVEL_16, [0, 0, 3.2], 0, 1, 120); // 2 秒 × 1.4/s
    expect(up.w).toBeCloseTo(1.5, 1);
    const down = hold(LEVEL_16, [0, 0, 3.2], up.w, -1, 200);
    // 按住 K 会越过 0 到 −0.5（仍是 w=0 层的半层带），松手后回弹到 0
    expect(down.w).toBeLessThan(0);
    expect(down.w).toBeGreaterThanOrEqual(-0.5 - 1e-9);
    const all = new PuzzleSession(LEVEL_16, P).walkable();
    expect(nearestLayer(all, down.w)).toBe(0);
    let w = down.w;
    for (let i = 0; i < 60; i++) w = settleW(w, all, 2.8, 1 / 60);
    expect(w).toBe(0);
    // 在 1.3 处松手 → 回到 1
    expect(nearestLayer(all, 1.3)).toBe(1);
  });

  it('不能跳层：w=0 与 w=2 之间没有 w=1 的地面时无法从 0 直达 2；三层叠放（L18 起点）可以爬到 2', () => {
    const level: LevelDef = {
      ...LEVEL_16,
      platforms: [
        { min: [-2, -0.2, -2], max: [2, 0, 2] },
        { min: [-2, -0.2, -2], max: [2, 0, 2], w: 2 },
      ],
      playerW: { enabled: true, initial: 0, range: [-3, 3] },
    };
    const r = hold(level, [0, 0, 0], 0, 1, 180);
    expect(r.w).toBeLessThanOrEqual(0.5 + 1e-9);
    expect(r.blocked).toBe(true);
    const r2 = hold(LEVEL_18, [0, 0, 6], 0, 1, 180);
    expect(r2.w).toBeGreaterThanOrEqual(2);
  });

  it('沿 W 后，行走的可用地面只剩当前层（走到走廊外会被挡住）', () => {
    const r = hold(LEVEL_16, [0, 0, 3.2], 0, 1, 60);
    expect(r.w).toBeGreaterThan(0.9);
    const all = new PuzzleSession(LEVEL_16, P).walkable();
    expect(footprintWalkable([1.7, 0, 3.2], 0.3, boxesAtW(all, 0))).toBe(true);
    expect(footprintWalkable([1.7, 0, 3.2], 0.3, boxesAtW(all, r.w))).toBe(false);
  });
});

describe('第六章 关卡与章节', () => {
  it('章节结构：三关、都启用 playerW、章末关切片跟随玩家；LEVELS 共 18 关', () => {
    const ch = CHAPTERS[5];
    expect(ch.index).toBe(6);
    expect(ch.id).toBe('crossing');
    expect(ch.levels.map((l) => l.id)).toEqual(['stepaside', 'through', 'youaretheslice']);
    for (const l of ch.levels) expect(l.playerW?.enabled).toBe(true);
    expect(LEVEL_18.playerW?.sliceFollows).toBe(true);
    expect(LEVEL_18.slice?.enabled).toBe(true);
    expect(LEVELS.length).toBe(18);
  });

  it('每关的分层平台：玩家起点在初始 w 层；出口所在层有地面；跨层处至少有一块重叠区域', () => {
    for (const l of [LEVEL_16, LEVEL_17, LEVEL_18]) {
      const s = new PuzzleSession(l, P);
      const w0 = l.playerW!.initial;
      expect(s.isWalkable(l.playerStart, 0, w0)).toBe(true);
      expect(s.isWalkable(l.exit.position, 0, l.exit.w ?? 0)).toBe(true);
      const layers = new Set(l.platforms.map((p) => p.w ?? 0));
      expect(layers.size).toBeGreaterThanOrEqual(2);
      // 相邻层之间在 xz 上有重叠（否则无法切换）
      const sorted = [...layers].sort((a, b) => a - b);
      for (let i = 1; i < sorted.length; i++) {
        const A = l.platforms.filter((p) => (p.w ?? 0) === sorted[i - 1]);
        const B = l.platforms.filter((p) => (p.w ?? 0) === sorted[i]);
        const overlap = A.some((a) => B.some((b) => a.min[0] < b.max[0] && b.min[0] < a.max[0] && a.min[2] < b.max[2] && b.min[2] < a.max[2]));
        expect(overlap).toBe(true);
      }
    }
  });

  it('Step Aside：三维里起点与出口平台不连通（w=0 层中间有缺口）', () => {
    const s = new PuzzleSession(LEVEL_16, P);
    expect(s.isWalkable([0, 0, 0], 0, 0)).toBe(false);
    expect(s.isWalkable([0, 0, 0], 0, 1)).toBe(true);
    s.update({ dt: 0.1, rotation: I, playerPosition: LEVEL_16.playerStart, sliceW0: null, rotatedW: false, playerW: 0 });
    expect(s.exitReady).toBe(true); // 出口无前置，难点只在走过去
  });

  it('You Are the Slice：三个 W 平面 + 玩家 w ≈ 1.6 → 四面体 → 闸门开；下到 w = 0 → 十二顶点 → 出口', () => {
    const s = new PuzzleSession(LEVEL_18, P);
    const rot = { ...I, XW: d2r(35), YW: d2r(40), ZW: d2r(30) };
    const frame = (playerW: number, playerPosition: math.Vec3, rotation = rot) => ({ dt: 0.1, rotation, playerPosition, sliceW0: playerW, rotatedW: true, playerW });
    // 单位姿态下 w₀ = 0 是立方体，twelve 还没出现（requires tetra）
    for (let i = 0; i < 8; i++) s.update(frame(0, [0, 0, 6], I));
    expect(s.nodes[0].active).toBe(false);
    expect(s.nodes[1].visible).toBe(false);
    expect(s.gates[0].open).toBe(false);
    // 爬到 w = 1.6：四面体
    for (let i = 0; i < 8; i++) s.update(frame(1.6, [0, 0, 6]));
    expect(math.sectionName(s.section as math.SectionSignature)).toBe('四面体');
    expect(s.nodes[0].active).toBe(true);
    expect(s.gates[0].open).toBe(true);
    expect(s.exitReady).toBe(false);
    // 闸门在 w = 2 层
    expect(s.isWalkable([0, 0, 0], 0, 2)).toBe(true);
    expect(s.isWalkable([0, 0, 0], 0, 0)).toBe(false);
    // 对岸下到 w = 0：十二顶点截面，出口就绪
    for (let i = 0; i < 8; i++) s.update(frame(0, [0, 0, -4.8]));
    expect(s.section?.vertices).toBe(12);
    expect(s.nodes[1].active).toBe(true);
    expect(s.exitReady).toBe(true);
    const ev = s.update(frame(0, LEVEL_18.exit.position));
    expect(ev.some((e) => e.type === 'levelComplete')).toBe(true);
  });
});
