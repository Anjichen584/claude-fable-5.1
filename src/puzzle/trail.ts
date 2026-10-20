import type { Vec3 } from '../math';

/**
 * 第七章：玩家轨迹。记录 (x, y, z, w, t)，终章结算时把整段路径画成"四维轨迹图"。
 * 纯数据 + 纯函数，不依赖渲染。
 */
export interface TrailSample {
  x: number;
  y: number;
  z: number;
  w: number;
  t: number;
}

export interface TrailStats {
  /** 三维路程（xz 平面，忽略 y） */
  length3: number;
  /** 沿 W 的累计位移 */
  wTravel: number;
  /** 经过的 W 层（四舍五入到整数层）个数 */
  layers: number;
  /** 采样点数 */
  samples: number;
  /** 时长（秒） */
  duration: number;
  wMin: number;
  wMax: number;
}

export class Trail {
  readonly samples: TrailSample[] = [];

  /** 位移或 w 变化超过阈值才记录，避免站着不动时堆积采样 */
  push(p: Vec3, w: number, t: number, minStep = 0.15, minW = 0.05): void {
    const last = this.samples[this.samples.length - 1];
    if (last) {
      const d = Math.hypot(p[0] - last.x, p[2] - last.z);
      if (d < minStep && Math.abs(w - last.w) < minW) return;
    }
    this.samples.push({ x: p[0], y: p[1], z: p[2], w, t });
  }

  reset(): void {
    this.samples.length = 0;
  }

  stats(): TrailStats {
    return trailStats(this.samples);
  }
}

export function trailStats(samples: readonly TrailSample[]): TrailStats {
  let length3 = 0;
  let wTravel = 0;
  let wMin = Infinity;
  let wMax = -Infinity;
  const layers = new Set<number>();
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    wMin = Math.min(wMin, s.w);
    wMax = Math.max(wMax, s.w);
    layers.add(Math.round(s.w));
    if (i > 0) {
      const p = samples[i - 1];
      length3 += Math.hypot(s.x - p.x, s.z - p.z);
      wTravel += Math.abs(s.w - p.w);
    }
  }
  if (samples.length === 0) {
    wMin = 0;
    wMax = 0;
  }
  return {
    length3,
    wTravel,
    layers: layers.size,
    samples: samples.length,
    duration: samples.length ? samples[samples.length - 1].t - samples[0].t : 0,
    wMin,
    wMax,
  };
}

export interface TrailPoint2D {
  x: number;
  y: number;
  w: number;
}

/**
 * 俯视图（x → 右，z → 下）映射到 width×height 的画布，等比缩放并留边距。
 * 返回画布坐标点列与 SVG path 的 d 字符串。
 */
export function trailTopDown(samples: readonly TrailSample[], width: number, height: number, pad = 16): { points: TrailPoint2D[]; d: string; scale: number } {
  if (samples.length === 0) return { points: [], d: '', scale: 1 };
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const s of samples) {
    minX = Math.min(minX, s.x);
    maxX = Math.max(maxX, s.x);
    minZ = Math.min(minZ, s.z);
    maxZ = Math.max(maxZ, s.z);
  }
  const spanX = Math.max(1e-6, maxX - minX);
  const spanZ = Math.max(1e-6, maxZ - minZ);
  const scale = Math.min((width - 2 * pad) / spanX, (height - 2 * pad) / spanZ);
  const ox = (width - spanX * scale) / 2;
  const oy = (height - spanZ * scale) / 2;
  const points = samples.map((s) => ({ x: ox + (s.x - minX) * scale, y: oy + (s.z - minZ) * scale, w: s.w }));
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  return { points, d, scale };
}

/**
 * W 剖面：横轴为累计路程（归一化到 0..1），纵轴为 w。
 */
export function trailWProfile(samples: readonly TrailSample[]): Array<{ s: number; w: number }> {
  if (samples.length === 0) return [];
  const out: Array<{ s: number; w: number }> = [{ s: 0, w: samples[0].w }];
  let acc = 0;
  for (let i = 1; i < samples.length; i++) {
    const p = samples[i - 1];
    const q = samples[i];
    acc += Math.hypot(q.x - p.x, q.z - p.z) + Math.abs(q.w - p.w) * 0.5;
    out.push({ s: acc, w: q.w });
  }
  const total = Math.max(1e-6, acc);
  return out.map((o) => ({ s: o.s / total, w: o.w }));
}

/** w → 颜色（与游戏一致：0 青、正紫、负金），返回 CSS 颜色 */
export function trailColor(w: number): string {
  const t = Math.max(-1, Math.min(1, w / 1.5));
  const mix = (a: [number, number, number], b: [number, number, number], k: number) =>
    `rgb(${Math.round(a[0] + (b[0] - a[0]) * k)},${Math.round(a[1] + (b[1] - a[1]) * k)},${Math.round(a[2] + (b[2] - a[2]) * k)})`;
  const cyan: [number, number, number] = [0, 229, 255];
  const purple: [number, number, number] = [185, 103, 255];
  const gold: [number, number, number] = [255, 209, 102];
  return t >= 0 ? mix(cyan, purple, t) : mix(cyan, gold, -t);
}
