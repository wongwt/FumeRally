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

/** Per-second fuel use of the sedan; other cars scale it. */
export const FUEL_DRAIN = 1.15;
export const GEM_FUEL = 9;
export const FUEL_MAX = 100;
/** Fuel a car restarts with after losing a life, if it had less. */
export const RESPAWN_FUEL = 70;
export const START_LIVES = 3;

export const READY_TIME = 1.8;
export const DYING_TIME = 1.1;
export const CLEAR_TIME = 2.4;
/** How long the combo multiplier survives without a new gem. */
export const COMBO_TIME = 6;
export const MAX_COMBO = 5;
/** Points per gem at ×1; the combo multiplies it. */
export const GEM_POINTS = 100;
/** Points per remaining fuel unit on a level clear. */
export const FUEL_BONUS = 10;
