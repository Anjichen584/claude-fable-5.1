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

// ===========================================================================
// 第四章 Shadows 投影之辨
// 概念：投影不是物体本身。同一个姿态，透视投影与正交投影给出不同的影子。
//   正交投影丢掉 w：对径顶点 v 与 −v 的影子永远中心对称（等距、反向）。
//   透视投影 s = d/(d−w)：w 大的顶点被放大、w 小的被缩小，对径顶点距离不等。
//   → 两个锚点"等距反向"= 只有正交做得到；"一近一远"= 只有透视做得到。
// 机制：P 键切换投影（0.45 s 过渡）；桥的 projection 字段决定锚点在哪种投影下求得，
//       判定永远用玩家当前的投影 → 投影不对，怎么转都够不着。
// ===========================================================================

// ---------------------------------------------------------------------------
// Level 10 — Shadow：开局正交，锚点一近一远 → 必须切到透视
// ---------------------------------------------------------------------------
export const LEVEL_10: LevelDef = {
  id: 'shadow',
  index: 10,
  chapter: 4,
  title: 'Shadow',
  subtitle: '影子',
  platforms: [
    { min: [-2, -T, 2.5], max: [2, 0, 7] },
    { min: [-2, -T, -7], max: [2, 0, -2.5] },
  ],
  playerStart: [0, 0, 5],
  core: {
    position: [0, 2.6, 0],
    scale: 1.2,
    initialRotation: rot({}),
    tilt: { pitch: 0.3, yaw: 0.5 },
    allowedPlanes: ['XW'],
    projection: { initial: 'orthographic', switchable: true },
  },
  bridges: [
    {
      id: 'bridge-1',
      start: [0, 0, 2.5],
      walkable: { min: [-0.7, -T, -2.6], max: [0.7, 0, 2.6] },
      vertex: 0,
      plane: 'XW',
      vertex2: 15,
      plane2: 'XW',
      solution: rot({ XW: deg(-110) }),
      projection: 'perspective',
    },
  ],
  nodes: [],
  exit: { position: [0, 0, -5.5], radius: 0.9, requires: ['bridge-1'] },
  hints: [
    { id: 'h-start', when: 'start', text: '这是正交投影下的核心——十六个顶点两两重合，看起来只是个立方体。两个共振点是一对对径顶点（0 与 15）。' },
    { id: 'h-w', when: 'noW:8', text: '正交投影里，对径的两个顶点永远离中心一样远、方向相反。可这两个锚点一近一远——这个影子里没有答案。按 P 换一种影子。' },
    { id: 'h-persp', when: 'projection:perspective', text: '透视投影：w 大的顶点被放大，w 小的被缩小。现在用 XW（Q / E）把 0 推远、把 15 拉近。' },
    { id: 'h-done', when: 'activated:bridge-1', text: '物体没变，变的是投影。影子里的"远近"是透视给的，不是物体自带的。' },
  ],
};

// ---------------------------------------------------------------------------
// Level 11 — Silhouette：开局透视，锚点等距反向 → 必须切到正交
// ---------------------------------------------------------------------------
export const LEVEL_11: LevelDef = {
  id: 'silhouette',
  index: 11,
  chapter: 4,
  title: 'Silhouette',
  subtitle: '剪影',
  platforms: [
    { min: [-2, -T, 2.5], max: [2, 0, 7] },
    { min: [-2, -T, -7], max: [2, 0, -2.5] },
  ],
  playerStart: [0, 0, 5],
  core: {
    position: [0, 2.6, 0],
    scale: 1.2,
    initialRotation: rot({}),
    tilt: { pitch: 0.3, yaw: 0.5 },
    allowedPlanes: ['YW'],
    projection: { initial: 'perspective', switchable: true },
  },
  bridges: [
    {
      id: 'bridge-1',
      start: [0, 0, 2.5],
      walkable: { min: [-0.7, -T, -2.6], max: [0.7, 0, 2.6] },
      vertex: 1,
      plane: 'YW',
      vertex2: 14,
      plane2: 'YW',
      solution: rot({ YW: deg(60) }),
      projection: 'orthographic',
    },
  ],
  nodes: [],
  exit: { position: [0, 0, -5.5], radius: 0.9, requires: ['bridge-1'] },
  hints: [
    { id: 'h-start', when: 'start', text: '这回两个锚点到核心中心一样远、方向正好相反。共振点仍是一对对径顶点（1 与 14）。' },
    { id: 'h-w', when: 'noW:8', text: '透视里对径顶点只有在 w 相等（都为 0）时才会等距，而那只发生在一个特定半径上。换正交（P）：它从不区分远近。' },
    { id: 'h-ortho', when: 'projection:orthographic', text: '正交投影：丢掉 w，只留 x y z。现在 YW（Z / C）只会让两个顶点沿一条线对称地滑动。' },
    { id: 'h-done', when: 'activated:bridge-1', text: '正交投影保留对称、丢掉深度；透视保留深度、打破对称。两种影子各说一半真话。' },
  ],
};

