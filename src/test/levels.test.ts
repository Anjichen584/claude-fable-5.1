import { describe, expect, it } from 'vitest';
import * as math from '../math';
import { createTesseract, type Plane, type Rotation4D, type Vec3 } from '../math';
import { LEVELS } from '../puzzle/levels';
import { PuzzleSession } from '../puzzle/PuzzleSession';
import { targetPoint, bridgePlanes, combineDualEvaluation, evaluateBridge, pointInAABBxz, resolveAnchor, resolveAnchor2, toleranceOf, vertexWorldPosition, type BridgeEvaluation } from '../puzzle/PuzzleRules';
import { PLANES } from '../math';
import { CHAPTERS, chapterOf, isLastInChapter, nextChapter } from '../puzzle/chapters';
import type { BridgeDef, LevelDef } from '../puzzle/types';

const T = createTesseract();

/** 某桥开始判定时的"基础姿态"：初始姿态 + 它所依赖链路上所有已锁定桥的解。 */
function baseRotationFor(level: LevelDef, bridge: BridgeDef): Rotation4D {
  let r = { ...level.core.initialRotation };
  const visit = (ids?: string[]) => {
    for (const id of ids ?? []) {
      const b = level.bridges.find((x) => x.id === id);
      if (b) {
        visit(b.requires);
        for (const p of bridgePlanes(b)) r = { ...r, [p]: b.solution[p] };
      }
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
    const ids = new Set([...level.bridges.map((b) => b.id), ...level.nodes.map((n) => n.id), ...(level.gates ?? []).map((g) => g.id)]);
    for (const b of level.bridges) for (const r of b.requires ?? []) expect(ids.has(r)).toBe(true);
    for (const n of level.nodes) for (const r of n.requires ?? []) expect(ids.has(r)).toBe(true);
    for (const g of level.gates ?? []) for (const r of g.requires) expect(ids.has(r)).toBe(true);
    for (const r of level.exit.requires) expect(ids.has(r)).toBe(true);
    // 每关必须有通路（桥或闸门），且出口的前置最终可达
    expect(level.bridges.length + (level.gates?.length ?? 0)).toBeGreaterThan(0);
  });

  describe.each(level.bridges.map((b) => [b.id, b] as const))('桥 %s', (_bid, bridge) => {
    const base = baseRotationFor(level, bridge);
    const anchor = resolveAnchor(T, bridge, level.core);
    const anchor2 = resolveAnchor2(T, bridge, level.core);
    const planes = bridgePlanes(bridge);
    const dual = bridge.vertex2 !== undefined;
    /** 第四章：对径顶点对（v, −v）只用一个平面，靠投影方式区分，不是"双旋"桥 */
    const antipodal = dual && bridge.plane === bridge.plane2;
    const blend = math.blendOf(bridge.projection ?? 'perspective');

    /** 与 PuzzleSession.evaluate 一致的完整评估（含双旋第二目标），在桥所要求的投影下 */
    const evalAt = (r: Rotation4D, b = blend): BridgeEvaluation => {
      const first = evaluateBridge(bridge, vertexWorldPosition(T, bridge.vertex, r, level.core, math.DEFAULT_PROJECTION, b), anchor);
      if (!dual) return first;
      const second = evaluateBridge(bridge, vertexWorldPosition(T, bridge.vertex2 as number, r, level.core, math.DEFAULT_PROJECTION, b), anchor2 as Vec3);
      return combineDualEvaluation(first, second);
    };
    const withSolution = (r: Rotation4D, delta = 0): Rotation4D => {
      let out = { ...r };
      for (const p of planes) out = { ...out, [p]: bridge.solution[p] + delta };
      return out;
    };

    it('只需在指定平面上旋转即可从基础姿态到达解（构造可解）', () => {
      expect(evalAt(withSolution(base)).satisfied).toBe(true);
      // 解与基础姿态在其他平面上一致（玩家不需要碰别的平面）
      for (const p of Object.keys(base) as Plane[]) {
        if (!planes.includes(p)) expect(bridge.solution[p]).toBeCloseTo(base[p], 10);
      }
    });

    it('解的角度明显不同于基础姿态（不是一开始就满足）', () => {
      expect(evalAt(base).satisfied).toBe(false);
      for (const p of planes) expect(Math.abs(bridge.solution[p] - base[p])).toBeGreaterThan(0.5);
    });

    it('解在 ±0.5° 内仍满足（容差不会苛刻到无法操作）', () => {
      for (const dd of [-0.5, 0.5]) {
        expect(evalAt(withSolution(base, (dd * Math.PI) / 180)).satisfied).toBe(true);
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
            const d = evalAt(r).distance; // 双旋桥取两个目标中的较大者
            if (d < minDist) minDist = d;
          }
        }
      }
      // 三维旋转保持顶点到核心中心的距离不变，而锚点半径不同，所以存在严格的下界
      expect(minDist).toBeGreaterThan(tol.distance * 1.5);
    });

    if (antipodal) {
      it('投影桥：在另一种投影下，指定平面任意角度（0.5° 步进）都无法同时满足两个目标', () => {
        const other = 1 - blend;
        for (const p of planes) {
          for (let k = -180; k < 180; k += 0.5) {
            const r = { ...base, [p]: base[p] + (k * Math.PI) / 180 };
            expect(evalAt(r, other).satisfied).toBe(false);
          }
        }
      });
    }

    if (dual && !antipodal) {
      it('双旋桥：任何单一平面的旋转（1° 步进，全部六个平面）都无法同时满足两个目标', () => {
        for (const p of PLANES) {
          for (let k = -180; k < 180; k += 1) {
            const r = { ...base, [p]: base[p] + (k * Math.PI) / 180 };
            expect(evalAt(r).satisfied).toBe(false);
          }
        }
      });

      if (typeof bridge.vertex !== 'number') {
        it('面心双手桥：目标 1 不随第二平面变化、目标 2 不随第一平面变化（严格解耦）', () => {
          const [p, q] = planes;
          for (const k of [-1.2, -0.4, 0.5, 1.4]) {
            const r1 = { ...bridge.solution, [q]: bridge.solution[q] + k };
            expect(evalAt(r1).primary?.distance ?? evalAt(r1).distance).toBeLessThan(1e-9);
            const r2 = { ...bridge.solution, [p]: bridge.solution[p] + k };
            expect(evalAt(r2).second?.distance).toBeLessThan(1e-9);
          }
        });
      }

      it('双旋桥：两个目标的锚点相距足够远（不会被误认为同一个）', () => {
        const a2 = anchor2 as Vec3;
        expect(Math.hypot(anchor[0] - a2[0], anchor[1] - a2[1], anchor[2] - a2[2])).toBeGreaterThan(0.8);
      });
    }

    if (level.core.linked && dual && planes.every((p) => (level.core.linked as Plane[]).includes(p))) {
      it('等角双旋：两个平面解角增量相等，且先后顺序不影响结果（正交平面可交换）', () => {
        const [p, q] = level.core.linked as [Plane, Plane];
        expect(bridge.solution[p] - base[p]).toBeCloseTo(bridge.solution[q] - base[q], 10);
        const rPQ = { ...base, [p]: bridge.solution[p], [q]: bridge.solution[q] };
        const ep = vertexWorldPosition(T, bridge.vertex, rPQ, level.core);
        const { applyRotation, rotate4D, projectPerspective, applyTilt } = math;
        // p、q 完全正交 → 两个旋转可交换（先 p 后 q 与先 q 后 p 结果一致）
        const pt = targetPoint(T, bridge.vertex);
        const v1 = rotate4D(rotate4D(pt, p, 0.7), q, 0.7);
        const v2 = rotate4D(rotate4D(pt, q, 0.7), p, 0.7);
        for (let i = 0; i < 4; i++) expect(v1[i]).toBeCloseTo(v2[i], 12);
        // 且 vertexWorldPosition 与手工 applyRotation + 投影 + 倾斜一致
        const proj = applyTilt(projectPerspective(applyRotation(pt, rPQ)), level.core.tilt);
        for (let i = 0; i < 3; i++) expect(proj[i] * level.core.scale + level.core.position[i]).toBeCloseTo(ep[i], 10);
      });
    }
  });
});

