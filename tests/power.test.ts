import { describe, expect, it, vi } from 'vitest';
import {
  FUEL_MAX,
  KNOCK_POINTS,
  KNOCK_RELEASE,
  POWER_TIME,
  ROCK_POINTS,
  SPECIAL_FIRST,
  SPECIAL_FUEL,
  SPECIAL_MIN_DISTANCE,
  SPECIAL_POINTS,
  SPECIAL_RESPAWN,
  START_LIVES
} from '../src/config/constants';
import { fnv1a } from '../src/core/rng';
import type { Enemy } from '../src/sim/enemies';
import { specialOrder } from '../src/sim/spawn';
import { DT, gem, park, place, playing, rock, run } from './helpers/sim';
import pocSpecial from './fixtures/poc-special.json';

describe('rainbow gem order', () => {
  const order = (level: number, seed = 0) => specialOrder(level, seed);

  it('lists every cell centre exactly once, deterministically', () => {
    const o = order(3);
    expect(o).toHaveLength(117);
    expect(new Set(o.map((c) => `${c.x},${c.y}`)).size).toBe(117);
    expect(o.every((c) => c.x % 2 === 1 && c.y % 2 === 1)).toBe(true);
    expect(order(3)).toEqual(o);
    expect(order(4)).not.toEqual(o);
  });

  it('matches the PoC', () => {
    const refs = pocSpecial as Record<string, { n: number; first: number[][]; hash: string }>;
    const cases: [string, number, number][] = [
      ['n1', 1, 0],
      ['n2', 2, 0],
      ['n3', 3, 0],
      ['n7', 7, 0],
      ['n30', 30, 0],
      ['rally7_2', 2, fnv1a('RALLY7')]
    ];
    for (const [key, level, seed] of cases) {
      const ref = refs[key];
      expect(ref).toBeDefined();
      if (!ref) continue;
      const o = order(level, seed);
      expect(o).toHaveLength(ref.n);
      expect(o.slice(0, 6).map((c) => [c.x, c.y])).toEqual(ref.first);
      expect(
        fnv1a(o.map((c) => `${c.x},${c.y}`).join(';'))
          .toString(16)
          .padStart(8, '0')
      ).toBe(ref.hash);
    }
  });
});

describe('rainbow gem appearance', () => {
  it('appears after the first delay, away from the player and from uncollected gems', () => {
    const sim = playing([gem(1, 1), gem(25, 17)]);
    park(sim, 13, 17);
    run(sim, SPECIAL_FIRST - 0.2);
    expect(sim.special).toBeNull();
    run(sim, 0.4);
    const sp = sim.special;
    expect(sp).not.toBeNull();
    if (!sp) return;
    expect(Math.abs(sp.x - 13) + Math.abs(sp.y - 17)).toBeGreaterThanOrEqual(SPECIAL_MIN_DISTANCE);
    expect(sim.gems.some((g) => !g.taken && g.x === sp.x && g.y === sp.y)).toBe(false);
  });

  it('never appears on bonus stages', () => {
    const sim = playing([gem(1, 1)]);
    sim.loadLevel(3, true);
    sim.startGame();
    sim.loadLevel(3, true);
    run(sim, 8);
    expect(sim.special).toBeNull();
  });

  it('is picked up for power, fuel and points, then returns later', () => {
    const sim = playing([gem(1, 1)]);
    park(sim, 13, 17);
    sim.fuel = 40;
    sim.special = { x: 13, y: 17 };
    const up = vi.fn();
    sim.events.on('powerUp', up);
    run(sim, DT);
    expect(sim.special).toBeNull();
    expect(sim.power).toBeGreaterThan(POWER_TIME - 0.1);
    expect(sim.fuel).toBeCloseTo(40 + SPECIAL_FUEL, 0);
    expect(sim.score).toBe(SPECIAL_POINTS);
    expect(up).toHaveBeenCalledWith({ x: 13, y: 17 });
    run(sim, SPECIAL_RESPAWN - 0.5);
    expect(sim.special).toBeNull();
    run(sim, 1);
    expect(sim.special).not.toBeNull();
  });

  it('cycles through the order for successive appearances', () => {
    const sim = playing([gem(1, 1)]);
    park(sim, 13, 17);
    run(sim, SPECIAL_FIRST + 0.1);
    const first = sim.special;
    sim.special = null;
    run(sim, SPECIAL_FIRST + 0.1);
    expect(sim.special).not.toEqual(first);
  });

  it('does not exceed a full tank', () => {
    const sim = playing([gem(1, 1)]);
    park(sim, 13, 17);
    sim.special = { x: 13, y: 17 };
    run(sim, DT);
    expect(sim.fuel).toBeLessThanOrEqual(FUEL_MAX);
  });
});

