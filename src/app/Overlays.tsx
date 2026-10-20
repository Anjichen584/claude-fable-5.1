import type { CSSProperties, ReactNode } from 'react';
import type { ChapterSnapshot, GameSnapshot } from '../game/GameController';
import { trailColor, trailTopDown, trailWProfile } from '../puzzle/trail';

const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
const CYAN = '#38e8ff';

const CN_NUM = ['零', '一', '二', '三', '四', '五', '六', '七'];
export const cnChapter = (i: number) => `第${CN_NUM[i] ?? i}章`;

export function MainMenu({ onStart, onStartChapter, chapters, muted, onToggleMute }: { onStart: () => void; onStartChapter: (index: number) => void; chapters: ChapterSnapshot[]; muted: boolean; onToggleMute: () => void }) {
  return (
    <Overlay dim={0.35}>
      <MuteButton muted={muted} onToggle={onToggleMute} />
      <div style={{ fontSize: 11, letterSpacing: '0.5em', color: '#6fa8ff' }}>HIGHER-DIMENSIONAL PUZZLE</div>
      <div style={{ fontSize: 56, fontWeight: 800, letterSpacing: '0.18em', marginTop: 8, lineHeight: 1 }}>
        NEXUS<span style={{ color: CYAN }}>:</span> 4D
      </div>
      <div style={{ marginTop: 14, color: '#9fb3d9', fontSize: 14 }}>你看到的，只是这个世界的一个切面。</div>
      <Button onClick={onStart} style={{ marginTop: 36 }}>开始</Button>
      <div style={{ marginTop: 22, fontSize: 10, letterSpacing: '0.3em', color: '#4a5a80' }}>选择章节 · 一章一天</div>
      <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
        {chapters.map((c) => (
          <button
            key={c.index}
            onClick={() => onStartChapter(c.index)}
            style={{
              padding: '10px 14px', borderRadius: 6, cursor: 'pointer', fontFamily: MONO, textAlign: 'left', minWidth: 190,
              background: 'rgba(255,255,255,0.03)', color: '#dbe7ff',
              border: `1px solid ${c.completed ? 'rgba(255,209,102,0.55)' : 'rgba(159,179,217,0.3)'}`,
            }}
          >
            <div style={{ fontSize: 10, letterSpacing: '0.25em', color: c.completed ? '#ffd166' : '#6fa8ff' }}>
              DAY {c.index}{c.completed ? ' · 已通关' : ''}
            </div>
            <div style={{ fontSize: 14, marginTop: 3 }}>{cnChapter(c.index)} · {c.subtitle} <span style={{ color: '#6a7aa0', fontSize: 11 }}>{c.title}</span></div>
            <div style={{ fontSize: 11, color: '#9fb3d9', marginTop: 3 }}>{c.levelCount} 关 · {c.concept}</div>
          </button>
        ))}
      </div>
      <div style={{ marginTop: 28, color: '#4a5a80', fontSize: 11, lineHeight: 1.9, textAlign: 'center' }}>
        <div>WASD 移动 · 鼠标拖动摄像机</div>
        <div>Q / E 与 Z / C 旋转四维核心 · R 重置 · Esc 暂停</div>
      </div>
    </Overlay>
  );
}

export function PauseMenu({ onResume, onRestart, onMenu, muted, onToggleMute }: { onResume: () => void; onRestart: () => void; onMenu: () => void; muted: boolean; onToggleMute: () => void }) {
  return (
    <Overlay dim={0.55}>
      <MuteButton muted={muted} onToggle={onToggleMute} />
      <div style={{ fontSize: 11, letterSpacing: '0.5em', color: '#6fa8ff' }}>PAUSED</div>
      <div style={{ fontSize: 28, fontWeight: 700, marginTop: 6 }}>已暂停</div>
      <div style={{ display: 'flex', gap: 12, marginTop: 28 }}>
        <Button onClick={onResume}>继续 (Esc)</Button>
        <Button onClick={onRestart} ghost>重置关卡 (R)</Button>
        <Button onClick={onMenu} ghost>主菜单</Button>
      </div>
    </Overlay>
  );
}

