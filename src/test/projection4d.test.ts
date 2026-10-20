import { describe, expect, it } from 'vitest';
import { createTesseract, isInnerVertex } from '../math/hypercube';
import {
  DEFAULT_PROJECTION,
  innerCubeHalfExtent,
  outerCubeHalfExtent,
  projectAll,
  projectBlend,
  projectOrthographic,
  projectPerspective,
  blendOf,
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

describe('第四章 投影之辨：正交 vs 透视', () => {
  const T = createTesseract();
  const len = (p: readonly number[]) => Math.hypot(p[0], p[1], p[2]);
  const antipode = (i: number) => T.vertices.findIndex((v) => v.every((c, k) => c === -T.vertices[i][k]));

  it('projectBlend：0 = 透视，1 = 正交，中间线性插值；blendOf 映射正确', () => {
    const v: [number, number, number, number] = [1, -1, 1, 1];
    expect(projectBlend(v, 0)).toEqual(projectPerspective(v));
    expect(projectBlend(v, 1)).toEqual(projectOrthographic(v));
    const p = projectPerspective(v);
    const o = projectOrthographic(v);
    const m = projectBlend(v, 0.5);
    for (let k = 0; k < 3; k++) expect(m[k]).toBeCloseTo((p[k] + o[k]) / 2, 12);
    expect(blendOf('perspective')).toBe(0);
    expect(blendOf('orthographic')).toBe(1);
  });

  it('正交投影：未旋转时十六个顶点两两重合成立方体的八个角', () => {
    const pts = new Set(projectAll(T.vertices, 'orthographic').map((p) => p.join(',')));
    expect(pts.size).toBe(8);
  });

  it('正交投影下对径顶点 v 与 −v 的影子永远中心对称（任意姿态）', () => {
    for (const rot of [{ XW: 0.7 }, { YW: -1.1, ZW: 0.4 }, { XW: 0.3, YW: 0.9, ZW: -1.3, XY: 0.5, XZ: -0.2, YZ: 1.7 }]) {
      const rotated = rotateAll(T.vertices, { ...identityRotation(), ...rot });
      for (let i = 0; i < 16; i++) {
        const a = projectOrthographic(rotated[i]);
        const b = projectOrthographic(rotated[antipode(i)]);
        for (let k = 0; k < 3; k++) expect(a[k]).toBeCloseTo(-b[k], 10);
      }
    }
  });

  it('透视投影下对径顶点只有在 w = 0 时才等距；一个 W 旋转即可打破对称', () => {
    const rotated = rotateAll(T.vertices, { ...identityRotation(), XW: 0.8 });
    let asymmetric = 0;
    for (let i = 0; i < 16; i++) {
      const w = rotated[i][3];
      const ra = len(projectPerspective(rotated[i]));
      const rb = len(projectPerspective(rotated[antipode(i)]));
      if (Math.abs(w) > 0.3) {
        expect(Math.abs(ra - rb)).toBeGreaterThan(0.1);
        asymmetric++;
      } else if (Math.abs(w) < 1e-9) expect(ra).toBeCloseTo(rb, 10);
    }
    expect(asymmetric).toBeGreaterThan(0);
  });
});