// ---------------------------------------------------------------------------
// Level 12 — Two Truths：透视桥 → 中继 → 正交桥（章末综合）
// ---------------------------------------------------------------------------
export const LEVEL_12: LevelDef = {
  id: 'twotruths',
  index: 12,
  chapter: 4,
  title: 'Two Truths',
  subtitle: '两种真相',
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
    tilt: { pitch: 0.3, yaw: 0.5 },
    allowedPlanes: ['XW', 'YW'],
    projection: { initial: 'orthographic', switchable: true },
  },
  bridges: [
    {
      id: 'bridge-a',
      start: [0, 0, 4],
      walkable: { min: [-0.7, -T, 1.4], max: [0.7, 0, 4.1] },
      vertex: 0,
      plane: 'XW',
      vertex2: 15,
      plane2: 'XW',
      solution: rot({ XW: deg(-110) }),
      projection: 'perspective',
    },
    {
      id: 'bridge-b',
      start: [0, 0, -1.5],
      walkable: { min: [-0.7, -T, -4.1], max: [0.7, 0, -1.4] },
      vertex: 1,
      plane: 'YW',
      vertex2: 14,
      plane2: 'YW',
      solution: rot({ XW: deg(-110), YW: deg(60) }),
      projection: 'orthographic',
      requires: ['relay'],
    },
  ],
  nodes: [{ id: 'relay', position: [0, 0, 0], trigger: { kind: 'reach', radius: 0.9 }, requires: ['bridge-a'] }],
  exit: { position: [0, 0, -6.5], radius: 0.9, requires: ['bridge-b'] },
  hints: [
    { id: 'h-start', when: 'start', text: '章末综合。第一座桥一近一远，第二座桥等距反向。看清每座桥要的是哪种影子。' },
    { id: 'h-a', when: 'activated:bridge-a', text: '透视桥锁定，XW 固定。走到中继，再决定下一座桥用哪种投影。' },
    { id: 'h-relay', when: 'activated:relay', text: '第二座桥：两个锚点等距反向——正交（P），然后 YW（Z / C）。' },
    { id: 'h-done', when: 'activated:bridge-b', text: '同一个四维姿态，两种投影各开一扇门。你看到的从来不是物体，是你选择的那种影子。' },
  ],
};

// ===========================================================================
// 第五章 Other Polytopes 异形
// 概念：四维有六种正多胞体。这里用两种：
//   正十六胞体（16-cell，超立方体的对偶）：8 顶点 24 边 32 面 16 四面体胞。顶点正对 W 时每个截面都是八面体
//     （超立方体胞正对 W 时每个截面都是立方体——对偶的镜像）。顶点形也是八面体，所以任何姿态顶端附近都是八面体；
//     "正中也是八面体"才能证明顶点正对 W。
//   正二十四胞体（24-cell，自对偶）：24 顶点 96 边 96 面 24 八面体胞。胞正对 W 时截面是截角八面体（24v36e），
//     顶点正对 W 时顶端附近是立方体（顶点形）。对称群有 1152 个元素：任何顶点都能填任何锚点（anyVertex）。
// ===========================================================================

const OCTA = { vertices: 6, edges: 12 };
const CUBE = { vertices: 8, edges: 12 };

