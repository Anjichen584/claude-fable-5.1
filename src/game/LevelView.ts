import * as THREE from 'three';
import type { Vec3 } from '../math';
import type { BridgeStatus, NodeStatus, PuzzleSession, GateStatus } from '../puzzle/PuzzleSession';
import { aabbCenter, aabbSize, type BridgeEvaluation } from '../puzzle/PuzzleRules';
import type { AABB, LevelDef } from '../puzzle/types';
import { glowTex } from './PlayerController';

const C_CYAN = new THREE.Color('#38e8ff');
const C_PURPLE = new THREE.Color('#a86bff');
const C_GOLD = new THREE.Color('#ffd166');
const C_DIM = new THREE.Color('#2a3a66');

/** 一个"共振插座"：锚点环 + 锚点光晕 + 目标顶点光点 + 连线。双旋桥有两个。 */
interface SocketVisual {
  anchorRing: THREE.Mesh;
  anchorMat: THREE.MeshBasicMaterial;
  anchorGlow: THREE.Sprite;
  targetGlow: THREE.Sprite;
  beam: THREE.Line;
  beamMat: THREE.LineBasicMaterial;
  beamPositions: Float32Array;
}

interface BridgeVisual {
  id: string;
  deck: THREE.Mesh;
  deckMat: THREE.MeshBasicMaterial;
  ghost: THREE.LineSegments;
  sockets: SocketVisual[];
  lockT: number; // 锁定动画进度 0..1
}

interface GateVisual {
  id: string;
  deck: THREE.Mesh;
  deckMat: THREE.MeshBasicMaterial;
  ghost: THREE.LineSegments;
  startZ: number;
  box: AABB;
  openT: number;
}

interface PlatformVisual {
  w: number;
  mesh: THREE.Mesh;
  edgeMat: THREE.LineBasicMaterial;
  gridMat: THREE.Material;
}

