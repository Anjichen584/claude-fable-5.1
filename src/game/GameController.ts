import * as THREE from 'three';
import { blendOf, createTesseract, W_PLANES, type Plane, type Polytope4, type ProjectionMode, type Rotation4D, sectionName } from '../math';
import { LEVELS } from '../puzzle/levels';
import { CHAPTERS, chapterOf, isLastInChapter, nextChapter } from '../puzzle/chapters';
import type { ChapterDef } from '../puzzle/types';
import { PuzzleSession, type BridgeStatus, type PuzzleEvent } from '../puzzle/PuzzleSession';
import type { LevelDef } from '../puzzle/types';
import { AudioEngine } from './Audio';
import { CoreController } from './CoreController';
import { GameScene } from './GameScene';
import { Input } from './Input';
import { LevelView } from './LevelView';
import { PlayerController } from './PlayerController';
import { TesseractView } from './TesseractView';
import { createDefaultViewState, type ViewState } from './ViewState';

export type GamePhase = 'menu' | 'playing' | 'paused' | 'complete' | 'won';

export interface BridgeTargetSnapshot {
  distance: number;
  angleErrorDeg: number;
  distanceOk: boolean;
  angleOk: boolean;
}

export interface BridgeSnapshot extends BridgeTargetSnapshot {
  id: string;
  plane: Plane;
  /** 双旋桥的第二平面与第二目标 */
  plane2: Plane | null;
  second: BridgeTargetSnapshot | null;
  /** 第四章：锚点所要求的投影（null = 普通桥） */
  projection: ProjectionMode | null;
  visible: boolean;
  locked: boolean;
  progress: number;
}

export interface ChapterSnapshot {
  index: number;
  title: string;
  subtitle: string;
  concept: string;
  outro: string;
  levelCount: number;
  /** 当前关在章内的序号（1 起） */
  levelInChapter: number;
  hasNext: boolean;
  /** 已通关（localStorage） */
  completed: boolean;
}

export interface GameSnapshot {
  phase: GamePhase;
  levelIndex: number;
  levelCount: number;
  /** 当前章（playing/complete/won）；菜单时为 null */
  chapter: ChapterSnapshot | null;
  /** 章节列表（菜单选章用） */
  chapters: ChapterSnapshot[];
  /** 等角双旋平面；本关无则 null */
  linked: [Plane, Plane] | null;
  /** 本帧正在双旋输入 */
  linking: boolean;
  title: string;
  subtitle: string;
  rotation: Rotation4D;
  activePlane: Plane;
  lockedPlanes: Plane[];
  bridges: BridgeSnapshot[];
  nodes: Array<{ id: string; visible: boolean; active: boolean; label: string | null; hold: number; holdSeconds: number }>;
  /** 闸门：形状节点满足后成路 */
  gates: Array<{ id: string; open: boolean }>;
  /** 当前切片截面签名（切片开启时） */
  section: { name: string | null; vertices: number; edges: number; faces: number } | null;
  exitReady: boolean;
  hint: string | null;
  slice: { enabled: boolean; w0: number } | null;
  /** 投影方式；本关不可切换时 switchable=false（前三章仍显示透视） */
  projection: { mode: ProjectionMode; switchable: boolean; blend: number };
  fps: number;
  debug: boolean;
  muted: boolean;
}

export interface GameCallbacks {
  onSnapshot: (s: GameSnapshot) => void;
  onError: (message: string) => void;
}

/**
 * 主循环编排：输入 → 四维姿态 → 角色 → 解谜规则 → 视图。
 * 摄像机（OrbitControls）与四维旋转（键盘）是两套独立状态。
 */
export class GameController {
  readonly viewState: ViewState = createDefaultViewState();
  readonly audio = new AudioEngine();
  phase: GamePhase = 'menu';
  private wonChapter: ChapterDef | null = null;
  debug = false;

  private readonly scene: GameScene;
  private readonly input: Input;
  private readonly poly: Polytope4 = createTesseract();
  private readonly tesseract: TesseractView;
  private readonly coreController: CoreController;
  private readonly player = new PlayerController();
  private readonly callbacks: GameCallbacks;

