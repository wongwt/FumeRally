import { describe, expect, it } from 'vitest';
import { CLEAR_TIME } from '../src/config/constants';
import { mulberry32 } from '../src/core/rng';
import { ChallengeState } from '../src/game/challenge';
import { Progress } from '../src/game/progress';
import { Sim } from '../src/sim/sim';
import { GhostStore } from '../src/storage/ghosts';
import { Prefs } from '../src/storage/prefs';
import { Records } from '../src/storage/records';
import { DT, gem, park, playing, run } from './helpers/sim';
import { MemoryStorage } from './helpers/storage';

function setup(storage = new MemoryStorage()) {
  const records = new Records(storage);
  records.load();
  const ghosts = new GhostStore(storage);
  ghosts.load();
  const sim = playing([gem(1, 1)]);
  const progress = new Progress(sim, records, ghosts);
  return { sim, progress, records, ghosts, storage };
}

/** Runs the current stage for `seconds`, then clears it, optionally after a crash. */
function clearStage(sim: Sim, seconds: number, crash = false): void {
  park(sim, 13, 17);
  sim.gems = [gem(1, 1)];
  run(sim, seconds);
  if (crash) sim.lvDeaths = 1;
  sim.gems = [gem(13, 17)];
  park(sim, 13, 17);
  run(sim, DT);
  expect(sim.phase).toBe('clear');
}

describe('Progress: stage clears', () => {
  it('records progress and the first best time and ghost', () => {
    const { sim, progress, records, ghosts } = setup();
    clearStage(sim, 2);
    expect(records.data.cleared).toBe(1);
    expect(records.data.carLv).toBe(1);
    const key = progress.stageKey(1);
    expect(key).toBe('N:1');
    expect(records.bestTime(key)).toBeGreaterThan(1.9);
    expect(ghosts.get(key)?.p.length).toBeGreaterThan(10);
    expect(progress.lastClear).toEqual({ bestPrev: null, newBest: true });
  });

  it('only a faster flawless clear replaces the best time and ghost', () => {
    const { sim, progress, records, ghosts } = setup();
    clearStage(sim, 4);
    const first = records.bestTime('N:1') as number;
    sim.loadLevel(1, false);
    sim.startGame();
    run(sim, 1.9);
    clearStage(sim, 6); // slower
    expect(records.bestTime('N:1')).toBe(first);
    expect(progress.lastClear).toEqual({ bestPrev: first, newBest: false });
    sim.startGame();
    run(sim, 1.9);
    clearStage(sim, 2); // faster
    expect(records.bestTime('N:1') as number).toBeLessThan(first);
    expect(ghosts.get('N:1')?.t).toBe(records.bestTime('N:1'));
    expect(progress.lastClear.newBest).toBe(true);
  });

  it('a clear after losing a car never sets a best time', () => {
    const { sim, progress, records } = setup();
    clearStage(sim, 2, true);
    expect(records.bestTime('N:1')).toBeUndefined();
    expect(progress.lastClear).toEqual({ bestPrev: null, newBest: false });
    expect(records.data.cleared).toBe(1); // still counts as progress
  });

  it('keeps best times and ghosts per board and car', () => {
    const { sim, progress, records } = setup();
    sim.challengeKey = 'C:RALLY7';
    clearStage(sim, 2);
    expect(records.bestTime('C:RALLY7:1')).toBeDefined();
    expect(records.bestTime('N:1')).toBeUndefined();
    expect(records.data.cleared).toBe(0); // code boards do not move the picker
    expect(records.data.carLv).toBe(1);
    sim.carId = 'moto';
    expect(progress.stageKey(1)).toBe('C:RALLY7:1@moto');
  });

  it('persists to storage', () => {
    const { sim, storage } = setup();
    clearStage(sim, 2);
    const again = setup(storage);
    expect(again.records.data.cleared).toBe(1);
    expect(again.ghosts.get('N:1')).not.toBeNull();
  });

  it('bonus stages are not recorded', () => {
    const { sim, records } = setup();
    sim.level = 3;
    clearStage(sim, 1);
    run(sim, CLEAR_TIME + 0.1);
    expect(sim.bonus).toBe(true);
    const cleared = records.data.cleared;
    sim.gems = [gem(13, 17)];
    park(sim, 13, 17);
    run(sim, 1.9 + DT);
    expect(records.data.cleared).toBe(cleared);
  });
});

