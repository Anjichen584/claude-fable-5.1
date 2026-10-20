import { DEFAULT_PROJECTION, identityRotation, type Plane, type ProjectionConfig, type ProjectionMode, type Rotation4D } from '../math';

/**
 * 四维物体的"姿态状态"。只描述四维核心，不包含摄像机——
 * 摄像机由 CameraRig / OrbitControls 独立持有，二者永不共用。
 */
export interface ViewState {
  rotation: Rotation4D;
  projection: ProjectionConfig;
  /** 当前投影方式（第四章可切换）；blend 是过渡动画值 0 透视 → 1 正交 */
  projectionMode: ProjectionMode;
  projectionBlend: number;
  slice: { enabled: boolean; w0: number };
  /** HUD 上 1–6 选中的"自由平面"，由 [ ] 键调整 */
  activePlane: Plane;
  /** 是否显示被切片的原始投影线框（半透明） */
  showProjection: boolean;
}

export function createDefaultViewState(): ViewState {
  return {
    rotation: identityRotation(),
    projection: { ...DEFAULT_PROJECTION },
    projectionMode: 'perspective',
    projectionBlend: 0,
    slice: { enabled: false, w0: 0 },
    activePlane: 'XW',
    showProjection: true,
  };
}

export function resetViewState(s: ViewState): void {
  const d = createDefaultViewState();
  s.rotation = d.rotation;
  s.projection = d.projection;
  s.projectionMode = d.projectionMode;
  s.projectionBlend = d.projectionBlend;
  s.slice = d.slice;
  s.activePlane = d.activePlane;
  s.showProjection = d.showProjection;
}
