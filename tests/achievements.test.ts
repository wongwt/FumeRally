import { describe, expect, it, vi } from 'vitest';
import { ACHS, ACH_BY_ID, isAchId, type AchId } from '../src/config/achievements';
import type { CarId } from '../src/config/cars';
import { CLEAR_TIME } from '../src/config/constants';
import { Achievements } from '../src/game/achievements';
import { Progress } from '../src/game/progress';
import type { Enemy } from '../src/sim/enemies';
import type { Sim } from '../src/sim/sim';
import { GhostStore } from '../src/storage/ghosts';
import { Records } from '../src/storage/records';
import { DT, gem, park, place, playing, rock, run } from './helpers/sim';
import { MemoryStorage } from './helpers/storage';

function setup(
  options: {
    car?: CarId;
    carLv?: number;
    gems?: ReturnType<typeof gem>[];
    rocks?: ReturnType<typeof rock>[];
    storage?: MemoryStorage;
  } = {}
) {
  const storage = options.storage ?? new MemoryStorage();
  const records = new Records(storage);
  records.load();
  if (options.carLv !== undefined) records.data.carLv = options.carLv;
  const ghosts = new GhostStore(storage);
  ghosts.load();
  const sim = playing(options.gems ?? [gem(1, 1)], options.rocks ?? [], options.car ?? 'sedan');
  const progress = new Progress(sim, records, ghosts);
  const ach = new Achievements(sim, progress, records);
  const unlocked: AchId[] = [];
  ach.events.on('unlocked', ({ id }) => unlocked.push(id));
  return { sim, records, ghosts, progress, ach, unlocked, storage };
}

/** Takes the stage's last gem so the stage is cleared. */
function clear(sim: Sim, level = sim.level): void {
  sim.level = level;
  sim.bonus = false; // every third stage is followed by a bonus stage; these scenarios want plain stage clears
  sim.gems = [gem(13, 17)];
  park(sim, 13, 17);
  run(sim, DT);
  expect(sim.phase).toBe('clear');
}

/** Runs through the clear screen and the next ready phase into play of the following stage. */
function nextStage(sim: Sim): void {
  run(sim, CLEAR_TIME + 0.05 + 1.9);
  expect(sim.phase).toBe('play');
  for (const en of sim.enemies) en.active = false;
}

describe('achievement definitions', () => {
  it('has 32 unique achievements with valid shapes', () => {
    expect(ACHS).toHaveLength(32);
    expect(new Set(ACHS.map((a) => a.id)).size).toBe(32);
    for (const a of ACHS) {
      expect(ACH_BY_ID[a.id]).toBe(a);
      if (a.stat) expect(a.need).toBeGreaterThan(0);
      if (a.lvl !== undefined) expect(a.tier).not.toBe('fun');
    }
    expect(ACHS.filter((a) => a.lvl !== undefined)).toHaveLength(7);
  });

  it('recognises ids', () => {
    expect(isAchId('t3')).toBe(true);
    expect(isAchId('nope')).toBe(false);
    expect(isAchId(3)).toBe(false);
  });
});

describe('unlocking basics', () => {
  it('awards once, remembers when, and saves', () => {
    const { ach, records, unlocked, storage } = setup();
    expect(ach.count).toBe(0);
    expect(ach.latest).toBeNull();
    expect(ach.unlock('first_puff')).toBe(true);
    expect(ach.unlock('first_puff')).toBe(false);
    expect(unlocked).toEqual(['first_puff']);
    expect(ach.latest).toBe('first_puff');
    expect(ach.count).toBe(1);
    expect(records.data.ach.first_puff).toBeGreaterThan(0);
    const reloaded = new Records(storage);
    reloaded.load();
    expect(reloaded.data.ach.first_puff).toBeDefined();
    expect(reloaded.data.achLast).toBe('first_puff');
  });

  it('latest follows the newest unlock and ignores junk', () => {
    const { ach, records } = setup();
    ach.unlock('first_puff');
    ach.unlock('first_rock');
    expect(ach.latest).toBe('first_rock');
    records.data.achLast = 'bogus';
    expect(ach.latest).toBeNull();
  });
});

