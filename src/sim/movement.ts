import { DIRS, type Vec } from '../config/constants';
import type { Maze } from '../core/maze';

/**
 * Grid-locked mover. It sits on tile (tx, ty) and travels towards (tx+dx, ty+dy);
 * `prog` is the 0..1 progress along that edge. (fx, fy) is the facing, which survives stopping.
 */
export interface Mover {
  tx: number;
  ty: number;
  dx: number;
  dy: number;
  prog: number;
  fx: number;
  fy: number;
}

export const posX = (e: Mover): number => e.tx + e.dx * e.prog;
export const posY = (e: Mover): number => e.ty + e.dy * e.prog;

export function createMover(x: number, y: number, fx = 0, fy = -1): Mover {
  return { tx: x, ty: y, dx: 0, dy: 0, prog: 0, fx, fy };
}

/** Called whenever a mover sits exactly on a tile and must decide where to go next. */
export type Chooser = (e: Mover) => void;

/** Moves `e` forward by `dist` tiles, asking `choose` for a direction at every tile boundary. */
export function advance(e: Mover, dist: number, choose: Chooser): void {
  let guard = 0;
  while (dist > 1e-9 && guard++ < 6) {
    if (e.dx === 0 && e.dy === 0) {
      choose(e);
      if (e.dx === 0 && e.dy === 0) return;
      continue;
    }
    const remain = 1 - e.prog;
    if (dist < remain) {
      e.prog += dist;
      return;
    }
    dist -= remain;
    e.tx += e.dx;
    e.ty += e.dy;
    e.prog = 0;
    choose(e);
  }
}

/** Player rule: take the requested turn if it is open, else keep going straight, else stop. */
export function choosePlayerDir(p: Mover, want: Vec | null, isOpen: (x: number, y: number) => boolean): void {
  if (want && isOpen(p.tx + want.x, p.ty + want.y)) {
    p.dx = want.x;
    p.dy = want.y;
    p.fx = p.dx;
    p.fy = p.dy;
    return;
  }
  if ((p.dx || p.dy) && isOpen(p.tx + p.dx, p.ty + p.dy)) return;
  p.dx = 0;
  p.dy = 0;
}

/** A U-turn can happen mid-tile: flip around and swap the remaining distance. */
export function reverseIfWanted(p: Mover, want: Vec | null): void {
  if (want && (p.dx || p.dy) && want.x === -p.dx && want.y === -p.dy) {
    p.tx += p.dx;
    p.ty += p.dy;
    p.prog = 1 - p.prog;
    p.dx = -p.dx;
    p.dy = -p.dy;
    p.fx = p.dx;
    p.fy = p.dy;
  }
}

/** Puts the player on a tile facing the first open direction (up, left, right, then down). */
export function resetPlayer(p: Mover, maze: Maze, x: number, y: number): void {
  p.tx = x;
  p.ty = y;
  p.prog = 0;
  const d = [DIRS.up, DIRS.left, DIRS.right, DIRS.down].find((o) => maze.isOpen(x + o.x, y + o.y)) ?? DIRS.up;
  p.dx = d.x;
  p.dy = d.y;
  p.fx = d.x;
  p.fy = d.y;
}
