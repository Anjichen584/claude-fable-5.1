import { useRef } from 'react';
import { DebugHUD } from './DebugHUD';
import { useEngine } from './useEngine';

export default function App() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { snapshot, handle, error, fps } = useEngine(containerRef);

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#05070f', overflow: 'hidden' }}>
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
      {error ? (
        <div style={errorStyle}>
          <div style={{ fontSize: 18, marginBottom: 8 }}>无法启动渲染器</div>
          <div style={{ opacity: 0.8 }}>{error}</div>
        </div>
      ) : (
        <DebugHUD snapshot={snapshot} handle={handle} fps={fps} />
      )}
    </div>
  );
}

const errorStyle: React.CSSProperties = {
  position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
  alignItems: 'center', justifyContent: 'center', color: '#ffd166',
  fontFamily: 'ui-monospace, Menlo, Consolas, monospace', textAlign: 'center', padding: 24,
};
