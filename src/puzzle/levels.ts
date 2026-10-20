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

// ===========================================================================
// 第三章 Cross-Sections 截面
// 概念：同一个超立方体，截面可以是立方体、棱柱、四面体……取决于"什么朝着 W 方向"：
//   0 个 W 平面旋转 → 顶端是一个胞 → 截面是立方体
//   1 个             → 顶端是一个面 → 永远是长方体（只变比例）
//   2 个             → 顶端是一条边 → 三棱柱 / 五棱柱 / 六棱柱
//   3 个             → 顶端是一个顶点 → 四面体 / 截角四面体 / （正中）八面体
// 机制：形状节点（截面签名匹配并保持 0.5 s）+ 闸门（节点满足即成路）。没有锚点。
// ===========================================================================

const PRISM = { vertices: 6, edges: 9 };
const TETRA = { vertices: 4, edges: 6 };
const TWELVE = { vertices: 12, edges: 18 };

// ---------------------------------------------------------------------------
// Level 07 — Prism：两个 W 平面
// ---------------------------------------------------------------------------
export const LEVEL_7: LevelDef = {
  id: 'prism',
  index: 7,
  chapter: 3,
  title: 'Prism',
  subtitle: '棱柱',
  platforms: [
    { min: [-2, -T, 2.5], max: [2, 0, 7] },
    { min: [-2, -T, -7], max: [2, 0, -2.5] },
  ],
  playerStart: [0, 0, 5],
  core: {
    position: [0, 2.6, 0],
    scale: 1.2,
    initialRotation: rot({}),
    tilt: { pitch: 0.25, yaw: 0.6 },
    allowedPlanes: ['XY', 'XZ', 'YZ', 'XW', 'YW', 'ZW'],
  },
  bridges: [],
  nodes: [{ id: 'prism', position: [0, 0, 0], trigger: { kind: 'shape', shape: PRISM, label: '三棱柱 6v · 9e', holdSeconds: 0.5 } }],
  gates: [{ id: 'gate-1', start: [0, 0, 2.5], walkable: { min: [-0.7, -T, -2.6], max: [0.7, 0, 2.6] }, requires: ['prism'] }],
  exit: { position: [0, 0, -5.5], radius: 0.9, requires: ['gate-1'] },
  slice: { enabled: true, initial: 0, range: [-2.2, 2.2] },
  hints: [
    { id: 'h-start', when: 'start', text: '这一关没有锚点。金色的是核心在 w₀ 处的截面——现在是一个正立方体（HUD 记作长方体）。闸门只认形状：把截面变成三棱柱。' },
    { id: 'h-w', when: 'noW:8', text: '只转一个 W 平面，截面永远是长方体，只会变胖变瘦。试试同时转两个：YW（Z / C）和 ZW（6 + [ ]），再用 , . 扫描 w₀。' },
    { id: 'h-done', when: 'activated:prism', text: '三棱柱：此时朝着 W 方向的最前端是一条棱。闸门开启。' },
  ],
};

// ---------------------------------------------------------------------------
// Level 08 — Vertex First：三个 W 平面
// ---------------------------------------------------------------------------
export const LEVEL_8: LevelDef = {
  id: 'vertexfirst',
  index: 8,
  chapter: 3,
  title: 'Vertex First',
  subtitle: '顶点朝前',
  platforms: [
    { min: [-2, -T, 2.5], max: [2, 0, 7] },
    { min: [-2, -T, -7], max: [2, 0, -2.5] },
  ],
  playerStart: [0, 0, 5],
  core: {
    position: [0, 2.6, 0],
    scale: 1.2,
    initialRotation: rot({}),
    tilt: { pitch: 0.2, yaw: -0.5 },
    allowedPlanes: ['XY', 'XZ', 'YZ', 'XW', 'YW', 'ZW'],
  },
  bridges: [],
  nodes: [{ id: 'tetra', position: [0, 0, 0], trigger: { kind: 'shape', shape: TETRA, label: '四面体 4v · 6e', holdSeconds: 0.5 } }],
  gates: [{ id: 'gate-1', start: [0, 0, 2.5], walkable: { min: [-0.7, -T, -2.6], max: [0.7, 0, 2.6] }, requires: ['tetra'] }],
  exit: { position: [0, 0, -5.5], radius: 0.9, requires: ['gate-1'] },
  slice: { enabled: true, initial: 0, range: [-2.2, 2.2] },
  hints: [
    { id: 'h-start', when: 'start', text: '闸门要求四面体。三棱柱的最前端是一条棱；四面体的最前端是一个顶点——三个 W 平面都要转。' },
    { id: 'h-w', when: 'noW:8', text: 'XW（Q / E）、YW（Z / C）、ZW（6 + [ ]）各转一点，然后把 w₀ 推到最边缘：四面体只在顶点附近出现。' },
    { id: 'h-done', when: 'activated:tetra', text: '顶点附近的截面是四面体，正如立方体顶角附近的截面是三角形。' },
  ],
};

