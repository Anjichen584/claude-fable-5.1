import type { Vec4 } from './vec4';

/** 六个旋转平面。前三个是熟悉的三维旋转，后三个跨入第四维。 */
export type Plane = 'XY' | 'XZ' | 'YZ' | 'XW' | 'YW' | 'ZW';

export const PLANES: readonly Plane[] = ['XY', 'XZ', 'YZ', 'XW', 'YW', 'ZW'];
export const W_PLANES: readonly Plane[] = ['XW', 'YW', 'ZW'];

/** 平面 → 参与旋转的两个坐标下标（x=0,y=1,z=2,w=3）。 */
const PLANE_AXES: Record<Plane, readonly [number, number]> = {
  XY: [0, 1],
  XZ: [0, 2],
  YZ: [1, 2],
  XW: [0, 3],
  YW: [1, 3],
  ZW: [2, 3],
};

export function planeAxes(plane: Plane): readonly [number, number] {
  return PLANE_AXES[plane];
}

export function involvesW(plane: Plane): boolean {
  return PLANE_AXES[plane][1] === 3;
}

/**
 * 在指定坐标平面内旋转一个四维向量。
 *   a' = a cosθ − b sinθ
 *   b' = a sinθ + b cosθ
 * 其余两个坐标不变。所有六个平面共用这一段代码。
 */
export function rotate4D(v: Vec4, plane: Plane, angle: number): Vec4 {
  if (angle === 0) return v;
  const [i, j] = PLANE_AXES[plane];
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const out: number[] = [v[0], v[1], v[2], v[3]];
  const a = v[i];
  const b = v[j];
  out[i] = a * c - b * s;
  out[j] = a * s + b * c;
  return out as unknown as Vec4;
}

/** 六个平面各自的角度（弧度）。 */
export type Rotation4D = Record<Plane, number>;

export function identityRotation(): Rotation4D {
  return { XY: 0, XZ: 0, YZ: 0, XW: 0, YW: 0, ZW: 0 };
}

export function cloneRotation(r: Rotation4D): Rotation4D {
  return { ...r };
}

/**
 * 固定应用顺序：XW → YW → ZW → XY → XZ → YZ。
 * 四维旋转不可交换，顺序必须确定；并且 W 平面在前、三维平面在后有一个关键性质：
 * 三维平面（XY/XZ/YZ）只混合 x/y/z，作用在已完成 W 旋转的结果上，不会改变任何顶点的 w。
 * 因此无论当前 W 角度是多少，纯三维旋转都只等价于把投影整体做三维旋转——
 * 这是"必须使用 W 才能解谜"这一关卡规则在任何状态下都成立的数学依据。
 */
export const ROTATION_ORDER: readonly Plane[] = ['XW', 'YW', 'ZW', 'XY', 'XZ', 'YZ'];

export function applyRotation(v: Vec4, r: Rotation4D): Vec4 {
  let out = v;
  for (const p of ROTATION_ORDER) {
    const a = r[p];
    if (a !== 0) out = rotate4D(out, p, a);
  }
  return out;
}

export function rotateAll(vertices: readonly Vec4[], r: Rotation4D): Vec4[] {
  return vertices.map((v) => applyRotation(v, r));
}

/** 把角度规约到 (-π, π]，便于 HUD 显示和角度比较。 */
export function wrapAngle(a: number): number {
  const twoPi = Math.PI * 2;
  let x = a % twoPi;
  if (x <= -Math.PI) x += twoPi;
  else if (x > Math.PI) x -= twoPi;
  return x;
}

export function wrapRotation(r: Rotation4D): Rotation4D {
  const out = identityRotation();
  for (const p of PLANES) out[p] = wrapAngle(r[p]);
  return out;
}
