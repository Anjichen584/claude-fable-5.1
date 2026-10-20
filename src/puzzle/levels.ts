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
  chapter: 1,
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
  chapter: 1,
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
  chapter: 1,
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

// ===========================================================================
// 第二章 Double Rotation 双旋
// 概念：四维里两个正交平面可以同时旋转；没有任何固定轴。
// 机制：双旋桥 —— 两个目标顶点必须同时落在各自锚点上，单一平面无法做到。
// ===========================================================================

// ---------------------------------------------------------------------------
// Level 04 — Two Hands：XW（Q/E）+ YZ（3 + [ ]），一对完全正交的平面
// 目标是两个"面心"：(−1,0,0,1) 只被 XW 移动、(0,1,−1,0) 只被 YZ 移动 → 两只手互不干扰。
// 基础姿态为单位元，用 tilt（投影后的三维倾斜）摆放视角，保证解耦严格成立。
// ---------------------------------------------------------------------------
const L4_BASE = rot({});

export const LEVEL_4: LevelDef = {
  id: 'twohands',
  index: 4,
  chapter: 2,
  title: 'Two Hands',
  subtitle: '双手',
  platforms: [
    { min: [-2, -T, 2.5], max: [2, 0, 7] },
    { min: [-2, -T, -7], max: [2, 0, -2.5] },
  ],
  playerStart: [0, 0, 5],
  core: {
    position: [0, 2.6, 0],
    scale: 1.2,
    initialRotation: L4_BASE,
    tilt: { pitch: 0.3, yaw: 0.5 },
    allowedPlanes: ['XY', 'XZ', 'YZ', 'XW', 'YW', 'ZW'],
  },
  bridges: [
    {
      id: 'bridge-1',
      start: [0, 0, 2.5],
      walkable: { min: [-0.7, -T, -2.6], max: [0.7, 0, 2.6] },
      vertex: [-1, 0, 0, 1],
      plane: 'XW',
      vertex2: [0, 1, -1, 0],
      plane2: 'YZ',
      solution: { ...L4_BASE, XW: deg(-65), YZ: deg(-110) },
    },
  ],
  nodes: [],
  exit: { position: [0, 0, -5.5], radius: 0.9, requires: ['bridge-1'] },
  hints: [
    { id: 'h-start', when: 'start', text: '这座桥有两个共振点，都是"面心"（一个面的中心）。XW（Q / E）只能移动第一个；YZ（按 3，再用 [ ]）只能移动第二个。' },
    { id: 'h-w', when: 'noW:8', text: 'XW 与 YZ 没有公共的轴 —— 完全正交。各调各的，互不干扰。' },
    { id: 'h-done', when: 'activated:bridge-1', text: '两个平面同时在转，却互不影响。三维里做不到：任何两个旋转轴都会打架。' },
  ],
};

// ---------------------------------------------------------------------------
// Level 05 — Isoclinic：XW 与 YZ 等角双旋（Shift + [ ]）
// ---------------------------------------------------------------------------
const L5_BASE = rot({ XZ: -0.45, XY: 0.2 });

export const LEVEL_5: LevelDef = {
  id: 'isoclinic',
  index: 5,
  chapter: 2,
  title: 'Isoclinic',
  subtitle: '等角',
  platforms: [
    { min: [-2, -T, 2.5], max: [2, 0, 7] },
    { min: [-2, -T, -7], max: [2, 0, -2.5] },
  ],
  playerStart: [0, 0, 5],
  core: {
    position: [0, 2.6, 0],
    scale: 1.2,
    initialRotation: L5_BASE,
    allowedPlanes: ['XY', 'XZ', 'YZ', 'XW', 'YW', 'ZW'],
    linked: ['XW', 'YZ'],
  },
  bridges: [
    {
      id: 'bridge-1',
      start: [0, 0, 2.5],
      walkable: { min: [-0.7, -T, -2.6], max: [0.7, 0, 2.6] },
      vertex: 4,
      plane: 'XW',
      vertex2: 14,
      plane2: 'YZ',
      solution: { ...L5_BASE, XW: deg(100), YZ: L5_BASE.YZ + deg(100) },
    },
  ],
  nodes: [],
  exit: { position: [0, 0, -5.5], radius: 0.9, requires: ['bridge-1'] },
  hints: [
    { id: 'h-start', when: 'start', text: 'XW 与 YZ 是一对完全正交的平面。按住 Shift 再按 [ 或 ]，两者会以相同角速度一起转 —— 等角双旋。' },
    { id: 'h-w', when: 'noW:8', text: '等角双旋里每个顶点都以同样的速度绕行，没有任何点静止。试试 Shift + ]。' },
    { id: 'h-done', when: 'activated:bridge-1', text: '两个锚点同时到位：两个角度相等。这是四维独有的运动。' },
  ],
};

