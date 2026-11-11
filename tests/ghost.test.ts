import { describe, expect, it, vi } from 'vitest';
import { GHOST_MAX_NUMBERS, GHOST_SAMPLE, GhostRecorder, ghostAt, type GhostData } from '../src/sim/ghost';
import { CLEAR_TIME } from '../src/config/constants';
import { DT, gem, park, playing, run } from './helpers/sim';

describe('GhostRecorder', () => {
  it('stores one rounded sample every 0.05 s', () => {
    const r = new GhostRecorder();
    for (let i = 0; i < 13; i++) r.sample(DT, 13.04, 17.5);
    // 13 steps of 1/120 s = 0.108 s -> 2 samples (x and y stored as integers: tiles × 16)
    expect(r.path).toEqual([209, 280, 209, 280]);
  });

  it('is independent of how time is sliced', () => {
    const a = new GhostRecorder();
    const b = new GhostRecorder();
    for (let i = 0; i < 122; i++) a.sample(1 / 120, 1, 1);
    for (let i = 0; i < 61; i++) b.sample(1 / 60, 1, 1);
    // about 1.02 s of time: 20 samples (two numbers each), give or take float rounding at a boundary
    expect(Math.abs(a.path.length - b.path.length)).toBeLessThanOrEqual(2);
    expect(a.path.length / 2).toBeGreaterThanOrEqual(19);
    expect(a.path.length / 2).toBeLessThanOrEqual(20);
  });

  it('stops recording at the cap so storage cannot balloon', () => {
    const r = new GhostRecorder();
    for (let i = 0; i < GHOST_MAX_NUMBERS; i++) r.sample(GHOST_SAMPLE, 1, 1);
    expect(r.path.length).toBe(GHOST_MAX_NUMBERS);
  });

  it('rounds gem times to hundredths and can reset', () => {
    const r = new GhostRecorder();
    r.addGem(3.14159);
    expect(r.gems).toEqual([3.14]);
    r.sample(1, 1, 1);
    r.reset();
    expect(r.path).toEqual([]);
    expect(r.gems).toEqual([]);
  });
});

describe('ghostAt', () => {
  const ghost: GhostData = { t: 1, p: [0, 0, 16, 0, 16, 32], g: [] }; // (0,0) -> (1,0) -> (1,2)

  it('interpolates between samples', () => {
    expect(ghostAt(ghost, 0)).toMatchObject({ x: 0, y: 0 });
    const mid = ghostAt(ghost, GHOST_SAMPLE / 2);
    expect(mid?.x).toBeCloseTo(0.5);
    expect(mid?.dx).toBe(16);
    expect(ghostAt(ghost, GHOST_SAMPLE * 1.5)).toMatchObject({ x: 1 });
    expect(ghostAt(ghost, GHOST_SAMPLE * 1.5)?.y).toBeCloseTo(1);
  });

  it('holds its last position after the run ends, and clamps negative time', () => {
    expect(ghostAt(ghost, 99)).toMatchObject({ x: 1, y: 2, dx: 0, dy: 0 });
    expect(ghostAt(ghost, -5)).toMatchObject({ x: 0, y: 0 });
  });

  it('has no pose for an empty ghost', () => {
    expect(ghostAt({ t: 0, p: [], g: [] }, 1)).toBeNull();
  });
});

describe('Sim ghost recording and racing', () => {
  it('records the path and gem times during play only', () => {
    const sim = playing([gem(1, 1)]);
    park(sim, 13, 17);
    expect(sim.recorder.path).toHaveLength(0);
    run(sim, 1);
    expect(sim.recorder.path.length / 2).toBeGreaterThanOrEqual(19);
    expect(sim.recorder.path.slice(0, 2)).toEqual([13 * 16, 17 * 16]);
  });

  it('logs the time of each gem pickup', () => {
    const sim = playing([gem(13, 17), gem(25, 17), gem(1, 1)]);
    park(sim, 13, 17);
    run(sim, DT);
    expect(sim.recorder.gems).toHaveLength(1);
    expect(sim.recorder.gems[0]).toBeGreaterThan(0);
    expect(sim.recorder.gems[0]).toBeLessThan(0.1);
  });

  it('reports how far ahead or behind the ghost each gem was', () => {
    const sim = playing([gem(13, 17), gem(1, 1)]);
    sim.ghost = { t: 20, p: [0, 0, 0, 0], g: [5] };
    const split = vi.fn();
    sim.events.on('ghostSplit', split);
    park(sim, 13, 17);
    run(sim, DT);
    expect(sim.ghostDelta).toBeLessThan(0); // we picked it up in ~0 s, the ghost took 5 s
    expect(sim.ghostDelta).toBeCloseTo(-4.99, 1);
    expect(split).toHaveBeenCalledWith(expect.objectContaining({ x: 13, y: 17 }));
  });

  it('shows no split when the ghost is off, absent or has run out of gems', () => {
    for (const setup of [
      (s: ReturnType<typeof playing>) => {
        s.ghost = { t: 1, p: [0, 0, 0, 0], g: [5] };
        s.ghostOn = false;
      },
      () => undefined,
      (s: ReturnType<typeof playing>) => {
        s.ghost = { t: 1, p: [0, 0, 0, 0], g: [] };
      }
    ]) {
      const sim = playing([gem(13, 17), gem(1, 1)]);
      setup(sim);
      park(sim, 13, 17);
      run(sim, DT);
      expect(sim.ghostDelta).toBeNull();
    }
  });

  it('a new stage clears the recording, the ghost and the delta', () => {
    const sim = playing([gem(13, 17), gem(1, 1)]);
    sim.ghost = { t: 1, p: [0, 0, 0, 0], g: [5] };
    park(sim, 13, 17);
    run(sim, DT);
    sim.loadLevel(2, false);
    expect(sim.recorder.path).toEqual([]);
    expect(sim.recorder.gems).toEqual([]);
    expect(sim.ghost).toBeNull();
    expect(sim.ghostDelta).toBeNull();
  });

  it('keeps recording across a crash within the same stage', () => {
    const sim = playing([gem(1, 1)]);
    park(sim, 13, 17);
    run(sim, 0.5);
    const before = sim.recorder.path.length;
    sim.fuel = 0.01;
    run(sim, 0.1 + 1.2 + 0.1);
    expect(sim.lvDeaths).toBe(1);
    expect(sim.recorder.path.length).toBeGreaterThanOrEqual(before);
  });

  it('the clear event carries the run and whether it was flawless', () => {
    const sim = playing([gem(1, 1)]); // out of reach, so the stage keeps going
    const clear = vi.fn();
    sim.events.on('levelClear', clear);
    park(sim, 13, 17);
    run(sim, 1);
    sim.gems = [gem(13, 17)];
    run(sim, DT);
    expect(clear).toHaveBeenCalledTimes(1);
    const payload = clear.mock.calls[0]?.[0];
    expect(payload.flawless).toBe(true);
    expect(payload.path.length).toBeGreaterThan(10);
    expect(payload.gems).toHaveLength(1);
    run(sim, CLEAR_TIME);
  });

  it('a crash on the stage makes the clear not flawless', () => {
    const sim = playing([gem(1, 1)]);
    sim.lvDeaths = 1;
    const clear = vi.fn();
    sim.events.on('levelClear', clear);
    sim.gems = [gem(13, 17)];
    park(sim, 13, 17);
    run(sim, DT);
    expect(clear.mock.calls[0]?.[0].flawless).toBe(false);
  });
});
