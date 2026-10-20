import type { Vec3 } from './vec4';

/**
 * 三维"视角倾斜"：投影之后对结果施加的固定三维旋转（先绕 X 俯仰，再绕 Y 偏航）。
 * 与四维姿态无关，只用于让关卡里的核心摆得好看，并且不破坏正交平面对之间的解耦。
 * 与 three.js 的 Euler(pitch, yaw, 0, 'YXZ') 等价。
 */
export interface Tilt {
  pitch: number;
  yaw: number;
}

export function applyTilt(p: Vec3, tilt: Tilt | undefined): Vec3 {
  if (!tilt) return p;
  const cx = Math.cos(tilt.pitch), sx = Math.sin(tilt.pitch);
  const cy = Math.cos(tilt.yaw), sy = Math.sin(tilt.yaw);
  // 绕 X：y,z
  const x1 = p[0];
  const y1 = p[1] * cx - p[2] * sx;
  const z1 = p[1] * sx + p[2] * cx;
  // 绕 Y：x,z
  return [x1 * cy + z1 * sy, y1, -x1 * sy + z1 * cy];
}