// ---------------------------------------------------------------------------
// Level 13 — Sixteen：十六胞体，正中八面体 ⇔ 顶点正对 W
// ---------------------------------------------------------------------------
export const LEVEL_13: LevelDef = {
  id: 'sixteen',
  index: 13,
  chapter: 5,
  title: 'Sixteen',
  subtitle: '十六胞体',
  platforms: [
    { min: [-2, -T, 2.5], max: [2, 0, 7] },
    { min: [-2, -T, -7], max: [2, 0, -2.5] },
  ],
  playerStart: [0, 0, 5],
  core: {
    position: [0, 2.6, 0],
    scale: 1.4,
    initialRotation: rot({ XW: deg(30), YW: deg(20) }),
    tilt: { pitch: 0.25, yaw: 0.5 },
    allowedPlanes: ['XW', 'YW'],
    polytope: 'cell16',
  },
  bridges: [],
  nodes: [{ id: 'octa', position: [0, 0, 0], trigger: { kind: 'shape', shape: OCTA, label: '正中八面体 |w₀| ≤ 0.2', holdSeconds: 0.5, w0Range: [-0.2, 0.2] } }],
  gates: [{ id: 'gate-1', start: [0, 0, 2.5], walkable: { min: [-0.7, -T, -2.6], max: [0.7, 0, 2.6] }, requires: ['octa'] }],
  exit: { position: [0, 0, -5.5], radius: 0.9, requires: ['gate-1'] },
  slice: { enabled: true, initial: 0.2, range: [-1.2, 1.2] },
  hints: [
    { id: 'h-start', when: 'start', text: '换一个物体：正十六胞体，超立方体的对偶——8 个顶点、24 条边、16 个四面体胞。闸门要求：切片在正中（|w₀| ≤ 0.2）时截面是八面体。' },
    { id: 'h-w', when: 'noW:8', text: '顶端附近的截面总是八面体（它的顶点形）；但"正中也是八面体"只在一个顶点正对 W 时成立。把 XW、YW 都转回 0°（或 ±90°、180°）。' },
    { id: 'h-done', when: 'activated:octa', text: '超立方体胞正对 W 时每个截面都是立方体；十六胞体顶点正对 W 时每个截面都是八面体。对偶，连切片都是镜像。' },
  ],
};

// ---------------------------------------------------------------------------
// Level 14 — Twenty-Four：二十四胞体，顶点形是立方体
// ---------------------------------------------------------------------------
export const LEVEL_14: LevelDef = {
  id: 'twentyfour',
  index: 14,
  chapter: 5,
  title: 'Twenty-Four',
  subtitle: '二十四胞体',
  platforms: [
    { min: [-2, -T, 2.5], max: [2, 0, 7] },
    { min: [-2, -T, -7], max: [2, 0, -2.5] },
  ],
  playerStart: [0, 0, 5],
  core: {
    position: [0, 2.6, 0],
    scale: 1.2,
    initialRotation: rot({}),
    tilt: { pitch: 0.25, yaw: -0.5 },
    allowedPlanes: ['XW'],
    polytope: 'cell24',
  },
  bridges: [],
  nodes: [{ id: 'cube', position: [0, 0, 0], trigger: { kind: 'shape', shape: CUBE, label: '立方体 8v · 12e', holdSeconds: 0.5 } }],
  gates: [{ id: 'gate-1', start: [0, 0, 2.5], walkable: { min: [-0.7, -T, -2.6], max: [0.7, 0, 2.6] }, requires: ['cube'] }],
  exit: { position: [0, 0, -5.5], radius: 0.9, requires: ['gate-1'] },
  slice: { enabled: true, initial: 0.3, range: [-1.5, 1.5] },
  hints: [
    { id: 'h-start', when: 'start', text: '正二十四胞体：24 个顶点、96 条边、24 个正八面体胞，自对偶，三维里没有任何对应物。现在一个胞正对着 W，截面是截角八面体。闸门要立方体。' },
    { id: 'h-w', when: 'noW:8', text: '立方体是它的顶点形——顶点附近的截面。让一个顶点正对 W：XW（Q / E）转到 45° 左右，再把 w₀ 推到顶端。' },
    { id: 'h-done', when: 'activated:cube', text: '二十四胞体的顶点形是立方体，胞是八面体——它把超立方体和十六胞体的性质各拿了一半。' },
  ],
};

