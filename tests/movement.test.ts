import { describe, expect, it } from 'vitest';
import { COLS, DIRS, START, type Vec } from '../src/config/constants';
import { buildMaze, Maze, mazeSeed } from '../src/core/maze';
import {
  advance,
  choosePlayerDir,
  createMover,
  posX,
  posY,
  resetPlayer,
  reverseIfWanted,
  type Mover
} from '../src/sim/movement';

/** Builds a maze with the given open tiles. */
function mazeWith(open: [number, number][]): Maze {
  const m = new Maze();
  for (const [x, y] of open) m.cells[y * COLS + x] = 0;
  return m;
}
// A "T": corridor along y=5 from x=1..7, with a branch going up at x=4 (y=1..5).
const tiles: [number, number][] = [];
for (let x = 1; x <= 7; x++) tiles.push([x, 5]);
for (let y = 1; y <= 5; y++) tiles.push([4, y]);
const maze = mazeWith(tiles);
const run = (p: Mover, want: () => Vec | null, dist: number): void =>
  advance(p, dist, (e) => choosePlayerDir(e, want(), (x, y) => maze.isOpen(x, y)));

describe('advance', () => {
  it('moves along a corridor at the requested distance', () => {
    const p = createMover(1, 5);
    p.dx = 1;
    p.fx = 1;
    p.fy = 0;
    run(p, () => null, 2.5);
    expect(posX(p)).toBeCloseTo(3.5);
    expect(posY(p)).toBe(5);
  });

  it('stops at a wall and keeps its facing', () => {
    const p = createMover(1, 5);
    p.dx = 1;
    p.fx = 1;
    p.fy = 0;
    run(p, () => null, 20);
    expect(p.tx).toBe(7);
    expect(p.dx).toBe(0);
    expect(p.dy).toBe(0);
    expect(p.fx).toBe(1);
  });

  it('crosses several tile boundaries in one big step', () => {
    const p = createMover(1, 5);
    p.dx = 1;
    run(p, () => null, 5.2);
    expect(p.tx).toBe(6);
    expect(p.prog).toBeCloseTo(0.2);
  });

  it('turns at the next junction when a turn is wanted', () => {
    const p = createMover(1, 5);
    p.dx = 1;
    run(p, () => DIRS.up, 3); // wants up from the start; only x=4 is open upwards
    expect(p.tx).toBe(4);
    expect(p.ty).toBe(5);
    expect(p.dx).toBe(0);
    expect(p.dy).toBe(-1);
    run(p, () => DIRS.up, 1.5);
    expect(posX(p)).toBe(4);
    expect(posY(p)).toBeCloseTo(3.5);
  });

  it('ignores a turn into a wall and keeps going straight', () => {
    const p = createMover(1, 5);
    p.dx = 1;
    run(p, () => DIRS.down, 2);
    expect(p.dy).toBe(0);
    expect(posX(p)).toBeCloseTo(3);
  });

  it('starts moving from a standstill when a direction is wanted', () => {
    const p = createMover(4, 5);
    run(p, () => DIRS.right, 0.5);
    expect(posX(p)).toBeCloseTo(4.5);
  });
});

describe('reverseIfWanted', () => {
  it('flips direction mid-tile and swaps the remaining distance', () => {
    const p = createMover(2, 5);
    p.dx = 1;
    p.prog = 0.25;
    reverseIfWanted(p, DIRS.left);
    expect(p.dx).toBe(-1);
    expect(p.fx).toBe(-1);
    expect(posX(p)).toBeCloseTo(2.25); // the car has not jumped
  });

  it('does nothing for other directions or when stopped', () => {
    const p = createMover(2, 5);
    p.dx = 1;
    p.prog = 0.25;
    reverseIfWanted(p, DIRS.up);
    expect(p.dx).toBe(1);
    const q = createMover(2, 5);
    reverseIfWanted(q, DIRS.left);
    expect(q.dx).toBe(0);
  });
});

describe('resetPlayer', () => {
  it('faces the first open direction (up, left, right, down)', () => {
    const m = buildMaze(mazeSeed(1, 0, false));
    const p = createMover(0, 0);
    resetPlayer(p, m, START.x, START.y);
    expect(p.tx).toBe(START.x);
    expect(p.prog).toBe(0);
    expect(m.isOpen(START.x + p.dx, START.y + p.dy)).toBe(true);
    expect([p.fx, p.fy]).toEqual([p.dx, p.dy]);
  });

  it('prefers up when it is open', () => {
    const p = createMover(0, 0);
    resetPlayer(p, maze, 4, 5);
    expect([p.dx, p.dy]).toEqual([0, -1]);
  });
});
