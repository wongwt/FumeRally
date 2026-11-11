import { expect } from 'vitest';
import { READY_TIME } from '../../src/config/constants';
import type { Enemy } from '../../src/sim/enemies';
import { Sim } from '../../src/sim/sim';
import type { Gem, Rock } from '../../src/sim/spawn';

/** One 120 Hz simulation step, as the game uses. */
export const DT = 1 / 120;
export const run = (sim: Sim, seconds: number, want = null as Parameters<Sim['update']>[1]): void => {
  for (let t = 0; t < seconds - 1e-9; t += DT) sim.update(DT, want);
};
export const gem = (x: number, y: number): Gem => ({ x, y, phase: 0, taken: false });
export const rock = (x: number, y: number): Rock => ({
  x,
  y,
  rx: 0,
  ry: 0,
  rz: 0,
  sx: 1,
  sz: 1,
  broken: false
});

/** A sim in the 'play' phase with the car parked on a known tile and a controlled set of gems. */
export function playing(gems: Gem[] = [gem(1, 1)], rocks: Rock[] = []): Sim {
  const sim = new Sim();
  sim.startGame();
  run(sim, READY_TIME + 0.01);
  expect(sim.phase).toBe('play');
  sim.gems = gems;
  sim.setRocks(rocks);
  for (const en of sim.enemies) en.active = false; // chasers have their own tests
  return sim;
}
export const place = (en: Enemy, x: number, y: number): void => {
  Object.assign(en, { tx: x, ty: y, dx: 0, dy: 0, prog: 0 });
};
export const park = (sim: Sim, x: number, y: number): void => {
  Object.assign(sim.player, { tx: x, ty: y, dx: 0, dy: 0, prog: 0 });
};