// ---------------------------------------------------------------------------
// Level 15 — Symmetry：立方体截面 → 中继 → 任意顶点双旋桥（章末综合）
// ---------------------------------------------------------------------------
export const LEVEL_15: LevelDef = {
  id: 'symmetry',
  index: 15,
  chapter: 5,
  title: 'Symmetry',
  subtitle: '对称',
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
    tilt: { pitch: 0.3, yaw: 0.5 },
    allowedPlanes: ['XW', 'YZ'],
    polytope: 'cell24',
  },
  bridges: [
    {
      id: 'bridge-b',
      start: [0, 0, -1.5],
      walkable: { min: [-0.7, -T, -4.1], max: [0.7, 0, -1.4] },
      vertex: 8, // (1, 0, 0, 1)
      plane: 'XW',
      vertex2: 12, // (0, 1, 1, 0)
      plane2: 'YZ',
      solution: rot({ XW: deg(-75), YZ: deg(70) }),
      anyVertex: true,
      requires: ['relay'],
    },
  ],
  nodes: [
    { id: 'cube', position: [0, 0, 2.7], trigger: { kind: 'shape', shape: CUBE, label: '立方体 8v · 12e', holdSeconds: 0.5 } },
    { id: 'relay', position: [0, 0, 0], trigger: { kind: 'reach', radius: 0.9 }, requires: ['cube'] },
  ],
  gates: [{ id: 'gate-a', start: [0, 0, 4], walkable: { min: [-0.7, -T, 1.4], max: [0.7, 0, 4.1] }, requires: ['cube'] }],
  exit: { position: [0, 0, -6.5], radius: 0.9, requires: ['bridge-b'] },
  slice: { enabled: true, initial: 0.3, range: [-1.5, 1.5] },
  hints: [
    { id: 'h-start', when: 'start', text: '章末综合。先用立方体截面打开第一道闸门（XW ≈ 45°，w₀ 推到顶端）。' },
    { id: 'h-cube', when: 'activated:cube', text: '闸门开启。走到中继——后面是一座双旋桥，但这次任何顶点都能填锚点。' },
    { id: 'h-relay', when: 'activated:relay', text: '二十四胞体有 1152 个对称：XW 或 YZ 转 90° 后，又是另一个顶点落到原来的位置。XW（Q / E）与 YZ（3 + [ ]）各自调整，哪个顶点来都算。' },
    { id: 'h-done', when: 'activated:bridge-b', text: '对称越高，解越多。六种正多胞体里，二十四胞体是唯一没有三维类比的——它只属于四维。' },
  ],
};

// ===========================================================================
// 第六章 Crossing Over 跨越
// 概念：玩家自身获得 W 坐标。平台可以位于不同的 w 层（AABB.w）；|玩家 w − 平台 w| ≤ 0.5 才可行走。
//   I / K 沿 W 滑动，只能滑到脚下仍有同层地面的位置（不能跳层）。
//   三维里"不相连"的两块平台，可以经由另一个 w 层连起来。
//   章末："你自己就是切片"——切片 w₀ 跟随玩家 w，形状节点靠移动自己来满足。
// ===========================================================================

// ---------------------------------------------------------------------------
// Level 16 — Step Aside：第一次沿 W 移动
// ---------------------------------------------------------------------------
export const LEVEL_16: LevelDef = {
  id: 'stepaside',
  index: 16,
  chapter: 6,
  title: 'Step Aside',
  subtitle: '侧步',
  platforms: [
    { min: [-2, -T, 2.5], max: [2, 0, 7] },
    { min: [-2, -T, -7], max: [2, 0, -2.5] },
    // w = +1 层：一条横跨缺口的走廊，只与起点平台重叠一小段
    { min: [-1, -T, -4], max: [1, 0, 4], w: 1 },
  ],
  playerStart: [0, 0, 5],
  core: {
    position: [0, 2.6, 0],
    scale: 1.0,
    initialRotation: rot({ XW: deg(20) }),
    tilt: { pitch: 0.25, yaw: 0.5 },
    allowedPlanes: [],
  },
  bridges: [],
  nodes: [],
  gates: [],
  exit: { position: [0, 0, -5.5], radius: 0.9, requires: [] },
  playerW: { enabled: true, initial: 0, range: [-1.5, 1.5] },
  hints: [
    { id: 'h-start', when: 'start', text: '从今天起，你也有 w 坐标了。按 I / K 沿 W 移动——只能滑到脚下仍有地面的地方。淡紫色的轮廓是 w = +1 层的平台。' },
    { id: 'h-w', when: 'noW:6', text: '站到起点平台靠近缺口的一端（紫色轮廓覆盖的地方），按住 I 滑到 w = +1，沿走廊走过缺口，再按 K 滑回 w = 0。' },
    { id: 'h-exit', when: 'exitReady', text: '出口在 w = 0 层。' },
  ],
};

