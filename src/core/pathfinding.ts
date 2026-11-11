/** Distance value for tiles the search never reached. */
export const UNREACHED = 9999;

const NEIGHBOURS: readonly (readonly [number, number])[] = [
  [0, -1],
  [0, 1],
  [-1, 0],
  [1, 0]
];

/**
 * Breadth-first distance field over a tile grid. Buffers are allocated once and reused,
 * so `fill` returns a shared array that is only valid until the next call.
 */
export class Pathfinder {
  private readonly dist: Int16Array;
  private readonly queue: Int16Array;

  constructor(
    readonly cols: number,
    readonly rows: number
  ) {
    this.dist = new Int16Array(cols * rows);
    this.queue = new Int16Array(cols * rows);
  }

  /** Distances (in tiles) from (tx, ty) to every tile reachable through `isOpen`; row-major. */
  fill(tx: number, ty: number, isOpen: (x: number, y: number) => boolean): Int16Array {
    const { dist, queue, cols } = this;
    dist.fill(UNREACHED);
    let head = 0;
    let tail = 0;
    const start = ty * cols + tx;
    dist[start] = 0;
    queue[tail++] = start;
    while (head < tail) {
      const cur = queue[head++] as number;
      const cx = cur % cols;
      const cy = (cur / cols) | 0;
      const nd = (dist[cur] as number) + 1;
      for (const [dx, dy] of NEIGHBOURS) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (!isOpen(nx, ny)) continue;
        const ni = ny * cols + nx;
        if ((dist[ni] as number) > nd) {
          dist[ni] = nd;
          queue[tail++] = ni;
        }
      }
    }
    return dist;
  }

  /** Number of tiles reached by the last `fill`. */
  static countReached(dist: Int16Array): number {
    let n = 0;
    for (let i = 0; i < dist.length; i++) if ((dist[i] as number) < UNREACHED) n++;
    return n;
  }
}