  private level: LevelDef | null = null;
  private session: PuzzleSession | null = null;
  private levelView: LevelView | null = null;
  private hint: string | null = null;
  private hintTimer = 0;

  private fps = 0;
  private fpsFrames = 0;
  private fpsAcc = 0;
  private snapAcc = 0;
  private readonly camTarget = new THREE.Vector3();
  private disposed = false;

  constructor(container: HTMLElement, callbacks: GameCallbacks) {
    this.callbacks = callbacks;
    this.input = new Input();
    this.tesseract = new TesseractView(this.poly);
    this.coreController = new CoreController(this.viewState, this.input);
    this.scene = new GameScene({
      container,
      onError: (e) => callbacks.onError(e instanceof Error ? e.message : String(e)),
      onFrame: (dt, t) => this.frame(dt, t),
    });
    this.scene.controls.maxPolarAngle = 1.42;
    this.scene.controls.minDistance = 3;
    this.scene.controls.maxDistance = 22;
    this.scene.root.add(this.tesseract.group);
    this.scene.root.add(this.player.group);
    this.player.group.visible = false;
    this.tesseract.group.position.set(0, 0, 0);
  }

  // ------------------------------------------------------------ 流程
  get levelCount(): number {
    return LEVELS.length;
  }

  /** 从某章第一关开始 */
  startChapter(chapterIndex: number): void {
    const ch = CHAPTERS.find((c) => c.index === chapterIndex);
    const first = ch?.levels[0];
    if (first) this.startLevel(first.index);
  }

  startLevel(index: number): void {
    const level = LEVELS.find((l) => l.index === index);
    if (!level) {
      this.phase = 'won';
      this.emitSnapshot();
      return;
    }
    this.wonChapter = null;
    this.unloadLevel();
    this.level = level;
    this.session = new PuzzleSession(level, this.poly);
    this.levelView = new LevelView(level);
    this.scene.root.add(this.levelView.group);

    this.viewState.rotation = { ...level.core.initialRotation };
    this.viewState.activePlane = level.bridges[0]?.plane ?? 'XW';
    this.viewState.slice = level.slice ? { enabled: level.slice.enabled, w0: level.slice.initial } : { enabled: false, w0: 0 };
    this.coreController.allowedPlanes = new Set(level.core.allowedPlanes);
    this.coreController.sliceRange = level.slice?.range ?? [-2.2, 2.2];
    this.coreController.allowSliceToggle = !!level.slice;
    this.coreController.linkedPlanes = level.core.linked ?? null;
    this.viewState.projectionMode = level.core.projection?.initial ?? 'perspective';
    this.viewState.projectionBlend = blendOf(this.viewState.projectionMode);
    this.coreController.allowProjectionToggle = level.core.projection?.switchable ?? false;

    this.tesseract.group.position.set(level.core.position[0], level.core.position[1], level.core.position[2]);
    this.tesseract.group.scale.setScalar(level.core.scale);
    // 视角倾斜：与 puzzle 里的 applyTilt 一致（先绕 X 俯仰，再绕 Y 偏航 → Euler 'YXZ'）
    const tilt = level.core.tilt;
    this.tesseract.group.rotation.set(tilt?.pitch ?? 0, tilt?.yaw ?? 0, 0, 'YXZ');

    this.player.setPosition(level.playerStart);
    this.player.facing = Math.PI;
    this.player.group.visible = true;

    // 摄像机：放在玩家身后上方，看向出口方向
    this.camTarget.set(level.playerStart[0], level.playerStart[1] + 0.6, level.playerStart[2]);
    this.scene.controls.target.copy(this.camTarget);
    this.scene.camera.position.set(level.playerStart[0] + 0.01, level.playerStart[1] + 6.5, level.playerStart[2] + 9.5);
    this.scene.controls.update();

    this.hint = null;
    this.phase = 'playing';
    this.emitSnapshot();
  }

  resetLevel(): void {
    if (this.level) this.startLevel(this.level.index);
  }

