import { PLANES, wrapAngle, type Plane } from '../math';
import type { Input } from './Input';
import type { ViewState } from './ViewState';

/** 四维核心的键位：一个输入只做一件事；鼠标永远不碰这里。 */
export const KEYMAP = {
  XW: ['KeyQ', 'KeyE'],
  YW: ['KeyZ', 'KeyC'],
  active: ['BracketLeft', 'BracketRight'],
  slice: ['Comma', 'Period'],
  toggleSlice: 'KeyX',
  /** 透视 ⇄ 正交（第四章） */
  toggleProjection: 'KeyP',
  selectPlane: ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6'],
  /** 按住任一 Shift + [ ] → 等角双旋（关卡定义了 linked 平面时） */
  linkModifier: ['ShiftLeft', 'ShiftRight'],
} as const;

export const ROTATE_SPEED = 1.2; // rad/s
export const SLICE_SPEED = 0.8; // w/s

/** 把键盘输入转换成 ViewState 的改变。纯状态逻辑，不涉及渲染。 */
export class CoreController {
  private readonly state: ViewState;
  private readonly input: Input;
  allowedPlanes: Set<Plane> = new Set(PLANES);
  sliceRange: readonly [number, number] = [-2.2, 2.2];
  /** 是否允许用 X 切换切片（关卡未启用切片时关闭） */
  allowSliceToggle = true;
  /** 是否允许用 P 切换投影（第四章起） */
  allowProjectionToggle = false;
  /** 本帧是否切换了投影（供音效/提示） */
  projectionToggled = false;
  /** 旋转速度倍率（0..1）。接近共振时由 GameController 调低，形成"磁性吸附"手感 */
  speedScale = 1;
  /** 等角双旋的两个平面（由关卡定义）；null 表示本关没有 */
  linkedPlanes: readonly [Plane, Plane] | null = null;
  /** 上一帧是否处于双旋输入中（供 HUD 高亮） */
  linking = false;

  constructor(state: ViewState, input: Input) {
    this.state = state;
    this.input = input;
  }

  update(dt: number): void {
    const s = this.state;
    const inp = this.input;

    KEYMAP.selectPlane.forEach((code, i) => {
      if (inp.wasPressed(code) && this.allowedPlanes.has(PLANES[i])) s.activePlane = PLANES[i];
    });
    if (this.allowSliceToggle && inp.wasPressed(KEYMAP.toggleSlice)) s.slice = { ...s.slice, enabled: !s.slice.enabled };
    this.projectionToggled = false;
    if (this.allowProjectionToggle && inp.wasPressed(KEYMAP.toggleProjection)) {
      s.projectionMode = s.projectionMode === 'perspective' ? 'orthographic' : 'perspective';
      this.projectionToggled = true;
    }
    // 投影过渡动画：blend 以 0.45 s 趋向目标
    const target = s.projectionMode === 'orthographic' ? 1 : 0;
    const step = dt / 0.45;
    s.projectionBlend = target > s.projectionBlend ? Math.min(target, s.projectionBlend + step) : Math.max(target, s.projectionBlend - step);

    const axis = (codes: readonly [string, string]): number =>
      (inp.isDown(codes[1]) ? 1 : 0) - (inp.isDown(codes[0]) ? 1 : 0);

    const speed = ROTATE_SPEED * this.speedScale;
    this.rotate('XW', axis(KEYMAP.XW) * speed * dt);
    this.rotate('YW', axis(KEYMAP.YW) * speed * dt);
    const shift = KEYMAP.linkModifier.some((c) => inp.isDown(c));
    const a = axis(KEYMAP.active);
    this.linking = shift && this.linkedPlanes !== null && a !== 0;
    if (shift && this.linkedPlanes) {
      // 等角双旋：两个正交平面同角速度
      this.rotate(this.linkedPlanes[0], a * speed * dt);
      this.rotate(this.linkedPlanes[1], a * speed * dt);
    } else {
      this.rotate(s.activePlane, a * speed * dt);
    }

    const sd = axis(KEYMAP.slice);
    if (sd !== 0 && s.slice.enabled) {
      const w0 = Math.min(this.sliceRange[1], Math.max(this.sliceRange[0], s.slice.w0 + sd * SLICE_SPEED * dt));
      s.slice = { ...s.slice, w0 };
    }
  }

  rotate(plane: Plane, delta: number): void {
    if (delta === 0 || !this.allowedPlanes.has(plane)) return;
    this.state.rotation = { ...this.state.rotation, [plane]: wrapAngle(this.state.rotation[plane] + delta) };
  }
}
