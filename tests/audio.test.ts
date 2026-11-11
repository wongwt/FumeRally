import { afterEach, describe, expect, it, vi } from 'vitest';
import { AudioEngine } from '../src/audio/engine';
import { loadMuted, saveMuted } from '../src/audio/settings';
import { bindSfx, Sfx, type SoundBank } from '../src/audio/sfx';
import { Sim } from '../src/sim/sim';

/** A minimal recording stand-in for AudioContext. */
function fakeContext(state: 'running' | 'suspended' = 'running') {
  const calls = {
    oscillators: [] as {
      type: string;
      freqSets: [number, number][];
      ramps: [number, number][];
      start: number;
      stop: number;
    }[],
    gains: [] as { values: number[]; ramps: [number, number][] }[],
    noises: [] as { length: number; cutoff: number }[],
    resume: vi.fn(() => Promise.resolve())
  };
  const ctx = {
    state,
    currentTime: 10,
    sampleRate: 1000,
    destination: {},
    resume: calls.resume,
    createGain() {
      const g = { values: [] as number[], ramps: [] as [number, number][] };
      calls.gains.push(g);
      return {
        gain: {
          set value(v: number) {
            g.values.push(v);
          },
          setValueAtTime: (v: number) => g.values.push(v),
          exponentialRampToValueAtTime: (v: number, t: number) => g.ramps.push([v, t])
        },
        connect: vi.fn()
      };
    },
    createOscillator() {
      const o = {
        type: '',
        freqSets: [] as [number, number][],
        ramps: [] as [number, number][],
        start: -1,
        stop: -1
      };
      calls.oscillators.push(o);
      return {
        set type(v: string) {
          o.type = v;
        },
        frequency: {
          setValueAtTime: (f: number, t: number) => o.freqSets.push([f, t]),
          linearRampToValueAtTime: (f: number, t: number) => o.ramps.push([f, t])
        },
        connect: vi.fn(),
        start: (t: number) => (o.start = t),
        stop: (t: number) => (o.stop = t)
      };
    },
    createBuffer: (_c: number, length: number) => {
      const data = new Float32Array(length);
      calls.noises.push({ length, cutoff: 0 });
      return { getChannelData: () => data };
    },
    createBufferSource: () => ({ buffer: null, connect: vi.fn(), start: vi.fn() }),
    createBiquadFilter: () => ({
      type: '',
      frequency: {
        set value(v: number) {
          const last = calls.noises[calls.noises.length - 1];
          if (last) last.cutoff = v;
        }
      },
      connect: vi.fn()
    })
  };
  return { ctx: ctx as unknown as AudioContext, calls };
}

describe('AudioEngine', () => {
  it('does nothing and does not throw before the first gesture', () => {
    const { ctx, calls } = fakeContext();
    const a = new AudioEngine({ createContext: () => ctx });
    a.tone(440, 0.1);
    a.noise(0.1);
    expect(a.ready).toBe(false);
    expect(calls.oscillators).toHaveLength(0);
  });

  it('creates the context once on ensure() and resumes a suspended one', () => {
    const { ctx, calls } = fakeContext('suspended');
    const create = vi.fn(() => ctx);
    const a = new AudioEngine({ createContext: create });
    a.ensure();
    a.ensure();
    expect(create).toHaveBeenCalledTimes(1);
    expect(a.ready).toBe(true);
    expect(calls.resume).toHaveBeenCalledTimes(2);
  });

  it('stays silent when audio is unsupported', () => {
    const a = new AudioEngine({ createContext: () => null });
    a.ensure();
    expect(() => a.tone(440, 0.1)).not.toThrow();
    expect(a.ready).toBe(false);
  });

  it('schedules a tone with slide, delay and a fading envelope', () => {
    const { ctx, calls } = fakeContext();
    const a = new AudioEngine({ createContext: () => ctx });
    a.ensure();
    a.tone(380, 0.7, 'sawtooth', 0.07, -320, 0.5);
    const o = calls.oscillators[0];
    expect(o?.type).toBe('sawtooth');
    expect(o?.freqSets[0]).toEqual([380, 10.5]);
    expect(o?.ramps[0]).toEqual([60, 11.2]);
    expect(o?.start).toBe(10.5);
    expect(o?.stop).toBeCloseTo(11.22);
    const env = calls.gains.find((g) => g.ramps.length);
    expect(env?.values).toContain(0.07);
    expect(env?.ramps[0]?.[0]).toBe(0.0001);
  });

  it('never bends a pitch below 30 Hz', () => {
    const { ctx, calls } = fakeContext();
    const a = new AudioEngine({ createContext: () => ctx });
    a.ensure();
    a.tone(100, 0.2, 'square', 0.05, -500);
    expect(calls.oscillators[0]?.ramps[0]?.[0]).toBe(30);
  });

  it('renders noise with the right length and cutoff', () => {
    const { ctx, calls } = fakeContext();
    const a = new AudioEngine({ createContext: () => ctx });
    a.ensure();
    a.noise(0.28, 0.09, 700);
    expect(calls.noises[0]).toEqual({ length: 280, cutoff: 700 });
  });

  it('plays nothing while muted, and again once unmuted', () => {
    const { ctx, calls } = fakeContext();
    const a = new AudioEngine({ createContext: () => ctx });
    a.ensure();
    a.muted = true;
    a.tone(440, 0.1);
    a.noise(0.1);
    expect(calls.oscillators).toHaveLength(0);
    expect(calls.noises).toHaveLength(0);
    a.muted = false;
    a.tone(440, 0.1);
    expect(calls.oscillators).toHaveLength(1);
  });
});

