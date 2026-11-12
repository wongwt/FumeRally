import { COLS, ROWS, layoutFor, type Layout } from '../config/constants';
import { mulberry32 } from './rng';

/** How a level's maze is generated. Cell counts: tiles = 2 * cells + 1; `cw` must be odd so the maze mirrors. */
export interface MazeSpec {
  cw: number;
  ch: number;
  /** Chance that each remaining wall is knocked out. More loops = more escape routes = easier. */
  loops: number;
  /** 0..1: how often the carving continues from the newest cell. Low = short, branching, easy to read; 1 = long winding corridors. */
  winding: number;
}

/** Maze size steps: [first level, cells across, cells down]. The last step is a bit larger than the old fixed 13 × 9. */
const SIZE_STEPS: readonly (readonly [number, number, number])[] = [
  [1, 9, 6],
  [3, 11, 7],
  [5, 13, 8],
  [7, 13, 9],
  [10, 15, 9],
  [13, 15, 10]
];

/** Levels start small, open and forgiving, and grow larger, twistier and with fewer shortcuts. */
export function mazeSpec(level: number): MazeSpec {
  const lv = Math.max(1, Math.floor(level));
  let step = SIZE_STEPS[0] as (typeof SIZE_STEPS)[number];
  for (const s of SIZE_STEPS) if (lv >= s[0]) step = s;
  return {
    cw: step[1],
    ch: step[2],
    loops: Math.max(0.2, 0.52 - 0.032 * (lv - 1)),
    winding: Math.min(1, 0.3 + 0.07 * (lv - 1))
  };
}

export class Maze {
  /** 1 = wall, 0 = open, row-major. */
  readonly cells: Uint8Array;
  /** Where the car starts and where the chasers live. */
  readonly layout: Layout;

  /** Without arguments: a solid block of the reference size (COLS × ROWS). */
  constructor(
    cells?: Uint8Array,
    readonly cols = COLS,
    readonly rows = ROWS
  ) {
    this.cells = cells ?? new Uint8Array(cols * rows).fill(1);
    this.layout = layoutFor(cols, rows);
  }

  get start(): Layout['start'] {
    return this.layout.start;
  }

  get homes(): Layout['homes'] {
    return this.layout.homes;
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.cols && y < this.rows;
  }

  isOpen(x: number, y: number): boolean {
    return this.inBounds(x, y) && this.cells[y * this.cols + x] === 0;
  }

  /** ASCII rendering, handy for tests and debugging. */
  toRows(): string[] {
    const out: string[] = [];
    for (let y = 0; y < this.rows; y++) {
      let row = '';
      for (let x = 0; x < this.cols; x++) row += this.cells[y * this.cols + x] ? '#' : ' ';
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
export function buildMaze(seed: number, spec: MazeSpec = mazeSpec(7)): Maze {
  const { cw: CW, ch: CH, loops, winding } = spec;
  const HALF = Math.ceil(CW / 2); // left half including the centre column
  const cols = 2 * CW + 1;
  const rows = 2 * CH + 1;
  const rand = mulberry32(seed);
  // hWall[r][e]: passage between cell e and e+1 in row r. vWall[r][c]: passage between row r and r+1.
  const hOpen = Array.from({ length: CH }, () => new Array<boolean>(HALF - 1).fill(false));
  const vOpen = Array.from({ length: CH - 1 }, () => new Array<boolean>(HALF).fill(false));
  const seen = Array.from({ length: CH }, () => new Array<boolean>(HALF).fill(false));
  const open = (grid: boolean[][], r: number, c: number): void => {
    (grid[r] as boolean[])[c] = true;
  };
  const isSeen = (r: number, c: number): boolean => (seen[r] as boolean[])[c] as boolean;

  // Growing-tree carving: continue from the newest cell (twisty) or from a random one (branchy).
  const stack: [number, number][] = [[0, CH - 1]];
  (seen[CH - 1] as boolean[])[0] = true;
  while (stack.length) {
    const at = rand() < winding ? stack.length - 1 : Math.floor(rand() * stack.length);
    const [c, r] = stack[at] as [number, number];
    const opts: { c: number; r: number; carve: () => void }[] = [];
    if (c > 0 && !isSeen(r, c - 1)) opts.push({ c: c - 1, r, carve: () => open(hOpen, r, c - 1) });
    if (c < HALF - 1 && !isSeen(r, c + 1)) opts.push({ c: c + 1, r, carve: () => open(hOpen, r, c) });
    if (r > 0 && !isSeen(r - 1, c)) opts.push({ c, r: r - 1, carve: () => open(vOpen, r - 1, c) });
    if (r < CH - 1 && !isSeen(r + 1, c)) opts.push({ c, r: r + 1, carve: () => open(vOpen, r, c) });
    if (!opts.length) {
      stack.splice(at, 1);
      continue;
    }
    const pick = opts[Math.floor(rand() * opts.length)] as (typeof opts)[number];
    pick.carve();
    open(seen, pick.r, pick.c);
    stack.push([pick.c, pick.r]);
  }
  // Knock out extra walls so the maze has loops. rand() is only drawn for closed walls.
  for (let r = 0; r < CH; r++)
    for (let e = 0; e < HALF - 1; e++) if (!(hOpen[r] as boolean[])[e] && rand() < loops) open(hOpen, r, e);
  for (let r = 0; r < CH - 1; r++)
    for (let c = 0; c < HALF; c++) if (!(vOpen[r] as boolean[])[c] && rand() < loops) open(vOpen, r, c);

  const maze = new Maze(undefined, cols, rows);
  const carve = (x: number, y: number): void => {
    maze.cells[y * cols + x] = 0;
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
