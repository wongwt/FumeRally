import { describe, expect, it, vi } from 'vitest';
import {
  CLEAR_TIME,
  CLOUD_LIFE,
  CLOUD_STUN_AGE,
  COMBO_TIME,
  DYING_TIME,
  FUEL_BONUS,
  FUEL_DRAIN,
  GEM_FUEL,
  GEM_POINTS,
  PUFF_COST,
  PUFF_DROP_DISTANCE,
  READY_TIME,
  RESPAWN_FUEL,
  START_LIVES,
  STUN_POINTS,
  STUN_TIME
} from '../src/config/constants';
import { mulberry32 } from '../src/core/rng';
import type { Enemy } from '../src/sim/enemies';
import { Sim } from '../src/sim/sim';
import { DT, gem, park, place, playing, rock, run } from './helpers/sim';

describe('phases', () => {
  it('starts on the title screen and only accepts start there', () => {
    const sim = new Sim();
    expect(sim.phase).toBe('title');
    expect(sim.wantsStart).toBe(true);
    sim.startGame();
    expect(sim.phase).toBe('ready');
    expect(sim.wantsStart).toBe(false);
  });

  it('goes ready → play after the ready time and announces it once', () => {
    const sim = new Sim();
    const go = vi.fn();
    sim.events.on('go', go);
    sim.startGame();
    run(sim, READY_TIME - 0.1);
    expect(sim.phase).toBe('ready');
    run(sim, 0.2);
    expect(sim.phase).toBe('play');
    run(sim, 1);
    expect(go).toHaveBeenCalledTimes(1);
  });

  it('does not move the car while getting ready', () => {
    const sim = new Sim();
    sim.startGame();
    const { tx, ty, prog } = sim.player;
    run(sim, READY_TIME - 0.1, { x: 0, y: -1 });
    expect([sim.player.tx, sim.player.ty, sim.player.prog]).toEqual([tx, ty, prog]);
  });

  it('pauses and resumes to the phase it left', () => {
    const sim = playing();
    sim.togglePause();
    expect(sim.phase).toBe('paused');
    const fuel = sim.fuel;
    run(sim, 2);
    expect(sim.fuel).toBe(fuel);
    sim.togglePause();
    expect(sim.phase).toBe('play');
  });

  it('cannot be paused from the title screen', () => {
    const sim = new Sim();
    sim.togglePause();
    expect(sim.phase).toBe('title');
  });
});

describe('fuel and gems', () => {
  it('drains fuel while playing', () => {
    const sim = playing([gem(1, 1)]);
    park(sim, 13, 17);
    const f0 = sim.fuel;
    run(sim, 2);
    expect(sim.fuel).toBeCloseTo(f0 - FUEL_DRAIN * 2, 1);
  });

  it('collecting a gem scores, refuels and raises the combo', () => {
    const sim = playing([gem(13, 17), gem(1, 1)]);
    sim.fuel = 50;
    const taken = vi.fn();
    sim.events.on('gemTaken', taken);
    park(sim, 13, 17);
    run(sim, DT);
    expect(sim.score).toBe(GEM_POINTS);
    expect(sim.mult).toBe(2);
    expect(sim.fuel).toBeCloseTo(50 + GEM_FUEL, 0);
    expect(taken).toHaveBeenCalledWith(expect.objectContaining({ points: GEM_POINTS, mult: 1 }));
  });

  it('combo multiplies the points of consecutive gems, capped at ×5', () => {
    const gems = [1, 2, 3, 4, 5, 6].map((i) => gem(1 + (i - 1) * 2, 1));
    const sim = playing([...gems, gem(25, 17)]);
    const pts: number[] = [];
    sim.events.on('gemTaken', (e) => pts.push(e.points));
    for (const g of gems) {
      park(sim, g.x, g.y);
      run(sim, DT);
    }
    expect(pts).toEqual([100, 200, 300, 400, 500, 500]);
    expect(sim.mult).toBe(5);
  });

  it('the combo times out', () => {
    const sim = playing([gem(13, 17), gem(1, 1)]);
    park(sim, 13, 17);
    run(sim, DT);
    expect(sim.mult).toBe(2);
    park(sim, 13, 17); // stay put
    run(sim, COMBO_TIME + 0.1);
    expect(sim.mult).toBe(1);
  });

  it('fuel never exceeds the tank', () => {
    const sim = playing([gem(13, 17), gem(1, 1)]);
    park(sim, 13, 17);
    run(sim, DT);
    expect(sim.fuel).toBeLessThanOrEqual(100);
  });

  it('ignores gems the car is merely near', () => {
    const sim = playing([gem(5, 5)]);
    park(sim, 13, 17);
    run(sim, 0.1);
    expect(sim.score).toBe(0);
  });
});