describe('Sfx', () => {
  const setup = () => {
    const { ctx, calls } = fakeContext();
    const a = new AudioEngine({ createContext: () => ctx });
    a.ensure();
    return { sfx: new Sfx(a), calls };
  };
  const freqs = (calls: ReturnType<typeof fakeContext>['calls']): number[] =>
    calls.oscillators.map((o) => o.freqSets[0]?.[0] ?? 0);

  it('the gem chime rises with the combo', () => {
    const low = setup();
    low.sfx.gem(1);
    const high = setup();
    high.sfx.gem(5);
    expect(freqs(low.calls)).toEqual([590, 885]);
    expect(freqs(high.calls)).toEqual([870, 1305]);
  });

  it('the ready tune and power-up arpeggio use the PoC notes', () => {
    const a = setup();
    a.sfx.go();
    expect(freqs(a.calls)).toEqual([660, 990]);
    const b = setup();
    b.sfx.power();
    expect(freqs(b.calls)).toEqual([392, 523, 659, 784, 1047]);
    const c = setup();
    c.sfx.clear();
    expect(freqs(c.calls)).toEqual([523, 659, 784, 1047]);
  });

  it('crash and smash combine a tone with noise', () => {
    const a = setup();
    a.sfx.crash();
    expect(a.calls.oscillators).toHaveLength(1);
    expect(a.calls.noises).toHaveLength(1);
    const b = setup();
    b.sfx.smash();
    expect(b.calls.oscillators).toHaveLength(1);
    expect(b.calls.noises).toHaveLength(1);
  });
});

describe('bindSfx', () => {
  function spyBank(): { bank: SoundBank; spies: Record<keyof SoundBank, ReturnType<typeof vi.fn>> } {
    const spies = {
      gem: vi.fn(),
      puff: vi.fn(),
      stun: vi.fn(),
      crash: vi.fn(),
      clear: vi.fn(),
      go: vi.fn(),
      empty: vi.fn(),
      power: vi.fn(),
      smash: vi.fn()
    };
    return { bank: spies as unknown as SoundBank, spies };
  }

  it('maps simulation events to sounds', () => {
    const sim = new Sim();
    const { bank, spies } = spyBank();
    bindSfx(sim.events, bank);
    const gem = { x: 1, y: 1, phase: 0, taken: true };
    const rock = { x: 1, y: 1, rx: 0, ry: 0, rz: 0, sx: 1, sz: 1, broken: true };
    const enemy = sim.enemies[0]!;
    sim.events.emit('gemTaken', { gem, points: 300, mult: 3 });
    expect(spies.gem).toHaveBeenCalledWith(3);
    sim.events.emit('puff', { cloud: { x: 0, y: 0, age: 0 } });
    sim.events.emit('puffEmpty', {});
    sim.events.emit('enemyStunned', { enemy, points: 50, x: 0, y: 0 });
    sim.events.emit('enemyKnocked', { enemy, points: 200, x: 0, y: 0 });
    sim.events.emit('crash', { why: 'rock', x: 0, y: 0 });
    sim.events.emit('levelClear', { fuelBonus: 0, time: 0, flawless: true, path: [], gems: [] });
    sim.events.emit('bonusEnd', { perfect: true, award: 0 });
    sim.events.emit('go', {});
    sim.events.emit('powerUp', { x: 0, y: 0 });
    sim.events.emit('rockSmashed', { rock, points: 20, crush: false });
    sim.events.emit('armorBroke', { x: 0, y: 0 });
    sim.events.emit('siren', { x: 0, y: 0, count: 1 });
    expect(spies.puff).toHaveBeenCalledTimes(1);
    expect(spies.empty).toHaveBeenCalledTimes(1);
    expect(spies.stun).toHaveBeenCalledTimes(3); // stunned, knocked, siren
    expect(spies.crash).toHaveBeenCalledTimes(1);
    expect(spies.clear).toHaveBeenCalledTimes(2);
    expect(spies.go).toHaveBeenCalledTimes(1);
    expect(spies.power).toHaveBeenCalledTimes(1);
    expect(spies.smash).toHaveBeenCalledTimes(2); // rock smash, armor break
  });
});

describe('mute setting', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('defaults to sound on when storage is unavailable', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      }
    });
    expect(loadMuted()).toBe(false);
    expect(() => saveMuted(true)).not.toThrow();
  });

  it('round-trips through storage', () => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v)
    });
    expect(loadMuted()).toBe(false);
    saveMuted(true);
    expect(loadMuted()).toBe(true);
    saveMuted(false);
    expect(loadMuted()).toBe(false);
  });
});
