import { COLS, HOMES, ROWS, START, type Vec } from '../config/constants';
import type { Maze } from '../core/maze';
import { Pathfinder } from '../core/pathfinding';
import { mulberry32, shuffle } from '../core/rng';

export interface Gem {
  x: number;
  y: number;
  /** Bobbing phase, so gems do not all move in step. */
  phase: number;
  taken: boolean;
}

export interface Rock {
  x: number;
  y: number;
  /** Deterministic look: Euler rotation and horizontal scale. */
  rx: number;
  ry: number;
  rz: number;
  sx: number;
  sz: number;
  broken: boolean;
}

const pathfinder = new Pathfinder(COLS, ROWS);

/** Level-specific seed offset, kept identical to the PoC so maps and codes stay compatible. */
const seedFor = (mul: number, add: number, level: number, challengeSeed: number, bonus: boolean): number =>
  (level * mul + add + challengeSeed * 40503 + (bonus ? 777 : 0)) >>> 0;

export const gemCount = (level: number, bonus: boolean): number => (bonus ? 20 : Math.min(26, 8 + level * 2));
export const rockCount = (level: number, bonus: boolean): number => (bonus ? 0 : Math.min(12, 2 + level));

/** Gems sit on cell centres, away from the start and the chasers' homes. */
export function spawnGems(level: number, challengeSeed: number, bonus: boolean): Gem[] {
  const rand = mulberry32(seedFor(3571, 99, level, challengeSeed, bonus));
  const cells: { x: number; y: number }[] = [];
  for (let y = 1; y < ROWS; y += 2) {
    for (let x = 1; x < COLS; x += 2) {
      if (Math.abs(x - START.x) + Math.abs(y - START.y) <= 4) continue;
      if (HOMES.some((h) => h.x === x && h.y === y)) continue;
      cells.push({ x, y });
    }
  }
  shuffle(cells, rand);
  const n = Math.min(cells.length, gemCount(level, bonus));
  const gems: Gem[] = [];
  for (let i = 0; i < n; i++) {
    const c = cells[i] as { x: number; y: number };
    gems.push({ x: c.x, y: c.y, phase: rand() * 6.28, taken: false });
  }
  return gems;
}

/**
 * Rocks block chasers and kill the player. They go on corridor tiles between cell centres,
 * never near the start or homes, and a rock is rejected if it would cut the maze in two.
 */
export function spawnRocks(maze: Maze, level: number, challengeSeed: number, bonus: boolean): Rock[] {
  const rand = mulberry32(seedFor(1231, 7, level, challengeSeed, bonus));
  const rocks: Rock[] = [];
  const blocked = new Uint8Array(COLS * ROWS);
  const isFree = (x: number, y: number): boolean => maze.isOpen(x, y) && !blocked[y * COLS + x];

  let openCount = 0;
  const cand: { x: number; y: number }[] = [];
  for (let y = 1; y < ROWS - 1; y++) {
    for (let x = 1; x < COLS - 1; x++) {
      if (!maze.isOpen(x, y)) continue;
      openCount++;
      if (x & 1 && y & 1) continue; // keep cell centres free (gems live there)
      if (Math.abs(x - START.x) + Math.abs(y - START.y) <= 5) continue; // not next to the start
      if (HOMES.some((h) => Math.abs(h.x - x) + Math.abs(h.y - y) <= 3)) continue;
      cand.push({ x, y });
    }
  }
  shuffle(cand, rand);

  const want = rockCount(level, bonus);
  for (const c of cand) {
    if (rocks.length >= want) break;
    blocked[c.y * COLS + c.x] = 1;
    const reach = Pathfinder.countReached(pathfinder.fill(START.x, START.y, isFree));
    if (reach !== openCount - rocks.length - 1) {
      blocked[c.y * COLS + c.x] = 0;
      continue;
    }
    rocks.push({
      x: c.x,
      y: c.y,
      rx: rand() * 3,
      ry: rand() * 6,
      rz: rand() * 3,
      sx: 0.9 + rand() * 0.25,
      sz: 0.9 + rand() * 0.25,
      broken: false
    });
  }
  return rocks;
}

/**
 * The order in which rainbow gems appear on a level: every cell centre, shuffled deterministically.
 * (Unlike gems and rocks this ignores the bonus flag, as in the PoC.)
 */
export function specialOrder(level: number, challengeSeed: number): Vec[] {
  const rand = mulberry32((level * 9173 + 31 + challengeSeed * 40503) >>> 0);
  const cells: Vec[] = [];
  for (let y = 1; y < ROWS; y += 2) for (let x = 1; x < COLS; x += 2) cells.push({ x, y });
  return shuffle(cells, rand);
}
