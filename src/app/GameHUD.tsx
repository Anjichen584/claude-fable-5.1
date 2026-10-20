import type { CSSProperties } from 'react';
import { PLANES, involvesW } from '../math';
import type { GameSnapshot } from '../game/GameController';

const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
const CYAN = '#38e8ff';
const PURPLE = '#a86bff';
const GOLD = '#ffd166';

interface Props {
  snap: GameSnapshot;
}

/** 游戏内 HUD：关卡标题、四维姿态仪表、共振状态、提示、键位。 */
export function GameHUD({ snap }: Props) {
  const degOf = (rad: number) => `${Math.round((rad * 180) / Math.PI)}°`;
  return (
    <>
      {/* 左上：标题 + 姿态 */}
      <div style={{ ...panel, top: 16, left: 16, width: 250 }}>
        <div style={{ fontSize: 10, letterSpacing: '0.3em', color: '#6fa8ff' }}>LEVEL {String(snap.levelIndex).padStart(2, '0')} / {String(snap.levelCount).padStart(2, '0')}</div>
        <div style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>
          {snap.title} <span style={{ color: '#9fb3d9', fontWeight: 400, fontSize: 13 }}>{snap.subtitle}</span>
        </div>
        <div style={{ ...subhead, marginTop: 10 }}>四维姿态</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px 8px' }}>
          {PLANES.map((p) => {
            const w = involvesW(p);
            const locked = snap.lockedPlanes.includes(p);
            const active = snap.activePlane === p;
            return (
              <div key={p} style={{
                display: 'flex', justifyContent: 'space-between', padding: '3px 6px', borderRadius: 4, whiteSpace: 'nowrap', fontSize: 11,
                background: active ? 'rgba(56,232,255,0.1)' : locked ? 'rgba(255,209,102,0.08)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${locked ? 'rgba(255,209,102,0.5)' : active ? 'rgba(56,232,255,0.4)' : 'transparent'}`,
              }} title={locked ? '已锁定' : undefined}>
                <span style={{ color: w ? GOLD : '#9fb3d9' }}>{p}{locked ? '·' : ''}</span>
                <span style={{ color: '#fff', fontVariantNumeric: 'tabular-nums' }}>{degOf(snap.rotation[p])}</span>
              </div>
            );
          })}
        </div>
        {snap.slice && (
          <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: GOLD }}>切片 w₀</span>
            <span style={{ color: '#fff' }}>{snap.slice.enabled ? snap.slice.w0.toFixed(2) : '关闭'}</span>
          </div>
        )}
      </div>

      {/* 右上：共振状态 */}
      <div style={{ ...panel, top: 16, right: 16, width: 240 }}>
        <div style={subhead}>共振</div>
        {snap.bridges.map((b) => (
          <BridgeRow key={b.id} b={b} />
        ))}
        {snap.nodes.length > 0 && (
          <>
            <div style={{ ...subhead, marginTop: 8 }}>节点</div>
            {snap.nodes.map((n) => (
              <div key={n.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                <span style={{ color: n.active ? GOLD : n.visible ? PURPLE : '#4a5a80' }}>{n.id}</span>
                <span style={{ color: n.active ? GOLD : '#6a7aa0' }}>{n.active ? '已激活' : n.visible ? '待激活' : '——'}</span>
              </div>
            ))}
          </>
        )}
        <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#9fb3d9' }}>出口</span>
          <span style={{ color: snap.exitReady ? CYAN : '#4a5a80' }}>{snap.exitReady ? '已开启' : '关闭'}</span>
        </div>
        <div style={{ marginTop: 6, fontSize: 10, color: '#4a5a80', textAlign: 'right' }}>{snap.fps} fps</div>
      </div>

      {/* 底部中央：提示 */}
      {snap.hint && (
        <div style={{
          position: 'absolute', left: '50%', bottom: 72, transform: 'translateX(-50%)',
          maxWidth: 560, padding: '10px 18px', borderRadius: 8,
          background: 'rgba(6,10,24,0.82)', border: `1px solid rgba(255,209,102,0.45)`,
          color: '#ffe9b3', fontFamily: MONO, fontSize: 13, lineHeight: 1.6, textAlign: 'center',
          backdropFilter: 'blur(6px)', pointerEvents: 'none',
        }}>
          {snap.hint}
        </div>
      )}

      {/* 底部：键位 */}
      <div style={{
        position: 'absolute', left: 16, bottom: 14, right: 16, display: 'flex', gap: 16, flexWrap: 'wrap',
        color: '#6a7aa0', fontFamily: MONO, fontSize: 11, pointerEvents: 'none',
      }}>
        <Key k="W A S D" v="移动" />
        <Key k="鼠标拖动" v="摄像机" />
        <Key k="Q / E" v="XW" gold />
        <Key k="Z / C" v="YW" gold />
        <Key k="1–6 + [ ]" v="自由平面" />
        {snap.slice && <Key k=", / ." v="切片" gold />}
        <Key k="R" v="重置" />
        <Key k="Esc" v="暂停" />
        <Key k="M" v={snap.muted ? '静音中' : '静音'} />
        <Key k="`" v="调试" />
      </div>
    </>
  );
}