export function LevelComplete({ title, index, last, onNext, onReplay }: { title: string; index: number; last: boolean; onNext: () => void; onReplay: () => void }) {
  return (
    <Overlay dim={0.45}>
      <div style={{ fontSize: 11, letterSpacing: '0.5em', color: '#ffd166' }}>LEVEL {String(index).padStart(2, '0')} COMPLETE</div>
      <div style={{ fontSize: 32, fontWeight: 700, marginTop: 6 }}>{title}</div>
      <div style={{ marginTop: 10, color: '#9fb3d9', fontSize: 13 }}>投影重合，通路成立。</div>
      <div style={{ display: 'flex', gap: 12, marginTop: 28 }}>
        <Button onClick={onNext}>{last ? '查看结算' : '下一关 (Enter)'}</Button>
        <Button onClick={onReplay} ghost>重玩 (R)</Button>
      </div>
    </Overlay>
  );
}

export function Victory({ chapter, trail, onMenu, onReplay, onNextChapter }: { chapter: ChapterSnapshot | null; trail: GameSnapshot['trail']; onMenu: () => void; onReplay: () => void; onNextChapter: () => void }) {
  const idx = chapter?.index ?? 1;
  const final = !chapter?.hasNext;
  return (
    <Overlay dim={final ? 0.7 : 0.55}>
      <div style={{ fontSize: 11, letterSpacing: '0.5em', color: '#ffd166' }}>{final ? 'SEVEN DAYS · ALL CHAPTERS COMPLETE' : `CHAPTER ${String(idx).padStart(2, '0')} · DAY ${idx} COMPLETE`}</div>
      <div style={{ fontSize: final ? 34 : 40, fontWeight: 800, marginTop: 8, letterSpacing: '0.1em' }}>{cnChapter(idx)} · {chapter?.subtitle ?? ''}</div>
      <div style={{ marginTop: 14, color: '#9fb3d9', fontSize: 14, maxWidth: 560, textAlign: 'center', lineHeight: 1.8 }}>
        {chapter?.outro}
      </div>
      {final && trail && <TrailMap trail={trail} />}
      <div style={{ display: 'flex', gap: 12, marginTop: final ? 20 : 30 }}>
        {chapter?.hasNext ? <Button onClick={onNextChapter}>下一章 · DAY {idx + 1}</Button> : null}
        <Button onClick={onReplay} ghost={!!chapter?.hasNext}>{chapter?.hasNext ? '重玩本章' : '重玩终章'}</Button>
        <Button onClick={onMenu} ghost>主菜单</Button>
      </div>
      {final && <div style={{ marginTop: 14, fontSize: 11, color: '#4a5a80' }}>NEXUS: 4D · 七个切面，到此为止。感谢游玩。</div>}
    </Overlay>
  );
}

