import * as THREE from 'three';
import type { Vec3 } from '../math';
import type { BridgeStatus, NodeStatus, PuzzleSession } from '../puzzle/PuzzleSession';
import { aabbCenter, aabbSize } from '../puzzle/PuzzleRules';
import type { AABB, LevelDef } from '../puzzle/types';
import { glowTex } from './PlayerController';

const C_CYAN = new THREE.Color('#38e8ff');
const C_PURPLE = new THREE.Color('#a86bff');
const C_GOLD = new THREE.Color('#ffd166');
const C_DIM = new THREE.Color('#2a3a66');

interface BridgeVisual {
  id: string;
  deck: THREE.Mesh;
  deckMat: THREE.MeshBasicMaterial;
  ghost: THREE.LineSegments;
  anchorRing: THREE.Mesh;
  anchorMat: THREE.MeshBasicMaterial;
  anchorGlow: THREE.Sprite;
  targetGlow: THREE.Sprite;
  beam: THREE.Line;
  beamMat: THREE.LineBasicMaterial;
  beamPositions: Float32Array;
  lockT: number; // 锁定动画进度 0..1
}

interface NodeVisual {
  id: string;
  gem: THREE.Mesh;
  gemMat: THREE.MeshStandardMaterial;
  ring: THREE.Mesh;
  ringMat: THREE.MeshBasicMaterial;
  glow: THREE.Sprite;
}

/**
 * 关卡的静态与反馈几何：平台、桥、锚点、目标顶点高亮、节点、出口传送门。
 * 不计算任何规则，只读取 PuzzleSession 的状态来表现。
 */
export class LevelView {
  readonly group = new THREE.Group();
  private readonly disposables: Array<{ dispose(): void }> = [];
  private readonly bridges = new Map<string, BridgeVisual>();
  private readonly nodes = new Map<string, NodeVisual>();
  private portal!: { ring: THREE.Mesh; ringMat: THREE.MeshBasicMaterial; disc: THREE.Mesh; discMat: THREE.MeshBasicMaterial; glow: THREE.Sprite; group: THREE.Group };

  constructor(level: LevelDef) {
    for (const p of level.platforms) this.addPlatform(p);
    for (const b of level.bridges) this.addBridge(b.id, b.walkable);
    for (const n of level.nodes) this.addNode(n.id, n.position);
    this.addPortal(level.exit.position);
  }