/** 第六章：W 层着色——w > 0 偏紫，w < 0 偏金，0 青色 */
function layerColor(w: number): THREE.Color {
  const t = Math.max(-1, Math.min(1, w / 1.5));
  return t >= 0 ? C_CYAN.clone().lerp(C_PURPLE, t) : C_CYAN.clone().lerp(C_GOLD, -t);
}
/** 与玩家 w 的层距离 → 可见度 0.12..1 */
function layerVisibility(w: number, playerW: number): number {
  const d = Math.abs(w - playerW);
  return d <= 0.5 ? 1 : Math.max(0.12, 1 - (d - 0.5) / 0.6);
}
/** 不同 W 层的视觉 Y 偏移，避免重叠轮廓完全重合 */
const LAYER_Y = 0.05;

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
  private readonly gates = new Map<string, GateVisual>();
  private readonly platforms: PlatformVisual[] = [];
  private readonly hasLayers: boolean;
  private exitW = 0;
  private readonly nodeW = new Map<string, number>();
  private portal!: { ring: THREE.Mesh; ringMat: THREE.MeshBasicMaterial; disc: THREE.Mesh; discMat: THREE.MeshBasicMaterial; glow: THREE.Sprite; group: THREE.Group };

  constructor(level: LevelDef) {
    this.hasLayers = !!level.playerW?.enabled;
    this.exitW = level.exit.w ?? 0;
    for (const n of level.nodes) if (n.trigger.kind === 'reach' && n.trigger.w) this.nodeW.set(n.id, n.trigger.w);
    for (const p of level.platforms) this.addPlatform(p);
    for (const b of level.bridges) this.addBridge(b.id, b.walkable, b.vertex2 !== undefined ? 2 : 1);
    for (const n of level.nodes) this.addNode(n.id, n.position);
    for (const g of level.gates ?? []) this.addGate(g.id, g.walkable, g.start);
    this.addPortal(level.exit.position);
  }

  // ---------------------------------------------------------------- 闸门（无插座的桥，金色）
  private addGate(id: string, box: AABB, start: Vec3): void {
    const size = aabbSize(box);
    const center = aabbCenter(box);
    const deckGeom = new THREE.BoxGeometry(size[0], 0.08, size[2]);
    const deckMat = new THREE.MeshBasicMaterial({ color: C_GOLD, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    const deck = new THREE.Mesh(deckGeom, deckMat);
    deck.position.set(center[0], box.max[1] - 0.04, center[2]);
    deck.visible = false;
    this.group.add(deck);
    const ghostGeom = new THREE.EdgesGeometry(new THREE.BoxGeometry(size[0], 0.02, size[2]));
    const ghost = new THREE.LineSegments(ghostGeom, new THREE.LineDashedMaterial({ color: C_GOLD, transparent: true, opacity: 0.22, dashSize: 0.25, gapSize: 0.18 }));
    ghost.computeLineDistances();
    ghost.position.set(center[0], box.max[1], center[2]);
    this.group.add(ghost);
    this.gates.set(id, { id, deck, deckMat, ghost, startZ: start[2], box, openT: 0 });
    this.disposables.push(deckGeom, deckMat, ghostGeom, ghost.material as THREE.Material);
  }

  private updateGate(g: GateStatus, dt: number, time: number): void {
    const v = this.gates.get(g.def.id);
    if (!v) return;
    if (!g.open) {
      v.deck.visible = false;
      v.ghost.visible = true;
      (v.ghost.material as THREE.LineDashedMaterial).opacity = 0.18 + 0.08 * Math.sin(time * 2);
      return;
    }
    v.openT = Math.min(1, v.openT + dt / 0.7);
    const e = 1 - Math.pow(1 - v.openT, 3);
    v.deck.visible = true;
    v.ghost.visible = false;
    v.deckMat.opacity = 0.16 + 0.08 * Math.sin(time * 4) * e;
    v.deck.scale.z = Math.max(0.001, e);
    const farZ = Math.abs(v.startZ - v.box.min[2]) < Math.abs(v.startZ - v.box.max[2]) ? v.box.max[2] : v.box.min[2];
    v.deck.position.z = v.startZ + (farZ - v.startZ) * 0.5 * e;
    if (v.openT >= 1) v.deck.position.z = (v.box.min[2] + v.box.max[2]) / 2;
  }

  // ---------------------------------------------------------------- 平台
  private addPlatform(box: AABB): void {
    const size = aabbSize(box);
    const center = aabbCenter(box);
    const geom = new THREE.BoxGeometry(size[0], size[1], size[2]);
    const mat = new THREE.MeshStandardMaterial({ color: '#0b1430', roughness: 0.85, metalness: 0.2, emissive: new THREE.Color('#071022'), emissiveIntensity: 0.6 });
    const w = box.w ?? 0;
    const yOff = this.hasLayers ? w * LAYER_Y : 0;
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(center[0], center[1] + yOff, center[2]);
    this.group.add(mesh);

    const edgeMat = new THREE.LineBasicMaterial({ color: this.hasLayers ? layerColor(w) : C_CYAN, transparent: true, opacity: 0.55 });
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geom), edgeMat);
    edges.position.copy(mesh.position);
    this.group.add(edges);

    // 顶面网格
    const grid = new THREE.GridHelper(Math.max(size[0], size[2]), Math.round(Math.max(size[0], size[2]) * 2), 0x1d3b6e, 0x14284d);
    grid.position.set(center[0], box.max[1] + 0.005 + yOff, center[2]);
    grid.scale.set(size[0] / Math.max(size[0], size[2]), 1, size[2] / Math.max(size[0], size[2]));
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.5;
    this.group.add(grid);

    this.disposables.push(geom, mat, edges.geometry, edges.material as THREE.Material, grid.geometry, grid.material as THREE.Material);
    this.platforms.push({ w, mesh, edgeMat, gridMat: grid.material as THREE.Material });
  }

  /** 第六章：按玩家 w 决定各层平台/闸门/出口的可见度 */
  private updateLayers(playerW: number): void {
    if (!this.hasLayers) return;
    for (const p of this.platforms) {
      const v = layerVisibility(p.w, playerW);
      p.mesh.visible = v >= 0.99;
      p.edgeMat.opacity = 0.55 * v + (v < 0.99 ? 0.1 : 0);
      p.gridMat.opacity = 0.5 * v;
    }
    for (const g of this.gates.values()) {
      const v = layerVisibility(g.box.w ?? 0, playerW);
      g.deck.visible = g.deck.visible && v >= 0.99;
      (g.ghost.material as THREE.LineDashedMaterial).opacity *= v;
    }
    const ev = layerVisibility(this.exitW, playerW);
    this.portal.group.visible = ev > 0.2;
    this.portal.ringMat.opacity = 0.9 * ev;
  }

  // ---------------------------------------------------------------- 桥
  private addBridge(id: string, box: AABB, socketCount: number): void {
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

    const sockets: SocketVisual[] = [];
    for (let i = 0; i < socketCount; i++) sockets.push(this.addSocket(i));

    this.bridges.set(id, { id, deck, deckMat, ghost, sockets, lockT: 0 });
    this.disposables.push(deckGeom, deckMat, ghostGeom, ghost.material as THREE.Material);
  }

  /** 第二个插座用稍小的环与偏紫的色调区分 */
  private addSocket(slot: number): SocketVisual {
    const anchorMat = new THREE.MeshBasicMaterial({ color: C_PURPLE, transparent: true, opacity: 0.9, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false });
    const anchorRing = new THREE.Mesh(new THREE.TorusGeometry(slot === 0 ? 0.22 : 0.17, 0.025, 10, 40), anchorMat);
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

    this.disposables.push(anchorRing.geometry, anchorMat, anchorGlow.material, targetGlow.material, beamGeom, beamMat);
    return { anchorRing, anchorMat, anchorGlow, targetGlow, beam, beamMat, beamPositions };
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
    group.position.set(pos[0], pos[1] + 1.0 + (this.hasLayers ? this.exitW * LAYER_Y : 0), pos[2]);
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
  update(session: PuzzleSession, dt: number, time: number, cameraPos: THREE.Vector3, sliceW0: number | null = null, playerW = 0): void {
    for (const b of session.bridges) this.updateBridge(b, dt, time);
    for (const n of session.nodes) this.updateNode(n, time, sliceW0, playerW);
    for (const g of session.gates) this.updateGate(g, dt, time);
    this.updatePortal(session.exitReady, dt, time, cameraPos);
    this.updateLayers(playerW);
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
      for (const sk of v.sockets) {
        sk.anchorMat.color.copy(C_GOLD);
        (sk.anchorGlow.material as THREE.SpriteMaterial).color.copy(C_GOLD);
        sk.anchorRing.visible = true;
        sk.anchorGlow.visible = true;
        sk.anchorRing.scale.setScalar(1 + 0.08 * Math.sin(time * 5) + (1 - e) * 2.5);
        sk.anchorGlow.scale.setScalar(1.2 + (1 - e) * 4);
        (sk.anchorGlow.material as THREE.SpriteMaterial).opacity = 0.6 + (1 - e) * 0.4;
        sk.targetGlow.visible = false;
        sk.beamMat.opacity = Math.max(0, 0.9 - v.lockT);
      }
      return;
    }

    v.deck.visible = false;
    v.ghost.visible = b.visible;
    for (const sk of v.sockets) {
      sk.anchorRing.visible = b.visible;
      sk.anchorGlow.visible = b.visible;
      sk.targetGlow.visible = b.visible;
    }
    if (!b.visible || !b.evaluation) {
      for (const sk of v.sockets) sk.beamMat.opacity = 0;
      return;
    }
    const ev = b.evaluation;
    // 双旋桥：两个插座各自对应一个目标；单桥只有一个
    const evals = ev.second ? [ev.primary ?? ev, ev.second] : [ev];
    v.sockets.forEach((sk, i) => {
      const e = evals[i];
      if (!e) return;
      this.updateSocket(sk, e, b.progress, time, i);
    });
  }

  private updateSocket(sk: SocketVisual, e: BridgeEvaluation, progress: number, time: number, slot: number): void {
    sk.anchorRing.position.set(e.anchor[0], e.anchor[1], e.anchor[2]);
    sk.anchorGlow.position.copy(sk.anchorRing.position);
    sk.anchorRing.rotation.y = time * 0.8 + slot * 1.3;
    sk.anchorRing.rotation.x = Math.sin(time * 0.6 + slot) * 0.6;
    sk.targetGlow.position.set(e.endpoint[0], e.endpoint[1], e.endpoint[2]);

    const close = THREE.MathUtils.clamp(1 - e.distance / 2.5, 0, 1);
    const col = e.satisfied ? C_CYAN : C_PURPLE;
    sk.anchorMat.color.copy(col);
    (sk.anchorGlow.material as THREE.SpriteMaterial).color.copy(col);
    sk.anchorGlow.scale.setScalar(0.9 + close * 0.6 + progress * 0.8);
    sk.anchorRing.scale.setScalar(1 + progress * 0.5);
    sk.targetGlow.scale.setScalar(0.45 + 0.1 * Math.sin(time * 6 + slot));

    sk.beamPositions.set([e.endpoint[0], e.endpoint[1], e.endpoint[2], e.anchor[0], e.anchor[1], e.anchor[2]]);
    (sk.beam.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    sk.beamMat.opacity = close * close * 0.8;
    sk.beamMat.color.copy(e.satisfied ? C_CYAN : C_GOLD);
  }

  private updateNode(n: NodeStatus, time: number, sliceW0: number | null, playerW = 0): void {
    const v = this.nodes.get(n.def.id);
    if (!v) return;
    const nodeW = this.nodeW.get(n.def.id) ?? 0;
    const layerV = this.hasLayers ? layerVisibility(nodeW, playerW) : 1;
    const col = (n.active ? C_GOLD : n.visible ? C_PURPLE : C_DIM).clone();
    // 切片节点：只在切片位置接近它所在的 w 区间时显形
    let reveal = 1;
    if (n.def.trigger.kind === 'slice' && !n.active) {
      const [a, b] = n.def.trigger.range;
      const c = (a + b) / 2;
      const half = (b - a) / 2;
      const d = sliceW0 === null ? Infinity : Math.max(0, Math.abs(sliceW0 - c) - half);
      reveal = THREE.MathUtils.clamp(1 - d / 0.5, 0, 1);
    }
    if (n.def.trigger.kind === 'shape' && !n.active && n.visible) {
      // 形状节点：匹配中（hold 累积）时用金色脉冲预告
      const hs = n.def.trigger.holdSeconds ?? 0.5;
      const t = THREE.MathUtils.clamp(n.hold / hs, 0, 1);
      if (t > 0) col.copy(C_PURPLE).lerp(C_GOLD, t);
    }
    reveal *= layerV;
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
