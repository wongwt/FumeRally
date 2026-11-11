import { describe, expect, it } from 'vitest';
import { Pathfinder, UNREACHED } from '../src/core/pathfinding';

// 5×3 grid; '#' is blocked.
const MAP = ['.....', '.###.', '.....'];
const open = (x: number, y: number): boolean => MAP[y]?.[x] === '.';

describe('Pathfinder', () => {
  const pf = new Pathfinder(5, 3);

  it('computes shortest distances around obstacles', () => {
    const d = pf.fill(0, 0, open);
    expect(d[0]).toBe(0);
    expect(d[4]).toBe(4); // along the top row
    expect(d[2 * 5 + 4]).toBe(6); // bottom-right corner
    expect(d[5 + 1]).toBe(UNREACHED); // inside a wall
  });

  it('treats blocked tiles as impassable', () => {
    const d = pf.fill(0, 0, (x, y) => open(x, y) && !(x === 2 && y === 0));
    expect(d[4]).toBe(8); // must go around through the bottom row
  });

  it('counts reached tiles', () => {
    expect(Pathfinder.countReached(pf.fill(0, 0, open))).toBe(12);
  });
});