  // ---------------------------------------------------------------- 平台
  private addPlatform(box: AABB): void {
    const size = aabbSize(box);
    const center = aabbCenter(box);
    const geom = new THREE.BoxGeometry(size[0], size[1], size[2]);
    const mat = new THREE.MeshStandardMaterial({ color: '#0b1430', roughness: 0.85, metalness: 0.2, emissive: new THREE.Color('#071022'), emissiveIntensity: 0.6 });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(center[0], center[1], center[2]);
    this.group.add(mesh);

    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geom), new THREE.LineBasicMaterial({ color: C_CYAN, transparent: true, opacity: 0.55 }));
    edges.position.copy(mesh.position);
    this.group.add(edges);

    // 顶面网格
    const grid = new THREE.GridHelper(Math.max(size[0], size[2]), Math.round(Math.max(size[0], size[2]) * 2), 0x1d3b6e, 0x14284d);
    grid.position.set(center[0], box.max[1] + 0.005, center[2]);
    grid.scale.set(size[0] / Math.max(size[0], size[2]), 1, size[2] / Math.max(size[0], size[2]));
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.5;
    this.group.add(grid);

    this.disposables.push(geom, mat, edges.geometry, edges.material as THREE.Material, grid.geometry, grid.material as THREE.Material);
  }

  // ---------------------------------------------------------------- 桥
  private addBridge(id: string, box: AABB): void {
    const size = aabbSize(box);
    const center = aabbCenter(box);

    const deckGeom = new THREE.BoxGeometry(size[0], 0.08, size[2]);
    const deckMat = new THREE.MeshBasicMaterial({ color: C_CYAN, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    const deck = new THREE.Mesh(deckGeom, deckMat);
    deck.position.set(center[0], box.max[1] - 0.04, center[2]);
    deck.visible = false;
    this.group.add(deck);

    const ghostGeom = new THREE.EdgesGeometry(new THREE.BoxGeometry(size[0], 0.02, size[2]));
    const ghost = new THREE.LineSegments(ghostGeom, new THREE.LineDashedMaterial({ color: C_PURPLE, transparent: true, opacity: 0.25, dashSize: 0.25, gapSize: 0.18 }));
    ghost.computeLineDistances();
    ghost.position.set(center[0], box.max[1], center[2]);
    this.group.add(ghost);

    const anchorMat = new THREE.MeshBasicMaterial({ color: C_PURPLE, transparent: true, opacity: 0.9, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false });
    const anchorRing = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.025, 10, 40), anchorMat);
    anchorRing.visible = false;
    this.group.add(anchorRing);

    const anchorGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: C_PURPLE, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }));
    anchorGlow.scale.setScalar(0.9);
    anchorGlow.visible = false;
    this.group.add(anchorGlow);

    const targetGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: C_GOLD, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
    targetGlow.scale.setScalar(0.5);
    targetGlow.visible = false;
    this.group.add(targetGlow);

    const beamPositions = new Float32Array(6);
    const beamGeom = new THREE.BufferGeometry();
    beamGeom.setAttribute('position', new THREE.BufferAttribute(beamPositions, 3).setUsage(THREE.DynamicDrawUsage));
    const beamMat = new THREE.LineBasicMaterial({ color: C_GOLD, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    const beam = new THREE.Line(beamGeom, beamMat);
    beam.frustumCulled = false;
    this.group.add(beam);

    this.bridges.set(id, { id, deck, deckMat, ghost, anchorRing, anchorMat, anchorGlow, targetGlow, beam, beamMat, beamPositions, lockT: 0 });
    this.disposables.push(deckGeom, deckMat, ghostGeom, ghost.material as THREE.Material, anchorRing.geometry, anchorMat, anchorGlow.material, targetGlow.material, beamGeom, beamMat);
  }

  // ---------------------------------------------------------------- 节点
  private addNode(id: string, pos: Vec3): void {
    const gemMat = new THREE.MeshStandardMaterial({ color: '#3a2a66', emissive: C_PURPLE, emissiveIntensity: 0.4, roughness: 0.3, metalness: 0.4 });
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), gemMat);
    gem.position.set(pos[0], pos[1] + 0.9, pos[2]);
    this.group.add(gem);

    const ringMat = new THREE.MeshBasicMaterial({ color: C_PURPLE, transparent: true, opacity: 0.5, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.6, 0.72, 48), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(pos[0], pos[1] + 0.015, pos[2]);
    this.group.add(ring);

    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: C_PURPLE, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.scale.setScalar(1.2);
    glow.position.copy(gem.position);
    this.group.add(glow);

    this.nodes.set(id, { id, gem, gemMat, ring, ringMat, glow });
    this.disposables.push(gem.geometry, gemMat, ring.geometry, ringMat, glow.material);
  }

  // ---------------------------------------------------------------- 出口
  private addPortal(pos: Vec3): void {
    const group = new THREE.Group();
    group.position.set(pos[0], pos[1] + 1.0, pos[2]);
    const ringMat = new THREE.MeshBasicMaterial({ color: C_DIM, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.05, 12, 64), ringMat);
    group.add(ring);
    const discMat = new THREE.MeshBasicMaterial({ color: C_CYAN, transparent: true, opacity: 0, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false });
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.8, 48), discMat);
    group.add(disc);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: C_CYAN, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.scale.setScalar(3.2);
    group.add(glow);
    this.group.add(group);
    this.portal = { ring, ringMat, disc, discMat, glow, group };
    this.disposables.push(ring.geometry, ringMat, disc.geometry, discMat, glow.material);
  }

  // ---------------------------------------------------------------- 每帧
  update(session: PuzzleSession, dt: number, time: number, cameraPos: THREE.Vector3, sliceW0: number | null = null): void {
    for (const b of session.bridges) this.updateBridge(b, dt, time);
    for (const n of session.nodes) this.updateNode(n, time, sliceW0);
    this.updatePortal(session.exitReady, dt, time, cameraPos);
  }

  private updateBridge(b: BridgeStatus, dt: number, time: number): void {
    const v = this.bridges.get(b.def.id);
    if (!v) return;

    if (b.locked) {
      v.lockT = Math.min(1, v.lockT + dt / 0.7);
      const e = 1 - Math.pow(1 - v.lockT, 3);
      v.deck.visible = true;
      v.deckMat.opacity = 0.18 + 0.1 * Math.sin(time * 4) * e;
      v.deck.scale.z = Math.max(0.001, e);
      // 从 start 一侧生长：把 deck 的中心沿 z 向 start 偏移
      const box = b.def.walkable;
      const len = box.max[2] - box.min[2];
      const startZ = b.def.start[2];
      const farZ = Math.abs(startZ - box.min[2]) < Math.abs(startZ - box.max[2]) ? box.max[2] : box.min[2];
      v.deck.position.z = startZ + (farZ - startZ) * 0.5 * e;
      if (Math.abs(v.deck.scale.z * len - len) < 1e-3) v.deck.position.z = (box.min[2] + box.max[2]) / 2;
      v.ghost.visible = false;
      v.anchorMat.color.copy(C_GOLD);
      (v.anchorGlow.material as THREE.SpriteMaterial).color.copy(C_GOLD);
      v.anchorRing.visible = true;
      v.anchorGlow.visible = true;
      v.anchorRing.scale.setScalar(1 + 0.08 * Math.sin(time * 5) + (1 - e) * 2.5);
      v.anchorGlow.scale.setScalar(1.2 + (1 - e) * 4);
      (v.anchorGlow.material as THREE.SpriteMaterial).opacity = 0.6 + (1 - e) * 0.4;
      v.targetGlow.visible = false;
      v.beamMat.opacity = Math.max(0, 0.9 - v.lockT);
      return;
    }

    v.deck.visible = false;
    v.ghost.visible = b.visible;
    v.anchorRing.visible = b.visible;
    v.anchorGlow.visible = b.visible;
    v.targetGlow.visible = b.visible;
    if (!b.visible || !b.evaluation) {
      v.beamMat.opacity = 0;
      return;
    }
    const ev = b.evaluation;
    v.anchorRing.position.set(ev.anchor[0], ev.anchor[1], ev.anchor[2]);
    v.anchorGlow.position.copy(v.anchorRing.position);
    v.anchorRing.rotation.y = time * 0.8;
    v.anchorRing.rotation.x = Math.sin(time * 0.6) * 0.6;
    v.targetGlow.position.set(ev.endpoint[0], ev.endpoint[1], ev.endpoint[2]);

    const close = THREE.MathUtils.clamp(1 - ev.distance / 2.5, 0, 1);
    const col = ev.satisfied ? C_CYAN : C_PURPLE;
    v.anchorMat.color.copy(col);
    (v.anchorGlow.material as THREE.SpriteMaterial).color.copy(col);
    v.anchorGlow.scale.setScalar(0.9 + close * 0.6 + b.progress * 0.8);
    v.anchorRing.scale.setScalar(1 + b.progress * 0.5);
    v.targetGlow.scale.setScalar(0.45 + 0.1 * Math.sin(time * 6));

    v.beamPositions.set([ev.endpoint[0], ev.endpoint[1], ev.endpoint[2], ev.anchor[0], ev.anchor[1], ev.anchor[2]]);
    (v.beam.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    v.beamMat.opacity = close * close * 0.8;
    v.beamMat.color.copy(ev.satisfied ? C_CYAN : C_GOLD);
  }

  private updateNode(n: NodeStatus, time: number, sliceW0: number | null): void {
    const v = this.nodes.get(n.def.id);
    if (!v) return;
    const col = n.active ? C_GOLD : n.visible ? C_PURPLE : C_DIM;
    // 切片节点：只在切片位置接近它所在的 w 区间时显形
    let reveal = 1;
    if (n.def.trigger.kind === 'slice' && !n.active) {
      const [a, b] = n.def.trigger.range;
      const c = (a + b) / 2;
      const half = (b - a) / 2;
      const d = sliceW0 === null ? Infinity : Math.max(0, Math.abs(sliceW0 - c) - half);
      reveal = THREE.MathUtils.clamp(1 - d / 0.5, 0, 1);
    }
    v.gem.visible = reveal > 0.02 || n.active;
    v.gemMat.emissive.copy(col);
    v.gemMat.emissiveIntensity = (n.active ? 1.4 : n.visible ? 0.6 : 0.15) * reveal;
    v.gemMat.transparent = true;
    v.gemMat.opacity = n.active ? 1 : 0.15 + 0.85 * reveal;
    v.ringMat.color.copy(col);
    v.ringMat.opacity = (n.active ? 0.9 : n.visible ? 0.5 : 0.2) * (0.3 + 0.7 * reveal);
    (v.glow.material as THREE.SpriteMaterial).color.copy(col);
    (v.glow.material as THREE.SpriteMaterial).opacity = (n.active ? 0.8 : n.visible ? 0.4 : 0.1) * reveal;
    v.gem.rotation.y = time * (n.active ? 2.2 : 0.7);
    v.gem.position.y = n.def.position[1] + 0.9 + Math.sin(time * 1.8) * 0.08;
    v.glow.position.copy(v.gem.position);
    v.ring.scale.setScalar(1 + (n.active ? 0.1 : 0.04) * Math.sin(time * 3));
  }

  private portalT = 0;
  private updatePortal(ready: boolean, dt: number, time: number, _cameraPos: THREE.Vector3): void {
    const p = this.portal;
    this.portalT = THREE.MathUtils.clamp(this.portalT + (ready ? dt / 0.8 : -dt / 0.4), 0, 1);
    const e = this.portalT;
    p.ringMat.color.copy(C_DIM).lerp(C_CYAN, e);
    p.discMat.opacity = 0.22 * e + 0.08 * e * Math.sin(time * 3);
    (p.glow.material as THREE.SpriteMaterial).opacity = 0.7 * e;
    p.ring.rotation.z = time * (0.3 + e * 1.2);
  }

  dispose(): void {
    for (const d of this.disposables) d.dispose();
  }
}
