import { describe, expect, it, vi } from 'vitest';
import {
  BONUS_PERFECT_POINTS,
  BONUS_SECOND_POINTS,
  BONUS_TIME,
  CLEAR_TIME,
  FUEL_MAX,
  READY_TIME
} from '../src/config/constants';
import { Sim } from '../src/sim/sim';
import { DT, gem, park, playing, run } from './helpers/sim';

/** Clears the current level instantly by taking its only gem. */
function clearLevel(sim: Sim): void {
  sim.gems = [gem(13, 17)];
  park(sim, 13, 17);
  run(sim, DT);
  expect(sim.phase).toBe('clear');
}

/** A sim sitting in the play phase of the bonus stage that follows level 3. */
function inBonus(): Sim {
  const sim = playing();
  sim.level = 3;
  clearLevel(sim);
  run(sim, CLEAR_TIME + 0.05);
  expect(sim.bonus).toBe(true);
  run(sim, READY_TIME + 0.05);
  expect(sim.phase).toBe('play');
  return sim;
}

describe('bonus stage flow', () => {
  it('follows every third level and leads to the next level', () => {
    const sim = playing();
    for (const level of [1, 2]) {
      sim.level = level;
      clearLevel(sim);
      run(sim, CLEAR_TIME + 0.05);
      expect(sim.bonus).toBe(false);
      expect(sim.level).toBe(level + 1);
      run(sim, READY_TIME + 0.05);
    }
    sim.level = 3;
    clearLevel(sim);
    run(sim, CLEAR_TIME + 0.05);
    expect(sim.bonus).toBe(true);
    expect(sim.level).toBe(3);
    run(sim, READY_TIME + 0.05);
    sim.gems = [gem(13, 17)];
    park(sim, 13, 17);
    run(sim, DT);
    run(sim, CLEAR_TIME + 0.05);
    expect(sim.bonus).toBe(false);
    expect(sim.level).toBe(4);
  });

  it('level 6 gets a bonus stage too, level 4 does not', () => {
    const sim = playing();
    sim.level = 4;
    clearLevel(sim);
    run(sim, CLEAR_TIME + 0.05);
    expect(sim.bonus).toBe(false);
    run(sim, READY_TIME + 0.05);
    sim.level = 6;
    clearLevel(sim);
    run(sim, CLEAR_TIME + 0.05);
    expect(sim.bonus).toBe(true);
  });
});

describe('bonus stage rules', () => {
  it('has twenty gems, no rocks and no chasers', () => {
    const sim = inBonus();
    expect(sim.gems).toHaveLength(20);
    expect(sim.rocks).toHaveLength(0);
    expect(sim.enemies.some((e) => e.active)).toBe(false);
  });

  it('counts down 30 seconds instead of using fuel', () => {
    const sim = inBonus();
    expect(sim.bonusT).toBeCloseTo(BONUS_TIME, 0);
    park(sim, 13, 17);
    run(sim, 5);
    expect(sim.bonusT).toBeCloseTo(BONUS_TIME - 5, 0);
    expect(sim.fuel).toBe(FUEL_MAX);
  });

  it('disables exhaust smoke', () => {
    const sim = inBonus();
    park(sim, 13, 17);
    sim.update(DT, null, true);
    expect(sim.clouds).toHaveLength(0);
  });

  it('time running out ends it with no award and does not count as a cleared level', () => {
    const sim = inBonus();
    sim.gems = [gem(1, 1), gem(3, 1)];
    park(sim, 13, 17);
    const before = sim.clearedInRun;
    const score = sim.score;
    const end = vi.fn();
    sim.events.on('bonusEnd', end);
    run(sim, BONUS_TIME + 0.1);
    expect(sim.phase).toBe('clear');
    expect(sim.clearKind).toBe('bonus');
    expect(sim.bonusPerfect).toBe(false);
    expect(sim.bonusAward).toBe(0);
    expect(sim.score).toBe(score);
    expect(sim.clearedInRun).toBe(before);
    expect(end).toHaveBeenCalledWith({ perfect: false, award: 0 });
  });

  it('collecting everything awards a time bonus', () => {
    const sim = inBonus();
    sim.gems = [gem(1, 1)]; // out of reach, so the stage keeps running
    park(sim, 13, 17);
    run(sim, 10);
    const score = sim.score;
    sim.gems = [gem(13, 17)];
    run(sim, DT);
    expect(sim.phase).toBe('clear');
    expect(sim.clearKind).toBe('bonus');
    expect(sim.bonusPerfect).toBe(true);
    const award = Math.ceil(sim.bonusT) * BONUS_SECOND_POINTS + BONUS_PERFECT_POINTS;
    expect(sim.bonusAward).toBe(award);
    expect(award).toBeGreaterThan(BONUS_PERFECT_POINTS);
    expect(sim.score).toBe(score + 100 + award); // the last gem's points plus the award
  });

  it('a normal level clear is labelled as a level', () => {
    const sim = playing();
    sim.level = 1;
    clearLevel(sim);
    expect(sim.clearKind).toBe('level');
  });
});