  /** 下一关；若当前是章末关则进入章节结算（won） */
  nextLevel(): void {
    if (!this.level) return;
    if (isLastInChapter(this.level)) {
      const ch = chapterOf(this.level);
      markChapterCompleted(ch.id);
      this.wonChapter = ch;
      this.phase = 'won';
      this.emitSnapshot();
      return;
    }
    this.startLevel(this.level.index + 1);
  }

  /** 章节结算后进入下一章（没有则回菜单） */
  nextChapter(): void {
    const ch = this.wonChapter ?? (this.level ? chapterOf(this.level) : null);
    const nx = ch ? nextChapter(ch) : undefined;
    if (nx) this.startChapter(nx.index);
    else this.toMenu();
  }

  pause(): void {
    if (this.phase === 'playing') {
      this.phase = 'paused';
      this.audio.setResonance(0, 0);
      this.audio.setRotating(false, false);
      this.emitSnapshot();
    }
  }

  resume(): void {
    if (this.phase === 'paused') {
      this.phase = 'playing';
      this.emitSnapshot();
    }
  }

  toMenu(): void {
    this.unloadLevel();
    this.phase = 'menu';
    this.emitSnapshot();
  }

  private unloadLevel(): void {
    if (this.levelView) {
      this.scene.root.remove(this.levelView.group);
      this.levelView.dispose();
      this.levelView = null;
    }
    this.session = null;
    this.level = null;
    this.player.group.visible = false;
  }

  // ------------------------------------------------------------ 每帧
  private frame(dt: number, t: number): void {
    const inp = this.input;

    if (inp.anyPressed()) this.unlockAudio();
    if (inp.wasPressed('Backquote')) this.debug = !this.debug;
    if (inp.wasPressed('KeyM')) this.toggleMute();
    if (inp.wasPressed('KeyB')) this.scene.bloomEnabled = !this.scene.bloomEnabled;
    if (inp.wasPressed('Escape')) {
      if (this.phase === 'playing') this.pause();
      else if (this.phase === 'paused') this.resume();
    }
    if (inp.wasPressed('KeyR') && (this.phase === 'playing' || this.phase === 'paused' || this.phase === 'complete')) {
      this.audio.playReset();
      this.resetLevel();
    }
    if (inp.wasPressed('Enter') && this.phase === 'complete') this.nextLevel();

    if (this.phase === 'playing' && this.session && this.level && this.levelView) {
      const before = this.viewState.rotation;
      this.coreController.update(dt);
      let rotation = this.viewState.rotation;
      const rotatedW = W_PLANES.some((p) => rotation[p] !== before[p]);
      if (this.coreController.projectionToggled) this.audio.playProjection(this.viewState.projectionMode === 'orthographic');
      // 已锁定的桥：对应平面吸附到精确解
      rotation = this.session.snapRotationForLockedBridges(rotation);
      this.viewState.rotation = rotation;

      // 摄像机朝向 → 角色移动方向
      const camDir = new THREE.Vector3().subVectors(this.scene.controls.target, this.scene.camera.position);
      const fl = Math.hypot(camDir.x, camDir.z) || 1;
      this.player.update(dt, inp, [camDir.x / fl, camDir.z / fl], this.session.walkable(), t);

      const events = this.session.update({
        dt,
        rotation,
        playerPosition: this.player.position,
        sliceW0: this.viewState.slice.enabled ? this.viewState.slice.w0 : null,
        rotatedW,
        projectionBlend: this.viewState.projectionBlend,
        projectionMode: this.viewState.projectionMode,
      });
      this.handleEvents(events);

      // 音效：共振（取最接近的可见未锁定桥）与旋转摩擦
      let closeness = 0;
      let progress = 0;
      for (const b of this.session.bridges) {
        if (b.locked || !b.visible || !b.evaluation) continue;
        closeness = Math.max(closeness, 1 - Math.min(1, b.evaluation.distance / 2.0));
        progress = Math.max(progress, b.progress);
      }
      this.audio.setResonance(closeness, progress);
      // 磁性吸附：距离锚点 < 0.6 时旋转减速，最低到 30%
      this.coreController.speedScale = closeness > 0.7 ? Math.max(0.3, 1 - (closeness - 0.7) / 0.3 * 0.7) : 1;
      const rotatedAny = (Object.keys(rotation) as Plane[]).some((p) => rotation[p] !== before[p]);
      this.audio.setRotating(rotatedAny, rotatedW);

      // 摄像机跟随：目标平滑移动，摄像机保持相对偏移
      const desired = new THREE.Vector3(this.player.position[0], this.player.position[1] + 0.6, this.player.position[2]);
      const k = 1 - Math.exp(-6 * dt);
      const prev = this.scene.controls.target.clone();
      this.scene.controls.target.lerp(desired, k);
      this.scene.camera.position.add(this.scene.controls.target.clone().sub(prev));

      this.levelView.update(this.session, dt, t, this.scene.camera.position, this.viewState.slice.enabled ? this.viewState.slice.w0 : null);

      if (this.hint && this.hintTimer > 0) {
        this.hintTimer -= dt;
        if (this.hintTimer <= 0) this.hint = null;
      }
    } else if (this.phase === 'menu') {
      this.audio.setResonance(0, 0);
      this.audio.setRotating(false, false);
      // 菜单背景：缓慢自转的超立方体
      this.viewState.rotation = { ...this.viewState.rotation, XW: this.viewState.rotation.XW + dt * 0.25, YZ: this.viewState.rotation.YZ + dt * 0.1 };
      this.tesseract.group.position.set(0, 0, 0);
      this.tesseract.group.scale.setScalar(1);
      this.tesseract.group.rotation.set(0, 0, 0, 'YXZ');
      this.scene.controls.target.lerp(new THREE.Vector3(0, 0, 0), 0.05);
    } else if (this.levelView && this.session) {
      // 暂停 / 完成：场景静止但仍渲染反馈
      this.levelView.update(this.session, 0, t, this.scene.camera.position, this.viewState.slice.enabled ? this.viewState.slice.w0 : null);
    }

    this.tesseract.update(this.viewState, t);
    inp.endFrame();

    this.fpsFrames++;
    this.fpsAcc += dt;
    if (this.fpsAcc >= 0.5) {
      this.fps = Math.round(this.fpsFrames / this.fpsAcc);
      this.fpsFrames = 0;
      this.fpsAcc = 0;
    }
    this.snapAcc += dt;
    if (this.snapAcc >= 0.05) {
      this.snapAcc = 0;
      this.emitSnapshot();
    }
  }