// ---------------------------------------------------------------------------
// Level 09 — Scan：棱柱 → 四面体 → 十二顶点截面（章末综合）
// ---------------------------------------------------------------------------
export const LEVEL_9: LevelDef = {
  id: 'scan',
  index: 9,
  chapter: 3,
  title: 'Scan',
  subtitle: '扫描',
  platforms: [
    { min: [-2, -T, 4], max: [2, 0, 8] },
    { min: [-2.5, -T, -1.5], max: [2.5, 0, 1.5] },
    { min: [-2, -T, -8], max: [2, 0, -4] },
  ],
  playerStart: [0, 0, 6],
  core: {
    position: [0, 3.1, 0],
    scale: 1.2,
    initialRotation: rot({}),
    tilt: { pitch: 0.3, yaw: 0.4 },
    allowedPlanes: ['XY', 'XZ', 'YZ', 'XW', 'YW', 'ZW'],
  },
  bridges: [],
  nodes: [
    { id: 'prism', position: [0, 0, 2.7], trigger: { kind: 'shape', shape: PRISM, label: '三棱柱 6v · 9e', holdSeconds: 0.5 } },
    { id: 'tetra', position: [0, 0, 0], trigger: { kind: 'shape', shape: TETRA, label: '四面体 4v · 6e', holdSeconds: 0.5 }, requires: ['prism'] },
    { id: 'twelve', position: [0, 0, -2.7], trigger: { kind: 'shape', shape: TWELVE, label: '十二顶点 12v · 18e', holdSeconds: 0.5 }, requires: ['tetra'] },
  ],
  gates: [
    { id: 'gate-a', start: [0, 0, 4], walkable: { min: [-0.7, -T, 1.4], max: [0.7, 0, 4.1] }, requires: ['prism'] },
    { id: 'gate-b', start: [0, 0, -1.5], walkable: { min: [-0.7, -T, -4.1], max: [0.7, 0, -1.4] }, requires: ['twelve'] },
  ],
  exit: { position: [0, 0, -6.5], radius: 0.9, requires: ['gate-b'] },
  slice: { enabled: true, initial: 0, range: [-2.2, 2.2] },
  hints: [
    { id: 'h-start', when: 'start', text: '章末综合：三个形状，按顺序。先是三棱柱（两个 W 平面）。' },
    { id: 'h-prism', when: 'activated:prism', text: '第一道闸门开了。接着是四面体：加上第三个 W 平面，w₀ 推到边缘。' },
    { id: 'h-tetra', when: 'activated:tetra', text: '最后：保持三个旋转，把 w₀ 从顶点扫向正中。截面会经过三棱柱、长方体、五棱柱，最后变成十二个顶点的形状。' },
    { id: 'h-twelve', when: 'activated:twelve', text: '你刚刚用一个三维切片"扫描"了一个四维物体。第二道闸门开启。' },
  ],
};

export const LEVELS: readonly LevelDef[] = [LEVEL_1, LEVEL_2, LEVEL_3, LEVEL_4, LEVEL_5, LEVEL_6, LEVEL_7, LEVEL_8, LEVEL_9];

export function levelByIndex(index: number): LevelDef | undefined {
  return LEVELS.find((l) => l.index === index);
}
