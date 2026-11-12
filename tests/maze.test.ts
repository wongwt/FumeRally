import { describe, expect, it } from 'vitest';
import { COLS, ROWS, layoutFor } from '../src/config/constants';
import { Maze, buildMaze, mazeSeed, mazeSpec } from '../src/core/maze';
import { Pathfinder, UNREACHED } from '../src/core/pathfinding';

const build = (level: number, bonus = false) => buildMaze(mazeSeed(level, 0, bonus), mazeSpec(level));
/** Mean walking distance from the start, relative to the maze's size: higher = twistier, fewer shortcuts. */
const windiness = (m: Maze): number => {
  const dist = new Pathfinder(m.cols, m.rows).fill(m.start.x, m.start.y, (x, y) => m.isOpen(x, y));
  let sum = 0;
  let n = 0;
  for (const d of dist) {
    if (d >= UNREACHED) continue;
    sum += d;
    n++;
  }
  return sum / n / (m.cols + m.rows);
};

describe('maze generation', () => {
  it('is deterministic for a seed and differs between seeds', () => {
    const a = build(1).toRows();
    expect(build(1).toRows()).toEqual(a);
    expect(build(2).toRows()).not.toEqual(a);
    expect(build(1, true).toRows()).not.toEqual(a);
  });

  it('has the size of its level and a solid border', () => {
    for (let level = 1; level <= 20; level++) {
      const { cw, ch } = mazeSpec(level);
      const m = build(level);
      const rows = m.toRows();
      expect([m.cols, m.rows]).toEqual([2 * cw + 1, 2 * ch + 1]);
      expect(rows).toHaveLength(m.rows);
      for (const r of rows) {
        expect(r).toHaveLength(m.cols);
        expect(r[0]).toBe('#');
        expect(r[m.cols - 1]).toBe('#');
      }
      expect(rows[0]).toBe('#'.repeat(m.cols));
      expect(rows[m.rows - 1]).toBe('#'.repeat(m.cols));
    }
  });

  it('keeps every cell centre open and places start and homes on open tiles', () => {
    for (let level = 1; level <= 20; level++) {
      const m = build(level);
      for (let y = 1; y < m.rows; y += 2)
        for (let x = 1; x < m.cols; x += 2) expect(m.isOpen(x, y)).toBe(true);
      expect(m.isOpen(m.start.x, m.start.y)).toBe(true);
      for (const h of m.homes) expect(m.isOpen(h.x, h.y)).toBe(true);
    }
  });

  it('is mirror-symmetric left to right', () => {
    for (let level = 1; level <= 20; level++) {
      for (const row of build(level).toRows()) {
        expect(row).toBe([...row].reverse().join(''));
      }
    }
  });

  it('is fully connected', () => {
    for (let level = 1; level <= 40; level++) {
      const m = build(level);
      const pf = new Pathfinder(m.cols, m.rows);
      const open = m.cells.filter((c) => c === 0).length;
      const dist = pf.fill(m.start.x, m.start.y, (x, y) => m.isOpen(x, y));
      expect(Pathfinder.countReached(dist)).toBe(open);
    }
  });
});

describe('level progression', () => {
  it('starts smaller than the reference maze and ends a little larger', () => {
    const first = mazeSpec(1);
    const last = mazeSpec(99);
    expect(2 * first.cw + 1).toBeLessThan(COLS);
    expect(2 * first.ch + 1).toBeLessThan(ROWS);
    expect(2 * last.cw + 1).toBeGreaterThan(COLS);
    expect(2 * last.ch + 1).toBeGreaterThan(ROWS);
  });

  it('never shrinks as levels go up, and every width is odd so the maze can mirror', () => {
    let w = 0;
    let h = 0;
    for (let level = 1; level <= 40; level++) {
      const s = mazeSpec(level);
      expect(s.cw).toBeGreaterThanOrEqual(w);
      expect(s.ch).toBeGreaterThanOrEqual(h);
      expect(s.cw % 2).toBe(1);
      [w, h] = [s.cw, s.ch];
    }
  });

  it('gets harder: fewer shortcuts and longer winding corridors', () => {
    let loops = 1;
    let winding = 0;
    for (let level = 1; level <= 40; level++) {
      const s = mazeSpec(level);
      expect(s.loops).toBeLessThanOrEqual(loops);
      expect(s.winding).toBeGreaterThanOrEqual(winding);
      [loops, winding] = [s.loops, s.winding];
    }
    expect(mazeSpec(1).loops).toBeGreaterThan(mazeSpec(30).loops);
    expect(mazeSpec(1).winding).toBeLessThan(mazeSpec(30).winding);
  });

  it('early mazes are more direct than late ones', () => {
    const avg = (levels: number[]): number => {
      let total = 0;
      for (const lv of levels)
        for (let seed = 0; seed < 8; seed++)
          total += windiness(buildMaze(mazeSeed(lv, seed, false), mazeSpec(lv)));
      return total / (levels.length * 8);
    };
    expect(avg([1, 2])).toBeLessThan(avg([14, 15, 16]));
  });

  it('layoutFor puts the start at the bottom middle and the homes at the corners and top middle', () => {
    const { start, homes } = layoutFor(27, 19);
    expect(start).toEqual({ x: 13, y: 17 });
    expect(homes).toHaveLength(5);
    expect(homes).toContainEqual({ x: 25, y: 17 });
    expect(layoutFor(19, 13).start).toEqual({ x: 9, y: 11 });
  });
});