  private handleEvents(events: PuzzleEvent[]): void {
    for (const e of events) {
      switch (e.type) {
        case 'hint':
          this.hint = e.text;
          this.hintTimer = 9;
          this.audio.playHint();
          break;
        case 'exitReady':
          this.audio.playPortal();
          break;
        case 'activated': {
          if (e.kind === 'bridge' || e.kind === 'gate') this.audio.playLock();
          else this.audio.playNode();
          // 新出现的桥 → 自动把自由平面切到它需要的平面，HUD 随之高亮
          const next = this.session?.bridges.find((b) => !b.locked && b.def.requires?.includes(e.id));
          if (next && this.coreController.allowedPlanes.has(next.def.plane)) this.viewState.activePlane = next.def.plane;
          break;
        }
        case 'levelComplete':
          this.phase = 'complete';
          this.audio.setResonance(0, 0);
          this.audio.setRotating(false, false);
          this.audio.playComplete();
          break;
        default:
          break;
      }
    }
  }

  // ------------------------------------------------------------ 快照
  private emitSnapshot(): void {
    if (this.disposed) return;
    this.callbacks.onSnapshot(this.snapshot());
  }

  /** 用户手势（点击按钮 / 按键）时调用，解锁音频 */
  unlockAudio(): void {
    this.audio.unlock();
    this.audio.setAmbient(true);
  }

  toggleMute(): boolean {
    const m = this.audio.toggleMute();
    this.emitSnapshot();
    return m;
  }