function BridgeRow({ b }: { b: GameSnapshot['bridges'][number] }) {
  const color = b.locked ? GOLD : !b.visible ? '#4a5a80' : b.progress > 0 ? CYAN : PURPLE;
  return (
    <div style={{ padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ color }}>{b.id}</span>
        <span style={{ color: involvesW(b.plane) ? GOLD : '#9fb3d9' }}>{b.plane}</span>
      </div>
      {b.locked ? (
        <div style={{ color: GOLD, fontSize: 11, marginTop: 2 }}>已锁定 · 可通行</div>
      ) : !b.visible ? (
        <div style={{ color: '#4a5a80', fontSize: 11, marginTop: 2 }}>锚点未出现</div>
      ) : (
        <>
          <Meter label="距离" ok={b.distanceOk} value={Number.isFinite(b.distance) ? b.distance.toFixed(2) : '—'} fill={Math.max(0, 1 - b.distance / 2.5)} />
          <Meter label="方向" ok={b.angleOk} value={`${b.angleErrorDeg.toFixed(0)}°`} fill={Math.max(0, 1 - b.angleErrorDeg / 90)} />
          <Meter label="共振" ok={b.progress >= 1} value={`${Math.round(b.progress * 100)}%`} fill={b.progress} accent={CYAN} />
        </>
      )}
    </div>
  );
}

function Meter({ label, ok, value, fill, accent }: { label: string; ok: boolean; value: string; fill: number; accent?: string }) {
  const col = ok ? (accent ?? CYAN) : PURPLE;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, fontSize: 11 }}>
      <span style={{ width: 28, color: '#9fb3d9' }}>{label}</span>
      <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(100, Math.max(0, fill * 100))}%`, height: '100%', background: col, transition: 'width 80ms linear' }} />
      </div>
      <span style={{ width: 44, textAlign: 'right', color: ok ? col : '#c9d4f0', fontVariantNumeric: 'tabular-nums' }}>{ok ? '✓ ' : ''}{value}</span>
    </div>
  );
}

function Key({ k, v, gold }: { k: string; v: string; gold?: boolean }) {
  return (
    <span><b style={{ color: gold ? GOLD : '#c9d4f0', fontWeight: 600 }}>{k}</b> {v}</span>
  );
}

const panel: CSSProperties = {
  position: 'absolute', padding: '12px 14px',
  background: 'rgba(6,10,24,0.72)', border: '1px solid rgba(56,232,255,0.22)', borderRadius: 10,
  color: '#dbe7ff', fontFamily: MONO, fontSize: 12, backdropFilter: 'blur(6px)', userSelect: 'none', pointerEvents: 'none',
};
const subhead: CSSProperties = { fontSize: 10, letterSpacing: '0.25em', color: '#6fa8ff', textTransform: 'uppercase', marginBottom: 4 };