// ---------------------------------------------------------------------------
// Level 06 — Counterweight：面心双手桥（YW + XZ）→ 中继 → 等角桥（ZW ≡ XY）
// ---------------------------------------------------------------------------
const L6_BASE = rot({});
const L6_A = { ...L6_BASE, YW: deg(65), XZ: deg(-85) };

export const LEVEL_6: LevelDef = {
  id: 'counterweight',
  index: 6,
  chapter: 2,
  title: 'Counterweight',
  subtitle: '配重',
  platforms: [
    { min: [-2, -T, 4], max: [2, 0, 8] },
    { min: [-2.5, -T, -1.5], max: [2.5, 0, 1.5] },
    { min: [-2, -T, -8], max: [2, 0, -4] },
  ],
  playerStart: [0, 0, 6],
  core: {
    position: [0, 3.1, 0],
    scale: 1.2,
    initialRotation: L6_BASE,
    tilt: { pitch: -0.25, yaw: -0.4 },
    allowedPlanes: ['XY', 'XZ', 'YZ', 'XW', 'YW', 'ZW'],
    linked: ['ZW', 'XY'],
  },
  bridges: [
    {
      id: 'bridge-a',
      start: [0, 0, 4],
      walkable: { min: [-0.7, -T, 1.4], max: [0.7, 0, 4.1] },
      vertex: [0, 1, 0, 1],
      plane: 'YW',
      vertex2: [1, 0, 1, 0],
      plane2: 'XZ',
      solution: L6_A,
    },
    {
      id: 'bridge-b',
      start: [0, 0, -1.5],
      walkable: { min: [-0.7, -T, -4.1], max: [0.7, 0, -1.4] },
      vertex: 10,
      plane: 'ZW',
      vertex2: 12,
      plane2: 'XY',
      solution: { ...L6_A, ZW: deg(100), XY: deg(100) },
      requires: ['relay'],
    },
  ],
  nodes: [{ id: 'relay', position: [0, 0, 0], trigger: { kind: 'reach', radius: 0.9 }, requires: ['bridge-a'] }],
  exit: { position: [0, 0, -6.5], radius: 0.9, requires: ['bridge-b'] },
  hints: [
    { id: 'h-start', when: 'start', text: '章末综合。第一座桥是另一对正交平面：YW（Z / C）配 XZ（按 2，再用 [ ]）。' },
    { id: 'h-a', when: 'activated:bridge-a', text: '走到中继平台。' },
    { id: 'h-relay', when: 'activated:relay', text: '最后一座桥是 ZW 与 XY 的等角双旋，目标是两个顶点：Shift + [ ]。' },
    { id: 'h-b', when: 'activated:bridge-b', text: '单旋、双旋、等角。四维旋转的三种面貌，你都用过了。' },
  ],
};

export const LEVELS: readonly LevelDef[] = [LEVEL_1, LEVEL_2, LEVEL_3, LEVEL_4, LEVEL_5, LEVEL_6];

export function levelByIndex(index: number): LevelDef | undefined {
  return LEVELS.find((l) => l.index === index);
}
