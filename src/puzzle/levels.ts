import { identityRotation, type Rotation4D } from '../math';
import type { LevelDef } from './types';

const deg = (d: number) => (d * Math.PI) / 180;
const rot = (r: Partial<Rotation4D>): Rotation4D => ({ ...identityRotation(), ...r });

/** 平台厚度 */
const T = 0.3;

// ---------------------------------------------------------------------------
// Level 01 — The Fold
// ---------------------------------------------------------------------------
const L1_BASE = rot({ XY: 0.25, YZ: 0.4 });

export const LEVEL_1: LevelDef = {
  id: 'fold',
  index: 1,
  title: 'The Fold',
  subtitle: '折叠之门',
  platforms: [
    { min: [-2, -T, 2.5], max: [2, 0, 7] },
    { min: [-2, -T, -7], max: [2, 0, -2.5] },
  ],
  playerStart: [0, 0, 5],
  core: {
    position: [0, 1.8, 0],
    scale: 1.2,
    initialRotation: L1_BASE,
    allowedPlanes: ['XY', 'XZ', 'YZ', 'XW', 'YW', 'ZW'],
  },
  bridges: [
    {
      id: 'bridge-1',
      start: [0, 0, 2.5],
      walkable: { min: [-0.7, -T, -2.6], max: [0.7, 0, 2.6] },
      vertex: 1,
      plane: 'XW',
      solution: { ...L1_BASE, XW: deg(115) },
    },
  ],
  nodes: [],
  exit: { position: [0, 0, -5.5], radius: 0.9, requires: ['bridge-1'] },
  hints: [
    { id: 'h-start', when: 'start', text: '出口就在对面，但桥断了。拖动鼠标可以环视；四维核心悬在裂口上方。' },
    { id: 'h-w', when: 'noW:8', text: '你只旋转了熟悉的三个维度。试试 W —— 按住 Q 或 E。' },
    { id: 'h-done', when: 'activated:bridge-1', text: '共振建立。桥已锁定，走过去。' },
  ],
};

// ---------------------------------------------------------------------------
// Level 02 — Reassembly
// ---------------------------------------------------------------------------
const L2_BASE = rot({ XZ: 0.5, YZ: 0.3 });
const L2_A = { ...L2_BASE, XW: deg(-115) };

export const LEVEL_2: LevelDef = {
  id: 'reassembly',
  index: 2,
  title: 'Reassembly',
  subtitle: '重组',
  platforms: [
    { min: [-2, -T, 4], max: [2, 0, 8] },
    { min: [-2, -T, -1], max: [2, 0, 1] },
    { min: [-2, -T, -8], max: [2, 0, -4] },
  ],
  playerStart: [0, 0, 6],
  core: {
    position: [0, 3.1, 0],
    scale: 1.2,
    initialRotation: L2_BASE,
    allowedPlanes: ['XY', 'XZ', 'YZ', 'XW', 'YW', 'ZW'],
  },
  bridges: [
    {
      id: 'bridge-a',
      start: [0, 0, 4],
      walkable: { min: [-0.7, -T, 0.9], max: [0.7, 0, 4.1] },
      vertex: 13,
      plane: 'XW',
      solution: L2_A,
    },
    {
      id: 'bridge-b',
      start: [0, 0, -1],
      walkable: { min: [-0.7, -T, -4.1], max: [0.7, 0, -0.9] },
      vertex: 8,
      plane: 'YW',
      solution: { ...L2_A, YW: deg(55) },
      requires: ['relay'],
    },
  ],
  nodes: [
    { id: 'relay', position: [0, 0, 0], trigger: { kind: 'reach', radius: 0.8 }, requires: ['bridge-a'] },
  ],
  exit: { position: [0, 0, -6.5], radius: 0.9, requires: ['bridge-b'] },
  hints: [
    { id: 'h-start', when: 'start', text: '两段断桥。先用 XW（Q / E）接通第一段，走到中继平台。' },
    { id: 'h-a', when: 'activated:bridge-a', text: '第一段已锁定。中继节点在平台中央。' },
    { id: 'h-relay', when: 'activated:relay', text: '节点激活，第二个锚点出现了。这次是 YW —— Z / C。' },
    { id: 'h-b', when: 'activated:bridge-b', text: '通路完成。' },
  ],
};

// ---------------------------------------------------------------------------
// Level 03 — The Slice
// ---------------------------------------------------------------------------
const L3_BASE = rot({ XY: 0.35, XZ: -0.5 });
const L3_A = { ...L3_BASE, XW: deg(-110) };

export const LEVEL_3: LevelDef = {
  id: 'slice',
  index: 3,
  title: 'The Slice',
  subtitle: '切面',
  platforms: [
    { min: [-2, -T, 4], max: [2, 0, 8] },
    { min: [-2.5, -T, -1.5], max: [2.5, 0, 1.5] },
    { min: [-2, -T, -8], max: [2, 0, -4] },
  ],
  playerStart: [0, 0, 6],
  core: {
    position: [0, 3.1, 0],
    scale: 1.2,
    initialRotation: L3_BASE,
    allowedPlanes: ['XY', 'XZ', 'YZ', 'XW', 'YW', 'ZW'],
  },
  bridges: [
    {
      id: 'bridge-a',
      start: [0, 0, 4],
      walkable: { min: [-0.7, -T, 1.4], max: [0.7, 0, 4.1] },
      vertex: 9,
      plane: 'XW',
      solution: L3_A,
    },
    {
      id: 'bridge-b',
      start: [0, 0, -1.5],
      walkable: { min: [-0.7, -T, -4.1], max: [0.7, 0, -1.4] },
      vertex: 0,
      plane: 'ZW',
      solution: { ...L3_A, ZW: deg(110) },
      requires: ['hidden'],
    },
  ],
  nodes: [
    // 只存在于 w₀ ∈ [0.3, 0.5] 这个切面里的节点
    { id: 'hidden', position: [0, 0, 0], trigger: { kind: 'slice', range: [0.3, 0.5], holdSeconds: 0.3 }, requires: ['bridge-a'] },
  ],
  exit: { position: [0, 0, -6.5], radius: 0.9, requires: ['bridge-b'] },
  slice: { enabled: true, initial: -0.9, range: [-2.2, 2.2] },
  hints: [
    { id: 'h-start', when: 'start', text: '这一关你看到的是核心的一个切面（金色）。先用 XW（Q / E）接通第一段桥。' },
    { id: 'h-a', when: 'activated:bridge-a', text: '中继平台是空的——节点藏在另一个切面里。用 , 和 . 移动切片位置 w₀，找到它。' },
    { id: 'h-hidden', when: 'activated:hidden', text: '节点显形。最后一座桥需要 ZW：按 6 选中 ZW，再用 [ 和 ] 旋转。' },
    { id: 'h-b', when: 'activated:bridge-b', text: '三个维度的旋转、一个维度的切片。通路完成。' },
  ],
};

export const LEVELS: readonly LevelDef[] = [LEVEL_1, LEVEL_2, LEVEL_3];

export function levelByIndex(index: number): LevelDef | undefined {
  return LEVELS.find((l) => l.index === index);
}
