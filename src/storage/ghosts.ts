import type { GhostData } from '../sim/ghost';
import { readJson, writeJson, type StorageLike } from './storage';

export type { GhostData };

/** Bumped when maze layouts changed (v0.2): ghosts recorded on the old fixed-size mazes would drive through walls. */
export const GHOSTS_KEY = 'fumeRallyGhosts2';
const MAX_GHOSTS = 30;

const isNumbers = (a: unknown): a is number[] => Array.isArray(a) && a.every((n) => Number.isFinite(n));

export function isGhost(v: unknown): v is GhostData {
  const g = v as GhostData | null;
  return !!g && typeof g === 'object' && Number.isFinite(g.t) && isNumbers(g.p) && isNumbers(g.g);
}

/** The best run per stage, kept for racing against. Ghosts are bulky, so only the newest 30 are kept. */
export class GhostStore {
  private ghosts: Record<string, GhostData> = {};

  constructor(private readonly storage: StorageLike | null) {}

  load(): void {
    this.ghosts = {};
    const raw = readJson(this.storage, GHOSTS_KEY);
    if (!raw) return;
    for (const [k, v] of Object.entries(raw)) if (isGhost(v)) this.ghosts[k] = v;
  }

  get(stageKey: string): GhostData | null {
    const g = this.ghosts[stageKey];
    return g && g.p.length >= 4 ? g : null;
  }

  /** Stores a ghost; if the browser's quota is hit, the oldest ghosts are dropped until it fits. */
  save(stageKey: string, ghost: GhostData): void {
    delete this.ghosts[stageKey];
    this.ghosts[stageKey] = ghost;
    let keys = Object.keys(this.ghosts);
    while (keys.length > MAX_GHOSTS) {
      delete this.ghosts[keys.shift() as string];
    }
    for (let tries = 0; tries < MAX_GHOSTS; tries++) {
      if (writeJson(this.storage, GHOSTS_KEY, this.ghosts)) return;
      keys = Object.keys(this.ghosts);
      if (keys.length <= 1) return;
      delete this.ghosts[keys[0] as string];
    }
  }

  get size(): number {
    return Object.keys(this.ghosts).length;
  }
}
