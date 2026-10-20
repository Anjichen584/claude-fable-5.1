import { useEffect, useRef, useState } from 'react';
import { GameController, type GameSnapshot } from '../game/GameController';
import { isWebGLAvailable } from '../game/GameScene';
import type { ViewState } from '../game/ViewState';
import { DebugHUD } from './DebugHUD';
import { GameHUD } from './GameHUD';
import { ErrorScreen, LevelComplete, MainMenu, PauseMenu, Victory } from './Overlays';

export default function App() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<GameController | null>(null);
  const [snap, setSnap] = useState<GameSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [debugState, setDebugState] = useState<ViewState | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    if (!isWebGLAvailable()) {
      setError('当前浏览器无法创建 WebGL 上下文。请使用最新版 Chrome / Edge / Firefox，并确认已启用硬件加速。');
      return;
    }
    let game: GameController;
    try {
      game = new GameController(el, {
        onSnapshot: (s) => {
          setSnap(s);
          if (s.debug) setDebugState(structuredClone(game.viewState));
        },
        onError: setError,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return;
    }
    gameRef.current = game;
    setSnap(game.snapshot());
    // 开发入口：?level=N 直接进入某关
    const lv = Number(new URLSearchParams(window.location.search).get('level'));
    if (Number.isInteger(lv) && lv >= 1 && lv <= game.levelCount) game.startLevel(lv);
    return () => {
      game.dispose();
      gameRef.current = null;
    };
  }, []);

  const g = gameRef.current;

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#05070f', overflow: 'hidden' }}>
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
      {error && <ErrorScreen message={error} />}
      {!error && snap && g && (
        <>
          {snap.phase !== 'menu' && snap.phase !== 'won' && <GameHUD snap={snap} />}
          {snap.phase === 'menu' && <MainMenu onStart={() => { g.unlockAudio(); g.startLevel(1); }} muted={snap.muted} onToggleMute={() => { g.unlockAudio(); g.toggleMute(); }} />}
          {snap.phase === 'paused' && <PauseMenu onResume={() => g.resume()} onRestart={() => g.resetLevel()} onMenu={() => g.toMenu()} muted={snap.muted} onToggleMute={() => g.toggleMute()} />}
          {snap.phase === 'complete' && (
            <LevelComplete title={snap.title} index={snap.levelIndex} last={snap.levelIndex >= snap.levelCount} onNext={() => g.nextLevel()} onReplay={() => g.resetLevel()} />
          )}
          {snap.phase === 'won' && <Victory onMenu={() => g.toMenu()} onReplay={() => g.startLevel(1)} />}
          {snap.debug && debugState && (
            <DebugHUD snapshot={debugState} fps={snap.fps} handle={{ state: g.viewState, touch: () => setDebugState(structuredClone(g.viewState)) }} />
          )}
        </>
      )}
    </div>
  );
}
