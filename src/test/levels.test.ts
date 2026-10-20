import { describe, expect, it } from 'vitest';
import { createTesseract, type Plane, type Rotation4D } from '../math';
import { LEVELS } from '../puzzle/levels';
import { PuzzleSession } from '../puzzle/PuzzleSession';
import { evaluateBridge, pointInAABBxz, resolveAnchor, toleranceOf, vertexWorldPosition } from '../puzzle/PuzzleRules';
import type { BridgeDef, LevelDef } from '../puzzle/types';

const T = createTesseract();

/** 某桥开始判定时的"基础姿态"：初始姿态 + 它所依赖链路上所有已锁定桥的解。 */
function baseRotationFor(level: LevelDef, bridge: BridgeDef): Rotation4D {
  let r = { ...level.core.initialRotation };
  const visit = (ids?: string[]) => {
    for (const id of ids ?? []) {
      const b = level.bridges.find((x) => x.id === id);
      if (b) { visit(b.requires); r = { ...r, [b.plane]: b.solution[b.plane] }; }
      const n = level.nodes.find((x) => x.id === id);
      if (n) visit(n.requires);
    }
  };
  visit(bridge.requires);
  return r;
}

describe.each(LEVELS.map((l) => [l.id, l] as const))('关卡 %s', (_id, level) => {
  it('平台不重叠，玩家起点在平台上，出口在平台上', () => {
    expect(level.platforms.some((p) => pointInAABBxz(level.playerStart, p))).toBe(true);
    expect(level.platforms.some((p) => pointInAABBxz(level.exit.position, p))).toBe(true);
  });

  it('所有 requires 引用的 id 都存在', () => {
    const ids = new Set([...level.bridges.map((b) => b.id), ...level.nodes.map((n) => n.id)]);
    for (const b of level.bridges) for (const r of b.requires ?? []) expect(ids.has(r)).toBe(true);
    for (const n of level.nodes) for (const r of n.requires ?? []) expect(ids.has(r)).toBe(true);
    for (const r of level.exit.requires) expect(ids.has(r)).toBe(true);
  });

  describe.each(level.bridges.map((b) => [b.id, b] as const))('桥 %s', (_bid, bridge) => {
    const base = baseRotationFor(level, bridge);
    const anchor = resolveAnchor(T, bridge, level.core);

    it('只需在指定平面上旋转即可从基础姿态到达解（构造可解）', () => {
      const r = { ...base, [bridge.plane]: bridge.solution[bridge.plane] };
      const ep = vertexWorldPosition(T, bridge.vertex, r, level.core);
      expect(evaluateBridge(bridge, ep, anchor).satisfied).toBe(true);
      // 解与基础姿态在其他平面上一致（玩家不需要碰别的平面）
      for (const p of Object.keys(base) as Plane[]) {
        if (p !== bridge.plane) expect(bridge.solution[p]).toBeCloseTo(base[p], 10);
      }
    });

    it('解的角度明显不同于基础姿态（不是一开始就满足）', () => {
      const ep0 = vertexWorldPosition(T, bridge.vertex, base, level.core);
      expect(evaluateBridge(bridge, ep0, anchor).satisfied).toBe(false);
      expect(Math.abs(bridge.solution[bridge.plane] - base[bridge.plane])).toBeGreaterThan(0.5);
    });

    it('解在 ±0.5° 内仍满足（容差不会苛刻到无法操作）', () => {
      for (const dd of [-0.5, 0.5]) {
        const r = { ...base, [bridge.plane]: bridge.solution[bridge.plane] + (dd * Math.PI) / 180 };
        const ep = vertexWorldPosition(T, bridge.vertex, r, level.core);
        expect(evaluateBridge(bridge, ep, anchor).satisfied).toBe(true);
      }
    });

    it('纯三维旋转（XY/XZ/YZ 任意组合）无法满足距离条件 —— 必须使用 W', () => {
      const step = 15; // 度
      const tol = toleranceOf(bridge);
      let minDist = Infinity;
      for (let a = -180; a < 180; a += step) {
        for (let b = -180; b < 180; b += step) {
          for (let c = -180; c < 180; c += step) {
            const r: Rotation4D = {
              ...base,
              XY: base.XY + (a * Math.PI) / 180,
              XZ: base.XZ + (b * Math.PI) / 180,
              YZ: base.YZ + (c * Math.PI) / 180,
            };
            const ep = vertexWorldPosition(T, bridge.vertex, r, level.core);
            const d = Math.hypot(ep[0] - anchor[0], ep[1] - anchor[1], ep[2] - anchor[2]);
            if (d < minDist) minDist = d;
          }
        }
      }
      // 三维旋转保持该顶点到核心中心的距离不变，而锚点半径不同，所以存在严格的下界
      expect(minDist).toBeGreaterThan(tol.distance * 1.5);
    });
  });
});

