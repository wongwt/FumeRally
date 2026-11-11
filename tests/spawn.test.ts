import { describe, expect, it } from 'vitest';
import { COLS, HOMES, ROWS, START } from '../src/config/constants';
import { buildMaze, mazeSeed } from '../src/core/maze';
import { Pathfinder } from '../src/core/pathfinding';
import { fnv1a } from '../src/core/rng';
import { gemCount, rockCount, spawnGems, spawnRocks } from '../src/sim/spawn';
import poc from './fixtures/poc-spawn.json';

interface PocRef {
  gems: number;
  rocks: number;
  g: string;
  r: string;
  first: { rot: number[]; scale: number[] } | null;
}
const pocRefs = poc as Record<string, PocRef>;
const hash = (s: string): string => fnv1a(s).toString(16).padStart(8, '0');
const maze = (level: number, cs = 0, bonus = false) => buildMaze(mazeSeed(level, cs, bonus));

describe('spawnGems', () => {
  it('is deterministic and respects the level formula', () => {
    expect(spawnGems(4, 0, false)).toEqual(spawnGems(4, 0, false));
    expect(spawnGems(1, 0, false)).toHaveLength(10);
    expect(spawnGems(30, 0, false)).toHaveLength(26);
    expect(spawnGems(3, 0, true)).toHaveLength(20);
    expect(gemCount(5, false)).toBe(18);
  });

  it('places gems on distinct cell centres, away from the start and homes', () => {
    for (let level = 1; level <= 30; level++) {
      const gems = spawnGems(level, 0, false);
      const seen = new Set<string>();
      for (const g of gems) {
        expect(g.x % 2).toBe(1);
        expect(g.y % 2).toBe(1);
        expect(Math.abs(g.x - START.x) + Math.abs(g.y - START.y)).toBeGreaterThan(4);
        expect(HOMES.some((h) => h.x === g.x && h.y === g.y)).toBe(false);
        expect(seen.has(`${g.x},${g.y}`)).toBe(false);
        seen.add(`${g.x},${g.y}`);
      }
    }
  });
});

describe('spawnRocks', () => {
  it('uses the level formula and no rocks on bonus stages', () => {
    expect(rockCount(1, false)).toBe(3);
    expect(rockCount(20, false)).toBe(12);
    expect(spawnRocks(maze(3, 0, true), 3, 0, true)).toHaveLength(0);
  });

  it('keeps cell centres and the start area free and never splits the maze', () => {
    const pf = new Pathfinder(COLS, ROWS);
    for (let level = 1; level <= 30; level++) {
      const m = maze(level);
      const rocks = spawnRocks(m, level, 0, false);
      const blocked = new Set(rocks.map((r) => `${r.x},${r.y}`));
      for (const r of rocks) {
        expect(m.isOpen(r.x, r.y)).toBe(true);
        expect(r.x & 1 && r.y & 1).toBeFalsy();
        expect(Math.abs(r.x - START.x) + Math.abs(r.y - START.y)).toBeGreaterThan(5);
      }
      const open = m.cells.filter((c) => c === 0).length - rocks.length;
      const dist = pf.fill(START.x, START.y, (x, y) => m.isOpen(x, y) && !blocked.has(`${x},${y}`));
      expect(Pathfinder.countReached(dist)).toBe(open);
    }
  });
});

// Reference values captured from the original PoC's spawnGems / spawnRocks, so levels, codes and
// ghosts recorded against the PoC's layouts keep meaning the same thing.
describe('PoC parity', () => {
  const cases: [string, number, boolean, number][] = [
    ...[1, 2, 3, 5, 8, 12, 20, 30].map((l): [string, number, boolean, number] => [`n${l}`, 0, false, l]),
    ['bonus3', 0, true, 3],
    ...[1, 2, 7].map((l): [string, number, boolean, number] => [`rally7_${l}`, fnv1a('RALLY7'), false, l])
  ];
  for (const [key, cs, bonus, level] of cases) {
    it(`matches the PoC for ${key}`, () => {
      const ref = pocRefs[key];
      expect(ref).toBeDefined();
      if (!ref) return;
      const gems = spawnGems(level, cs, bonus);
      const rocks = spawnRocks(maze(level, cs, bonus), level, cs, bonus);
      expect(gems).toHaveLength(ref.gems);
      expect(rocks).toHaveLength(ref.rocks);
      expect(hash(gems.map((g) => `${g.x},${g.y},${g.phase.toFixed(4)}`).join(';'))).toBe(ref.g);
      expect(hash(rocks.map((r) => `${r.x},${r.y}`).join(';'))).toBe(ref.r);
      const first = rocks[0];
      if (ref.first && first) {
        expect([first.rx, first.ry, first.rz].map((v) => +v.toFixed(4))).toEqual(ref.first.rot);
        expect([first.sx, first.sz].map((v) => +v.toFixed(4))).toEqual(ref.first.scale);
      }
    });
  }
});