describe('crashes', () => {
  it('being caught: first_catch and a hit', () => {
    const { sim, ach, unlocked, records } = setup();
    const en = sim.enemies[0] as Enemy;
    en.active = true;
    en.release = 0;
    park(sim, 13, 17);
    place(en, 13, 17);
    run(sim, DT);
    expect(sim.crashWhy).toBe('caught');
    expect(unlocked).toContain('first_catch');
    expect(records.data.st.hits).toBe(1);
    expect(ach.has('first_rock')).toBe(false);
  });

  it('hitting a rock: first_rock, a hit and a rock', () => {
    const { sim, unlocked, records } = setup({ rocks: [rock(13, 17)] });
    park(sim, 13, 17);
    run(sim, DT);
    expect(unlocked).toContain('first_rock');
    expect([records.data.st.hits, records.data.st.rocks]).toEqual([1, 1]);
  });

  it('running out of fuel: no_fuel, but not a hit', () => {
    const { sim, unlocked, records } = setup();
    sim.fuel = 0.01;
    run(sim, 0.2);
    expect(unlocked).toContain('no_fuel');
    expect(records.data.st.hits ?? 0).toBe(0);
  });

  it('lifetime counters add up to hits_10, hits_50 and rocks_5', () => {
    const { sim, ach, records } = setup();
    for (let i = 0; i < 4; i++) sim.events.emit('crash', { why: 'rock', x: 0, y: 0 });
    expect(ach.has('rocks_5')).toBe(false);
    sim.events.emit('crash', { why: 'rock', x: 0, y: 0 });
    expect(ach.has('rocks_5')).toBe(true);
    expect(ach.has('hits_10')).toBe(false);
    for (let i = 0; i < 5; i++) sim.events.emit('crash', { why: 'caught', x: 0, y: 0 });
    expect(ach.has('hits_10')).toBe(true);
    expect(ach.has('hits_50')).toBe(false);
    for (let i = 0; i < 40; i++) sim.events.emit('crash', { why: 'caught', x: 0, y: 0 });
    expect(ach.has('hits_50')).toBe(true);
    expect(records.data.st.hits).toBe(50);
  });
});

describe('exhaust', () => {
  it('first puff, then 100 puffs', () => {
    const { sim, ach } = setup();
    park(sim, 13, 17);
    sim.update(DT, null, true);
    expect(ach.has('first_puff')).toBe(true);
    for (let i = 0; i < 98; i++) sim.events.emit('puff', { cloud: { x: 0, y: 0, age: 0 } });
    expect(ach.has('puff_100')).toBe(false);
    sim.events.emit('puff', { cloud: { x: 0, y: 0, age: 0 } });
    expect(ach.has('puff_100')).toBe(true);
  });

  it('stunning a chaser with smoke: first_stun, then 50', () => {
    const { sim, ach } = setup();
    const en = sim.enemies[0] as Enemy;
    en.active = true;
    en.release = 0;
    park(sim, 13, 17);
    sim.clouds = [{ x: 9, y: 9, age: 0 }];
    place(en, 9, 9);
    run(sim, DT);
    expect(ach.has('first_stun')).toBe(true);
    expect(ach.has('stun_50')).toBe(false);
    for (let i = 0; i < 48; i++) sim.events.emit('enemyStunned', { enemy: en, points: 50, x: 0, y: 0 });
    expect(ach.has('stun_50')).toBe(false);
    sim.events.emit('enemyStunned', { enemy: en, points: 50, x: 0, y: 0 });
    expect(ach.has('stun_50')).toBe(true);
  });
});

describe('power-ups', () => {
  it('the first rainbow gem', () => {
    const { sim, unlocked } = setup();
    park(sim, 13, 17);
    sim.special = { x: 13, y: 17 };
    run(sim, DT);
    expect(unlocked).toContain('first_power');
  });

  it('three knock-outs in one invincibility earn knock3; armor knocks do not count', () => {
    const { sim, ach } = setup();
    sim.power = 7;
    park(sim, 13, 17);
    for (const en of sim.enemies.slice(0, 3)) {
      en.active = true;
      en.release = 0;
      place(en, 13, 17);
    }
    sim.events.emit('powerUp', { x: 0, y: 0 });
    run(sim, DT);
    expect(ach.has('knock3')).toBe(true);

    const other = setup();
    other.sim.events.emit('powerUp', { x: 0, y: 0 });
    const en = other.sim.enemies[0] as Enemy;
    for (let i = 0; i < 5; i++) other.sim.events.emit('enemyKnocked', { enemy: en, points: 0, x: 0, y: 0 });
    expect(other.ach.has('knock3')).toBe(false);
  });

  it('the knock-out count starts over with each new power-up', () => {
    const { sim, ach } = setup();
    const en = sim.enemies[0] as Enemy;
    sim.events.emit('powerUp', { x: 0, y: 0 });
    sim.events.emit('enemyKnocked', { enemy: en, points: 200, x: 0, y: 0 });
    sim.events.emit('enemyKnocked', { enemy: en, points: 200, x: 0, y: 0 });
    sim.events.emit('powerUp', { x: 0, y: 0 });
    sim.events.emit('enemyKnocked', { enemy: en, points: 200, x: 0, y: 0 });
    expect(ach.has('knock3')).toBe(false);
  });

  it('combo5 on reaching the ×5 multiplier', () => {
    const gems = [1, 3, 5, 7, 9].map((x) => gem(x, 1));
    const { sim, ach } = setup({ gems: [...gems, gem(25, 17)] });
    for (const g of gems.slice(0, 4)) {
      park(sim, g.x, g.y);
      run(sim, DT);
    }
    expect(sim.mult).toBe(5);
    expect(ach.has('combo5')).toBe(true);
  });

  it('combo5 is not given for a ×4 combo', () => {
    const gems = [1, 3, 5].map((x) => gem(x, 1));
    const { sim, ach } = setup({ gems: [...gems, gem(25, 17)] });
    for (const g of gems) {
      park(sim, g.x, g.y);
      run(sim, DT);
    }
    expect(sim.mult).toBe(4);
    expect(ach.has('combo5')).toBe(false);
  });

  it('score_10k on reaching 10,000 in one run', () => {
    const { sim, ach } = setup();
    sim.events.emit('score', { score: 9999 });
    expect(ach.has('score_10k')).toBe(false);
    sim.events.emit('score', { score: 10000 });
    expect(ach.has('score_10k')).toBe(true);
  });

  it('bonus_perfect only for a complete bonus stage', () => {
    const { sim, ach } = setup();
    sim.events.emit('bonusEnd', { perfect: false, award: 0 });
    expect(ach.has('bonus_perfect')).toBe(false);
    sim.events.emit('bonusEnd', { perfect: true, award: 2500 });
    expect(ach.has('bonus_perfect')).toBe(true);
  });
});

