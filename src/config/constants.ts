/** Maze is COLS × ROWS tiles; cells sit on odd coordinates, walls/corridors fill the gaps. */
export const COLS = 27;
export const ROWS = 19;

export interface Vec {
  readonly x: number;
  readonly y: number;
}

export const START: Vec = { x: 13, y: 17 };
export const HOMES: readonly Vec[] = [
  { x: 1, y: 1 },
  { x: 25, y: 1 },
  { x: 13, y: 1 },
  { x: 1, y: 17 },
  { x: 25, y: 17 }
];

export const DIRS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 }
} as const satisfies Record<string, Vec>;
export type DirName = keyof typeof DIRS;
export const DIR_LIST: readonly Vec[] = [DIRS.up, DIRS.down, DIRS.left, DIRS.right];

/** Sedan speed in tiles per second; other cars override this once the garage lands. */
export const PLAYER_SPEED = 5.3;