// ---------------------------------------------------------------------------
// Level 17 — Through：在另一层触发节点，桥在本层
// ---------------------------------------------------------------------------
const L17_BASE = rot({ XZ: 0.3 });
export const LEVEL_17: LevelDef = {
  id: 'through',
  index: 17,
  chapter: 6,
  title: 'Through',
  subtitle: '穿过',
  platforms: [
    { min: [-2, -T, 4], max: [2, 0, 8] },
    { min: [-2.5, -T, -1.5], max: [2.5, 0, 1.5] },
    { min: [-2, -T, -8], max: [2, 0, -4] },
    // w = +1：从起点通到中间平台的走廊
    { min: [-1, -T, -1.5], max: [1, 0, 5], w: 1 },
    // w = −1：中间平台下方的一小块"暗室"，节点在这里
    { min: [-1.5, -T, -1.5], max: [1.5, 0, 1.5], w: -1 },
  ],
  playerStart: [0, 0, 6],
  core: {
    position: [0, 3.1, 0],
    scale: 1.2,
    initialRotation: L17_BASE,
    tilt: { pitch: 0.3, yaw: 0.5 },
    allowedPlanes: ['XW'],
  },
  bridges: [
    {
      id: 'bridge-1',
      start: [0, 0, -1.5],
      walkable: { min: [-0.7, -T, -4.1], max: [0.7, 0, -1.4] },
      vertex: 1,
      plane: 'XW',
      solution: { ...L17_BASE, XW: deg(110) },
      requires: ['key'],
    },
  ],
  nodes: [{ id: 'key', position: [0, 0, 0], trigger: { kind: 'reach', radius: 0.9, w: -1 } }],
  gates: [],
  exit: { position: [0, 0, -6.5], radius: 0.9, requires: ['bridge-1'] },
  playerW: { enabled: true, initial: 0, range: [-1.5, 1.5] },
  hints: [
    { id: 'h-start', when: 'start', text: '先经 w = +1 的走廊到中间平台。桥的锚点还没出现——它的钥匙在 w = −1 层，中间平台的正下方。' },
    { id: 'h-key', when: 'activated:key', text: '钥匙节点激活，锚点出现在 w = 0 层。滑回 w = 0，用 XW（Q / E）对齐。' },
    { id: 'h-done', when: 'activated:bridge-1', text: '同一个位置、不同的 w：三维里看是同一块地，四维里是三个房间。' },
  ],
};

// ---------------------------------------------------------------------------
// Level 18 — You Are the Slice：切片跟随玩家 w（章末综合）
// ---------------------------------------------------------------------------
const TETRA_6 = { vertices: 4, edges: 6 };
const TWELVE_6 = { vertices: 12, edges: 18 };
export const LEVEL_18: LevelDef = {
  id: 'youaretheslice',
  index: 18,
  chapter: 6,
  title: 'You Are the Slice',
  subtitle: '你就是切片',
  platforms: [
    // 起点：三层叠放，供玩家沿 W 爬升到 w = 2
    { min: [-2, -T, 4], max: [2, 0, 8] },
    { min: [-2, -T, 4], max: [2, 0, 8], w: 1 },
    { min: [-2, -T, 4], max: [2, 0, 8], w: 2 },
    // 对岸：w = 2 层的平台，再逐层下到 w = 0
    { min: [-2, -T, -8], max: [2, 0, -4], w: 2 },
    { min: [-2, -T, -8], max: [2, 0, -4], w: 1 },
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
    { id: 'tetra', position: [0, 0, 2.7], trigger: { kind: 'shape', shape: TETRA_6, label: '四面体 4v · 6e（在你的 w 处）', holdSeconds: 0.2 } },
    { id: 'twelve', position: [0, 0, -2.7], trigger: { kind: 'shape', shape: TWELVE_6, label: '十二顶点 12v · 18e（在你的 w 处）', holdSeconds: 0.5 }, requires: ['tetra'] },
  ],
  gates: [{ id: 'gate-1', start: [0, 0, 4], walkable: { min: [-0.7, -T, -4.1], max: [0.7, 0, 4.1], w: 2 }, requires: ['tetra'] }],
  exit: { position: [0, 0, -6.5], radius: 0.9, requires: ['twelve'] },
  slice: { enabled: true, initial: 0, range: [-2.2, 2.2] },
  playerW: { enabled: true, initial: 0, range: [-2.5, 2.5], sliceFollows: true },
  hints: [
    { id: 'h-start', when: 'start', text: '这一关切片 w₀ 就是你的 w：你站在哪一层，就看到核心在那一层的截面。闸门在 w = 2 层，要求四面体。' },
    { id: 'h-w', when: 'noW:8', text: '四面体只在顶点附近：三个 W 平面都转（Q/E、Z/C、6 + [ ]），然后按住 I 沿 W 向上爬——经过 w ≈ 1.2–2 时截面会变成四面体。' },
    { id: 'h-tetra', when: 'activated:tetra', text: '闸门开在 w = 2 层。走过去，再逐层下到 w = 0：出口要求你站在十二顶点截面所在的层。' },
    { id: 'h-done', when: 'activated:twelve', text: '你刚刚用自己的身体扫描了一个四维物体。' },
  ],
};