/** 终章结算：玩家在枢纽里的四维轨迹——俯视图（颜色 = w）+ W 剖面 + 统计 */
function TrailMap({ trail }: { trail: NonNullable<GameSnapshot['trail']> }) {
  const W = 420;
  const H = 240;
  const { points, d } = trailTopDown(trail.samples, W, H, 18);
  const profile = trailWProfile(trail.samples);
  const st = trail.stats;
  const PW = 420;
  const PH = 70;
  const wSpan = Math.max(1, st.wMax - st.wMin);
  const py = (w: number) => 8 + (PH - 16) * (1 - (w - st.wMin) / wSpan);
  const segs = points.slice(1).map((p, i) => ({ a: points[i], b: p, w: (points[i].w + p.w) / 2 }));
  const first = points[0];
  const last = points[points.length - 1];
  return (
    <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }} data-testid="trail-map">
      <div style={{ fontSize: 10, letterSpacing: '0.3em', color: '#6fa8ff' }}>你在「{trail.levelTitle}」里的四维轨迹 · 俯视 x / z，颜色 = w</div>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ background: 'rgba(8,12,28,0.7)', border: '1px solid #1d3b6e', borderRadius: 8 }}>
        <path d={d} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
        {segs.map((sg, i) => (
          <line key={i} x1={sg.a.x} y1={sg.a.y} x2={sg.b.x} y2={sg.b.y} stroke={trailColor(sg.w)} strokeWidth={2.2} strokeLinecap="round" />
        ))}
        {first && <circle cx={first.x} cy={first.y} r={4} fill="#38e8ff" />}
        {last && <circle cx={last.x} cy={last.y} r={5} fill="none" stroke="#ffd166" strokeWidth={2} />}
      </svg>
      <svg width={PW} height={PH} viewBox={`0 0 ${PW} ${PH}`} style={{ background: 'rgba(8,12,28,0.7)', border: '1px solid #1d3b6e', borderRadius: 8 }}>
        <line x1={0} y1={py(0)} x2={PW} y2={py(0)} stroke="#2a3f6e" strokeDasharray="3 4" />
        <polyline fill="none" stroke="#b967ff" strokeWidth={1.8} points={profile.map((p) => `${(p.s * (PW - 4) + 2).toFixed(1)},${py(p.w).toFixed(1)}`).join(' ')} />
        <text x={6} y={py(0) - 3} fill="#4a5a80" fontSize={9} fontFamily={MONO}>w = 0</text>
        <text x={PW - 6} y={PH - 5} fill="#4a5a80" fontSize={9} fontFamily={MONO} textAnchor="end">W 剖面 · 横轴 = 路程</text>
      </svg>
      <div style={{ display: 'flex', gap: 18, fontSize: 11, color: '#9fb3d9', fontFamily: MONO }}>
        <span>路程 <b style={{ color: '#fff' }}>{st.length3.toFixed(1)}</b> m</span>
        <span>沿 W <b style={{ color: '#b967ff' }}>{st.wTravel.toFixed(1)}</b></span>
        <span>经过 <b style={{ color: '#ffd166' }}>{st.layers}</b> 层</span>
        <span>用时 <b style={{ color: '#fff' }}>{Math.round(st.duration)}</b> s</span>
      </div>
    </div>
  );
}

export function ErrorScreen({ message }: { message: string }) {
  return (
    <Overlay dim={0.9}>
      <div style={{ fontSize: 20, color: '#ffd166' }}>无法启动渲染器</div>
      <div style={{ marginTop: 10, color: '#9fb3d9', maxWidth: 520, textAlign: 'center', lineHeight: 1.7 }}>{message}</div>
    </Overlay>
  );
}

function MuteButton({ muted, onToggle }: { muted: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      title="静音 (M)"
      style={{
        position: 'absolute', top: 18, right: 18, padding: '6px 12px', borderRadius: 6, cursor: 'pointer',
        background: 'transparent', color: muted ? '#6a7aa0' : CYAN, border: '1px solid rgba(159,179,217,0.35)',
        fontFamily: MONO, fontSize: 12, letterSpacing: '0.1em',
      }}
    >
      {muted ? '♪ 静音' : '♪ 音效'}
    </button>
  );
}

function Overlay({ children, dim }: { children: ReactNode; dim: number }) {
  return (
    <div style={{
      position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      background: `rgba(5,7,15,${dim})`, color: '#dbe7ff', fontFamily: MONO, backdropFilter: 'blur(2px)',
    }}>
      {children}
    </div>
  );
}

function Button({ children, onClick, ghost, style }: { children: ReactNode; onClick: () => void; ghost?: boolean; style?: CSSProperties }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '11px 26px', borderRadius: 6, cursor: 'pointer', fontFamily: MONO, fontSize: 14, letterSpacing: '0.12em',
        background: ghost ? 'transparent' : 'rgba(56,232,255,0.14)', color: ghost ? '#9fb3d9' : CYAN,
        border: `1px solid ${ghost ? 'rgba(159,179,217,0.35)' : 'rgba(56,232,255,0.6)'}`,
        ...style,
      }}
    >
      {children}
    </button>
  );
}
