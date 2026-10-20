import { useEffect, useRef, useState, type RefObject } from 'react';
import { createTesseract } from '../math';
import { CoreController } from '../game/CoreController';
import { GameScene, isWebGLAvailable } from '../game/GameScene';
import { Input } from '../game/Input';
import { TesseractView } from '../game/TesseractView';
import { createDefaultViewState, type ViewState } from '../game/ViewState';

export interface EngineHandle {
  state: ViewState;
  /** HUD 直接改 state 后调用，强制下一次快照刷新 */
  touch: () => void;
}

/**
 * 把 Three.js 场景挂到容器上，并以 ~20 Hz 向 React 暴露 ViewState 快照。
 * 渲染循环本身不经过 React。
 */
export function useEngine(containerRef: RefObject<HTMLDivElement | null>) {
  const stateRef = useRef<ViewState>(createDefaultViewState());
  const [snapshot, setSnapshot] = useState<ViewState>(() => structuredClone(stateRef.current));
  const [error, setError] = useState<string | null>(null);
  const [fps, setFps] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    if (!isWebGLAvailable()) {
      setError('当前浏览器无法创建 WebGL 上下文。请使用最新版 Chrome / Edge / Firefox，并确认已启用硬件加速。');
      return;
    }

    const state = stateRef.current;
    const input = new Input();
    const controller = new CoreController(state, input);
    const view = new TesseractView(createTesseract());

    let frames = 0;
    let acc = 0;
    let hudAcc = 0;

    let scene: GameScene;
    try {
      scene = new GameScene({
        container: el,
        onError: (e) => setError(e instanceof Error ? e.message : String(e)),
        onFrame: (dt, t) => {
          controller.update(dt);
          view.update(state, t);
          input.endFrame();

          frames++;
          acc += dt;
          hudAcc += dt;
          if (acc >= 0.5) {
            setFps(Math.round(frames / acc));
            frames = 0;
            acc = 0;
          }
          if (hudAcc >= 0.05) {
            hudAcc = 0;
            setSnapshot(structuredClone(state));
          }
        },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      input.dispose();
      view.dispose();
      return;
    }
    scene.root.add(view.group);

    return () => {
      scene.root.remove(view.group);
      view.dispose();
      input.dispose();
      scene.dispose();
    };
  }, [containerRef]);

  const handle: EngineHandle = {
    state: stateRef.current,
    touch: () => setSnapshot(structuredClone(stateRef.current)),
  };

  return { snapshot, handle, error, fps };
}