describe('Progress: ghosts for new stages', () => {
  it('hands the stored ghost to the stage when it loads, but not on bonus stages', () => {
    const { sim, ghosts } = setup();
    ghosts.save('N:2', { t: 9, p: [0, 0, 16, 16, 32, 32], g: [1] });
    sim.loadLevel(2, false);
    expect(sim.ghost?.t).toBe(9);
    sim.loadLevel(2, true);
    expect(sim.ghost).toBeNull();
    sim.loadLevel(3, false);
    expect(sim.ghost).toBeNull();
  });

  it('uses the ghost of the selected board and car', () => {
    const { sim, ghosts } = setup();
    ghosts.save('C:AB:1@moto', { t: 9, p: [0, 0, 16, 16], g: [] });
    sim.loadLevel(1, false);
    expect(sim.ghost).toBeNull();
    sim.challengeKey = 'C:AB';
    sim.carId = 'moto';
    sim.loadLevel(1, false);
    expect(sim.ghost?.t).toBe(9);
  });
});

describe('Progress: game over', () => {
  it('adds the run to the board and raises the normal-mode best score', () => {
    const { sim, records } = setup();
    sim.score = 1500;
    sim.clearedInRun = 3;
    sim.runTime = 83.26;
    sim.lives = 1;
    sim.fuel = 0.01;
    run(sim, 0.2 + 1.2);
    expect(sim.phase).toBe('over');
    expect(records.boardOf('N')[0]).toMatchObject({ s: 1500, l: 3, t: 83.3, c: 'sedan' });
    expect(records.data.hi).toBe(1500);
  });

  it('scores on a code board stay off the normal best', () => {
    const { sim, records } = setup();
    sim.challengeKey = 'C:RALLY7';
    sim.score = 800;
    sim.lives = 1;
    sim.fuel = 0.01;
    run(sim, 0.2 + 1.2);
    expect(records.boardOf('C:RALLY7')).toHaveLength(1);
    expect(records.data.hi).toBe(0);
  });
});

describe('ChallengeState', () => {
  const day = new Date(2026, 10, 12, 9);
  const make = () => {
    const prefs = new Prefs(new MemoryStorage());
    prefs.load();
    return { prefs, chal: new ChallengeState(prefs, () => day) };
  };

  it('normal mode uses the built-in maps', () => {
    const { chal } = make();
    expect(chal).toMatchObject({ mode: 'normal', key: 'N', seed: 0, code: '', valid: true });
  });

  it('daily mode follows the date', () => {
    const { chal } = make();
    chal.setMode('daily');
    expect(chal.key).toBe('C:XL38QJ');
    expect(chal.code).toBe('XL38QJ');
    expect(chal.seed).not.toBe(0);
  });

  it('custom mode needs a code and remembers it across modes', () => {
    const { chal, prefs } = make();
    chal.setMode('custom');
    expect(chal.valid).toBe(false);
    chal.setCode(' rally7! ');
    expect(chal.customCode).toBe('RALLY7');
    expect(chal.key).toBe('C:RALLY7');
    expect(chal.valid).toBe(true);
    chal.setMode('normal');
    expect(chal.customCode).toBe('RALLY7');
    expect(prefs.mode).toBe('normal');
  });

  it('randomize switches to custom with a fresh code', () => {
    const { chal } = make();
    const code = chal.randomize(mulberry32(1));
    expect(chal.mode).toBe('custom');
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    expect(chal.key).toBe('C:' + code);
  });

  it('saves choices through prefs', () => {
    const storage = new MemoryStorage();
    const prefs = new Prefs(storage);
    const chal = new ChallengeState(prefs, () => day);
    chal.setMode('custom');
    chal.setCode('abc');
    const reloaded = new Prefs(storage);
    reloaded.load();
    expect(reloaded).toMatchObject({ mode: 'custom', code: 'ABC' });
  });
});
