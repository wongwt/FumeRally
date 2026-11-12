/**
 * Reference maze size in tiles, used as the default for hand-built mazes. Real levels vary in size
 * (see `mazeSpec`); cells sit on odd coordinates, walls/corridors fill the gaps.
 */
export const COLS = 27;
export const ROWS = 19;

export interface Vec {
  readonly x: number;
  readonly y: number;
}

export interface Layout {
  /** Where the car starts: bottom middle. */
  start: Vec;
  /** Chaser homes: the four corners and the top middle. */
  homes: readonly Vec[];
}

/** Start and chaser homes for a maze of `cols × rows` tiles (cols odd in cells, so the middle exists). */
export function layoutFor(cols: number, rows: number): Layout {
  const mid = (cols - 1) / 2; // an odd number, i.e. a cell centre, because the cell count is odd
  return {
    start: { x: mid, y: rows - 2 },
    homes: [
      { x: 1, y: 1 },
      { x: cols - 2, y: 1 },
      { x: mid, y: 1 },
      { x: 1, y: rows - 2 },
      { x: cols - 2, y: rows - 2 }
    ]
  };
}

const REF = layoutFor(COLS, ROWS);
export const START: Vec = REF.start;
export const HOMES: readonly Vec[] = REF.homes;

export const DIRS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 }
} as const satisfies Record<string, Vec>;
export type DirName = keyof typeof DIRS;
export const DIR_LIST: readonly Vec[] = [DIRS.up, DIRS.down, DIRS.left, DIRS.right];

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

/** Smoke: fuel per puff, delay between puffs, how long a cloud lives and how far it reaches. */
export const PUFF_COST = 3.5;
export const PUFF_COOLDOWN = 0.36;
export const PUFF_DROP_DISTANCE = 0.8;
export const CLOUD_LIFE = 1.5;
/** A cloud only stuns while it is young and dense. */
export const CLOUD_STUN_AGE = 1.2;
export const CLOUD_RADIUS = 1.05;
export const STUN_TIME = 3.0;
/** Grace period after a stun ends, so one cloud cannot chain-stun forever. */
export const STUN_IMMUNITY = 1.0;
export const STUN_POINTS = 50;
/** Player and chaser collide when closer than this many tiles. */
export const HIT_RADIUS = 0.62;

/** Rainbow gem: invincibility length, first appearance, respawn delay and rewards. */
export const POWER_TIME = 7;
export const SPECIAL_FIRST = 4;
export const SPECIAL_RESPAWN = 18;
export const SPECIAL_FUEL = 25;
export const SPECIAL_POINTS = 500;
/** The rainbow gem never appears this close (in tiles) to the player. */
export const SPECIAL_MIN_DISTANCE = 4;
export const ROCK_POINTS = 20;
export const KNOCK_POINTS = 200;
/** A knocked-out chaser waits this long at home before it comes back. */
export const KNOCK_RELEASE = 2.5;

/** A timed bonus stage follows every third level. */
export const BONUS_EVERY = 3;
export const BONUS_TIME = 30;
export const BONUS_PERFECT_POINTS = 2000;
export const BONUS_SECOND_POINTS = 100;

/** Armor: after absorbing a hit the car is invulnerable (and flashes) for this long. */
export const ARMOR_GRACE = 1.5;

/** Police siren: starts ready after a short delay, stuns chasers in range, then recharges. */
export const SIREN_START = 3;
export const SIREN_COOLDOWN = 8;
export const SIREN_RANGE = 2.6;
export const SIREN_STUN = 2.0;
