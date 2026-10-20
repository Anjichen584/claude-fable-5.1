/**
 * WebAudio 合成音效，零外部资源。
 * 浏览器要求用户手势后才能发声：在开始按钮 / 首次按键时调用 unlock()。
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  private resonanceOsc: OscillatorNode | null = null;
  private resonanceGain: GainNode | null = null;
  private rotateGain: GainNode | null = null;
  private rotateFilter: BiquadFilterNode | null = null;
  private _muted = false;

  constructor() {
    try {
      this._muted = localStorage.getItem('nexus4d.muted') === '1';
    } catch {
      /* ignore */
    }
  }

  get muted(): boolean {
    return this._muted;
  }

  get ready(): boolean {
    return this.ctx !== null && this.ctx.state === 'running';
  }

  /** 在用户手势中调用。幂等。 */
  unlock(): void {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.build();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  toggleMute(): boolean {
    this._muted = !this._muted;
    try {
      localStorage.setItem('nexus4d.muted', this._muted ? '1' : '0');
    } catch {
      /* ignore */
    }
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(this._muted ? 0 : 0.8, this.ctx.currentTime, 0.05);
    return this._muted;
  }

  private build(): void {
    const ctx = this.ctx!;
    this.master = ctx.createGain();
    this.master.gain.value = this._muted ? 0 : 0.8;
    this.master.connect(ctx.destination);

    // ---- 环境嗡鸣：两个失谐的低频振荡 + 低通 + 慢 LFO
    this.ambientGain = ctx.createGain();
    this.ambientGain.gain.value = 0;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 320;
    lp.connect(this.ambientGain);
    this.ambientGain.connect(this.master);
    for (const [f, type] of [[55, 'sawtooth'], [55.6, 'sine'], [110.3, 'triangle']] as const) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.value = type === 'sawtooth' ? 0.12 : 0.25;
      o.connect(g).connect(lp);
      o.start();
    }
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 90;
    lfo.connect(lfoGain).connect(lp.frequency);
    lfo.start();

    // ---- 共振音：随接近程度升高音调、随持续进度增大音量
    this.resonanceOsc = ctx.createOscillator();
    this.resonanceOsc.type = 'sine';
    this.resonanceOsc.frequency.value = 220;
    this.resonanceGain = ctx.createGain();
    this.resonanceGain.gain.value = 0;
    this.resonanceOsc.connect(this.resonanceGain).connect(this.master);
    this.resonanceOsc.start();

    // ---- 旋转 W 时的"空间摩擦"：带通噪声
    const bufLen = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    noise.loop = true;
    this.rotateFilter = ctx.createBiquadFilter();
    this.rotateFilter.type = 'bandpass';
    this.rotateFilter.frequency.value = 900;
    this.rotateFilter.Q.value = 2.5;
    this.rotateGain = ctx.createGain();
    this.rotateGain.gain.value = 0;
    noise.connect(this.rotateFilter).connect(this.rotateGain).connect(this.master);
    noise.start();
  }

  setAmbient(on: boolean): void {
    if (!this.ctx || !this.ambientGain) return;
    this.ambientGain.gain.setTargetAtTime(on ? 0.5 : 0, this.ctx.currentTime, 0.6);
  }

  /** 每帧：closeness 0..1（越接近锚点越高），progress 0..1（持续满足的进度） */
  setResonance(closeness: number, progress: number): void {
    if (!this.ctx || !this.resonanceOsc || !this.resonanceGain) return;
    const t = this.ctx.currentTime;
    const c = Math.max(0, Math.min(1, closeness));
    const p = Math.max(0, Math.min(1, progress));
    this.resonanceOsc.frequency.setTargetAtTime(220 + c * c * 440 + p * 220, t, 0.05);
    this.resonanceGain.gain.setTargetAtTime(c > 0.35 ? 0.03 + c * 0.08 + p * 0.12 : 0, t, 0.08);
  }

  /** 每帧：是否正在旋转 W 平面 */
  setRotating(active: boolean, wPlane: boolean): void {
    if (!this.ctx || !this.rotateGain || !this.rotateFilter) return;
    const t = this.ctx.currentTime;
    this.rotateGain.gain.setTargetAtTime(active ? (wPlane ? 0.07 : 0.03) : 0, t, 0.06);
    this.rotateFilter.frequency.setTargetAtTime(wPlane ? 1400 : 700, t, 0.1);
  }

  playLock(): void {
    this.chime([523.25, 783.99, 1046.5], 0.0, 0.09, 0.9, 'sine');
    this.sweep(180, 60, 0.6, 0.18, 'triangle');
  }

  playNode(): void {
    this.chime([659.25, 830.61, 987.77, 1318.5], 0.0, 0.07, 0.6, 'triangle');
  }

  playPortal(): void {
    this.sweep(220, 880, 1.2, 0.12, 'sawtooth', 600);
    this.chime([440, 554.37, 659.25], 0.5, 0.12, 1.2, 'sine');
  }

  playComplete(): void {
    this.chime([523.25, 659.25, 783.99, 1046.5, 1318.5], 0.0, 0.11, 1.6, 'sine');
    this.sweep(110, 220, 1.5, 0.15, 'triangle');
  }

  playHint(): void {
    this.chime([880, 1108.7], 0, 0.05, 0.25, 'sine', 0.05);
  }

  playUI(): void {
    this.chime([1200], 0, 0, 0.08, 'square', 0.03);
  }

  playReset(): void {
    this.sweep(600, 150, 0.35, 0.1, 'triangle');
  }

  // ------------------------------------------------------------ 工具
  private chime(freqs: number[], startDelay: number, spacing: number, decay: number, type: OscillatorType, vol = 0.12): void {
    if (!this.ctx || !this.master) return;
    const t0 = this.ctx.currentTime + startDelay;
    freqs.forEach((f, i) => {
      const o = this.ctx!.createOscillator();
      o.type = type;
      o.frequency.value = f;
      const g = this.ctx!.createGain();
      const t = t0 + i * spacing;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0005, t + decay);
      o.connect(g).connect(this.master!);
      o.start(t);
      o.stop(t + decay + 0.05);
    });
  }

  private sweep(f0: number, f1: number, dur: number, vol: number, type: OscillatorType, lowpass?: number): void {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    let node: AudioNode = o;
    if (lowpass) {
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = lowpass;
      node.connect(lp);
      node = lp;
    }
    node.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  dispose(): void {
    void this.ctx?.close();
    this.ctx = null;
  }
}
