import * as THREE from 'three';
import { blendOf, createPolytope, createTesseract, POLYTOPE_NAMES, W_PLANES, type Plane, type Polytope4, type PolytopeKind, type ProjectionMode, type Rotation4D, sectionName } from '../math';
import { LEVELS } from '../puzzle/levels';
import { CHAPTERS, chapterOf, isLastInChapter, nextChapter } from '../puzzle/chapters';
import { chapterDone, clearProgress, continueLevel, formatTime, isLevelCompleted, loadProgress, recordLevelComplete, saveProgress, totalDone, withLastLevel, type Progress } from '../puzzle/progress';
import type { ChapterDef } from '../puzzle/types';
import { PuzzleSession, type BridgeStatus, type PuzzleEvent } from '../puzzle/PuzzleSession';
import type { LevelDef } from '../puzzle/types';
import { Trail, trailStats, type TrailSample, type TrailStats } from '../puzzle/trail';
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
  /** 第五章：任意顶点可填锚点 */
  anyVertex: boolean;
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
  /** 已通关（存档：本章所有关都已通关） */
  completed: boolean;
  /** 本章已通关的关数 */
  done: number;
  /** 本章各关（菜单选关用） */
  levels: Array<{ index: number; title: string; subtitle: string; completed: boolean; bestTime: number | null }>;
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
  /** 存档：继续应进入的关（无存档为 null）、总通关数、本关计时与最佳 */
  progress: { continueLevel: number | null; totalDone: number; levelCount: number; levelTime: number; bestTime: number | null; isNewBest: boolean; completedBefore: boolean };
  /** 第七章：本关玩家轨迹（仅在 complete / won 阶段附带，避免每帧拷贝） */
  trail: { samples: TrailSample[]; stats: TrailStats; levelTitle: string } | null;
  /** 第六章：玩家自身的 w；未启用时 null */
  playerW: { w: number; range: [number, number]; blocked: boolean; sliceFollows: boolean } | null;
  /** 核心多胞体（第五章起可能不是超立方体） */
  polytope: { kind: PolytopeKind; name: string; vertices: number; edges: number; cells: number };
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
  private readonly trail = new Trail();
  private progress: Progress = loadProgress(typeof localStorage !== 'undefined' ? localStorage : null);
  /** 本关已玩时长（仅 playing 累计） */
  private levelTime = 0;
  private lastResult: { isNewBest: boolean; completedBefore: boolean } = { isNewBest: false, completedBefore: false };
  private wonChapter: ChapterDef | null = null;
  debug = false;

  private readonly scene: GameScene;
  private readonly input: Input;
  private poly: Polytope4 = createTesseract();
  private tesseract: TesseractView;
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
    this.ensurePolytope(level.core.polytope ?? 'tesseract');
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
    this.trail.reset();
    this.levelTime = 0;
    this.lastResult = { isNewBest: false, completedBefore: isLevelCompleted(this.progress, level) };
    this.progress = withLastLevel(this.progress, level.index);
    saveProgress(this.storage(), this.progress);
    this.player.wEnabled = level.playerW?.enabled ?? false;
    this.player.w = level.playerW?.initial ?? 0;
    this.player.wRange = level.playerW?.range ?? [0, 0];
    this.coreController.sliceFollowsPlayer = !!(level.playerW?.enabled && level.playerW.sliceFollows);
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

  /** 第五章：按关卡切换核心多胞体（重建线框视图） */
  private ensurePolytope(kind: PolytopeKind): void {
    if (this.poly.name === kind) return;
    this.scene.root.remove(this.tesseract.group);
    this.tesseract.dispose();
    this.poly = createPolytope(kind);
    this.tesseract = new TesseractView(this.poly);
    this.scene.root.add(this.tesseract.group);
  }

  resetLevel(): void {
    if (this.level) this.startLevel(this.level.index);
  }

  /** 下一关；若当前是章末关则进入章节结算（won） */
  nextLevel(): void {
    if (!this.level) return;
    if (isLastInChapter(this.level)) {
      const ch = chapterOf(this.level);
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
      this.trail.push(this.player.position, this.player.w, t);
      this.levelTime += dt;
      if (import.meta.env.DEV) (window as unknown as { __nexusPlayer?: unknown }).__nexusPlayer = { x: this.player.position[0], z: this.player.position[2], w: this.player.w };
      if (this.coreController.sliceFollowsPlayer && this.level.slice) {
        // 第六章："你自己就是切片"：切片 w₀ 跟随玩家 w
        const [lo, hi] = this.level.slice.range;
        this.viewState.slice = { enabled: true, w0: Math.min(hi, Math.max(lo, this.player.w)) };
      }

      const events = this.session.update({
        dt,
        rotation,
        playerPosition: this.player.position,
        sliceW0: this.viewState.slice.enabled ? this.viewState.slice.w0 : null,
        rotatedW,
        projectionBlend: this.viewState.projectionBlend,
        projectionMode: this.viewState.projectionMode,
        playerW: this.player.w,
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
      this.audio.setRotating(rotatedAny || this.player.wMoving !== 0, rotatedW || this.player.wMoving !== 0);

      // 摄像机跟随：目标平滑移动，摄像机保持相对偏移
      const desired = new THREE.Vector3(this.player.position[0], this.player.position[1] + 0.6, this.player.position[2]);
      const k = 1 - Math.exp(-6 * dt);
      const prev = this.scene.controls.target.clone();
      this.scene.controls.target.lerp(desired, k);
      this.scene.camera.position.add(this.scene.controls.target.clone().sub(prev));

      this.levelView.update(this.session, dt, t, this.scene.camera.position, this.viewState.slice.enabled ? this.viewState.slice.w0 : null, this.player.w);

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
      this.levelView.update(this.session, 0, t, this.scene.camera.position, this.viewState.slice.enabled ? this.viewState.slice.w0 : null, this.player.w);
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
        case 'levelComplete': {
          this.phase = 'complete';
          if (this.level) {
            const r = recordLevelComplete(this.progress, this.level, this.levelTime);
            this.progress = r.progress;
            this.lastResult = { ...this.lastResult, isNewBest: r.isNewBest };
            saveProgress(this.storage(), this.progress);
          }
          this.audio.setResonance(0, 0);
          this.audio.setRotating(false, false);
          this.audio.playComplete();
          break;
        }
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
      progress: {
        continueLevel: continueLevel(this.progress),
        totalDone: totalDone(this.progress),
        levelCount: LEVELS.length,
        levelTime: this.levelTime,
        bestTime: l ? (this.progress.levels[l.id]?.bestTime ?? null) : null,
        isNewBest: this.lastResult.isNewBest,
        completedBefore: this.lastResult.completedBefore,
      },
      trail: (this.phase === 'complete' || this.phase === 'won') && this.trail.samples.length > 1 ? { samples: this.trail.samples.slice(), stats: trailStats(this.trail.samples), levelTitle: l?.title ?? '' } : null,
      playerW: this.player.wEnabled ? { w: this.player.w, range: [this.player.wRange[0], this.player.wRange[1]], blocked: this.player.wBlocked, sliceFollows: this.coreController.sliceFollowsPlayer } : null,
      polytope: { kind: this.poly.name as PolytopeKind, name: POLYTOPE_NAMES[this.poly.name as PolytopeKind], vertices: this.poly.vertices.length, edges: this.poly.edges.length, cells: this.poly.cells.length },
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
      completed: chapterDone(this.progress, ch).completed,
      done: chapterDone(this.progress, ch).done,
      levels: ch.levels.map((lv) => ({ index: lv.index, title: lv.title, subtitle: lv.subtitle, completed: isLevelCompleted(this.progress, lv), bestTime: this.progress.levels[lv.id]?.bestTime ?? null })),
    };
  }

  private storage(): Storage | null {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  }

  /** 菜单"继续"：进入存档推荐的关 */
  continueGame(): void {
    const idx = continueLevel(this.progress);
    this.startLevel(idx ?? 1);
  }

  /** 清空存档（菜单） */
  resetProgress(): void {
    this.progress = clearProgress(this.storage());
    this.emitSnapshot();
  }

  /** 本关用时（格式化，HUD 用） */
  get levelTimeText(): string {
    return formatTime(this.levelTime);
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
    anyVertex: b.def.anyVertex ?? false,
    visible: b.visible,
    locked: b.locked,
    ...toTargetSnapshot(first),
    progress: b.progress,
  };
}