// ===========================================================================
// 第七章 The Nexus 枢纽（终章）
// 没有新概念。前六天的每一种能力各自回响一次，然后在枢纽里同时用上。
// ===========================================================================

// ---------------------------------------------------------------------------
// Level 19 — Echo：双旋桥（第二章）→ 三棱柱截面（第三章）→ w = +1 的回声室（第六章）
// ---------------------------------------------------------------------------
const L19_BASE = rot({});
export const LEVEL_19: LevelDef = {
  id: 'echo',
  index: 19,
  chapter: 7,
  title: 'Echo',
  subtitle: '回响',
  platforms: [
    { min: [-2, -T, 2.5], max: [2, 0, 7] },
    { min: [-2, -T, -7], max: [2, 0, -2.5] },
  ],
  playerStart: [0, 0, 5],
  core: {
    position: [0, 2.6, 0],
    scale: 1.2,
    initialRotation: L19_BASE,
    tilt: { pitch: 0.3, yaw: 0.5 },
    allowedPlanes: ['XW', 'YZ', 'YW'],
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
      solution: { ...L19_BASE, XW: deg(-65), YZ: deg(-110) },
    },
  ],
  nodes: [
    { id: 'prism', position: [0, 0, -3.5], trigger: { kind: 'shape', shape: PRISM, label: '三棱柱 6v · 9e', holdSeconds: 0.5 }, requires: ['bridge-1'] },
    { id: 'echo', position: [0, 0, -6], trigger: { kind: 'reach', radius: 0.9, w: 1 }, requires: ['prism'] },
  ],
  // 回声室：w = +1 层、只覆盖对岸平台的后半段，三棱柱出现后才成路
  gates: [{ id: 'echo-room', start: [0, 0, -4], walkable: { min: [-2, -T, -7], max: [2, 0, -4], w: 1 }, requires: ['prism'] }],
  exit: { position: [0, 0, -5.5], radius: 0.9, requires: ['echo'] },
  slice: { enabled: true, initial: 0, range: [-2.2, 2.2] },
  playerW: { enabled: true, initial: 0, range: [-1.5, 1.5] },
  hints: [
    { id: 'h-start', when: 'start', text: '终章没有新东西。先把第二天的双旋桥搭起来：XW 与 YZ 各有一个目标。' },
    { id: 'h-bridge', when: 'activated:bridge-1', text: '桥锁定了 XW 与 YZ。对岸的节点要三棱柱：剩下的 YW 转一点（±20°–40°），再把切片推到边缘（|w₀| ≈ 1–1.5）。' },
    { id: 'h-prism', when: 'activated:prism', text: '对岸后半段出现了 w = +1 的回声室。按 I 上去，碰到节点，再按 K 下来。' },
    { id: 'h-exit', when: 'exitReady', text: '出口在 w = 0。' },
  ],
};

