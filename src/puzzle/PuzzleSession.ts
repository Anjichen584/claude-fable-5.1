import { distance3, involvesW, type Plane, type Polytope4, type Rotation4D, type Vec3 } from '../math';
import { bridgePlanes, combineDualEvaluation, evaluateBridge, pointInAnyAABBxz, resolveAnchor, resolveAnchor2, toleranceOf, vertexWorldPosition, type BridgeEvaluation } from './PuzzleRules';
import type { AABB, BridgeDef, LevelDef, NodeDef } from './types';

export interface BridgeStatus {
  def: BridgeDef;
  /** 前置满足，锚点可见、开始判定 */
  visible: boolean;
  evaluation: BridgeEvaluation | null;
  /** 条件持续满足的时间（秒） */
  hold: number;
  /** 0..1 */
  progress: number;
  locked: boolean;
}

export interface NodeStatus {
  def: NodeDef;
  visible: boolean;
  active: boolean;
  hold: number;
}

export type PuzzleEvent =
  | { type: 'activated'; id: string; kind: 'bridge' | 'node' }
  | { type: 'exitReady' }
  | { type: 'hint'; id: string; text: string }
  | { type: 'levelComplete' };

export interface PuzzleFrameInput {
  dt: number;
  rotation: Rotation4D;
  playerPosition: Vec3;
  sliceW0: number | null;
  /** 本帧玩家是否旋转了任一 W 平面（用于 noW 提示） */
  rotatedW: boolean;
}

/**
 * 一关的解谜状态机：桥的持续计时与锁定、节点激活、出口可用、提示触发。
 * 纯逻辑，不含渲染；每帧由 GameController 喂入姿态与玩家位置。
 */
export class PuzzleSession {
  readonly level: LevelDef;
  readonly bridges: BridgeStatus[];
  readonly nodes: NodeStatus[];
  exitReady = false;
  completed = false;

  private readonly poly: Polytope4;
  private readonly activated = new Set<string>();
  private readonly firedHints = new Set<string>();
  private elapsed = 0;
  private everRotatedW = false;
  private pendingEvents: PuzzleEvent[] = [];

  constructor(level: LevelDef, poly: Polytope4) {
    this.level = level;
    this.poly = poly;
    this.bridges = level.bridges.map((def) => ({ def, visible: false, evaluation: null, hold: 0, progress: 0, locked: false }));
    this.nodes = level.nodes.map((def) => ({ def, visible: false, active: false, hold: 0 }));
    this.fireHints('start');
  }

  private requirementsMet(requires?: string[]): boolean {
    if (!requires || requires.length === 0) return true;
    return requires.every((id) => this.activated.has(id));
  }

  isActivated(id: string): boolean {
    return this.activated.has(id);
  }

  /** 当前可行走区域 = 静态平台 ∪ 已锁定的桥。 */
  walkable(): AABB[] {
    const out: AABB[] = [...this.level.platforms];
    for (const b of this.bridges) if (b.locked) out.push(b.def.walkable);
    return out;
  }

  isWalkable(p: Vec3, margin = 0): boolean {
    return pointInAnyAABBxz(p, this.walkable(), margin);
  }

  anchorOf(bridge: BridgeDef): Vec3 {
    return resolveAnchor(this.poly, bridge, this.level.core);
  }

  /** 评估一座桥在给定姿态下的状态（含双旋桥的第二目标），不改动状态。 */
  evaluate(bridge: BridgeDef, rotation: Rotation4D): BridgeEvaluation {
    const anchor = this.anchorOf(bridge);
    const endpoint = vertexWorldPosition(this.poly, bridge.vertex, rotation, this.level.core);
    const first = evaluateBridge(bridge, endpoint, anchor);
    if (bridge.vertex2 === undefined) return first;
    const anchor2 = resolveAnchor2(this.poly, bridge, this.level.core) as Vec3;
    const endpoint2 = vertexWorldPosition(this.poly, bridge.vertex2, rotation, this.level.core);
    return combineDualEvaluation(first, evaluateBridge(bridge, endpoint2, anchor2));
  }

