import { COLS, ROWS } from '../config/constants';

/** Tile → world coordinates. The maze is centred on the origin, one tile = one world unit. */
export const wx = (x: number): number => x - COLS / 2 + 0.5;
export const wz = (y: number): number => y - ROWS / 2 + 0.5;