  snapshot(): GameSnapshot {
    const s = this.session;
    const l = this.level;
    return {
      phase: this.phase,
      levelIndex: l?.index ?? 0,
      levelCount: LEVELS.length,
      chapter: this.chapterSnapshot(this.wonChapter ?? (l ? chapterOf(l) : null), l?.index ?? 0),
      chapters: CHAPTERS.map((c) => this.chapterSnapshot(c, 0) as ChapterSnapshot),
      linked: l?.core.linked ? [l.core.linked[0], l.core.linked[1]] : null,
      linking: this.coreController.linking,
      title: l?.title ?? 'NEXUS: 4D',
      subtitle: l?.subtitle ?? '',
      rotation: { ...this.viewState.rotation },
      activePlane: this.viewState.activePlane,
      lockedPlanes: s ? s.bridges.filter((b) => b.locked).flatMap((b) => (b.def.plane2 ? [b.def.plane, b.def.plane2] : [b.def.plane])) : [],
      bridges: s ? s.bridges.map(toBridgeSnapshot) : [],
      nodes: s
        ? s.nodes.map((n) => ({
            id: n.def.id,
            visible: n.visible,
            active: n.active,
            label: n.def.trigger.kind === 'shape' ? n.def.trigger.label : null,
            hold: n.hold,
            holdSeconds: n.def.trigger.kind === 'shape' ? n.def.trigger.holdSeconds ?? 0.5 : 0,
          }))
        : [],
      gates: s ? s.gates.map((g) => ({ id: g.def.id, open: g.open })) : [],
      section: s?.section ? { name: sectionName(s.section), vertices: s.section.vertices, edges: s.section.edges, faces: s.section.faces } : null,
      exitReady: s?.exitReady ?? false,
      hint: this.hint,
      slice: l?.slice ? { ...this.viewState.slice } : null,
      projection: { mode: this.viewState.projectionMode, switchable: l?.core.projection?.switchable ?? false, blend: this.viewState.projectionBlend },
      fps: this.fps,
      debug: this.debug,
      muted: this.audio.muted,
    };
  }

  private chapterSnapshot(ch: ChapterDef | null, levelIndex: number): ChapterSnapshot | null {
    if (!ch) return null;
    const pos = ch.levels.findIndex((lv) => lv.index === levelIndex);
    return {
      index: ch.index,
      title: ch.title,
      subtitle: ch.subtitle,
      concept: ch.concept,
      outro: ch.outro,
      levelCount: ch.levels.length,
      levelInChapter: pos >= 0 ? pos + 1 : 0,
      hasNext: nextChapter(ch) !== undefined,
      completed: isChapterCompleted(ch.id),
    };
  }

  dispose(): void {
    this.disposed = true;
    this.unloadLevel();
    this.player.dispose();
    this.tesseract.dispose();
    this.input.dispose();
    this.audio.dispose();
    this.scene.dispose();
  }
}

function toTargetSnapshot(e: { distance: number; angleError: number; distanceOk: boolean; angleOk: boolean } | null | undefined): BridgeTargetSnapshot {
  return {
    distance: e?.distance ?? Infinity,
    angleErrorDeg: ((e?.angleError ?? Math.PI) * 180) / Math.PI,
    distanceOk: e?.distanceOk ?? false,
    angleOk: e?.angleOk ?? false,
  };
}

function toBridgeSnapshot(b: BridgeStatus): BridgeSnapshot {
  const ev = b.evaluation;
  // 双旋桥：主行显示第一个目标自己的数据，second 显示第二个；锁定/进度仍以合并结果为准
  const first = ev?.primary ?? ev;
  return {
    id: b.def.id,
    plane: b.def.plane,
    plane2: b.def.plane2 ?? null,
    second: b.def.vertex2 !== undefined ? toTargetSnapshot(ev?.second) : null,
    projection: b.def.projection ?? null,
    visible: b.visible,
    locked: b.locked,
    ...toTargetSnapshot(first),
    progress: b.progress,
  };
}

const COMPLETED_KEY = 'nexus4d.completedChapters';
function readCompleted(): Set<string> {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(COMPLETED_KEY) : null;
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}
function isChapterCompleted(id: string): boolean {
  return readCompleted().has(id);
}
function markChapterCompleted(id: string): void {
  try {
    const set = readCompleted();
    set.add(id);
    localStorage.setItem(COMPLETED_KEY, JSON.stringify([...set]));
  } catch {
    /* 无存储环境忽略 */
  }
}
