import * as THREE from 'three';
import {
  isInnerVertex,
  projectAll,
  rotateAll,
  sliceHyperplane,
  type Polytope4,
  type Vec3,
} from '../math';
import type { ViewState } from './ViewState';

const COLOR_INNER = new THREE.Color('#38e8ff'); // 青
const COLOR_OUTER = new THREE.Color('#a86bff'); // 紫
const COLOR_LINK = new THREE.Color('#6fa8ff'); // 内外连接边
const COLOR_SLICE = new THREE.Color('#ffd166'); // 暖金
const COLOR_CORE = new THREE.Color('#ffffff');

/**
 * 把一个四维多胞体的投影画成线框。所有顶点位置每帧由 math 模块重新计算，
 * 这里只负责把结果写进 BufferGeometry——不做任何四维数学。
 */
export class TesseractView {
  readonly group = new THREE.Group();

  private readonly poly: Polytope4;
  private readonly edgeGeom: THREE.BufferGeometry;
  private readonly edgePositions: Float32Array;
  private readonly edgeLines: THREE.LineSegments;
  private readonly edgeMaterial: THREE.LineBasicMaterial;

  private readonly vertexGeom: THREE.BufferGeometry;
  private readonly vertexPositions: Float32Array;
  private readonly vertexPoints: THREE.Points;

  private readonly sliceGeom: THREE.BufferGeometry;
  private sliceCapacity: number;
  private readonly sliceLines: THREE.LineSegments;
  private readonly slicePointsGeom: THREE.BufferGeometry;
  private readonly slicePoints: THREE.Points;

  private readonly core: THREE.Mesh;
  private readonly coreHalo: THREE.Sprite;

  /** 最近一次 update 得到的投影顶点（世界坐标 = group 局部坐标 × scale）。供解谜规则读取。 */
  projected: Vec3[] = [];