// ---------------------------------------------------------------------------
// Level 20 — Two Lights：24-cell（第五章）+ 正交投影桥（第四章）+ w = −1 钥匙（第六章）
// ---------------------------------------------------------------------------
export const LEVEL_20: LevelDef = {
  id: 'twolights',
  index: 20,
  chapter: 7,
  title: 'Two Lights',
  subtitle: '两盏灯',
  platforms: [
    { min: [-2, -T, 4], max: [2, 0, 8] },
    { min: [-2.5, -T, -1.5], max: [2.5, 0, 1.5] },
    { min: [-2, -T, -8], max: [2, 0, -4] },
    // 中间平台下方 w = −1 的钥匙室
    { min: [-1.5, -T, -1.5], max: [1.5, 0, 1.5], w: -1 },
  ],
  playerStart: [0, 0, 6],
  core: {
    position: [0, 3.1, 0],
    scale: 1.2,
    initialRotation: rot({}),
    tilt: { pitch: 0.3, yaw: 0.5 },
    allowedPlanes: ['XW', 'YZ'],
    polytope: 'cell24',
    projection: { initial: 'perspective', switchable: true },
  },
  bridges: [
    {
      id: 'bridge-b',
      start: [0, 0, -1.5],
      walkable: { min: [-0.7, -T, -4.1], max: [0.7, 0, -1.4] },
      vertex: 8, // (1, 0, 0, 1)
      plane: 'XW',
      vertex2: 12, // (0, 1, 1, 0)
      plane2: 'YZ',
      solution: rot({ XW: deg(-105), YZ: deg(70) }),
      anyVertex: true,
      projection: 'orthographic',
      requires: ['key'],
    },
  ],
  nodes: [
    { id: 'cube', position: [0, 0, 2.7], trigger: { kind: 'shape', shape: CUBE, label: '立方体 8v · 12e', holdSeconds: 0.5 } },
    { id: 'key', position: [0, 0, 0], trigger: { kind: 'reach', radius: 0.9, w: -1 }, requires: ['cube'] },
  ],
  gates: [{ id: 'gate-a', start: [0, 0, 4], walkable: { min: [-0.7, -T, 1.4], max: [0.7, 0, 4.1] }, requires: ['cube'] }],
  exit: { position: [0, 0, -6.5], radius: 0.9, requires: ['bridge-b'] },
  slice: { enabled: true, initial: 0.3, range: [-1.5, 1.5] },
  playerW: { enabled: true, initial: 0, range: [-1.5, 1.5] },
  hints: [
    { id: 'h-start', when: 'start', text: '二十四胞体。先要第五天的立方体截面（XW ≈ 45°，切片推到顶端），闸门才开。' },
    { id: 'h-cube', when: 'activated:cube', text: '闸门开了。桥的钥匙在中间平台下方 w = −1 处。' },
    { id: 'h-key', when: 'activated:key', text: '锚点出现了——但这座桥是用正交投影画的。按 P 换灯，再用 XW 与 YZ 把任意一个顶点送上去。' },
    { id: 'h-done', when: 'activated:bridge-b', text: '两盏灯、三个房间、一个不认识的物体。都用过了。' },
  ],
};

