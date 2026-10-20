import {
  type Plane,
  angleBetween3,
  applyRotation,
  distance3,
  projectBlend,
  blendOf,
  sub3,
  type Polytope4,
  type ProjectionConfig,
  type Rotation4D,
  type Vec3,
} from '../math';
import { DEFAULT_PROJECTION, applyTilt, type Tilt, type Vec4 } from '../math';
import { DEFAULT_TOLERANCE, type AABB, type BridgeDef, type BridgeTolerance, type TargetRef } from './types';

/** 核心的世界变换：投影结果 → 视角倾斜 → × scale + position。 */
export interface CoreTransform {
  position: Vec3;
  scale: number;
  tilt?: Tilt;
}

/** 目标引用 → 核心局部四维坐标。 */
export function targetPoint(poly: Polytope4, ref: TargetRef): Vec4 {
  if (typeof ref === 'number') {
    const v = poly.vertices[ref];
    if (!v) throw new Error(`顶点下标越界: ${ref}`);
    return v;
  }
  return ref;
}

/** 一个四维顶点（或任意随核心旋转的四维点）在给定姿态下的世界坐标。 */
export function vertexWorldPosition(
  poly: Polytope4,
  ref: TargetRef,
  rotation: Rotation4D,
  core: CoreTransform,
  proj: ProjectionConfig = DEFAULT_PROJECTION,
  /** 投影混合：0 透视（默认），1 正交 */
  blend = 0,
): Vec3 {
  const p = applyTilt(projectBlend(applyRotation(targetPoint(poly, ref), rotation), blend, proj), core.tilt);
  return [
    core.position[0] + p[0] * core.scale,
    core.position[1] + p[1] * core.scale,
    core.position[2] + p[2] * core.scale,
  ];
}

/** 所有顶点的世界坐标。 */
export function allVertexWorldPositions(
  poly: Polytope4,
  rotation: Rotation4D,
  core: CoreTransform,
  proj: ProjectionConfig = DEFAULT_PROJECTION,
): Vec3[] {
  return poly.vertices.map((_, i) => vertexWorldPosition(poly, i, rotation, core, proj));
}

/** 锚点 = 目标顶点在解姿态下的世界位置。 */
export function resolveAnchor(poly: Polytope4, bridge: BridgeDef, core: CoreTransform): Vec3 {
  return vertexWorldPosition(poly, bridge.vertex, bridge.solution, core, DEFAULT_PROJECTION, blendOf(bridge.projection ?? 'perspective'));
}

export interface BridgeEvaluation {
  /** 投影端点当前世界位置 */
  endpoint: Vec3;
  anchor: Vec3;
  /** 距离；双旋桥为两个目标中的较大者 */
  distance: number;
  /** 连接方向误差（弧度）；双旋桥为较大者 */
  angleError: number;
  distanceOk: boolean;
  angleOk: boolean;
  /** 本帧条件是否全部满足（不含持续时间） */
  satisfied: boolean;
  /** 双旋桥：第一个目标的单独评估（本身不再嵌套） */
  primary?: BridgeEvaluation;
  /** 双旋桥：第二个目标的单独评估（本身不再嵌套） */
  second?: BridgeEvaluation;
}

/** 双旋桥的第二个锚点 = 第二个目标顶点在解姿态下的世界位置。 */
export function resolveAnchor2(poly: Polytope4, bridge: BridgeDef, core: CoreTransform): Vec3 | null {
  if (bridge.vertex2 === undefined) return null;
  return vertexWorldPosition(poly, bridge.vertex2, bridge.solution, core, DEFAULT_PROJECTION, blendOf(bridge.projection ?? 'perspective'));
}

/** 合并双旋桥两个目标的评估：两者都满足才算满足。 */
export function combineDualEvaluation(first: BridgeEvaluation, second: BridgeEvaluation): BridgeEvaluation {
  return {
    endpoint: first.endpoint,
    anchor: first.anchor,
    distance: Math.max(first.distance, second.distance),
    angleError: Math.max(first.angleError, second.angleError),
    distanceOk: first.distanceOk && second.distanceOk,
    angleOk: first.angleOk && second.angleOk,
    satisfied: first.satisfied && second.satisfied,
    primary: first,
    second,
  };
}

/** 桥涉及的所有平面（主平面 + 双旋第二平面）。 */
export function bridgePlanes(bridge: BridgeDef): Plane[] {
  return bridge.plane2 && bridge.plane2 !== bridge.plane ? [bridge.plane, bridge.plane2] : [bridge.plane];
}

export function toleranceOf(bridge: BridgeDef): BridgeTolerance {
  return { ...DEFAULT_TOLERANCE, ...bridge.tolerance };
}

/**
 * 桥接条件（不含时间）：
 *  1. |endpoint − anchor| < δ
 *  2. angle(endpoint − start, anchor − start) < α
 */
export function evaluateBridge(
  bridge: BridgeDef,
  endpoint: Vec3,
  anchor: Vec3,
): BridgeEvaluation {
  const tol = toleranceOf(bridge);
  const distance = distance3(endpoint, anchor);
  const angleError = angleBetween3(sub3(endpoint, bridge.start), sub3(anchor, bridge.start));
  const distanceOk = distance < tol.distance;
  const angleOk = angleError < tol.angle;
  return { endpoint, anchor, distance, angleError, distanceOk, angleOk, satisfied: distanceOk && angleOk };
}

/** anyVertex 桥：对一个锚点，取全部顶点中距离最近者的评估结果。 */
export function evaluateBridgeAnyVertex(
  poly: Polytope4,
  bridge: BridgeDef,
  rotation: Rotation4D,
  core: CoreTransform,
  anchor: Vec3,
  blend = 0,
): BridgeEvaluation {
  let best: BridgeEvaluation | null = null;
  for (let i = 0; i < poly.vertices.length; i++) {
    const e = evaluateBridge(bridge, vertexWorldPosition(poly, i, rotation, core, DEFAULT_PROJECTION, blend), anchor);
    if (!best || e.distance < best.distance) best = e;
  }
  return best as BridgeEvaluation;
}

/** 点（只看 x/z）是否在 AABB 内，可带向内收缩的 margin。 */
export function pointInAABBxz(p: Vec3, box: AABB, margin = 0): boolean {
  return (
    p[0] >= box.min[0] + margin &&
    p[0] <= box.max[0] - margin &&
    p[2] >= box.min[2] + margin &&
    p[2] <= box.max[2] - margin
  );
}

export function pointInAnyAABBxz(p: Vec3, boxes: readonly AABB[], margin = 0): boolean {
  for (const b of boxes) if (pointInAABBxz(p, b, margin)) return true;
  return false;
}

/**
 * 半径为 r 的角色是否可以站在 p：中心与四个方向的采样点都必须落在某个 AABB 内
 * （每个点可以在不同的 AABB 里，所以跨越接缝时不会出现死区）。
 */
export function footprintWalkable(p: Vec3, r: number, boxes: readonly AABB[]): boolean {
  if (!pointInAnyAABBxz(p, boxes)) return false;
  const samples: Vec3[] = [
    [p[0] + r, p[1], p[2]],
    [p[0] - r, p[1], p[2]],
    [p[0], p[1], p[2] + r],
    [p[0], p[1], p[2] - r],
  ];
  for (const q of samples) if (!pointInAnyAABBxz(q, boxes)) return false;
  return true;
}

export function aabbCenter(b: AABB): Vec3 {
  return [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2];
}

export function aabbSize(b: AABB): Vec3 {
  return [b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]];
}