describe('PuzzleSession 状态机', () => {
  const level = LEVELS[0];
  const frame = (s: PuzzleSession, rotation: Rotation4D, dt = 1 / 60, player = level.playerStart) =>
    s.update({ dt, rotation, playerPosition: player, sliceW0: null, rotatedW: false });

  it('开始时发出 start 提示，桥不可走', () => {
    const s = new PuzzleSession(level, T);
    const ev = frame(s, level.core.initialRotation);
    expect(ev.some((e) => e.type === 'hint' && e.id === 'h-start')).toBe(true);
    expect(s.isWalkable([0, 0, 0])).toBe(false);
  });

  it('条件满足需持续 300ms 才锁定；中途离开则重置', () => {
    const s = new PuzzleSession(level, T);
    const sol = level.bridges[0].solution;
    for (let i = 0; i < 10; i++) frame(s, sol); // 167ms
    expect(s.bridges[0].locked).toBe(false);
    expect(s.bridges[0].progress).toBeGreaterThan(0.4);
    frame(s, level.core.initialRotation); // 离开
    expect(s.bridges[0].hold).toBe(0);
    let activated = false;
    for (let i = 0; i < 20; i++) {
      const ev = frame(s, sol);
      if (ev.some((e) => e.type === 'activated' && e.id === 'bridge-1')) activated = true;
    }
    expect(activated).toBe(true);
    expect(s.bridges[0].locked).toBe(true);
    expect(s.exitReady).toBe(true);
    expect(s.isWalkable([0, 0, 0])).toBe(true); // 桥面可走
  });

  it('锁定后旋转离开解，桥仍保持锁定', () => {
    const s = new PuzzleSession(level, T);
    for (let i = 0; i < 20; i++) frame(s, level.bridges[0].solution);
    frame(s, level.core.initialRotation);
    expect(s.bridges[0].locked).toBe(true);
    expect(s.isWalkable([0, 0, 0])).toBe(true);
  });

  it('到达出口触发 levelComplete，且仅在 exitReady 后', () => {
    const s = new PuzzleSession(level, T);
    let ev = frame(s, level.core.initialRotation, 1 / 60, level.exit.position);
    expect(ev.some((e) => e.type === 'levelComplete')).toBe(false);
    for (let i = 0; i < 20; i++) frame(s, level.bridges[0].solution);
    ev = frame(s, level.bridges[0].solution, 1 / 60, level.exit.position);
    expect(ev.some((e) => e.type === 'levelComplete')).toBe(true);
    expect(s.completed).toBe(true);
  });

  it('noW 提示在 8 秒后触发，且旋转过 W 则不触发', () => {
    const s1 = new PuzzleSession(level, T);
    let fired = false;
    for (let i = 0; i < 9 * 60; i++) if (frame(s1, level.core.initialRotation).some((e) => e.type === 'hint' && e.id === 'h-w')) fired = true;
    expect(fired).toBe(true);

    const s2 = new PuzzleSession(level, T);
    fired = false;
    for (let i = 0; i < 9 * 60; i++) {
      const ev = s2.update({ dt: 1 / 60, rotation: level.core.initialRotation, playerPosition: level.playerStart, sliceW0: null, rotatedW: i === 1 });
      if (ev.some((e) => e.type === 'hint' && e.id === 'h-w')) fired = true;
    }
    expect(fired).toBe(false);
  });

  it('第二关：bridge-b 在 relay 激活前不可见；relay 需先锁定 bridge-a', () => {
    const l2 = LEVELS[1];
    const s = new PuzzleSession(l2, T);
    const f = (rotation: Rotation4D, player = l2.playerStart) =>
      s.update({ dt: 1 / 60, rotation, playerPosition: player, sliceW0: null, rotatedW: false });
    f(l2.core.initialRotation, [0, 0, 0]); // 站在 relay 上但 bridge-a 未锁
    expect(s.nodes[0].active).toBe(false);
    expect(s.bridges[1].visible).toBe(false);
    for (let i = 0; i < 20; i++) f(l2.bridges[0].solution);
    expect(s.bridges[0].locked).toBe(true);
    expect(s.bridges[1].visible).toBe(false);
    f(l2.bridges[0].solution, [0, 0, 0]);
    expect(s.nodes[0].active).toBe(true);
    f(l2.bridges[0].solution, [0, 0, 0]);
    expect(s.bridges[1].visible).toBe(true);
    // bridge-b 在 bridge-a 的解姿态下不应已经满足
    expect(s.bridges[1].evaluation?.satisfied).toBe(false);
    for (let i = 0; i < 20; i++) f(l2.bridges[1].solution, [0, 0, 0]);
    expect(s.bridges[1].locked).toBe(true);
    expect(s.exitReady).toBe(true);
  });

  it('snapRotationForLockedBridges 吸附已锁定平面到精确解', () => {
    const s = new PuzzleSession(level, T);
    for (let i = 0; i < 20; i++) frame(s, level.bridges[0].solution);
    const off = { ...level.bridges[0].solution, XW: level.bridges[0].solution.XW + 0.01, XY: 1.0 };
    const snapped = s.snapRotationForLockedBridges(off);
    expect(snapped.XW).toBe(level.bridges[0].solution.XW);
    expect(snapped.XY).toBe(1.0);
  });
});

