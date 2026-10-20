import * as THREE from 'three';
import type { Vec3 } from '../math';
import type { AABB } from '../puzzle/types';
import { footprintWalkable } from '../puzzle/PuzzleRules';
import type { Input } from './Input';

export const PLAYER_SPEED = 3.6;
export const PLAYER_RADIUS = 0.22;

/**
 * 角色：在 XZ 平面上沿可行走 AABB 移动。相对摄像机朝向的 WASD / 方向键。
 * 没有重力与坠落——不在可行走区域的移动直接被阻止（按轴分离以便贴边滑动）。
 */
export class PlayerController {
  readonly group = new THREE.Group();
  position: [number, number, number] = [0, 0, 0];
  facing = Math.PI; // 朝 -z
  private readonly body: THREE.Mesh;
  private readonly glow: THREE.Sprite;
  private readonly ring: THREE.Mesh;
  private moving = false;

  constructor() {
    const mat = new THREE.MeshStandardMaterial({
      color: '#9fe9ff',
      emissive: new THREE.Color('#38e8ff'),
      emissiveIntensity: 0.9,
      roughness: 0.3,
      metalness: 0.1,
    });
    this.body = new THREE.Mesh(new THREE.CapsuleGeometry(PLAYER_RADIUS, 0.5, 6, 12), mat);
    this.body.position.y = 0.47;
    this.group.add(this.body);

    this.glow = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: glowTex(), color: '#38e8ff', transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    this.glow.scale.setScalar(1.3);
    this.glow.position.y = 0.5;
    this.group.add(this.glow);

    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(0.28, 0.36, 32),
      new THREE.MeshBasicMaterial({ color: '#38e8ff', transparent: true, opacity: 0.6, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.02;
    this.group.add(this.ring);
  }

  setPosition(p: Vec3): void {
    this.position = [p[0], p[1], p[2]];
    this.group.position.set(p[0], p[1], p[2]);
  }

  /**
   * @param forward 摄像机的水平前向（已归一化的 [x, z]），"W" 沿它移动
   */
  update(dt: number, input: Input, forward: readonly [number, number], walkable: readonly AABB[], time: number): void {
    let ix = 0;
    let iz = 0;
    if (input.isDown('KeyW') || input.isDown('ArrowUp')) iz -= 1;
    if (input.isDown('KeyS') || input.isDown('ArrowDown')) iz += 1;
    if (input.isDown('KeyA') || input.isDown('ArrowLeft')) ix -= 1;
    if (input.isDown('KeyD') || input.isDown('ArrowRight')) ix += 1;

    this.moving = ix !== 0 || iz !== 0;
    if (this.moving) {
      const len = Math.hypot(ix, iz);
      ix /= len;
      iz /= len;
      // 右 = forward × up（y 向上）
      const fx = forward[0];
      const fz = forward[1];
      const rx = -fz;
      const rz = fx;
      const dx = ix * rx + -iz * fx;
      const dz = ix * rz + -iz * fz;
      const step = PLAYER_SPEED * dt;

      // 按轴分离，贴边时可以滑动
      const nx: Vec3 = [this.position[0] + dx * step, this.position[1], this.position[2]];
      if (footprintWalkable(nx, PLAYER_RADIUS, walkable)) this.position[0] = nx[0];
      const nz: Vec3 = [this.position[0], this.position[1], this.position[2] + dz * step];
      if (footprintWalkable(nz, PLAYER_RADIUS, walkable)) this.position[2] = nz[2];

      this.facing = Math.atan2(dx, dz);
    }

    this.group.position.set(this.position[0], this.position[1], this.position[2]);
    this.group.rotation.y = this.facing;
    const bob = this.moving ? Math.sin(time * 14) * 0.03 : Math.sin(time * 2) * 0.015;
    this.body.position.y = 0.47 + bob;
    this.ring.scale.setScalar(1 + Math.sin(time * 3) * 0.05);
  }

  dispose(): void {
    this.body.geometry.dispose();
    (this.body.material as THREE.Material).dispose();
    (this.glow.material as THREE.Material).dispose();
    this.ring.geometry.dispose();
    (this.ring.material as THREE.Material).dispose();
  }
}

let tex: THREE.Texture | null = null;
export function glowTex(): THREE.Texture {
  if (tex) return tex;
  const size = 64;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.5)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  tex = new THREE.CanvasTexture(c);
  return tex;
}
