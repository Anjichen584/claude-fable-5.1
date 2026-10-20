import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

export interface GameSceneOptions {
  container: HTMLElement;
  onFrame: (dt: number, time: number) => void;
  onError?: (err: unknown) => void;
}

/**
 * Three.js 场景外壳：渲染器、摄像机、轨道控制、宇宙背景、resize、主循环、释放。
 * 摄像机状态只在这里（OrbitControls），与四维旋转状态完全分离。
 */
export class GameScene {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;
  readonly root = new THREE.Group();

  private readonly container: HTMLElement;
  private readonly onFrame: (dt: number, time: number) => void;
  private readonly clock = new THREE.Clock();
  private rafId = 0;
  private disposed = false;
  private readonly resizeObserver: ResizeObserver;
  private readonly starfield: THREE.Points;
  private readonly bloom: UnrealBloomPass;
  private _bloomEnabled = false;
  private readonly onContextLost: (e: Event) => void;

  constructor(opts: GameSceneOptions) {
    this.container = opts.container;
    this.onFrame = opts.onFrame;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance', outputBufferType: THREE.HalfFloatType });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(new THREE.Color('#05070f'), 1);
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.container.appendChild(this.renderer.domElement);

    this.scene.fog = new THREE.FogExp2('#05070f', 0.035);

    this.camera = new THREE.PerspectiveCamera(50, 1, 0.05, 200);
    this.camera.position.set(4.0, 3.0, 5.8);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 1.5;
    this.controls.maxDistance = 30;
    this.controls.target.set(0, 0, 0);

    this.scene.add(new THREE.AmbientLight('#8fb4ff', 0.6));
    const key = new THREE.PointLight('#38e8ff', 8, 30, 1.5);
    key.position.set(3, 4, 3);
    this.scene.add(key);
    const fill = new THREE.PointLight('#a86bff', 6, 30, 1.5);
    fill.position.set(-4, -2, -3);
    this.scene.add(fill);

    this.starfield = makeStarfield();
    this.scene.add(this.starfield);
    this.scene.add(this.root);

    // 轻量 bloom：使用 r182 内置后处理管线（renderer.setEffects），色彩空间由渲染器统一处理
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.5, 0.4, 0.7);
    this.bloomEnabled = true;

    this.onContextLost = (e: Event) => {
      e.preventDefault();
      opts.onError?.(new Error('WebGL 上下文丢失（显卡驱动或浏览器回收了 GPU 资源）。请刷新页面。'));
      this.dispose();
    };
    this.renderer.domElement.addEventListener('webglcontextlost', this.onContextLost, false);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.container);
    this.resize();

    const loop = () => {
      if (this.disposed) return;
      this.rafId = requestAnimationFrame(loop);
      const dt = Math.min(this.clock.getDelta(), 0.1);
      const t = this.clock.elapsedTime;
      try {
        this.onFrame(dt, t);
        this.controls.update();
        this.starfield.rotation.y = t * 0.004;
        this.renderer.render(this.scene, this.camera);
      } catch (err) {
        opts.onError?.(err);
        this.dispose();
      }
    };
    // 首帧异步启动，保证调用方的构造函数先完成
    this.rafId = requestAnimationFrame(loop);
  }

  /** 发光后处理开关（B 键）。低端机可关闭。 */
  get bloomEnabled(): boolean {
    return this._bloomEnabled;
  }
  set bloomEnabled(v: boolean) {
    this._bloomEnabled = v;
    try {
      this.renderer.setEffects(v ? [this.bloom] : []);
    } catch {
      this._bloomEnabled = false;
    }
  }

  resize(): void {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    const pr = this.renderer.getPixelRatio();
    this.bloom?.setSize(w * pr, h * pr);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.rafId);
    this.resizeObserver.disconnect();
    this.renderer.domElement.removeEventListener('webglcontextlost', this.onContextLost);
    this.controls.dispose();
    this.renderer.setEffects([]);
    this.bloom.dispose();
    this.starfield.geometry.dispose();
    (this.starfield.material as THREE.Material).dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}

/** 是否能创建 WebGL 上下文（用于启动前兜底）。 */
export function isWebGLAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch {
    return false;
  }
}

function makeStarfield(): THREE.Points {
  const n = 1600;
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  const palette = [new THREE.Color('#9fd8ff'), new THREE.Color('#c9b8ff'), new THREE.Color('#ffffff'), new THREE.Color('#ffe9b3')];
  for (let i = 0; i < n; i++) {
    // 球壳分布
    const r = 40 + Math.random() * 60;
    const u = Math.random() * 2 - 1;
    const th = Math.random() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    pos[i * 3] = r * s * Math.cos(th);
    pos[i * 3 + 1] = r * u;
    pos[i * 3 + 2] = r * s * Math.sin(th);
    const c = palette[Math.floor(Math.random() * palette.length)];
    const b = 0.18 + Math.random() * 0.4; // 保持在 bloom 阈值之下
    col[i * 3] = c.r * b;
    col[i * 3 + 1] = c.g * b;
    col[i * 3 + 2] = c.b * b;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const m = new THREE.PointsMaterial({ size: 0.3, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false, fog: false });
  return new THREE.Points(g, m);
}