  constructor(poly: Polytope4) {
    this.poly = poly;

    // ---- 边 ----
    const edgeCount = poly.edges.length;
    this.edgePositions = new Float32Array(edgeCount * 2 * 3);
    const edgeColors = new Float32Array(edgeCount * 2 * 3);
    poly.edges.forEach(([i, j], e) => {
      const ci = isInnerVertex(i);
      const cj = isInnerVertex(j);
      const col = ci && cj ? COLOR_INNER : !ci && !cj ? COLOR_OUTER : COLOR_LINK;
      for (let k = 0; k < 2; k++) {
        edgeColors[(e * 2 + k) * 3 + 0] = col.r;
        edgeColors[(e * 2 + k) * 3 + 1] = col.g;
        edgeColors[(e * 2 + k) * 3 + 2] = col.b;
      }
    });
    this.edgeGeom = new THREE.BufferGeometry();
    this.edgeGeom.setAttribute('position', new THREE.BufferAttribute(this.edgePositions, 3).setUsage(THREE.DynamicDrawUsage));
    this.edgeGeom.setAttribute('color', new THREE.BufferAttribute(edgeColors, 3));
    this.edgeMaterial = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.edgeLines = new THREE.LineSegments(this.edgeGeom, this.edgeMaterial);
    this.group.add(this.edgeLines);

    // ---- 顶点光点 ----
    this.vertexPositions = new Float32Array(poly.vertices.length * 3);
    const vColors = new Float32Array(poly.vertices.length * 3);
    poly.vertices.forEach((_, i) => {
      const c = isInnerVertex(i) ? COLOR_INNER : COLOR_OUTER;
      vColors[i * 3] = c.r;
      vColors[i * 3 + 1] = c.g;
      vColors[i * 3 + 2] = c.b;
    });
    this.vertexGeom = new THREE.BufferGeometry();
    this.vertexGeom.setAttribute('position', new THREE.BufferAttribute(this.vertexPositions, 3).setUsage(THREE.DynamicDrawUsage));
    this.vertexGeom.setAttribute('color', new THREE.BufferAttribute(vColors, 3));
    this.vertexPoints = new THREE.Points(
      this.vertexGeom,
      new THREE.PointsMaterial({
        size: 0.09,
        vertexColors: true,
        map: makeGlowTexture(),
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true,
      }),
    );
    this.group.add(this.vertexPoints);

    // ---- 切片线段（容量按面数预留，24 面最多 24 段）----
    this.sliceCapacity = poly.faces.length;
    this.sliceGeom = new THREE.BufferGeometry();
    this.sliceGeom.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(this.sliceCapacity * 2 * 3), 3).setUsage(THREE.DynamicDrawUsage),
    );
    this.sliceGeom.setDrawRange(0, 0);
    this.sliceLines = new THREE.LineSegments(
      this.sliceGeom,
      new THREE.LineBasicMaterial({ color: COLOR_SLICE, transparent: true, opacity: 1, linewidth: 2 }),
    );
    this.sliceLines.visible = false;
    this.group.add(this.sliceLines);

    this.slicePointsGeom = new THREE.BufferGeometry();
    this.slicePointsGeom.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(poly.edges.length * 3), 3).setUsage(THREE.DynamicDrawUsage),
    );
    this.slicePointsGeom.setDrawRange(0, 0);
    this.slicePoints = new THREE.Points(
      this.slicePointsGeom,
      new THREE.PointsMaterial({
        size: 0.12,
        color: COLOR_SLICE,
        map: makeGlowTexture(),
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    this.slicePoints.visible = false;
    this.group.add(this.slicePoints);

    // ---- 中心核 ----
    this.core = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.08, 2),
      new THREE.MeshBasicMaterial({ color: COLOR_CORE }),
    );
    this.group.add(this.core);
    this.coreHalo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: makeGlowTexture(),
        color: COLOR_INNER,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        opacity: 0.8,
      }),
    );
    this.coreHalo.scale.setScalar(0.9);
    this.group.add(this.coreHalo);
  }

  /** 每帧调用：四维旋转 → 投影 → 写入几何。 */
  update(state: ViewState, time: number): void {
    const rotated = rotateAll(this.poly.vertices, state.rotation);
    const projected = projectAll(rotated, 'perspective', state.projection);
    this.projected = projected;

    // 边
    this.poly.edges.forEach(([i, j], e) => {
      const a = projected[i];
      const b = projected[j];
      const o = e * 6;
      this.edgePositions[o] = a[0];
      this.edgePositions[o + 1] = a[1];
      this.edgePositions[o + 2] = a[2];
      this.edgePositions[o + 3] = b[0];
      this.edgePositions[o + 4] = b[1];
      this.edgePositions[o + 5] = b[2];
    });
    (this.edgeGeom.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    this.edgeGeom.computeBoundingSphere();

    // 顶点
    projected.forEach((p, i) => {
      this.vertexPositions[i * 3] = p[0];
      this.vertexPositions[i * 3 + 1] = p[1];
      this.vertexPositions[i * 3 + 2] = p[2];
    });
    (this.vertexGeom.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    this.vertexGeom.computeBoundingSphere();

    // 切片
    if (state.slice.enabled) {
      const s = sliceHyperplane(this.poly, rotated, state.slice.w0);
      const sp = projectAll(s.points, 'perspective', state.projection);
      const pos = this.sliceGeom.getAttribute('position') as THREE.BufferAttribute;
      const arr = pos.array as Float32Array;
      const n = Math.min(s.segments.length, this.sliceCapacity);
      for (let k = 0; k < n; k++) {
        const [a, b] = s.segments[k];
        const pa = sp[a];
        const pb = sp[b];
        arr.set([pa[0], pa[1], pa[2], pb[0], pb[1], pb[2]], k * 6);
      }
      pos.needsUpdate = true;
      this.sliceGeom.setDrawRange(0, n * 2);
      this.sliceGeom.computeBoundingSphere();

      const ppos = this.slicePointsGeom.getAttribute('position') as THREE.BufferAttribute;
      const parr = ppos.array as Float32Array;
      sp.forEach((p, i) => parr.set([p[0], p[1], p[2]], i * 3));
      ppos.needsUpdate = true;
      this.slicePointsGeom.setDrawRange(0, sp.length);
      this.slicePointsGeom.computeBoundingSphere();

      this.sliceLines.visible = true;
      this.slicePoints.visible = true;
      this.edgeMaterial.opacity = state.showProjection ? 0.28 : 0;
      (this.vertexPoints.material as THREE.PointsMaterial).opacity = state.showProjection ? 0.35 : 0;
    } else {
      this.sliceLines.visible = false;
      this.slicePoints.visible = false;
      this.edgeMaterial.opacity = 0.95;
      (this.vertexPoints.material as THREE.PointsMaterial).opacity = 1;
    }

    // 核心呼吸
    const pulse = 0.85 + 0.15 * Math.sin(time * 2.2);
    this.coreHalo.scale.setScalar(0.9 * pulse);
    this.core.scale.setScalar(pulse);
  }

  dispose(): void {
    this.edgeGeom.dispose();
    this.edgeMaterial.dispose();
    this.vertexGeom.dispose();
    (this.vertexPoints.material as THREE.Material).dispose();
    this.sliceGeom.dispose();
    (this.sliceLines.material as THREE.Material).dispose();
    this.slicePointsGeom.dispose();
    (this.slicePoints.material as THREE.Material).dispose();
    this.core.geometry.dispose();
    (this.core.material as THREE.Material).dispose();
    (this.coreHalo.material as THREE.Material).dispose();
  }
}

let glowTexture: THREE.Texture | null = null;
/** 程序生成的径向渐变光晕贴图，避免外部资源。 */
function makeGlowTexture(): THREE.Texture {
  if (glowTexture) return glowTexture;
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.3, 'rgba(255,255,255,0.6)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  glowTexture = new THREE.CanvasTexture(canvas);
  return glowTexture;
}