  /** 推进一帧。返回本帧产生的事件（已排序）。 */
  update(input: PuzzleFrameInput): PuzzleEvent[] {
    if (this.completed) return [];
    this.elapsed += input.dt;
    if (input.rotatedW) this.everRotatedW = true;

    // 桥
    for (const b of this.bridges) {
      if (b.locked) continue;
      b.visible = this.requirementsMet(b.def.requires);
      if (!b.visible) {
        b.evaluation = null;
        b.hold = 0;
        b.progress = 0;
        continue;
      }
      b.evaluation = this.evaluate(b.def, input.rotation);
      const tol = toleranceOf(b.def);
      if (b.evaluation.satisfied) {
        b.hold += input.dt;
        if (b.hold >= tol.holdSeconds) {
          b.locked = true;
          b.hold = tol.holdSeconds;
          this.activate(b.def.id, 'bridge');
        }
      } else {
        b.hold = 0;
      }
      b.progress = Math.min(1, b.hold / tol.holdSeconds);
    }

    // 节点
    for (const n of this.nodes) {
      if (n.active) continue;
      n.visible = this.requirementsMet(n.def.requires);
      if (!n.visible) continue;
      const trig = n.def.trigger;
      if (trig.kind === 'reach') {
        if (distance3(input.playerPosition, n.def.position) <= trig.radius) {
          n.active = true;
          this.activate(n.def.id, 'node');
        }
      } else if (trig.kind === 'slice') {
        const w = input.sliceW0;
        const inRange = w !== null && w >= trig.range[0] && w <= trig.range[1];
        if (inRange) {
          n.hold += input.dt;
          if (n.hold >= (trig.holdSeconds ?? 0.3)) {
            n.active = true;
            this.activate(n.def.id, 'node');
          }
        } else {
          n.hold = 0;
        }
      }
    }

    // 出口
    if (!this.exitReady && this.requirementsMet(this.level.exit.requires)) {
      this.exitReady = true;
      this.pendingEvents.push({ type: 'exitReady' });
      this.fireHints('exitReady');
    }
    if (this.exitReady && distance3(input.playerPosition, this.level.exit.position) <= this.level.exit.radius) {
      this.completed = true;
      this.pendingEvents.push({ type: 'levelComplete' });
    }

    // 定时提示
    if (!this.everRotatedW) {
      for (const h of this.level.hints) {
        if (!h.when.startsWith('noW:') || this.firedHints.has(h.id)) continue;
        const sec = Number(h.when.slice(4));
        if (this.elapsed >= sec) this.fireHint(h.id, h.text);
      }
    }

    const events = this.pendingEvents;
    this.pendingEvents = [];
    return events;
  }

  /** 某桥锁定后，把对应平面的角度"吸附"到精确解，保证后续桥的构造解仍成立。 */
  snapRotationForLockedBridges(rotation: Rotation4D): Rotation4D {
    let out = rotation;
    for (const b of this.bridges) {
      if (!b.locked) continue;
      for (const p of bridgePlanes(b.def)) {
        if (out[p] !== b.def.solution[p]) out = { ...out, [p]: b.def.solution[p] };
      }
    }
    return out;
  }

  private activate(id: string, kind: 'bridge' | 'node'): void {
    if (this.activated.has(id)) return;
    this.activated.add(id);
    this.pendingEvents.push({ type: 'activated', id, kind });
    this.fireHints(`activated:${id}`);
  }

  private fireHints(when: string): void {
    for (const h of this.level.hints) if (h.when === when) this.fireHint(h.id, h.text);
  }

  private fireHint(id: string, text: string): void {
    if (this.firedHints.has(id)) return;
    this.firedHints.add(id);
    this.pendingEvents.push({ type: 'hint', id, text });
  }
}

export function isWRotationPlane(p: Plane): boolean {
  return involvesW(p);
}
