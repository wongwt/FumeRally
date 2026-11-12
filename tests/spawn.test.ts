import { describe, expect, it } from 'vitest';
import { buildMaze, mazeSeed, mazeSpec } from '../src/core/maze';
import { Pathfinder } from '../src/core/pathfinding';
import { gemCount, rockCount, spawnGems, spawnRocks } from '../src/sim/spawn';

const maze = (level: number, cs = 0, bonus = false) => buildMaze(mazeSeed(level, cs, bonus), mazeSpec(level));

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
      const { start: START, homes: HOMES } = maze(level).layout;
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
    for (let level = 1; level <= 30; level++) {
      const m = maze(level);
      const { start: START } = m.layout;
      const pf = new Pathfinder(m.cols, m.rows);
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