describe('car abilities', () => {
  it('armor blocking a rock counts as a hit and a rock', () => {
    const { sim, ach, records } = setup({ car: 'armor', rocks: [rock(13, 17)] });
    park(sim, 13, 17);
    run(sim, DT);
    expect(ach.has('armor_block')).toBe(true);
    expect([records.data.st.hits, records.data.st.rocks]).toEqual([1, 1]);
  });

  it('armor blocking a chaser counts as a hit only', () => {
    const { sim, ach, records } = setup({ car: 'armor' });
    const en = sim.enemies[0] as Enemy;
    en.active = true;
    en.release = 0;
    park(sim, 13, 17);
    place(en, 13, 17);
    run(sim, DT);
    expect(ach.has('armor_block')).toBe(true);
    expect([records.data.st.hits, records.data.st.rocks ?? 0]).toEqual([1, 0]);
  });

  it('the off-roader crushing ten rocks earns crush_10, invincibility crushing does not', () => {
    const { sim, ach, records } = setup({ car: 'offroad', rocks: [rock(13, 17)] });
    park(sim, 13, 17);
    run(sim, DT);
    expect(records.data.st.crush).toBe(1);
    for (let i = 0; i < 8; i++) sim.events.emit('rockSmashed', { rock: rock(1, 1), points: 20, crush: true });
    expect(ach.has('crush_10')).toBe(false);
    sim.events.emit('rockSmashed', { rock: rock(1, 1), points: 20, crush: true });
    expect(ach.has('crush_10')).toBe(true);

    const other = setup({ rocks: [rock(13, 17)] });
    other.sim.power = 5;
    park(other.sim, 13, 17);
    run(other.sim, DT);
    expect(other.records.data.st.crush ?? 0).toBe(0);
  });

  it('the police siren stunning a chaser', () => {
    const { sim, ach } = setup({ car: 'police' });
    const en = sim.enemies[0] as Enemy;
    en.active = true;
    en.release = 0;
    park(sim, 13, 17);
    run(sim, 3.1);
    place(en, 13, 15);
    run(sim, DT);
    expect(ach.has('siren_1')).toBe(true);
  });
});