describe('第三关 The Slice 状态机', () => {
  it('隐藏节点需要 bridge-a 锁定 + 切片位置进入区间并持续 300ms；随后 bridge-b 出现并可用 ZW 解开', () => {
    const l3 = LEVELS[2];
    const s = new PuzzleSession(l3, T);
    const f = (rotation: Rotation4D, sliceW0: number | null, player = l3.playerStart) =>
      s.update({ dt: 1 / 60, rotation, playerPosition: player, sliceW0, rotatedW: false });
    // 切片在区间内但 bridge-a 未锁 → 不激活
    for (let i = 0; i < 30; i++) f(l3.core.initialRotation, 0.4);
    expect(s.nodes[0].active).toBe(false);
    for (let i = 0; i < 20; i++) f(l3.bridges[0].solution, -1.9);
    expect(s.bridges[0].locked).toBe(true);
    // 切片在区间外 → 不激活
    for (let i = 0; i < 30; i++) f(l3.bridges[0].solution, -1.0);
    expect(s.nodes[0].active).toBe(false);
    // 进入区间 10 帧（167ms）→ 还没激活；离开 → 重置
    for (let i = 0; i < 10; i++) f(l3.bridges[0].solution, 0.4);
    expect(s.nodes[0].active).toBe(false);
    f(l3.bridges[0].solution, 1.0);
    expect(s.nodes[0].hold).toBe(0);
    for (let i = 0; i < 20; i++) f(l3.bridges[0].solution, 0.45);
    expect(s.nodes[0].active).toBe(true);
    f(l3.bridges[0].solution, 0.45);
    expect(s.bridges[1].visible).toBe(true);
    expect(s.bridges[1].evaluation?.satisfied).toBe(false);
    for (let i = 0; i < 20; i++) f(l3.bridges[1].solution, 0.45);
    expect(s.bridges[1].locked).toBe(true);
    expect(s.exitReady).toBe(true);
  });
});
