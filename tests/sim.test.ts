import { describe, expect, it, vi } from 'vitest';
import {
  CLEAR_TIME,
  COMBO_TIME,
  DYING_TIME,
  FUEL_BONUS,
  FUEL_DRAIN,
  GEM_FUEL,
  GEM_POINTS,
  READY_TIME,
  RESPAWN_FUEL,
  START_LIVES
} from '../src/config/constants';
import { Sim } from '../src/sim/sim';
import type { Gem, Rock } from '../src/sim/spawn';

const DT = 1 / 120;
const run = (sim: Sim, seconds: number, want = null as Parameters<Sim['update']>[1]): void => {
  for (let t = 0; t < seconds - 1e-9; t += DT) sim.update(DT, want);
};
const gem = (x: number, y: number): Gem => ({ x, y, phase: 0, taken: false });
const rock = (x: number, y: number): Rock => ({ x, y, rx: 0, ry: 0, rz: 0, sx: 1, sz: 1, broken: false });

/** A sim in the 'play' phase with the car parked on a known tile and a controlled set of gems. */
function playing(gems: Gem[] = [gem(1, 1)], rocks: Rock[] = []): Sim {
  const sim = new Sim();
  sim.startGame();
  run(sim, READY_TIME + 0.01);
  expect(sim.phase).toBe('play');
  sim.gems = gems;
  sim.rocks = rocks;
  return sim;
}
const park = (sim: Sim, x: number, y: number): void => {
  Object.assign(sim.player, { tx: x, ty: y, dx: 0, dy: 0, prog: 0 });
};

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
    sim.rocks = [rock(sim.player.tx, sim.player.ty)];
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
    sim.rocks = [];
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
    sim.rocks = [];
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
