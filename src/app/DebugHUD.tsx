import { PLANES, involvesW, type Plane } from '../math';
import { resetViewState, type ViewState } from '../game/ViewState';
import { SLICE_RANGE } from '../game/CoreController';
import type { EngineHandle } from './useEngine';

interface Props {
  snapshot: ViewState;
  handle: EngineHandle;
  fps: number;
}

const deg = (rad: number) => `${(rad * 180 / Math.PI).toFixed(0).padStart(4, ' ')}°`;

/** Day 1 调试 HUD：六个旋转平面、投影距离、切片。鼠标拖动场景只控制摄像机。 */
export function DebugHUD({ snapshot, handle, fps }: Props) {
  const set = (fn: (s: ViewState) => void) => {
    fn(handle.state);
    handle.touch();
  };

  return (
    <div style={styles.panel}>
      <div style={styles.title}>
        <span style={{ letterSpacing: '0.25em' }}>NEXUS</span>
        <span style={{ color: '#38e8ff' }}>: 4D</span>
        <span style={styles.fps}>{fps} fps</span>
      </div>
      <div style={styles.sub}>四维核心 · 旋转平面</div>

      {PLANES.map((p) => (
        <PlaneRow
          key={p}
          plane={p}
          value={snapshot.rotation[p]}
          active={snapshot.activePlane === p}
          onChange={(v) => set((s) => { s.rotation = { ...s.rotation, [p]: v }; })}
          onSelect={() => set((s) => { s.activePlane = p; })}
        />
      ))}

      <div style={styles.sub}>投影</div>
      <label style={styles.row}>
        <span style={styles.label}>距离 d</span>
        <input
          type="range" min={1.5} max={8} step={0.05}
          value={snapshot.projection.distance}
          onChange={(e) => set((s) => { s.projection = { ...s.projection, distance: Number(e.target.value) }; })}
          style={styles.slider}
        />
        <span style={styles.value}>{snapshot.projection.distance.toFixed(2)}</span>
      </label>

      <div style={styles.sub}>切片 w = w₀</div>
      <label style={styles.row}>
        <input
          type="checkbox"
          checked={snapshot.slice.enabled}
          onChange={(e) => set((s) => { s.slice = { ...s.slice, enabled: e.target.checked }; })}
        />
        <span style={{ ...styles.label, width: 'auto', marginLeft: 6 }}>启用 (X)</span>
        <input
          type="range" min={SLICE_RANGE[0]} max={SLICE_RANGE[1]} step={0.01}
          value={snapshot.slice.w0}
          disabled={!snapshot.slice.enabled}
          onChange={(e) => set((s) => { s.slice = { ...s.slice, w0: Number(e.target.value) }; })}
          style={styles.slider}
        />
        <span style={styles.value}>{snapshot.slice.w0.toFixed(2)}</span>
      </label>
      <label style={{ ...styles.row, opacity: snapshot.slice.enabled ? 1 : 0.4 }}>
        <input
          type="checkbox"
          checked={snapshot.showProjection}
          disabled={!snapshot.slice.enabled}
          onChange={(e) => set((s) => { s.showProjection = e.target.checked; })}
        />
        <span style={{ ...styles.label, width: 'auto', marginLeft: 6 }}>同时显示原投影（半透明）</span>
      </label>

      <button style={styles.button} onClick={() => set(resetViewState)}>重置四维姿态 (R)</button>

      <div style={styles.help}>
        <div><b>鼠标拖动</b> 摄像机轨道 · <b>滚轮</b> 缩放</div>
        <div><b>Q / E</b> XW 旋转 · <b>Z / C</b> YW 旋转</div>
        <div><b>1–6</b> 选择自由平面 · <b>[ / ]</b> 旋转自由平面</div>
        <div><b>X</b> 切片开关 · <b>, / .</b> 移动切片 · <b>R</b> 重置</div>
      </div>
    </div>
  );
}

function PlaneRow({ plane, value, active, onChange, onSelect }: {
  plane: Plane; value: number; active: boolean;
  onChange: (v: number) => void; onSelect: () => void;
}) {
  const w = involvesW(plane);
  return (
    <label style={{ ...styles.row, background: active ? 'rgba(56,232,255,0.08)' : 'transparent' }}>
      <span
        style={{ ...styles.label, color: w ? '#ffd166' : '#9fb3d9', cursor: 'pointer' }}
        onClick={(e) => { e.preventDefault(); onSelect(); }}
        title="点击设为自由平面（[ ] 键控制）"
      >
        {active ? '▸ ' : '  '}{plane}
      </span>
      <input
        type="range" min={-180} max={180} step={1}
        value={Math.round(value * 180 / Math.PI)}
        onChange={(e) => onChange(Number(e.target.value) * Math.PI / 180)}
        style={{ ...styles.slider, accentColor: w ? '#ffd166' : '#38e8ff' }}
      />
      <span style={styles.value}>{deg(value)}</span>
    </label>
  );
}

const styles: Record<string, React.CSSProperties> = {
  panel: {
    position: 'absolute', top: 16, left: 16, width: 320,
    padding: '14px 16px 12px',
    background: 'rgba(6, 10, 24, 0.78)',
    border: '1px solid rgba(56,232,255,0.25)',
    borderRadius: 10,
    color: '#dbe7ff',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    fontSize: 12,
    backdropFilter: 'blur(6px)',
    userSelect: 'none',
  },
  title: { display: 'flex', alignItems: 'baseline', gap: 2, fontSize: 16, fontWeight: 700, marginBottom: 6 },
  fps: { marginLeft: 'auto', fontSize: 11, color: '#6fa8ff', fontWeight: 400 },
  sub: { marginTop: 10, marginBottom: 4, fontSize: 10, letterSpacing: '0.2em', color: '#6fa8ff', textTransform: 'uppercase' },
  row: { display: 'flex', alignItems: 'center', gap: 8, padding: '2px 4px', borderRadius: 4 },
  label: { width: 46, whiteSpace: 'pre' },
  slider: { flex: 1, accentColor: '#38e8ff' },
  value: { width: 48, textAlign: 'right', color: '#ffffff', fontVariantNumeric: 'tabular-nums' },
  button: {
    marginTop: 12, width: '100%', padding: '7px 0',
    background: 'rgba(56,232,255,0.12)', color: '#38e8ff',
    border: '1px solid rgba(56,232,255,0.5)', borderRadius: 6,
    fontFamily: 'inherit', fontSize: 12, cursor: 'pointer', letterSpacing: '0.1em',
  },
  help: { marginTop: 12, lineHeight: 1.7, color: '#9fb3d9', fontSize: 11 },
};