describe('level clear', () => {
  it('clears when the last gem is taken, with a fuel bonus', () => {
    const sim = playing([gem(13, 17)]);
    sim.fuel = 80;
    park(sim, 13, 17);
    const cleared = vi.fn();
    sim.events.on('levelClear', cleared);
    run(sim, DT);
    expect(sim.phase).toBe('clear');
    const bonus = Math.round(sim.fuel) * FUEL_BONUS;
    expect(sim.lastFuelBonus).toBe(bonus);
    expect(sim.score).toBe(GEM_POINTS + bonus);
    expect(sim.clearedInRun).toBe(1);
    expect(cleared).toHaveBeenCalledTimes(1);
  });

  it('moves on to the next level and gets ready again', () => {
    const sim = playing([gem(13, 17)]);
    park(sim, 13, 17);
    run(sim, DT);
    const loaded = vi.fn();
    sim.events.on('levelLoaded', loaded);
    run(sim, CLEAR_TIME + 0.05);
    expect(sim.level).toBe(2);
    expect(sim.phase).toBe('ready');
    expect(sim.fuel).toBe(100);
    expect(sim.gemsLeft).toBeGreaterThan(0);
    expect(loaded).toHaveBeenCalledWith({ level: 2, bonus: false });
  });
});

describe('crashing', () => {
  it('running out of fuel costs a life', () => {
    const sim = playing([gem(1, 1)]);
    park(sim, 13, 17);
    sim.fuel = 0.05;
    const crash = vi.fn();
    sim.events.on('crash', crash);
    run(sim, 0.2);
    expect(sim.phase).toBe('dying');
    expect(sim.crashWhy).toBe('fuel');
    expect(sim.lives).toBe(START_LIVES - 1);
    expect(sim.lvDeaths).toBe(1);
    expect(crash).toHaveBeenCalledWith(expect.objectContaining({ why: 'fuel' }));
  });

  it('hitting a rock is fatal', () => {
    const sim = playing([gem(1, 1)], [rock(13, 17)]);
    park(sim, 13, 17);
    run(sim, DT);
    expect(sim.phase).toBe('dying');
    expect(sim.crashWhy).toBe('rock');
  });

  it('crashes only once while dying', () => {
    const sim = playing([gem(1, 1)], [rock(13, 17)]);
    park(sim, 13, 17);
    run(sim, 0.5);
    expect(sim.lives).toBe(START_LIVES - 1);
  });

  it('respawns at the start with topped-up fuel, keeping collected gems', () => {
    const sim = playing([gem(13, 17), gem(1, 1)], [rock(5, 5)]);
    sim.fuel = 90;
    park(sim, 13, 17);
    run(sim, DT); // takes the first gem
    sim.fuel = 20;
    sim.setRocks([rock(sim.player.tx, sim.player.ty)]);
    run(sim, DT);
    expect(sim.phase).toBe('dying');
    const respawn = vi.fn();
    sim.events.on('respawn', respawn);
    run(sim, DYING_TIME + 0.05);
    expect(sim.phase).toBe('ready');
    expect(sim.fuel).toBe(RESPAWN_FUEL);
    expect(sim.mult).toBe(1);
    expect(sim.gemsLeft).toBe(1);
    expect(respawn).toHaveBeenCalled();
  });

  it('ends the game after the last life without a record if the best was not beaten', () => {
    const sim = new Sim();
    sim.hi = 5000; // best from earlier runs
    sim.startGame();
    run(sim, READY_TIME + 0.01);
    sim.gems = [gem(1, 1)];
    sim.setRocks([]);
    sim.lives = 1;
    sim.score = 1234;
    sim.fuel = 0.01;
    const over = vi.fn();
    sim.events.on('gameOver', over);
    run(sim, 0.1 + DYING_TIME + 0.05);
    expect(sim.phase).toBe('over');
    expect(sim.wantsStart).toBe(true);
    expect(over).toHaveBeenCalledWith({ score: 1234, newRecord: false });
  });

  it('beating the previous best is a new record', () => {
    const sim = new Sim();
    sim.hi = 100;
    sim.startGame();
    run(sim, READY_TIME + 0.01);
    sim.gems = [gem(13, 17), gem(1, 1)];
    sim.setRocks([]);
    park(sim, 13, 17);
    run(sim, DT);
    expect(sim.hi).toBe(100); // 100 points ties, does not beat
    sim.score = 150;
    sim.hi = 150;
    sim.lives = 1;
    sim.fuel = 0.01;
    run(sim, 0.1 + DYING_TIME + 0.05);
    expect(sim.newRecord).toBe(true);
  });

  it('a fresh game resets score, lives and level progress', () => {
    const sim = playing();
    sim.score = 999;
    sim.lives = 0;
    sim.startLevel = 4;
    sim.startGame();
    expect(sim.score).toBe(0);
    expect(sim.lives).toBe(START_LIVES);
    expect(sim.level).toBe(4);
    expect(sim.phase).toBe('ready');
  });
});

