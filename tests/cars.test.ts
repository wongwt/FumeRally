import { describe, expect, it, vi } from 'vitest';
import {
  CARS,
  CAR_ORDER,
  carUnlocked,
  isCarId,
  newlyUnlockedCar,
  nextLockedCar,
  unlockedCars
} from '../src/config/cars';
import {
  ARMOR_GRACE,
  CLEAR_TIME,
  DYING_TIME,
  FUEL_DRAIN,
  READY_TIME,
  ROCK_POINTS,
  SIREN_COOLDOWN,
  SIREN_START,
  SIREN_STUN
} from '../src/config/constants';
import { Progress } from '../src/game/progress';
import type { Enemy } from '../src/sim/enemies';
import { posX, posY } from '../src/sim/movement';
import { Sim } from '../src/sim/sim';
import { GhostStore } from '../src/storage/ghosts';
import { Records } from '../src/storage/records';
import { DT, gem, park, place, playing, rock, run } from './helpers/sim';
import { MemoryStorage } from './helpers/storage';

describe('car definitions', () => {
  it('unlock one after another, in order', () => {
    const levels = CAR_ORDER.map((id) => CARS[id].unlock);
    expect(levels).toEqual([...levels].sort((a, b) => a - b));
    expect(levels[0]).toBe(0);
    expect(new Set(CAR_ORDER).size).toBe(8);
  });

  it('knows what is unlocked at each stage of progress', () => {
    expect(unlockedCars(0)).toEqual(['sedan']);
    expect(unlockedCars(4)).toEqual(['sedan']);
    expect(unlockedCars(5)).toEqual(['sedan', 'sport']);
    expect(unlockedCars(40)).toHaveLength(8);
    expect(carUnlocked('moto', 34)).toBe(false);
    expect(carUnlocked('moto', 35)).toBe(true);
    expect(nextLockedCar(0)).toBe('sport');
    expect(nextLockedCar(35)).toBeUndefined();
  });

  it('finds the car a clear unlocked, if any', () => {
    expect(newlyUnlockedCar(4, 5)).toBe('sport');
    expect(newlyUnlockedCar(5, 6)).toBeNull();
    expect(newlyUnlockedCar(0, 12)).toBe('armor'); // jumping past several gives the newest
    expect(newlyUnlockedCar(40, 41)).toBeNull();
  });

  it('validates ids', () => {
    expect(isCarId('moto')).toBe(true);
    expect(isCarId('tank')).toBe(false);
    expect(isCarId(5)).toBe(false);
  });

  it('every car has a distinct colour and sane stats', () => {
    const colours = new Set(CAR_ORDER.map((id) => CARS[id].color));
    expect(colours.size).toBe(8);
    for (const id of CAR_ORDER) {
      expect(CARS[id].speed).toBeGreaterThan(3);
      expect(CARS[id].drain).toBeGreaterThan(0);
    }
  });
});

describe('speed and fuel', () => {
  const travelled = (sim: Sim, seconds: number): number => {
    park(sim, 13, 15);
    Object.assign(sim.player, { dx: 0, dy: -1, fx: 0, fy: -1 });
    const y0 = posY(sim.player);
    run(sim, seconds, { x: 0, y: -1 });
    return Math.abs(posY(sim.player) - y0) + Math.abs(posX(sim.player) - 13);
  };

  it('faster cars cover more ground', () => {
    const sedan = travelled(playing([gem(1, 1)], [], 'sedan'), 0.3);
    const moto = travelled(playing([gem(1, 1)], [], 'moto'), 0.3);
    expect(moto).toBeGreaterThan(sedan);
    expect(sedan).toBeCloseTo(CARS.sedan.speed * 0.3, 0);
  });

  it('the tanker burns less fuel and the motorbike far more', () => {
    const burn = (car: 'sedan' | 'tanker' | 'moto'): number => {
      const sim = playing([gem(1, 1)], [], car);
      park(sim, 13, 17);
      const f0 = sim.fuel;
      run(sim, 5);
      return f0 - sim.fuel;
    };
    const sedan = burn('sedan');
    expect(sedan).toBeCloseTo(FUEL_DRAIN * 5, 1);
    expect(burn('tanker')).toBeCloseTo(sedan * 0.6, 1);
    expect(burn('moto')).toBeCloseTo(sedan * 1.7, 1);
  });

  it('setCar updates the stats the sim uses', () => {
    const sim = new Sim();
    sim.setCar('sport');
    expect([sim.carId, sim.speed, sim.drain]).toEqual(['sport', 6.3, 1.3]);
  });
});

