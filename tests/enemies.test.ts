import { describe, expect, it } from 'vitest';
import { COLS, HOMES, ROWS, START } from '../src/config/constants';
import { Maze } from '../src/core/maze';
import { mulberry32 } from '../src/core/rng';
import { Pathfinder } from '../src/core/pathfinding';
import {
  chooseEnemyDir,
  configureEnemies,
  createEnemies,
  enemyBaseSpeed,
  enemyCount,
  enemyTarget,
  resetEnemies,
  type ChaseContext
} from '../src/sim/enemies';
import { advance, createMover, posX, posY } from '../src/sim/movement';

/** Ring corridor: row y=3 and y=9 from x=3..13, columns x=3 and x=13 from y=3..9. */
function ringMaze(): Maze {
  const m = new Maze();
  const carve = (x: number, y: number): void => void (m.cells[y * COLS + x] = 0);
  for (let x = 3; x <= 13; x++) {
    carve(x, 3);
    carve(x, 9);
  }
  for (let y = 3; y <= 9; y++) {
    carve(3, y);
    carve(13, y);
  }
  return m;
}
const ctxFor = (maze: Maze, player = createMover(3, 3), rand = mulberry32(1)): ChaseContext => ({
  player,
  isOpen: (x, y) => maze.isOpen(x, y),
  pathfinder: new Pathfinder(COLS, ROWS),
  rand
});

describe('configureEnemies', () => {
  it('grows the chaser count and speed with the level', () => {
    expect([1, 2, 3, 4, 5, 7, 20].map(enemyCount)).toEqual([2, 3, 3, 4, 4, 5, 5]);
    expect(enemyBaseSpeed(1)).toBeCloseTo(3.82);
    expect(enemyBaseSpeed(20)).toBe(4.9);
  });

  it('activates that many chasers and none on bonus stages', () => {
    const enemies = createEnemies();
    configureEnemies(enemies, 4, false);
    expect(enemies.filter((e) => e.active)).toHaveLength(4);
    configureEnemies(enemies, 4, true);
    expect(enemies.filter((e) => e.active)).toHaveLength(0);
  });

  it('gives chasers staggered release times and sends them home', () => {
    const enemies = createEnemies();
    enemies.forEach((e) => Object.assign(e, { tx: 9, ty: 9, stun: 2, immune: 1 }));
    resetEnemies(enemies);
    enemies.forEach((e, i) => {
      expect([e.tx, e.ty]).toEqual([HOMES[i]?.x, HOMES[i]?.y]);
      expect(e.stun).toBe(0);
      expect(e.release).toBeCloseTo(0.9 + i * 1.8);
    });
  });

  it('has an ambusher, a chaser and an erratic one in rotation', () => {
    const enemies = createEnemies();
    configureEnemies(enemies, 20, false);
    expect(enemies.map((e) => e.mode)).toEqual([0, 1, 2, 0, 1]);
    expect(enemies[2]?.wild).toBeGreaterThan(enemies[0]?.wild ?? 1);
  });
});

describe('enemyTarget', () => {
  const maze = ringMaze();
  const open = (x: number, y: number): boolean => maze.isOpen(x, y);

  it('direct chasers aim at the player tile', () => {
    const player = createMover(13, 9);
    expect(enemyTarget({ ...createMover(3, 3), mode: 0 }, player, open)).toEqual({ x: 13, y: 9 });
  });

  it('ambushers aim ahead of a distant player along its heading', () => {
    const player = createMover(3, 9, 1, 0); // facing right along the bottom row
    expect(enemyTarget({ ...createMover(13, 3), mode: 1 }, player, open)).toEqual({ x: 7, y: 9 });
  });

  it('ambushers stop at walls and switch to direct chase when close', () => {
    const wall = createMover(13, 9, 1, 0); // facing a wall right away
    expect(enemyTarget({ ...createMover(3, 3), mode: 1 }, wall, open)).toEqual({ x: 13, y: 9 });
    const near = createMover(5, 3, 1, 0);
    expect(enemyTarget({ ...createMover(3, 3), mode: 1 }, near, open)).toEqual({ x: 5, y: 3 });
  });
});

describe('chooseEnemyDir', () => {
  const maze = ringMaze();

  it('takes the shorter way round the ring', () => {
    const en = { ...createEnemies()[0]!, tx: 3, ty: 3, wild: 0 };
    const ctx = ctxFor(maze, createMover(3, 9)); // straight down is shorter than going right
    chooseEnemyDir(en, ctx);
    expect([en.dx, en.dy]).toEqual([0, 1]);
    expect([en.fx, en.fy]).toEqual([0, 1]);
  });

  it('does not U-turn when it can continue', () => {
    const en = { ...createEnemies()[0]!, tx: 8, ty: 3, dx: 1, dy: 0, wild: 0 };
    const ctx = ctxFor(maze, createMover(3, 3)); // player is behind it
    chooseEnemyDir(en, ctx);
    expect([en.dx, en.dy]).toEqual([1, 0]);
  });

  it('turns back at a dead end', () => {
    const dead = new Maze();
    for (let x = 3; x <= 6; x++) dead.cells[3 * COLS + x] = 0;
    const en = { ...createEnemies()[0]!, tx: 6, ty: 3, dx: 1, dy: 0, wild: 0 };
    chooseEnemyDir(en, ctxFor(dead, createMover(3, 3)));
    expect([en.dx, en.dy]).toEqual([-1, 0]);
  });

  it('stops when completely boxed in', () => {
    const en = { ...createEnemies()[0]!, tx: 1, ty: 1, wild: 0 };
    chooseEnemyDir(en, ctxFor(new Maze()));
    expect([en.dx, en.dy]).toEqual([0, 0]);
  });

  it('erratic chasers sometimes ignore the shortest path', () => {
    const picks = new Set<string>();
    for (let seed = 1; seed < 60; seed++) {
      const en = { ...createEnemies()[0]!, tx: 3, ty: 3, wild: 1 };
      chooseEnemyDir(en, ctxFor(maze, createMover(3, 9), mulberry32(seed)));
      picks.add(`${en.dx},${en.dy}`);
    }
    expect(picks.size).toBe(2); // down and right are both chosen
  });

  it('chasers walk all the way to the player', () => {
    const en = { ...createEnemies()[0]!, tx: 13, ty: 3, wild: 0 };
    const player = createMover(3, 9);
    const ctx = ctxFor(maze, player);
    for (let i = 0; i < 400 && Math.hypot(posX(en) - 3, posY(en) - 9) > 0.1; i++) {
      advance(en, 0.05 * 3.8, (e) => chooseEnemyDir(e as typeof en, ctx));
    }
    expect(Math.hypot(posX(en) - 3, posY(en) - 9)).toBeLessThan(0.2);
  });

  it('treats the start tile region as ordinary space', () => {
    expect(START.y).toBeLessThan(ROWS);
  });
});
