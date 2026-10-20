import { DEFAULT_PROJECTION, distance3, involvesW, matchesShape, rotateAll, sectionSignature, sliceHyperplane, type Plane, type Polytope4, type Rotation4D, type SectionSignature, type Vec3 } from '../math';
import { boxesAtW, bridgePlanes, combineDualEvaluation, evaluateBridge, evaluateBridgeAnyVertex, pointInAnyAABBxz, resolveAnchor, resolveAnchor2, toleranceOf, vertexWorldPosition, type BridgeEvaluation } from './PuzzleRules';
import { W_LAYER_HALF, type AABB, type BridgeDef, type GateDef, type LevelDef, type NodeDef, type TargetRef } from './types';
import type { ProjectionMode } from '../math';

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

export interface GateStatus {
  def: GateDef;
  open: boolean;
}

export type PuzzleEvent =
  | { type: 'activated'; id: string; kind: 'bridge' | 'node' | 'gate' }
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
  /** 当前投影混合：0 透视（默认）… 1 正交。桥的判定用它算当前端点位置。 */
  projectionBlend?: number;
  /** 当前投影方式（用于 projection:<mode> 提示） */
  projectionMode?: ProjectionMode;
  /** 第六章：玩家自身的 w（默认 0）。到达类节点与出口要求同层。 */
  playerW?: number;
}

/**
 * 一关的解谜状态机：桥的持续计时与锁定、节点激活、出口可用、提示触发。
 * 纯逻辑，不含渲染；每帧由 GameController 喂入姿态与玩家位置。
 */
export class PuzzleSession {
  private lastProjection: ProjectionMode | null = null;
  readonly level: LevelDef;
  readonly bridges: BridgeStatus[];
  readonly nodes: NodeStatus[];
  readonly gates: GateStatus[];
  exitReady = false;
  completed = false;
  /** 当前切面截面的签名（切片关闭时为 null）；每帧更新，供形状节点与 HUD 使用 */
  section: SectionSignature | null = null;

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
    this.gates = (level.gates ?? []).map((def) => ({ def, open: false }));
    this.fireHints('start');
  }

  private requirementsMet(requires?: string[]): boolean {
    if (!requires || requires.length === 0) return true;
    return requires.every((id) => this.activated.has(id));
  }

  isActivated(id: string): boolean {
    return this.activated.has(id);
  }

  /** 当前可行走区域 = 静态平台 ∪ 已锁定的桥 ∪ 已开启的闸门。 */
  walkable(): AABB[] {
    const out: AABB[] = [...this.level.platforms];
    for (const b of this.bridges) if (b.locked) out.push(b.def.walkable);
    for (const g of this.gates) if (g.open) out.push(g.def.walkable);
    return out;
  }

  /** 第六章：玩家 w 所在层的可行走区域 */
  walkableAt(w: number): AABB[] {
    return boxesAtW(this.walkable(), w);
  }

  isWalkable(p: Vec3, margin = 0, w = 0): boolean {
    return pointInAnyAABBxz(p, this.walkableAt(w), margin);
  }

  anchorOf(bridge: BridgeDef): Vec3 {
    return resolveAnchor(this.poly, bridge, this.level.core);
  }

  /** 评估一座桥在给定姿态下的状态（含双旋桥的第二目标），不改动状态。 */
  evaluate(bridge: BridgeDef, rotation: Rotation4D, projectionBlend = 0): BridgeEvaluation {
    const anchor = this.anchorOf(bridge);
    const evalTarget = (ref: TargetRef, a: Vec3): BridgeEvaluation =>
      bridge.anyVertex
        ? evaluateBridgeAnyVertex(this.poly, bridge, rotation, this.level.core, a, projectionBlend)
        : evaluateBridge(bridge, vertexWorldPosition(this.poly, ref, rotation, this.level.core, DEFAULT_PROJECTION, projectionBlend), a);
    const first = evalTarget(bridge.vertex, anchor);
    if (bridge.vertex2 === undefined) return first;
    const anchor2 = resolveAnchor2(this.poly, bridge, this.level.core) as Vec3;
    return combineDualEvaluation(first, evalTarget(bridge.vertex2, anchor2));
  }

  /** 推进一帧。返回本帧产生的事件（已排序）。 */
  update(input: PuzzleFrameInput): PuzzleEvent[] {
    if (this.completed) return [];
    this.elapsed += input.dt;
    if (input.rotatedW) this.everRotatedW = true;
    if (input.projectionMode && input.projectionMode !== this.lastProjection) {
      if (this.lastProjection !== null) this.fireHints(`projection:${input.projectionMode}`);
      this.lastProjection = input.projectionMode;
    }

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
      b.evaluation = this.evaluate(b.def, input.rotation, input.projectionBlend ?? 0);
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

    // 截面签名（切片开启时）
    if (input.sliceW0 !== null) {
      const slice = sliceHyperplane(this.poly, rotateAll(this.poly.vertices, input.rotation), input.sliceW0);
      this.section = sectionSignature(this.poly, slice);
    } else {
      this.section = null;
    }

    // 节点
    for (const n of this.nodes) {
      if (n.active) continue;
      n.visible = this.requirementsMet(n.def.requires);
      if (!n.visible) continue;
      const trig = n.def.trigger;
      if (trig.kind === 'reach') {
        const sameLayer = Math.abs((trig.w ?? 0) - (input.playerW ?? 0)) <= W_LAYER_HALF + 1e-9;
        if (sameLayer && distance3(input.playerPosition, n.def.position) <= trig.radius) {
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
      } else if (trig.kind === 'shape') {
        const inRange = !trig.w0Range || (input.sliceW0 !== null && input.sliceW0 >= trig.w0Range[0] && input.sliceW0 <= trig.w0Range[1]);
        const ok = inRange && this.section !== null && matchesShape(this.section, trig.shape);
        if (ok) {
          n.hold += input.dt;
          if (n.hold >= (trig.holdSeconds ?? 0.5)) {
            n.active = true;
            this.activate(n.def.id, 'node');
          }
        } else {
          n.hold = 0;
        }
      }
    }

    // 闸门：前置满足即开启
    for (const g of this.gates) {
      if (g.open) continue;
      if (this.requirementsMet(g.def.requires)) {
        g.open = true;
        this.activate(g.def.id, 'gate');
      }
    }

    // 出口
    if (!this.exitReady && this.requirementsMet(this.level.exit.requires)) {
      this.exitReady = true;
      this.pendingEvents.push({ type: 'exitReady' });
      this.fireHints('exitReady');
    }
    const exitSameLayer = Math.abs((this.level.exit.w ?? 0) - (input.playerW ?? 0)) <= W_LAYER_HALF + 1e-9;
    if (this.exitReady && exitSameLayer && distance3(input.playerPosition, this.level.exit.position) <= this.level.exit.radius) {
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

  private activate(id: string, kind: 'bridge' | 'node' | 'gate'): void {
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
