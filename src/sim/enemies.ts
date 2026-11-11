import { COLS, DIR_LIST, HOMES, type Vec } from '../config/constants';
import type { Pathfinder } from '../core/pathfinding';
import { createMover, posX, posY, type Mover } from './movement';

/** A red chaser. Extends the grid mover with AI personality and its stun / release timers. */
export interface Enemy extends Mover {
  readonly home: Vec;
  active: boolean;
  /** Tiles per second. */
  speed: number;
  /** 0 = direct chase, 1 = ambusher (aims ahead of the player), 2 = erratic. */
  mode: number;
  /** Chance per junction of picking a random direction instead of the shortest path. */
  wild: number;
  /** Seconds left stunned (cannot move, harmless). */
  stun: number;
  /** Seconds left of post-stun immunity to smoke. */
  immune: number;
  /** Seconds before it leaves home after a (re)spawn. */
  release: number;
}

const WILDS = [0.05, 0.08, 0.22] as const;

export function createEnemies(): Enemy[] {
  return HOMES.map((h, i) => ({
    ...createMover(h.x, h.y, 0, 1),
    home: h,
    active: false,
    speed: 3.8,
    mode: i % 3,
    wild: WILDS[0],
    stun: 0,
    immune: 0,
    release: 0
  }));
}

/** How many chasers a level has, and how fast they are. Both grow with the level. */
export const enemyCount = (level: number): number => Math.min(5, 2 + Math.ceil((level - 1) / 2));
export const enemyBaseSpeed = (level: number): number => Math.min(4.9, 3.6 + 0.22 * level);

export function configureEnemies(enemies: Enemy[], level: number, bonus: boolean): void {
  const n = enemyCount(level);
  const base = enemyBaseSpeed(level);
  enemies.forEach((en, i) => {
    en.active = !bonus && i < n;
    en.speed = base * (0.97 + 0.03 * (i % 2));
    en.mode = i % 3;
    en.wild = WILDS[i % 3] as number;
  });
}

/** Sends every chaser home. They leave one after another. */
export function resetEnemies(enemies: Enemy[]): void {
  enemies.forEach((en, i) => {
    Object.assign(en, { tx: en.home.x, ty: en.home.y, prog: 0, dx: 0, dy: 0, fx: 0, fy: 1 });
    en.stun = 0;
    en.immune = 0;
    en.release = 0.9 + i * 1.8;
  });
}

export interface ChaseContext {
  player: Mover;
  /** Tiles a chaser may use: corridors without rocks. */
  isOpen: (x: number, y: number) => boolean;
  pathfinder: Pathfinder;
  rand: () => number;
}

/** The tile a chaser is heading for. Ambushers aim up to 4 tiles ahead of a distant player. */
export function enemyTarget(
  en: Mover & { mode: number },
  player: Mover,
  isOpen: ChaseContext['isOpen']
): Vec {
  const ptx = Math.round(posX(player));
  const pty = Math.round(posY(player));
  const md = Math.abs(ptx - en.tx) + Math.abs(pty - en.ty);
  if (en.mode === 1 && md > 6) {
    let x = ptx;
    let y = pty;
    for (let i = 0; i < 4; i++) {
      const nx = x + player.fx;
      const ny = y + player.fy;
      if (!isOpen(nx, ny)) break;
      x = nx;
      y = ny;
    }
    return { x, y };
  }
  return { x: ptx, y: pty };
}

/** Picks the chaser's next direction at a tile: never a U-turn unless it is a dead end. */
export function chooseEnemyDir(en: Enemy, ctx: ChaseContext): void {
  const open = DIR_LIST.filter((d) => ctx.isOpen(en.tx + d.x, en.ty + d.y));
  if (!open.length) {
    en.dx = 0;
    en.dy = 0;
    return;
  }
  let list = open;
  if (en.dx || en.dy) {
    const forward = open.filter((d) => !(d.x === -en.dx && d.y === -en.dy));
    if (forward.length) list = forward;
  }
  let pick: Vec;
  if (ctx.rand() < en.wild) {
    pick = list[Math.floor(ctx.rand() * list.length)] as Vec;
  } else {
    const t = enemyTarget(en, ctx.player, ctx.isOpen);
    const dist = ctx.pathfinder.fill(t.x, t.y, ctx.isOpen);
    let best = Infinity;
    let bests: Vec[] = [];
    for (const d of list) {
      const v = dist[(en.ty + d.y) * COLS + en.tx + d.x] as number;
      if (v < best) {
        best = v;
        bests = [d];
      } else if (v === best) {
        bests.push(d);
      }
    }
    pick = bests[Math.floor(ctx.rand() * bests.length)] as Vec;
  }
  en.dx = pick.x;
  en.dy = pick.y;
  en.fx = pick.x;
  en.fy = pick.y;
}