describe('armor', () => {
  const armored = (rocks = [rock(13, 17)]) => {
    const sim = playing([gem(1, 1)], rocks, 'armor');
    park(sim, 13, 17);
    return sim;
  };

  it('starts each life with one hit of armor', () => {
    const sim = armored([]);
    expect(sim.armor).toBe(1);
    expect(playing([gem(1, 1)]).armor).toBe(0);
  });

  it('absorbs one rock: it smashes, no crash, a grace period starts', () => {
    const sim = armored();
    const broke = vi.fn();
    const smashed = vi.fn();
    sim.events.on('armorBroke', broke);
    sim.events.on('rockSmashed', smashed);
    run(sim, DT);
    expect(sim.phase).toBe('play');
    expect(sim.armor).toBe(0);
    expect(sim.hitT).toBeCloseTo(ARMOR_GRACE, 1);
    expect(sim.score).toBe(ROCK_POINTS);
    expect(broke).toHaveBeenCalledWith({ x: 13, y: 17, by: 'rock' });
    expect(smashed).toHaveBeenCalledWith(expect.objectContaining({ crush: false }));
  });

  it('the second hit is fatal', () => {
    const sim = armored();
    run(sim, DT);
    sim.setRocks([rock(13, 17)]);
    run(sim, DT);
    expect(sim.phase).toBe('dying');
  });

  it('absorbs a chaser by sending it home, without points', () => {
    const sim = armored([]);
    const en = sim.enemies[0] as Enemy;
    en.active = true;
    en.release = 0;
    place(en, 13, 17);
    const knocked = vi.fn();
    sim.events.on('enemyKnocked', knocked);
    run(sim, DT);
    expect(sim.phase).toBe('play');
    expect(sim.armor).toBe(0);
    expect([en.tx, en.ty]).toEqual([en.home.x, en.home.y]);
    expect(sim.score).toBe(0);
    expect(knocked).toHaveBeenCalledWith(expect.objectContaining({ points: 0 }));
  });

  it('the grace period protects against the next chaser, then it wears off', () => {
    const sim = armored([]);
    const [a, b] = [sim.enemies[0] as Enemy, sim.enemies[1] as Enemy];
    for (const en of [a, b]) {
      en.active = true;
      en.release = 0;
    }
    place(a, 13, 17);
    run(sim, DT);
    place(b, 13, 17);
    run(sim, DT * 3);
    expect(sim.phase).toBe('play'); // still invulnerable
    run(sim, ARMOR_GRACE);
    place(b, 13, 17);
    park(sim, 13, 17);
    run(sim, DT);
    expect(sim.phase).toBe('dying');
  });

  it('armor comes back after losing a life', () => {
    const sim = armored();
    run(sim, DT); // armor used
    sim.fuel = 0.01;
    run(sim, 0.2 + DYING_TIME + 0.05);
    expect(sim.phase).toBe('ready');
    expect(sim.armor).toBe(1);
    expect(sim.hitT).toBe(0);
  });
});

describe('off-road crushing', () => {
  it('smashes rocks without invincibility and without damage', () => {
    const sim = playing([gem(1, 1)], [rock(13, 17)], 'offroad');
    park(sim, 13, 17);
    const smashed = vi.fn();
    sim.events.on('rockSmashed', smashed);
    run(sim, DT);
    expect(sim.phase).toBe('play');
    expect(sim.rocks[0]?.broken).toBe(true);
    expect(sim.score).toBe(ROCK_POINTS);
    expect(sim.isOpenForChasers(13, 17)).toBe(true);
    expect(smashed).toHaveBeenCalledWith(expect.objectContaining({ crush: true }));
  });

  it('does not make the car immune to chasers', () => {
    const sim = playing([gem(1, 1)], [], 'offroad');
    const en = sim.enemies[0] as Enemy;
    en.active = true;
    en.release = 0;
    park(sim, 13, 17);
    place(en, 13, 17);
    run(sim, DT);
    expect(sim.phase).toBe('dying');
  });

  it('smashing under power reports crush: false', () => {
    const sim = playing([gem(1, 1)], [rock(13, 17)], 'offroad');
    sim.power = 5;
    park(sim, 13, 17);
    const smashed = vi.fn();
    sim.events.on('rockSmashed', smashed);
    run(sim, DT);
    expect(smashed).toHaveBeenCalledWith(expect.objectContaining({ crush: false }));
  });
});