// ---------------------------------------------------------------------------
// Level 21 — The Nexus：枢纽。中央平台四条辐条，每条用一种能力；全部点亮才打开出口。
//   北：双旋桥（第二章）       东：w 层走廊 + w = −1 节点（第六章）
//   西：五棱柱截面闸门（第三章） 南：正交投影下的双旋桥（第四章 + 第二章）→ 出口
// ---------------------------------------------------------------------------
const PENTA = { vertices: 10, edges: 15 };
const L21_BASE = rot({});
export const LEVEL_21: LevelDef = {
  id: 'nexus',
  index: 21,
  chapter: 7,
  title: 'The Nexus',
  subtitle: '枢纽',
  platforms: [
    // 中央
    { min: [-2.5, -T, -2.5], max: [2.5, 0, 2.5] },
    // 北 / 南 / 西 / 东 四个端点平台
    { min: [-2, -T, -8.5], max: [2, 0, -5] },
    { min: [-2, -T, 5], max: [2, 0, 8.5] },
    { min: [-8.5, -T, -2], max: [-5, 0, 2] },
    { min: [8.5 - 3.5, -T, -2], max: [8.5, 0, 2] },
    // 东：w = +1 走廊，从中央平台东侧一直铺到东平台
    { min: [1, -T, -1], max: [6, 0, 1], w: 1 },
    // 东平台下方 w = −1 的小室（节点所在）
    { min: [4.8, -T, -1.2], max: [8, 0, 1.2], w: -1 },
  ],
  playerStart: [0, 0, 0.5],
  core: {
    position: [0, 3.4, 0],
    scale: 1.3,
    initialRotation: L21_BASE,
    tilt: { pitch: 0.3, yaw: 0.5 },
    allowedPlanes: ['XW', 'YZ', 'YW', 'ZW'],
    projection: { initial: 'perspective', switchable: true },
  },
  bridges: [
    {
      id: 'north',
      start: [0, 0, -2.5],
      walkable: { min: [-1, -T, -5.1], max: [1, 0, -2.4] },
      vertex: [-1, 0, 0, 1],
      plane: 'XW',
      vertex2: [0, 1, -1, 0],
      plane2: 'YZ',
      solution: { ...L21_BASE, XW: deg(-65), YZ: deg(-110) },
    },
    {
      id: 'south',
      start: [0, 0, 2.5],
      walkable: { min: [-1, -T, 2.4], max: [1, 0, 5.1] },
      vertex: 8,
      plane: 'YW',
      vertex2: 1,
      plane2: 'ZW',
      solution: { ...L21_BASE, XW: deg(-65), YZ: deg(-110), YW: deg(-75), ZW: deg(-45) },
      projection: 'orthographic',
      requires: ['n-node', 'e-node', 'w-node'],
    },
  ],
  nodes: [
    { id: 'n-node', position: [0, 0, -7], trigger: { kind: 'reach', radius: 0.9 }, requires: ['north'] },
    { id: 'e-node', position: [7, 0, 0], trigger: { kind: 'reach', radius: 0.9, w: -1 } },
    { id: 'penta', position: [-3.5, 0, 0], trigger: { kind: 'shape', shape: PENTA, label: '五棱柱 10v · 15e', holdSeconds: 0.5 }, requires: ['north'] },
    { id: 'w-node', position: [-7, 0, 0], trigger: { kind: 'reach', radius: 0.9 }, requires: ['penta'] },
  ],
  gates: [{ id: 'west', start: [-2.5, 0, 0], walkable: { min: [-5.1, -T, -1], max: [-2.4, 0, 1] }, requires: ['penta'] }],
  exit: { position: [0, 0, 7], radius: 0.9, requires: ['south'] },
  slice: { enabled: true, initial: 0, range: [-2.2, 2.2] },
  playerW: { enabled: true, initial: 0, range: [-1.5, 1.5] },
  hints: [
    { id: 'h-start', when: 'start', text: '枢纽。四条辐条，四种能力。北：双旋桥。东：沿 W 的走廊。西：截面闸门。南：出口。顺序不限——但有些路会互相解锁。' },
    { id: 'h-north', when: 'activated:north', text: '北桥锁定了 XW 与 YZ。西边的闸门现在可解：剩下的 YW 转 ±20°–30°，切片留在中间（|w₀| ≤ 0.6），找到五棱柱。' },
    { id: 'h-penta', when: 'activated:penta', text: '五棱柱——一个你从没见过的截面。西闸门开了。' },
    { id: 'h-east', when: 'activated:e-node', text: '东节点点亮。它在 w = −1，和走廊不是同一层。' },
    { id: 'h-south', when: 'activated:w-node', text: '三个节点都亮了，南桥的两个锚点出现。它是正交投影下的双旋桥：按 P 换灯，再把 YW 与 ZW 各自转到位。' },
    { id: 'h-exit', when: 'exitReady', text: '出口在南边。七天，到此为止。' },
  ],
};

export const LEVELS: readonly LevelDef[] = [LEVEL_1, LEVEL_2, LEVEL_3, LEVEL_4, LEVEL_5, LEVEL_6, LEVEL_7, LEVEL_8, LEVEL_9, LEVEL_10, LEVEL_11, LEVEL_12, LEVEL_13, LEVEL_14, LEVEL_15, LEVEL_16, LEVEL_17, LEVEL_18, LEVEL_19, LEVEL_20, LEVEL_21];

export function levelByIndex(index: number): LevelDef | undefined {
  return LEVELS.find((l) => l.index === index);
}
