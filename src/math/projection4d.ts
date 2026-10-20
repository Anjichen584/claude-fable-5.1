import type { Vec3, Vec4 } from './vec4';

export interface ProjectionConfig {
  /** 透视投影距离 d。d 越大越接近正交投影。 */
  distance: number;
  /** 分母 d − w 的最小值，防止除零与几何爆炸。 */
  minDenominator: number;
}

export const DEFAULT_PROJECTION: ProjectionConfig = {
  distance: 3,
  minDenominator: 0.05,
};

/**
 * 四维 → 三维透视投影。
 *   s = d / (d − w)
 *   (x3, y3, z3) = s · (x, y, z)
 * 分母钳位到 minDenominator，保证结果有限。
 */
export function projectPerspective(v: Vec4, cfg: ProjectionConfig = DEFAULT_PROJECTION): Vec3 {
  const denom = Math.max(cfg.distance - v[3], cfg.minDenominator);
  const s = cfg.distance / denom;
  return [v[0] * s, v[1] * s, v[2] * s];
}

/** 四维 → 三维正交投影（直接丢弃 w）。Day 4 章节使用，MVP 仅用于 HUD/测试。 */
export function projectOrthographic(v: Vec4): Vec3 {
  return [v[0], v[1], v[2]];
}

export type ProjectionMode = 'perspective' | 'orthographic';

/**
 * 透视与正交之间的连续混合（第四章投影切换的过渡动画用）。
 * blend = 0 → 纯透视；blend = 1 → 纯正交；中间线性插值两种投影结果。
 */
export function projectBlend(v: Vec4, blend: number, cfg: ProjectionConfig = DEFAULT_PROJECTION): Vec3 {
  if (blend <= 0) return projectPerspective(v, cfg);
  if (blend >= 1) return projectOrthographic(v);
  const p = projectPerspective(v, cfg);
  const o = projectOrthographic(v);
  return [p[0] + (o[0] - p[0]) * blend, p[1] + (o[1] - p[1]) * blend, p[2] + (o[2] - p[2]) * blend];
}

export function blendOf(mode: ProjectionMode): number {
  return mode === 'orthographic' ? 1 : 0;
}

export function project(v: Vec4, mode: ProjectionMode, cfg: ProjectionConfig = DEFAULT_PROJECTION): Vec3 {
  return mode === 'perspective' ? projectPerspective(v, cfg) : projectOrthographic(v);
}

export function projectAll(
  vertices: readonly Vec4[],
  mode: ProjectionMode = 'perspective',
  cfg: ProjectionConfig = DEFAULT_PROJECTION,
): Vec3[] {
  return vertices.map((v) => project(v, mode, cfg));
}

/** 未旋转 tesseract 的内立方体顶点投影后到原点的距离（每个坐标的绝对值）。 */
export function innerCubeHalfExtent(cfg: ProjectionConfig = DEFAULT_PROJECTION): number {
  return cfg.distance / (cfg.distance + 1);
}

/** 未旋转 tesseract 的外立方体顶点投影后每个坐标的绝对值。 */
export function outerCubeHalfExtent(cfg: ProjectionConfig = DEFAULT_PROJECTION): number {
  return cfg.distance / (cfg.distance - 1);
}
