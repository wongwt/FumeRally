import { COLS, ROWS } from '../config/constants';

let cols = COLS;
let rows = ROWS;

/** Tells the helpers below how big the current maze is. Call whenever a level loads. */
export function setGridSize(c: number, r: number): void {
  cols = c;
  rows = r;
}

/** Tile → world coordinates. The maze is centred on the origin, one tile = one world unit. */
export const wx = (x: number): number => x - cols / 2 + 0.5;
export const wz = (y: number): number => y - rows / 2 + 0.5;