describe('章节结构', () => {
  it('每章至少 3 关，关卡全局序号连续且按章分组', () => {
    let expected = 1;
    for (const ch of CHAPTERS) {
      expect(ch.levels.length).toBeGreaterThanOrEqual(3);
      for (const lv of ch.levels) {
        expect(lv.index).toBe(expected++);
        expect(lv.chapter).toBe(ch.index);
        expect(chapterOf(lv)).toBe(ch);
      }
      expect(isLastInChapter(ch.levels[ch.levels.length - 1])).toBe(true);
      expect(isLastInChapter(ch.levels[0])).toBe(false);
    }
    expect(expected - 1).toBe(LEVELS.length);
    expect(nextChapter(CHAPTERS[0])).toBe(CHAPTERS[1]);
    expect(nextChapter(CHAPTERS[CHAPTERS.length - 1])).toBeUndefined();
  });

  it('第三章每关只用形状节点 + 闸门，不用锚点桥；切片默认开启', () => {
    for (const lv of CHAPTERS[2].levels) {
      expect(lv.bridges).toHaveLength(0);
      expect(lv.gates?.length ?? 0).toBeGreaterThan(0);
      expect(lv.nodes.every((n) => n.trigger.kind === 'shape')).toBe(true);
      expect(lv.slice?.enabled).toBe(true);
    }
  });

  it('第四章每关可切换投影，每座桥都是对径顶点对且声明了 projection；至少一座透视桥与一座正交桥', () => {
    const ch = CHAPTERS[3];
    expect(ch.index).toBe(4);
    expect(ch.levels.map((l) => l.id)).toEqual(['shadow', 'silhouette', 'twotruths']);
    const modes = new Set<string>();
    for (const lv of ch.levels) {
      expect(lv.core.projection?.switchable).toBe(true);
      for (const b of lv.bridges) {
        expect(b.projection).toBeDefined();
        modes.add(b.projection as string);
        expect(typeof b.vertex).toBe('number');
        const v = T.vertices[b.vertex as number];
        const v2 = T.vertices[b.vertex2 as number];
        for (let k = 0; k < 4; k++) expect(v2[k]).toBe(-v[k]);
      }
      // 开局投影与第一座桥要求的投影相反：必须切换才能解
      expect(lv.core.projection?.initial).not.toBe(lv.bridges[0].projection);
    }
    expect(modes).toEqual(new Set(['perspective', 'orthographic']));
  });

  it('第二章每关至少有一座双旋桥；等角关的 linked 平面正交且与桥的平面一致', () => {
    for (const lv of CHAPTERS[1].levels) {
      expect(lv.bridges.some((b) => b.vertex2 !== undefined)).toBe(true);
      if (lv.core.linked) {
        const [p, q] = lv.core.linked;
        expect(new Set([...p, ...q]).size).toBe(4); // 四个不同轴 → 完全正交
        expect(lv.bridges.some((b) => bridgePlanes(b).every((x) => x === p || x === q))).toBe(true);
      }
    }
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

describe('第二章 双旋 状态机', () => {
  const L4 = LEVELS.find((l) => l.id === 'twohands') as LevelDef;
  const L6 = LEVELS.find((l) => l.id === 'counterweight') as LevelDef;
  const frame = (rotation: Rotation4D, playerPosition: Vec3, dt = 0.1) => ({ dt, rotation, playerPosition, sliceW0: null, rotatedW: true });

  it('双手桥：只转对 XW（YW 未动）不会累计进度；两个都满足才锁定', () => {
    const s = new PuzzleSession(L4, T);
    const b = L4.bridges[0];
    const onlyXW = { ...L4.core.initialRotation, XW: b.solution.XW };
    for (let i = 0; i < 5; i++) s.update(frame(onlyXW, L4.playerStart));
    expect(s.bridges[0].locked).toBe(false);
    expect(s.bridges[0].progress).toBe(0);
    expect(s.bridges[0].evaluation?.satisfied).toBe(false);
    expect(s.bridges[0].evaluation?.second).toBeDefined();
    const dOnlyXW = s.bridges[0].evaluation?.distance ?? 0;
    s.update(frame(b.solution, L4.playerStart));
    expect(s.bridges[0].evaluation?.distance ?? Infinity).toBeLessThan(dOnlyXW);
    for (let i = 0; i < 4; i++) s.update(frame(b.solution, L4.playerStart));
    expect(s.bridges[0].locked).toBe(true);
    // 锁定后两个平面都被吸附
    const snapped = s.snapRotationForLockedBridges({ ...b.solution, XW: 0, YW: 0 });
    expect(snapped.XW).toBe(b.solution.XW);
    expect(snapped.YW).toBe(b.solution.YW);
  });

  it('配重：双手桥 → 中继 → 等角桥 → 出口', () => {
    const s = new PuzzleSession(L6, T);
    const [a, b] = L6.bridges;
    for (let i = 0; i < 4; i++) s.update(frame(a.solution, L6.playerStart));
    expect(s.isActivated('bridge-a')).toBe(true);
    expect(s.bridges[1].visible).toBe(false);
    s.update(frame(a.solution, [0, 0, 0]));
    expect(s.isActivated('relay')).toBe(true);
    s.update(frame(a.solution, [0, 0, 0]));
    expect(s.bridges[1].visible).toBe(true);
    for (let i = 0; i < 4; i++) s.update(frame(b.solution, [0, 0, 0]));
    expect(s.isActivated('bridge-b')).toBe(true);
    expect(s.exitReady).toBe(true);
    const ev = s.update(frame(b.solution, L6.exit.position));
    expect(ev.some((e) => e.type === 'levelComplete')).toBe(true);
  });
});

describe('第三章 截面 状态机', () => {
  const L7 = LEVELS.find((l) => l.id === 'prism') as LevelDef;
  const L9 = LEVELS.find((l) => l.id === 'scan') as LevelDef;
  const d2r = (x: number) => (x * Math.PI) / 180;
  const frame = (rotation: Rotation4D, sliceW0: number | null, playerPosition: Vec3 = [0, 0, 5], dt = 0.1) => ({ dt, rotation, playerPosition, sliceW0, rotatedW: true });
  const I = math.identityRotation();

  it('单个 W 平面旋转：截面始终是长方体，节点不激活；两个 W 平面 + 扫描到边缘 → 三棱柱 → 闸门开', () => {
    const s = new PuzzleSession(L7, T);
    for (let w0 = -1.3; w0 <= 1.3; w0 += 0.1) {
      s.update(frame({ ...I, XW: d2r(40) }, w0));
      expect(s.section?.vertices).toBe(8);
      expect(math.sectionName(s.section as math.SectionSignature)).toBe('长方体');
    }
    expect(s.nodes[0].active).toBe(false);
    expect(s.gates[0].open).toBe(false);
    const two = { ...I, YW: d2r(40), ZW: d2r(30) };
    s.update(frame(two, 0));
    expect(math.sectionName(s.section as math.SectionSignature)).toBe('六棱柱');
    for (let i = 0; i < 6; i++) s.update(frame(two, -1.2));
    expect(s.nodes[0].active).toBe(true);
    expect(s.gates[0].open).toBe(true);
    expect(s.exitReady).toBe(true);
    expect(s.isWalkable([0, 0, 0])).toBe(true);
  });

  it('切片关闭时 section 为 null，形状节点不累计', () => {
    const s = new PuzzleSession(L7, T);
    const two = { ...I, YW: d2r(40), ZW: d2r(30) };
    for (let i = 0; i < 6; i++) s.update(frame(two, null));
    expect(s.section).toBeNull();
    expect(s.nodes[0].active).toBe(false);
  });

  it('Scan：顺序 三棱柱 → 四面体 → 十二顶点；乱序不激活', () => {
    const s = new PuzzleSession(L9, T);
    const two = { ...I, YW: d2r(40), ZW: d2r(30) };
    const three = { ...I, XW: d2r(35), YW: d2r(40), ZW: d2r(30) };
    // 先试四面体：prism 未激活，tetra 不可见
    for (let i = 0; i < 6; i++) s.update(frame(three, -1.6));
    expect(s.isActivated('tetra')).toBe(false);
    for (let i = 0; i < 6; i++) s.update(frame(two, -1.2));
    expect(s.isActivated('prism')).toBe(true);
    expect(s.gates[0].open).toBe(true);
    for (let i = 0; i < 6; i++) s.update(frame(three, -1.6));
    expect(s.isActivated('tetra')).toBe(true);
    for (let i = 0; i < 6; i++) s.update(frame(three, 0));
    expect(s.isActivated('twelve')).toBe(true);
    expect(s.gates[1].open).toBe(true);
    expect(s.exitReady).toBe(true);
  });

  it('纯三维旋转不改变截面签名（形状只取决于 W 朝向）', () => {
    const three = { ...I, XW: d2r(35), YW: d2r(40), ZW: d2r(30) };
    const base = math.sectionSignature(T, math.sliceHyperplane(T, math.rotateAll(T.vertices, three), -1.6));
    expect(base.vertices).toBe(4);
    for (const extra of [{ XY: 0.7 }, { XZ: -1.1 }, { YZ: 2.0 }, { XY: 0.3, XZ: 0.4, YZ: -0.9 }]) {
      const sig = math.sectionSignature(T, math.sliceHyperplane(T, math.rotateAll(T.vertices, { ...three, ...extra }), -1.6));
      expect(sig).toEqual(base);
    }
  });
});

describe('第四章 投影 状态机', () => {
  const L10 = LEVELS.find((l) => l.id === 'shadow') as LevelDef;
  const d2r = (x: number) => (x * Math.PI) / 180;
  const I = math.identityRotation();
  const frame = (rotation: Rotation4D, blend: number, mode: math.ProjectionMode, dt = 0.1) => ({ dt, rotation, playerPosition: [0, 0, 5] as Vec3, sliceW0: null, rotatedW: true, projectionBlend: blend, projectionMode: mode });

  it('Shadow：解姿态在正交下不满足、在透视下锁定；切换投影触发 projection:perspective 提示', () => {
    const s = new PuzzleSession(L10, T);
    const sol = { ...I, XW: d2r(-110) };
    for (let i = 0; i < 6; i++) s.update(frame(sol, 1, 'orthographic'));
    expect(s.bridges[0].locked).toBe(false);
    expect(s.bridges[0].evaluation?.satisfied).toBe(false);
    const events = s.update(frame(sol, 0, 'perspective'));
    expect(events.some((e) => e.type === 'hint' && e.id === 'h-persp')).toBe(true);
    for (let i = 0; i < 6; i++) s.update(frame(sol, 0, 'perspective'));
    expect(s.bridges[0].locked).toBe(true);
    expect(s.exitReady).toBe(true);
  });

  it('过渡中（blend = 0.5）两个目标不会同时满足', () => {
    const s = new PuzzleSession(L10, T);
    const sol = { ...I, XW: d2r(-110) };
    for (let i = 0; i < 6; i++) s.update(frame(sol, 0.5, 'perspective'));
    expect(s.bridges[0].locked).toBe(false);
  });
});
