import { describe, expect, it } from 'vitest';
import { createTesseract } from '../math/hypercube';
import {
  applyRotation,
  identityRotation,
  involvesW,
  PLANES,
  rotate4D,
  rotateAll,
  wrapAngle,
} from '../math/rotation4d';
import { distance4, dot4, length4, type Vec4 } from '../math/vec4';

const T = createTesseract();
const sample: Vec4[] = [
  [1, 2, 3, 4],
  [-0.5, 0.25, 7, -2],
  [0, 0, 0, 1],
  ...T.vertices,
];
const angles = [0.1, 0.7, 1.3, Math.PI / 2, 2.9, -1.1];

describe('rotate4D', () => {
  it('零角度不改变坐标', () => {
    for (const p of PLANES) {
      for (const v of sample) expect(rotate4D(v, p, 0)).toEqual(v);
    }
  });

  it('保持四维长度与两点距离', () => {
    for (const p of PLANES) {
      for (const a of angles) {
        for (let i = 0; i < sample.length; i++) {
          const v = sample[i];
          expect(length4(rotate4D(v, p, a))).toBeCloseTo(length4(v), 10);
          const u = sample[(i + 1) % sample.length];
          expect(distance4(rotate4D(v, p, a), rotate4D(u, p, a))).toBeCloseTo(distance4(v, u), 10);
        }
      }
    }
  });

  it('θ 后 −θ 恢复原坐标', () => {
    for (const p of PLANES) {
      for (const a of angles) {
        for (const v of sample) {
          const back = rotate4D(rotate4D(v, p, a), p, -a);
          for (let k = 0; k < 4; k++) expect(back[k]).toBeCloseTo(v[k], 10);
        }
      }
    }
  });

  it('只改变平面内的两个坐标', () => {
    const v: Vec4 = [1, 2, 3, 4];
    const r = rotate4D(v, 'XW', 0.9);
    expect(r[1]).toBe(2);
    expect(r[2]).toBe(3);
    expect(r[0]).not.toBe(1);
    expect(r[3]).not.toBe(4);
  });

  it('XW 旋转公式与定义一致', () => {
    const v: Vec4 = [1, 0, 0, 0];
    const r = rotate4D(v, 'XW', Math.PI / 2);
    expect(r[0]).toBeCloseTo(0);
    expect(r[3]).toBeCloseTo(1);
  });

  it('XY/XZ/YZ 旋转不改变 w；XW/YW/ZW 旋转会改变 w', () => {
    const v: Vec4 = [1, 1, 1, 1];
    for (const p of PLANES) {
      const r = rotate4D(v, p, 0.8);
      if (involvesW(p)) expect(r[3]).not.toBeCloseTo(1);
      else expect(r[3]).toBe(1);
    }
  });

  it('旋转 2π 等价于不旋转', () => {
    for (const p of PLANES) {
      const r = rotate4D([1, 2, 3, 4], p, Math.PI * 2);
      [1, 2, 3, 4].forEach((c, k) => expect(r[k]).toBeCloseTo(c, 10));
    }
  });
});

describe('applyRotation / rotateAll', () => {
  it('恒等旋转不改变整个 tesseract', () => {
    expect(rotateAll(T.vertices, identityRotation())).toEqual(T.vertices);
  });

  it('复合旋转保持所有顶点间距离（刚体）', () => {
    const r = { ...identityRotation(), XW: 0.6, YZ: 1.1, ZW: -0.4 };
    const out = rotateAll(T.vertices, r);
    for (let i = 0; i < 16; i++) {
      for (let j = i + 1; j < 16; j++) {
        expect(distance4(out[i], out[j])).toBeCloseTo(distance4(T.vertices[i], T.vertices[j]), 10);
      }
    }
  });

  it('复合旋转保持正交性（任意两个正交向量旋转后仍正交）', () => {
    const r = { ...identityRotation(), XY: 0.3, XW: 0.6, YW: -1.2 };
    const a = applyRotation([1, 0, 0, 0], r);
    const b = applyRotation([0, 0, 0, 1], r);
    expect(dot4(a, b)).toBeCloseTo(0, 10);
  });

  it('四维旋转不可交换：XW 后 YW ≠ YW 后 XW', () => {
    const v: Vec4 = [1, 2, 3, 4];
    const ab = rotate4D(rotate4D(v, 'XW', 0.7), 'YW', 0.9);
    const ba = rotate4D(rotate4D(v, 'YW', 0.9), 'XW', 0.7);
    const same = ab.every((c, k) => Math.abs(c - ba[k]) < 1e-9);
    expect(same).toBe(false);
  });
});

describe('wrapAngle', () => {
  it('规约到 (-π, π]', () => {
    expect(wrapAngle(0)).toBe(0);
    expect(wrapAngle(Math.PI)).toBeCloseTo(Math.PI);
    expect(wrapAngle(-Math.PI)).toBeCloseTo(Math.PI);
    expect(wrapAngle(3 * Math.PI)).toBeCloseTo(Math.PI);
    expect(wrapAngle(Math.PI * 2 + 0.5)).toBeCloseTo(0.5);
    expect(wrapAngle(-Math.PI * 2 - 0.5)).toBeCloseTo(-0.5);
  });
});

describe('应用顺序的不变量', () => {
  it('在任意 W 姿态下，叠加 XY/XZ/YZ 旋转都不改变任何顶点的 w', () => {
    const base = { ...identityRotation(), XW: 0.9, YW: -0.4, ZW: 1.7 };
    const w0 = rotateAll(T.vertices, base).map((v) => v[3]);
    for (const r of [
      { ...base, XY: 0.5 },
      { ...base, XZ: -1.2 },
      { ...base, YZ: 2.2 },
      { ...base, XY: 0.3, XZ: 0.7, YZ: -0.9 },
    ]) {
      const w1 = rotateAll(T.vertices, r).map((v) => v[3]);
      w1.forEach((w, i) => expect(w).toBeCloseTo(w0[i], 10));
    }
  });
});