describe('invincibility', () => {
  const powered = (rocks = [rock(13, 17)]) => {
    const sim = playing([gem(1, 1)], rocks);
    sim.power = POWER_TIME;
    park(sim, 13, 17);
    return sim;
  };

  it('counts down and then wears off', () => {
    const sim = powered([]);
    run(sim, 3);
    expect(sim.power).toBeCloseTo(POWER_TIME - 3, 1);
    run(sim, POWER_TIME);
    expect(sim.power).toBe(0);
  });

  it('smashes rocks instead of crashing, for points, and frees the tile for chasers', () => {
    const sim = powered();
    const smashed = vi.fn();
    sim.events.on('rockSmashed', smashed);
    expect(sim.isOpenForChasers(13, 17)).toBe(false);
    run(sim, DT);
    expect(sim.phase).toBe('play');
    expect(sim.rocks[0]?.broken).toBe(true);
    expect(sim.score).toBe(ROCK_POINTS);
    expect(sim.isOpenForChasers(13, 17)).toBe(true);
    expect(smashed).toHaveBeenCalledTimes(1);
    run(sim, DT * 3);
    expect(smashed).toHaveBeenCalledTimes(1); // a broken rock is gone
  });

  it('is fatal again once it wears off', () => {
    const sim = powered([]);
    run(sim, POWER_TIME + 0.1);
    sim.setRocks([rock(13, 17)]);
    run(sim, DT);
    expect(sim.phase).toBe('dying');
  });

  it('knocks chasers back home instead of dying, even stunned ones', () => {
    const sim = powered([]);
    const en = sim.enemies[0] as Enemy;
    en.active = true;
    en.release = 0;
    en.stun = 2;
    place(en, 13, 17);
    const knocked = vi.fn();
    sim.events.on('enemyKnocked', knocked);
    run(sim, DT);
    expect(sim.phase).toBe('play');
    expect([en.tx, en.ty]).toEqual([en.home.x, en.home.y]);
    expect(en.release).toBeCloseTo(KNOCK_RELEASE, 1);
    expect(en.stun).toBe(0);
    expect(sim.score).toBe(KNOCK_POINTS);
    expect(sim.knockPow).toBe(1);
    expect(knocked).toHaveBeenCalledWith(expect.objectContaining({ points: KNOCK_POINTS, x: 13, y: 17 }));
  });

  it('counts several knock-outs within one power-up', () => {
    const sim = powered([]);
    for (const en of sim.enemies.slice(0, 3)) {
      en.active = true;
      en.release = 0;
      place(en, 13, 17);
    }
    run(sim, DT);
    expect(sim.knockPow).toBe(3);
    expect(sim.score).toBe(3 * KNOCK_POINTS);
  });

  it('a chaser waiting at home cannot be hit', () => {
    const sim = powered([]);
    const en = sim.enemies[0] as Enemy;
    en.active = true;
    en.release = 5;
    place(en, 13, 17);
    run(sim, DT);
    expect(sim.knockPow).toBe(0);
  });

  it('is lost when a life is lost', () => {
    const sim = powered([]);
    sim.fuel = 0.01;
    run(sim, 0.2 + 1.2);
    expect(sim.lives).toBe(START_LIVES - 1);
    expect(sim.power).toBe(0);
  });
});
