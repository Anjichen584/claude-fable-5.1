import type { CSSProperties, ReactNode } from 'react';

const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
const CYAN = '#38e8ff';

export function MainMenu({ onStart }: { onStart: () => void }) {
  return (
    <Overlay dim={0.35}>
      <div style={{ fontSize: 11, letterSpacing: '0.5em', color: '#6fa8ff' }}>HIGHER-DIMENSIONAL PUZZLE</div>
      <div style={{ fontSize: 56, fontWeight: 800, letterSpacing: '0.18em', marginTop: 8, lineHeight: 1 }}>
        NEXUS<span style={{ color: CYAN }}>:</span> 4D
      </div>
      <div style={{ marginTop: 14, color: '#9fb3d9', fontSize: 14 }}>你看到的，只是这个世界的一个切面。</div>
      <Button onClick={onStart} style={{ marginTop: 36 }}>开始</Button>
      <div style={{ marginTop: 28, color: '#4a5a80', fontSize: 11, lineHeight: 1.9, textAlign: 'center' }}>
        <div>WASD 移动 · 鼠标拖动摄像机</div>
        <div>Q / E 与 Z / C 旋转四维核心 · R 重置 · Esc 暂停</div>
      </div>
    </Overlay>
  );
}

export function PauseMenu({ onResume, onRestart, onMenu }: { onResume: () => void; onRestart: () => void; onMenu: () => void }) {
  return (
    <Overlay dim={0.55}>
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

export function Victory({ onMenu, onReplay }: { onMenu: () => void; onReplay: () => void }) {
  return (
    <Overlay dim={0.55}>
      <div style={{ fontSize: 11, letterSpacing: '0.5em', color: '#ffd166' }}>CHAPTER 01 COMPLETE</div>
      <div style={{ fontSize: 40, fontWeight: 800, marginTop: 8, letterSpacing: '0.1em' }}>第一章 · 折叠</div>
      <div style={{ marginTop: 14, color: '#9fb3d9', fontSize: 14, maxWidth: 480, textAlign: 'center', lineHeight: 1.8 }}>
        你已经学会让一个四维物体在三维里改变形状。<br />这只是七个切面中的第一个。
      </div>
      <div style={{ display: 'flex', gap: 12, marginTop: 30 }}>
        <Button onClick={onReplay}>从头再玩</Button>
        <Button onClick={onMenu} ghost>主菜单</Button>
      </div>
    </Overlay>
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
