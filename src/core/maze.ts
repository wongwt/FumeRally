import { COLS, ROWS } from '../config/constants';
import { mulberry32 } from './rng';

/** Cell grid dimensions: tiles = 2 * cells + 1. */
const CW = (COLS - 1) / 2; // 13
const CH = (ROWS - 1) / 2; // 9
const HALF = Math.ceil(CW / 2); // 7: left half including the centre column

export class Maze {
  /** 1 = wall, 0 = open, row-major. */
  readonly cells: Uint8Array;
  readonly cols = COLS;
  readonly rows = ROWS;

  constructor(cells?: Uint8Array) {
    this.cells = cells ?? new Uint8Array(COLS * ROWS).fill(1);
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < COLS && y < ROWS;
  }

  isOpen(x: number, y: number): boolean {
    return this.inBounds(x, y) && this.cells[y * COLS + x] === 0;
  }

  /** ASCII rendering, handy for tests and debugging. */
  toRows(): string[] {
    const out: string[] = [];
    for (let y = 0; y < ROWS; y++) {
      let row = '';
      for (let x = 0; x < COLS; x++) row += this.cells[y * COLS + x] ? '#' : ' ';
      out.push(row);
    }
    return out;
  }
}

/** Seed for a level's maze. `challengeSeed` is 0 for normal mode, a code hash otherwise. */
export function mazeSeed(level: number, challengeSeed: number, bonus: boolean): number {
  return (level * 7919 + 4242 + challengeSeed * 40503 + (bonus ? 777 : 0)) >>> 0;
}

/**
 * Builds a maze: the left half is carved with a randomised DFS, extra walls are knocked out
 * to create loops, then everything is mirrored so the maze is left/right symmetric.
 */
export function buildMaze(seed: number): Maze {
  const rand = mulberry32(seed);
  // hWall[r][e]: passage between cell e and e+1 in row r. vWall[r][c]: passage between row r and r+1.
  const hOpen = Array.from({ length: CH }, () => new Array<boolean>(HALF - 1).fill(false));
  const vOpen = Array.from({ length: CH - 1 }, () => new Array<boolean>(HALF).fill(false));
  const seen = Array.from({ length: CH }, () => new Array<boolean>(HALF).fill(false));
  const open = (grid: boolean[][], r: number, c: number): void => {
    (grid[r] as boolean[])[c] = true;
  };
  const isSeen = (r: number, c: number): boolean => (seen[r] as boolean[])[c] as boolean;

  const stack: [number, number][] = [[0, CH - 1]];
  (seen[CH - 1] as boolean[])[0] = true;
  while (stack.length) {
    const [c, r] = stack[stack.length - 1] as [number, number];
    const opts: { c: number; r: number; carve: () => void }[] = [];
    if (c > 0 && !isSeen(r, c - 1)) opts.push({ c: c - 1, r, carve: () => open(hOpen, r, c - 1) });
    if (c < HALF - 1 && !isSeen(r, c + 1)) opts.push({ c: c + 1, r, carve: () => open(hOpen, r, c) });
    if (r > 0 && !isSeen(r - 1, c)) opts.push({ c, r: r - 1, carve: () => open(vOpen, r - 1, c) });
    if (r < CH - 1 && !isSeen(r + 1, c)) opts.push({ c, r: r + 1, carve: () => open(vOpen, r, c) });
    if (!opts.length) {
      stack.pop();
      continue;
    }
    const pick = opts[Math.floor(rand() * opts.length)] as (typeof opts)[number];
    pick.carve();
    open(seen, pick.r, pick.c);
    stack.push([pick.c, pick.r]);
  }
  // Knock out extra walls so the maze has loops. rand() is only drawn for closed walls.
  for (let r = 0; r < CH; r++)
    for (let e = 0; e < HALF - 1; e++) if (!(hOpen[r] as boolean[])[e] && rand() < 0.34) open(hOpen, r, e);
  for (let r = 0; r < CH - 1; r++)
    for (let c = 0; c < HALF; c++) if (!(vOpen[r] as boolean[])[c] && rand() < 0.34) open(vOpen, r, c);

  const maze = new Maze();
  const carve = (x: number, y: number): void => {
    maze.cells[y * COLS + x] = 0;
  };
  for (let r = 0; r < CH; r++) for (let c = 0; c < CW; c++) carve(2 * c + 1, 2 * r + 1);
  for (let r = 0; r < CH; r++) {
    for (let e = 0; e < HALF - 1; e++) {
      if (!(hOpen[r] as boolean[])[e]) continue;
      carve(2 * e + 2, 2 * r + 1);
      carve(2 * (CW - 2 - e) + 2, 2 * r + 1);
    }
  }
  for (let r = 0; r < CH - 1; r++) {
    for (let c = 0; c < HALF; c++) {
      if (!(vOpen[r] as boolean[])[c]) continue;
      carve(2 * c + 1, 2 * r + 2);
      carve(2 * (CW - 1 - c) + 1, 2 * r + 2);
    }
  }
  return maze;
}
