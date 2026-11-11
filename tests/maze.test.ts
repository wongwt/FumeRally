import { describe, expect, it } from 'vitest';
import { COLS, HOMES, ROWS, START } from '../src/config/constants';
import { buildMaze, mazeSeed } from '../src/core/maze';
import { Pathfinder } from '../src/core/pathfinding';
import { fnv1a } from '../src/core/rng';

const hashOf = (rows: string[]): string =>
  fnv1a(rows.map((r) => [...r].map((c) => (c === '#' ? 1 : 0)).join('')).join('\n'))
    .toString(16)
    .padStart(8, '0');

describe('maze generation', () => {
  it('is deterministic for a seed and differs between seeds', () => {
    const a = buildMaze(mazeSeed(1, 0, false)).toRows();
    expect(buildMaze(mazeSeed(1, 0, false)).toRows()).toEqual(a);
    expect(buildMaze(mazeSeed(2, 0, false)).toRows()).not.toEqual(a);
    expect(buildMaze(mazeSeed(1, 0, true)).toRows()).not.toEqual(a);
  });

  it('has the expected size and a solid border', () => {
    const rows = buildMaze(mazeSeed(3, 0, false)).toRows();
    expect(rows).toHaveLength(ROWS);
    for (const r of rows) expect(r).toHaveLength(COLS);
    expect(rows[0]).toBe('#'.repeat(COLS));
    expect(rows[ROWS - 1]).toBe('#'.repeat(COLS));
    for (const r of rows) {
      expect(r[0]).toBe('#');
      expect(r[COLS - 1]).toBe('#');
    }
  });

  it('keeps every cell centre open and places start and homes on open tiles', () => {
    for (let level = 1; level <= 20; level++) {
      const m = buildMaze(mazeSeed(level, 0, false));
      for (let y = 1; y < ROWS; y += 2) for (let x = 1; x < COLS; x += 2) expect(m.isOpen(x, y)).toBe(true);
      expect(m.isOpen(START.x, START.y)).toBe(true);
      for (const h of HOMES) expect(m.isOpen(h.x, h.y)).toBe(true);
    }
  });

  it('is mirror-symmetric left to right', () => {
    for (let level = 1; level <= 20; level++) {
      for (const row of buildMaze(mazeSeed(level, 0, false)).toRows()) {
        expect(row).toBe([...row].reverse().join(''));
      }
    }
  });

  it('is fully connected', () => {
    const pf = new Pathfinder(COLS, ROWS);
    for (let level = 1; level <= 40; level++) {
      const m = buildMaze(mazeSeed(level, 0, false));
      const open = m.cells.filter((c) => c === 0).length;
      const dist = pf.fill(START.x, START.y, (x, y) => m.isOpen(x, y));
      expect(Pathfinder.countReached(dist)).toBe(open);
    }
  });

  // Hashes were captured from the original PoC's buildMaze, so these maps must never change:
  // players' best times, ghosts and shared level codes depend on them.
  it('reproduces the original PoC maps exactly', () => {
    const poc: Record<number, string> = {
      1: 'e885564a',
      2: '3da89ff7',
      3: '5bb9a0e7',
      4: 'a7d1a822',
      5: '773c8317',
      6: '954998ba',
      7: 'bcbf241f',
      8: '66705d47',
      9: 'df63d662',
      10: 'd95adae2',
      11: '6453ef97',
      12: 'cc4d5d92'
    };
    for (const [level, hash] of Object.entries(poc)) {
      expect(hashOf(buildMaze(mazeSeed(Number(level), 0, false)).toRows())).toBe(hash);
    }
    expect(hashOf(buildMaze(mazeSeed(3, 0, true)).toRows())).toBe('639e8b5f');
    expect(hashOf(buildMaze(mazeSeed(6, 0, true)).toRows())).toBe('b792c942');
    const code = fnv1a('RALLY7');
    expect(code).toBe(2342527264);
    expect(hashOf(buildMaze(mazeSeed(1, code, false)).toRows())).toBe('d23bc362');
    expect(hashOf(buildMaze(mazeSeed(2, code, false)).toRows())).toBe('75ed00f2');
    expect(hashOf(buildMaze(mazeSeed(5, code, false)).toRows())).toBe('d6d6ee7f');
  });
});
