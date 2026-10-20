import {
  angleBetween3,
  applyRotation,
  distance3,
  projectPerspective,
  sub3,
  type Polytope4,
  type ProjectionConfig,
  type Rotation4D,
  type Vec3,
} from '../math';
import { DEFAULT_PROJECTION } from '../math';
import { DEFAULT_TOLERANCE, type AABB, type BridgeDef, type BridgeTolerance } from './types';

/** 核心的世界变换：投影结果 × scale + position。 */
export interface CoreTransform {
  position: Vec3;
  scale: number;
}

/** 一个四维顶点在给定姿态下的世界坐标。 */
export function vertexWorldPosition(
  poly: Polytope4,
  index: number,
  rotation: Rotation4D,
  core: CoreTransform,
  proj: ProjectionConfig = DEFAULT_PROJECTION,
): Vec3 {
  const p = projectPerspective(applyRotation(poly.vertices[index], rotation), proj);
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
  return vertexWorldPosition(poly, bridge.vertex, bridge.solution, core);
}

export interface BridgeEvaluation {
  /** 投影端点当前世界位置 */
  endpoint: Vec3;
  anchor: Vec3;
  distance: number;
  /** 连接方向误差（弧度） */
  angleError: number;
  distanceOk: boolean;
  angleOk: boolean;
  /** 本帧条件是否全部满足（不含持续时间） */
  satisfied: boolean;
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