describe('police siren', () => {
  const policed = () => {
    const sim = playing([gem(1, 1)], [], 'police');
    park(sim, 13, 17);
    const en = sim.enemies[0] as Enemy;
    en.active = true;
    en.release = 0;
    return { sim, en };
  };

  it('is not ready right at the start of a life', () => {
    const { sim, en } = policed();
    place(en, 13, 14); // within range, but the siren has not charged yet
    en.stun = 0;
    run(sim, SIREN_START - 0.5);
    expect(en.stun).toBe(0);
  });

  it('stuns chasers in range once charged, then recharges', () => {
    const { sim, en } = policed();
    run(sim, SIREN_START + 0.1);
    place(en, 13, 15); // 2 tiles away
    const siren = vi.fn();
    sim.events.on('siren', siren);
    run(sim, DT);
    expect(en.stun).toBeGreaterThan(SIREN_STUN - 0.1);
    expect(siren).toHaveBeenCalledWith(expect.objectContaining({ count: 1 }));
    expect(sim.sirenT).toBeCloseTo(SIREN_COOLDOWN, 1);
  });

  it('stays ready, and fires the moment a chaser comes close, if nobody was in range', () => {
    const { sim, en } = policed();
    place(en, 1, 1);
    en.release = 99;
    run(sim, SIREN_START + 2);
    expect(sim.sirenT).toBe(0);
    en.release = 0;
    place(en, 13, 15);
    run(sim, DT);
    expect(en.stun).toBeGreaterThan(0);
  });

  it('ignores chasers out of range, at home, stunned or immune', () => {
    const { sim, en } = policed();
    run(sim, SIREN_START + 0.1);
    place(en, 13, 12); // 5 tiles away
    run(sim, DT);
    expect(en.stun).toBe(0);
    place(en, 13, 15);
    en.immune = 1;
    run(sim, DT);
    expect(en.stun).toBe(0);
  });

  it('other cars have no siren', () => {
    const sim = playing([gem(1, 1)], [], 'sedan');
    park(sim, 13, 17);
    const en = sim.enemies[0] as Enemy;
    en.active = true;
    en.release = 0;
    run(sim, SIREN_START + 0.1);
    place(en, 13, 15);
    run(sim, DT);
    expect(en.stun).toBe(0);
  });
});

describe('unlocking cars', () => {
  function setup(carLv = 0) {
    const storage = new MemoryStorage();
    const records = new Records(storage);
    records.load();
    records.data.carLv = carLv;
    const sim = playing([gem(1, 1)]);
    const progress = new Progress(sim, records, new GhostStore(storage));
    return { sim, progress, records };
  }
  const clear = (sim: Sim, level: number): void => {
    sim.level = level;
    sim.gems = [gem(13, 17)];
    park(sim, 13, 17);
    run(sim, DT);
    expect(sim.phase).toBe('clear');
  };

  it('clearing stage 5 unlocks the sport car and queues the announcement', () => {
    const { sim, progress, records } = setup(4);
    clear(sim, 5);
    expect(records.data.carLv).toBe(5);
    expect(progress.lastClear.unlocked).toBe('sport');
    expect(progress.pendingUnlock).toBe('sport');
  });

  it('a normal clear unlocks nothing', () => {
    const { sim, progress } = setup(0);
    clear(sim, 1);
    expect(progress.lastClear.unlocked).toBeNull();
    expect(progress.pendingUnlock).toBeNull();
  });

  it('code boards count towards unlocks', () => {
    const { sim, progress } = setup(9);
    sim.challengeKey = 'C:RALLY7';
    clear(sim, 10);
    expect(progress.pendingUnlock).toBe('armor');
  });

  it('the clear screen waits while a dialog is open', () => {
    const { sim } = setup(0);
    clear(sim, 1);
    sim.holdClear = true;
    run(sim, CLEAR_TIME + 1);
    expect(sim.phase).toBe('clear');
    sim.holdClear = false;
    run(sim, CLEAR_TIME + 0.1);
    expect(sim.phase).toBe('ready');
  });

  it('keeps ghosts and best times separate per car', () => {
    const { sim, progress } = setup(0);
    sim.setCar('moto');
    expect(progress.stageKey(2)).toBe('N:2@moto');
    run(sim, READY_TIME);
  });
});