describe('driving', () => {
  it('moves the car through the maze under player control', () => {
    const sim = playing([gem(1, 1)]);
    const x0 = sim.player.tx + sim.player.dx * sim.player.prog;
    const y0 = sim.player.ty + sim.player.dy * sim.player.prog;
    run(sim, 0.5, { x: 0, y: -1 });
    const x1 = sim.player.tx + sim.player.dx * sim.player.prog;
    const y1 = sim.player.ty + sim.player.dy * sim.player.prog;
    expect(Math.hypot(x1 - x0, y1 - y0)).toBeGreaterThan(1);
  });
});

describe('chasers', () => {
  /** Level 9 (27 × 19) with one chaser released next to the player and everything else quiet. */
  function chased(): Sim {
    const sim = playing([gem(1, 1)], [], 'sedan', 9);
    sim.rand = mulberry32(5);
    const en = sim.enemies[0] as Enemy;
    en.active = true;
    en.release = 0;
    return sim;
  }
  it('stay home until their release time', () => {
    const sim = new Sim();
    sim.startGame();
    run(sim, READY_TIME + 0.5);
    const en = sim.enemies[0] as Enemy;
    expect([en.tx, en.ty]).toEqual([en.home.x, en.home.y]);
    run(sim, 1.5);
    expect(en.release).toBeLessThanOrEqual(0);
    expect(Math.hypot(en.tx - en.home.x, en.ty - en.home.y)).toBeGreaterThan(0);
  });

  it('catching the player costs a life', () => {
    const sim = chased();
    park(sim, 13, 17);
    place(sim.enemies[0] as Enemy, 13, 17);
    const crash = vi.fn();
    sim.events.on('crash', crash);
    run(sim, DT);
    expect(sim.phase).toBe('dying');
    expect(sim.crashWhy).toBe('caught');
    expect(crash).toHaveBeenCalledWith(expect.objectContaining({ why: 'caught' }));
  });

  it('do not catch the player while still at home', () => {
    const sim = chased();
    const en = sim.enemies[0] as Enemy;
    en.release = 5;
    park(sim, 13, 17);
    place(en, 13, 17);
    run(sim, DT * 3);
    expect(sim.phase).toBe('play');
  });

  it('a chaser eventually runs a stationary player down', () => {
    const sim = chased();
    park(sim, 13, 17);
    place(sim.enemies[0] as Enemy, 13, 1);
    for (let t = 0; t < 20 && sim.phase === 'play'; t += DT) sim.update(DT, null);
    expect(sim.phase).toBe('dying');
    expect(sim.crashWhy).toBe('caught');
    expect(sim.lives).toBe(START_LIVES - 1);
  });

  it('go back home and are re-released after a crash', () => {
    const sim = chased();
    park(sim, 13, 17);
    const en = sim.enemies[0] as Enemy;
    place(en, 13, 17);
    run(sim, DT + DYING_TIME + 0.05);
    expect(sim.phase).toBe('ready');
    expect([en.tx, en.ty]).toEqual([en.home.x, en.home.y]);
    expect(en.release).toBeGreaterThan(0);
  });
});

