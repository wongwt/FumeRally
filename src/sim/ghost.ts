/** A recorded run of one stage, for racing against. */
export interface GhostData {
  /** clear time in seconds */
  t: number;
  /** x, y pairs (×GHOST_SCALE, rounded) sampled every GHOST_SAMPLE seconds */
  p: number[];
  /** time of each gem pickup, in order */
  g: number[];
}

/** Seconds between position samples. */
export const GHOST_SAMPLE = 0.05;
/** Positions are stored as integers: tiles × 16. */
export const GHOST_SCALE = 16;
/** Cap on stored numbers (two per sample), so a very long stage cannot fill the browser's storage. */
export const GHOST_MAX_NUMBERS = 6000;

/** Records the player's path and gem times during a stage. */
export class GhostRecorder {
  path: number[] = [];
  gems: number[] = [];
  private acc = 0;

  reset(): void {
    this.path = [];
    this.gems = [];
    this.acc = 0;
  }

  /** Call every step with the player's tile position; stores one sample per GHOST_SAMPLE seconds. */
  sample(dt: number, x: number, y: number): void {
    this.acc += dt;
    while (this.acc >= GHOST_SAMPLE) {
      this.acc -= GHOST_SAMPLE;
      if (this.path.length < GHOST_MAX_NUMBERS)
        this.path.push(Math.round(x * GHOST_SCALE), Math.round(y * GHOST_SCALE));
    }
  }

  /** Notes that a gem was picked up `t` seconds into the stage. */
  addGem(t: number): void {
    this.gems.push(Math.round(t * 100) / 100);
  }
}

export interface GhostPose {
  /** tile position */
  x: number;
  y: number;
  /** direction of travel since the last sample; zero when standing still */
  dx: number;
  dy: number;
}

/** Where a ghost is `t` seconds into the stage (interpolated between samples; holds its last spot). */
export function ghostAt(ghost: GhostData, t: number): GhostPose | null {
  const p = ghost.p;
  const n = Math.floor(p.length / 2);
  if (n < 1) return null;
  const f = Math.min(Math.max(0, t) / GHOST_SAMPLE, n - 1);
  const i0 = Math.floor(f);
  const i1 = Math.min(n - 1, i0 + 1);
  const fr = f - i0;
  const ax = p[i0 * 2] as number;
  const ay = p[i0 * 2 + 1] as number;
  const bx = p[i1 * 2] as number;
  const by = p[i1 * 2 + 1] as number;
  return {
    x: (ax + (bx - ax) * fr) / GHOST_SCALE,
    y: (ay + (by - ay) * fr) / GHOST_SCALE,
    dx: bx - ax,
    dy: by - ay
  };
}
