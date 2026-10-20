import type { Plane, Rotation4D, Tilt, Vec3, Vec4 } from '../math';

/** 轴对齐包围盒（世界坐标）。可行走判定只用 x/z；y 用于渲染高度。 */
export interface AABB {
  min: Vec3;
  max: Vec3;
}

/** 桥的目标引用：顶点下标，或核心局部坐标系里的四维点。 */
export type TargetRef = number | Vec4;

/** 桥接条件的阈值。 */
export interface BridgeTolerance {
  /** 投影端点与锚点的最大距离 */
  distance: number;
  /** 连接方向最大误差（弧度） */
  angle: number;
  /** 条件需持续满足的时间（秒） */
  holdSeconds: number;
}

export const DEFAULT_TOLERANCE: BridgeTolerance = {
  distance: 0.18,
  angle: (12 * Math.PI) / 180,
  holdSeconds: 0.3,
};

/**
 * 一座桥。锚点不直接写坐标，而是由"某个顶点在某个姿态下的投影位置"推导：
 * 这样关卡在构造上一定可解，并且可以被测试验证"纯三维旋转不可解"。
 */
export interface BridgeDef {
  id: string;
  /** 桥的起点（靠近玩家一侧的平台边缘中心），用于方向判定 */
  start: Vec3;
  /** 桥激活后加入可行走集合的区域 */
  walkable: AABB;
  /** 目标：顶点下标（tesseract 0..15），或随核心一起旋转的任意四维点（如面心 (±1,0,0,±1)） */
  vertex: TargetRef;
  /** 解：在这个四维姿态下，目标顶点的投影恰好落在锚点上 */
  solution: Rotation4D;
  /** 解谜时需要玩家操作的平面（仅用于提示和 HUD 高亮） */
  plane: Plane;
  /**
   * 双旋桥（第二章起）：第二个目标顶点，必须与第一个**同时**落在各自锚点上。
   * 两个锚点都由同一个 solution 推导；plane2 是第二个顶点主要依赖的平面。
   */
  vertex2?: TargetRef;
  plane2?: Plane;
  /** 前置条件：这些节点/桥激活后，锚点才出现并开始判定 */
  requires?: string[];
  tolerance?: Partial<BridgeTolerance>;
}

export type NodeTrigger =
  | { kind: 'reach'; radius: number }
  | { kind: 'slice'; range: [number, number]; holdSeconds?: number };

/** 节点：被激活后作为其他元素的前置条件。 */
export interface NodeDef {
  id: string;
  position: Vec3;
  trigger: NodeTrigger;
  requires?: string[];
}

/** 章节：一个游玩日，一个新概念。 */
export interface ChapterDef {
  index: number;
  id: string;
  title: string;
  subtitle: string;
  /** 本章引入的概念（一句话） */
  concept: string;
  /** 章末结算文案 */
  outro: string;
  levels: LevelDef[];
}

export interface HintDef {
  id: string;
  text: string;
  /**
   * 触发条件：
   * - start：关卡开始
   * - noW:<秒>：开局后 N 秒内玩家从未旋转过 W 平面
   * - activated:<id>：某桥/节点激活
   * - exitReady：出口可用
   */
  when: string;
}

export interface LevelDef {
  id: string;
  /** 全局关卡序号（1 起，跨章连续） */
  index: number;
  /** 所属章节（1 起） */
  chapter: number;
  title: string;
  subtitle: string;
  platforms: AABB[];
  playerStart: Vec3;
  core: {
    position: Vec3;
    scale: number;
    initialRotation: Rotation4D;
    /** 投影后的三维视角倾斜（不改变四维姿态，不破坏正交平面对的解耦） */
    tilt?: Tilt;
    /** 本关允许玩家操作的平面；其他平面锁定 */
    allowedPlanes: Plane[];
    /**
     * 等角双旋（isoclinic）：按住 Shift + [ ] 时这两个（正交）平面以相同角速度一起转。
     * 两平面正交时旋转可交换，所以"同时转"与"先后转相同角度"结果一致。
     */
    linked?: [Plane, Plane];
  };
  bridges: BridgeDef[];
  nodes: NodeDef[];
  exit: { position: Vec3; radius: number; requires: string[] };
  slice?: { enabled: boolean; initial: number; range: [number, number] };
  hints: HintDef[];
}