describe('exhaust smoke', () => {
  function smoky(): { sim: Sim; en: Enemy } {
    const sim = playing([gem(1, 1)]);
    sim.rand = mulberry32(9);
    const en = sim.enemies[0] as Enemy;
    en.active = true;
    en.release = 0;
    return { sim, en };
  }

  it('costs fuel and drops a cloud behind the car', () => {
    const { sim } = smoky();
    park(sim, 13, 17);
    Object.assign(sim.player, { fx: 1, fy: 0 });
    const f0 = sim.fuel;
    const puff = vi.fn();
    sim.events.on('puff', puff);
    run(sim, DT, null);
    sim.update(DT, null, true);
    expect(sim.clouds).toHaveLength(1);
    expect(sim.clouds[0]).toMatchObject({ x: 13 - PUFF_DROP_DISTANCE, y: 17 });
    expect(sim.fuel).toBeCloseTo(f0 - PUFF_COST - FUEL_DRAIN * DT * 2, 1);
    expect(puff).toHaveBeenCalledTimes(1);
  });

  it('is rate limited while the button is held', () => {
    const { sim } = smoky();
    park(sim, 13, 17);
    for (let t = 0; t < 1.0; t += DT) sim.update(DT, null, true);
    expect(sim.clouds.length).toBeGreaterThanOrEqual(2);
    expect(sim.clouds.length).toBeLessThanOrEqual(3);
  });

  it('does nothing, and says so, when the tank is too low', () => {
    const { sim } = smoky();
    park(sim, 13, 17);
    sim.fuel = PUFF_COST - 0.5;
    const empty = vi.fn();
    sim.events.on('puffEmpty', empty);
    sim.update(DT, null, true);
    expect(sim.clouds).toHaveLength(0);
    expect(empty).toHaveBeenCalledTimes(1);
  });

  it('clouds fade away after their lifetime', () => {
    const { sim } = smoky();
    park(sim, 13, 17);
    sim.update(DT, null, true);
    expect(sim.clouds).toHaveLength(1);
    run(sim, CLOUD_LIFE + 0.1);
    expect(sim.clouds).toHaveLength(0);
  });

  it('stuns a chaser that touches a fresh cloud and awards points', () => {
    const { sim, en } = smoky();
    park(sim, 13, 17);
    sim.clouds = [{ x: 9, y: 9, age: 0 }];
    Object.assign(en, { tx: 9, ty: 9, dx: 0, dy: 0, prog: 0 });
    const stunned = vi.fn();
    sim.events.on('enemyStunned', stunned);
    run(sim, DT);
    expect(en.stun).toBeGreaterThan(STUN_TIME - 0.1);
    expect(sim.score).toBe(STUN_POINTS);
    expect(stunned).toHaveBeenCalledTimes(1);
  });

  it('old clouds no longer stun', () => {
    const { sim, en } = smoky();
    park(sim, 13, 17);
    sim.clouds = [{ x: 9, y: 9, age: CLOUD_STUN_AGE + 0.05 }];
    Object.assign(en, { tx: 9, ty: 9, dx: 0, dy: 0, prog: 0 });
    run(sim, DT);
    expect(en.stun).toBe(0);
  });

  it('a stunned chaser is frozen and harmless, then immune for a moment', () => {
    const { sim, en } = smoky();
    park(sim, 13, 17);
    en.stun = STUN_TIME;
    place(en, 13, 17);
    run(sim, DT * 3);
    expect(sim.phase).toBe('play'); // touching but harmless
    expect([en.tx, en.ty]).toEqual([13, 17]); // not moving
    run(sim, STUN_TIME);
    expect(en.stun).toBe(0);
    expect(en.immune).toBeGreaterThan(0);
  });

  it('immune chasers are not stunned again straight away', () => {
    const { sim, en } = smoky();
    park(sim, 13, 17);
    en.immune = 0.5;
    sim.clouds = [{ x: 9, y: 9, age: 0 }];
    Object.assign(en, { tx: 9, ty: 9, dx: 0, dy: 0, prog: 0 });
    run(sim, DT);
    expect(en.stun).toBe(0);
  });

  it('is unavailable on bonus stages', () => {
    const { sim } = smoky();
    sim.bonus = true;
    park(sim, 13, 17);
    sim.update(DT, null, true);
    expect(sim.clouds).toHaveLength(0);
  });

  it('rocks block chasers but not the maze itself', () => {
    const sim = new Sim();
    expect(sim.rocks.length).toBeGreaterThan(0);
    for (const r of sim.rocks) {
      expect(sim.maze.isOpen(r.x, r.y)).toBe(true);
      expect(sim.isOpenForChasers(r.x, r.y)).toBe(false);
    }
    sim.setRocks([]);
    expect(sim.isOpenForChasers(sim.maze.start.x, sim.maze.start.y)).toBe(true);
  });
});
