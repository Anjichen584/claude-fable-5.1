/** 四维向量，纯数据，不依赖任何渲染库。 */
export type Vec4 = readonly [number, number, number, number];
export type Vec3 = readonly [number, number, number];

export const vec4 = (x: number, y: number, z: number, w: number): Vec4 => [x, y, z, w];

export function add4(a: Vec4, b: Vec4): Vec4 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2], a[3] + b[3]];
}

export function sub4(a: Vec4, b: Vec4): Vec4 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2], a[3] - b[3]];
}

export function scale4(a: Vec4, s: number): Vec4 {
  return [a[0] * s, a[1] * s, a[2] * s, a[3] * s];
}

export function lerp4(a: Vec4, b: Vec4, t: number): Vec4 {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
    a[3] + (b[3] - a[3]) * t,
  ];
}

export function dot4(a: Vec4, b: Vec4): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
}

export function length4(a: Vec4): number {
  return Math.sqrt(dot4(a, a));
}

export function distance4(a: Vec4, b: Vec4): number {
  return length4(sub4(a, b));
}

export function sub3(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

export function dot3(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function length3(a: Vec3): number {
  return Math.sqrt(dot3(a, a));
}

export function distance3(a: Vec3, b: Vec3): number {
  return length3(sub3(a, b));
}

export function normalize3(a: Vec3): Vec3 {
  const l = length3(a);
  return l === 0 ? [0, 0, 0] : [a[0] / l, a[1] / l, a[2] / l];
}

/** 两个三维向量夹角（弧度）。零向量返回 Math.PI（视为完全不对齐）。 */
export function angleBetween3(a: Vec3, b: Vec3): number {
  const la = length3(a);
  const lb = length3(b);
  if (la === 0 || lb === 0) return Math.PI;
  const c = Math.min(1, Math.max(-1, dot3(a, b) / (la * lb)));
  return Math.acos(c);
}

export function isFinite4(a: Vec4): boolean {
  return Number.isFinite(a[0]) && Number.isFinite(a[1]) && Number.isFinite(a[2]) && Number.isFinite(a[3]);
}

export function isFinite3(a: Vec3): boolean {
  return Number.isFinite(a[0]) && Number.isFinite(a[1]) && Number.isFinite(a[2]);
}
