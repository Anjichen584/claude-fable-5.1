import { describe, expect, it } from 'vitest';
import { createTesseract, isInnerVertex } from '../math/hypercube';
import {
  DEFAULT_PROJECTION,
  innerCubeHalfExtent,
  outerCubeHalfExtent,
  projectAll,
  projectPerspective,
} from '../math/projection4d';
import { identityRotation, rotateAll, W_PLANES, type Plane } from '../math/rotation4d';
import { isFinite3, distance3 } from '../math/vec4';

const T = createTesseract();

describe('透视投影', () => {
  it('w=0 的点投影保持 xyz 不变', () => {
    expect(projectPerspective([0.3, -1, 2, 0])).toEqual([0.3, -1, 2]);
  });

  it('内立方体投影更小，外立方体投影更大，且数值符合 d/(d∓1)', () => {
    const p = projectAll(T.vertices);
    p.forEach((v, i) => {
      const expected = isInnerVertex(i) ? innerCubeHalfExtent() : outerCubeHalfExtent();
      for (const c of v) expect(Math.abs(c)).toBeCloseTo(expected, 10);
    });
    expect(innerCubeHalfExtent()).toBeCloseTo(0.75);
    expect(outerCubeHalfExtent()).toBeCloseTo(1.5);
  });

  it('分母钳位：w 接近/超过 d 时结果仍有限且不爆炸', () => {
    const d = DEFAULT_PROJECTION.distance;
    for (const w of [d - 1e-9, d, d + 0.5, d + 100]) {
      const p = projectPerspective([1, 1, 1, w]);
      expect(isFinite3(p)).toBe(true);
      const maxScale = d / DEFAULT_PROJECTION.minDenominator;
      for (const c of p) expect(Math.abs(c)).toBeLessThanOrEqual(maxScale + 1e-9);
    }
  });

  it('改变 XW / YW / ZW 角度时，投影几何确实变化', () => {
    const base = projectAll(T.vertices);
    for (const plane of W_PLANES) {
      const r = { ...identityRotation(), [plane]: 0.5 };
      const p = projectAll(rotateAll(T.vertices, r));
      const moved = p.filter((v, i) => distance3(v, base[i]) > 1e-6).length;
      expect(moved).toBeGreaterThan(0);
      // 投影后的顶点间距离分布应变化——这是"真四维"而非整体三维旋转的证据
      const d0 = distance3(base[0], base[15]);
      const d1 = distance3(p[0], p[15]);
      expect(Math.abs(d0 - d1)).toBeGreaterThan(1e-6);
    }
  });

  it('XY/XZ/YZ 旋转只等价于投影的整体三维旋转（投影后顶点间距离不变）', () => {
    const base = projectAll(T.vertices);
    for (const plane of ['XY', 'XZ', 'YZ'] as Plane[]) {
      const r = { ...identityRotation(), [plane]: 0.77 };
      const p = projectAll(rotateAll(T.vertices, r));
      for (let i = 0; i < 16; i++) {
        for (let j = i + 1; j < 16; j++) {
          expect(distance3(p[i], p[j])).toBeCloseTo(distance3(base[i], base[j]), 10);
        }
      }
    }
  });

  it('XW 旋转 π 后内外立方体交换', () => {
    const r = { ...identityRotation(), XW: Math.PI };
    const p = projectAll(rotateAll(T.vertices, r));
    p.forEach((v, i) => {
      const expected = isInnerVertex(i) ? outerCubeHalfExtent() : innerCubeHalfExtent();
      for (const c of v) expect(Math.abs(c)).toBeCloseTo(expected, 10);
    });
  });
});
