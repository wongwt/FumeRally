export interface AudioEngineOptions {
  /** Creates the Web Audio context; returns null where audio is unavailable. Injectable for tests. */
  createContext?: () => AudioContext | null;
}

const defaultCreateContext = (): AudioContext | null => {
  const w = window as unknown as {
    AudioContext?: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
  };
  const Ctor = w.AudioContext ?? w.webkitAudioContext;
  if (!Ctor) return null;
  try {
    return new Ctor();
  } catch {
    return null;
  }
};

/**
 * Thin wrapper over Web Audio for synthesised sound effects. Browsers only allow audio after a
 * user gesture, so the context is created lazily by `ensure()`; until then every call is a no-op.
 */
export class AudioEngine {
  muted = false;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private readonly createContext: () => AudioContext | null;

  constructor(options: AudioEngineOptions = {}) {
    this.createContext = options.createContext ?? defaultCreateContext;
  }

  /** True once a context exists (i.e. after the first user gesture). */
  get ready(): boolean {
    return this.ctx !== null;
  }

  /** Creates the context on first use and resumes it if the browser suspended it. Call on gestures. */
  ensure(): void {
    if (!this.ctx) {
      const ctx = this.createContext();
      if (!ctx) return;
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.gain.value = 0.9;
      this.master.connect(ctx.destination);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => {});
  }

  /** One oscillator note. `slide` bends the pitch (Hz) over the note; `delay` offsets the start (s). */
  tone(freq: number, dur: number, type: OscillatorType = 'square', vol = 0.05, slide = 0, delay = 0): void {
    const { ctx, master } = this;
    if (!ctx || !master || this.muted) return;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slide) osc.frequency.linearRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  /** A burst of low-passed noise that fades out, for puffs and impacts. */
  noise(dur: number, vol = 0.06, cutoff = 900): void {
    const { ctx, master } = this;
    if (!ctx || !master || this.muted) return;
    const n = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, n, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const gain = ctx.createGain();
    gain.gain.value = vol;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start();
  }
}