describe('stage clears', () => {
  it('trophies follow the highest stage cleared, in any mode', () => {
    const { sim, ach } = setup();
    clear(sim, 3);
    expect(ach.has('t3')).toBe(true);
    expect(ach.has('t5')).toBe(false);
    nextStage(sim);
    sim.challengeKey = 'C:RALLY7';
    clear(sim, 5);
    expect(ach.has('t5')).toBe(true);
    expect(ach.has('code_clear')).toBe(true);
  });

  it('a normal-mode clear is not a code clear', () => {
    const { sim, ach } = setup();
    clear(sim, 1);
    expect(ach.has('code_clear')).toBe(false);
  });

  it('flawless3: three clean stages in a row, and a crash resets the streak', () => {
    const { sim, ach } = setup();
    clear(sim, 1);
    nextStage(sim);
    clear(sim, 2);
    nextStage(sim);
    sim.lvDeaths = 1;
    clear(sim, 3); // not clean: streak resets
    nextStage(sim);
    expect(ach.has('flawless3')).toBe(false);
    clear(sim, 4);
    nextStage(sim);
    clear(sim, 5);
    expect(ach.has('flawless3')).toBe(false);
    nextStage(sim);
    clear(sim, 6);
    expect(ach.has('flawless3')).toBe(true);
  });

  it('a new run starts a new streak', () => {
    const { sim, ach } = setup();
    clear(sim, 1);
    nextStage(sim);
    clear(sim, 2);
    nextStage(sim);
    sim.lives = 1;
    sim.fuel = 0.01;
    run(sim, 0.2 + 1.2);
    expect(sim.phase).toBe('over');
    sim.startGame();
    run(sim, 1.9);
    sim.gems = [gem(1, 1)];
    for (const en of sim.enemies) en.active = false;
    clear(sim, 1);
    expect(ach.has('flawless3')).toBe(false); // would be the third in a row without the reset
  });

  it('run5: five stages in one run', () => {
    const { sim, ach } = setup();
    for (let lv = 1; lv <= 5; lv++) {
      if (lv > 1) nextStage(sim);
      expect(ach.has('run5')).toBe(false);
      clear(sim, lv);
    }
    expect(sim.clearedInRun).toBe(5);
    expect(ach.has('run5')).toBe(true);
  });

  it('low_fuel: cleared with under 10% fuel', () => {
    const a = setup();
    a.sim.fuel = 12;
    clear(a.sim);
    expect(a.ach.has('low_fuel')).toBe(false);
    const b = setup();
    b.sim.fuel = 0.5; // the last gem adds 9 before the clear is judged
    clear(b.sim);
    expect(b.ach.has('low_fuel')).toBe(true);
  });

  it('moto_clear only on the motorcycle', () => {
    const a = setup({ car: 'moto' });
    clear(a.sim);
    expect(a.ach.has('moto_clear')).toBe(true);
    const b = setup();
    clear(b.sim);
    expect(b.ach.has('moto_clear')).toBe(false);
  });

  it('garage_full once all eight cars are unlocked', () => {
    const a = setup({ carLv: 34 });
    clear(a.sim, 34);
    expect(a.ach.has('garage_full')).toBe(false);
    const b = setup({ carLv: 34 });
    clear(b.sim, 35);
    expect(b.ach.has('garage_full')).toBe(true);
  });

  it('beat_ghost: a faster flawless run against a ghost', () => {
    const { sim, ghosts, ach } = setup();
    const slow = { t: 99, p: [0, 0, 16, 16, 32, 32], g: [] };
    ghosts.save('N:1', slow);
    sim.loadLevel(1, false);
    sim.startGame();
    run(sim, 1.9);
    for (const en of sim.enemies) en.active = false;
    expect(sim.ghost).not.toBeNull();
    run(sim, 1);
    clear(sim, 1);
    expect(ach.has('beat_ghost')).toBe(true);
  });

  it('beat_ghost needs a ghost to beat, and the ghost switched on', () => {
    const noGhost = setup();
    clear(noGhost.sim, 1);
    expect(noGhost.ach.has('beat_ghost')).toBe(false);

    const off = setup();
    off.ghosts.save('N:1', { t: 99, p: [0, 0, 16, 16, 32, 32], g: [] });
    off.sim.ghostOn = false;
    off.sim.loadLevel(1, false);
    off.sim.startGame();
    run(off.sim, 1.9);
    for (const en of off.sim.enemies) en.active = false;
    run(off.sim, 1);
    clear(off.sim, 1);
    expect(off.ach.has('beat_ghost')).toBe(false);
  });
});

describe('progress from before achievements existed', () => {
  it('is granted silently, without pop-ups', () => {
    const { ach, unlocked, records } = setup({ carLv: 12 });
    expect(ach.has('t3') && ach.has('t5') && ach.has('t10')).toBe(true);
    expect(ach.has('t15')).toBe(false);
    expect(unlocked).toEqual([]);
    expect(records.data.ach.t3).toBeGreaterThan(0);
  });

  it('includes the garage collector for a full garage', () => {
    const { ach } = setup({ carLv: 40 });
    expect(ach.has('garage_full')).toBe(true);
    expect(ach.count).toBe(8); // seven trophies and the garage
  });

  it('does not overwrite earlier unlock dates', () => {
    const storage = new MemoryStorage();
    storage.map.set('fumeRallyRec', JSON.stringify({ carLv: 5, cleared: 5, ach: { t3: 123 } }));
    const { records } = setup({ storage });
    expect(records.data.ach.t3).toBe(123);
    expect(records.data.ach.t5).toBeGreaterThan(123);
  });

  it('the spy never fires for a full set at startup', () => {
    const spy = vi.fn();
    const { ach } = setup({ carLv: 40 });
    ach.events.on('unlocked', spy);
    expect(spy).not.toHaveBeenCalled();
  });
});
