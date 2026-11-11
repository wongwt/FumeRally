import { COLS, ROWS } from '../config/constants';
import type { Maze } from '../core/maze';
import type { CameraRig } from '../render/cameraRig';
import { posX, posY } from '../sim/movement';
import type { Sim } from '../sim/sim';

/** Pixels per tile on the radar canvas (216 × 152 for a 27 × 19 maze). */
const RT = 8;

/** Full-map overview shown beside the stage while the camera follows the car. */
export class Radar {
  private readonly ctx: CanvasRenderingContext2D | null;
  private readonly walls = document.createElement('canvas');

  constructor(canvas: HTMLCanvasElement) {
    canvas.width = COLS * RT;
    canvas.height = ROWS * RT;
    this.ctx = canvas.getContext('2d');
    this.walls.width = COLS * RT;
    this.walls.height = ROWS * RT;
  }

  /** Pre-renders the walls of a new level. */
  setMaze(maze: Maze): void {
    const c = this.walls.getContext('2d');
    if (!c) return;
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        c.fillStyle = maze.isOpen(x, y) ? '#0a1b27' : '#2a5c7a';
        c.fillRect(x * RT, y * RT, RT, RT);
      }
    }
  }

  draw(sim: Sim, rig: CameraRig): void {
    const c = this.ctx;
    if (!c) return;
    const half = RT / 2;
    c.drawImage(this.walls, 0, 0);
    c.fillStyle = '#b8b0a2';
    for (const r of sim.rocks) if (!r.broken) c.fillRect(r.x * RT + 1, r.y * RT + 1, RT - 2, RT - 2);
    c.fillStyle = '#ffc83d';
    for (const g of sim.gems) if (!g.taken) c.fillRect(g.x * RT + half - 2, g.y * RT + half - 2, 4, 4);
    if (sim.special) {
      c.fillStyle = Math.floor(sim.time * 6) % 2 ? '#ffffff' : '#ff7ad9';
      c.fillRect(sim.special.x * RT + half - 4, sim.special.y * RT + half - 4, 8, 8);
    }
    for (const en of sim.enemies) {
      if (!en.active) continue;
      c.fillStyle = en.stun > 0 ? '#7d93a3' : '#ff5b4b';
      c.fillRect(posX(en) * RT + half - 3, posY(en) * RT + half - 3, 6, 6);
    }
    c.fillStyle = sim.power > 0 && Math.floor(sim.time * 8) % 2 ? '#ffffff' : '#37c6ff';
    c.fillRect(posX(sim.player) * RT + half - 4, posY(sim.player) * RT + half - 4, 8, 8);
    // the part of the map currently on screen
    c.strokeStyle = 'rgba(255,255,255,0.7)';
    c.lineWidth = 1;
    const cx = rig.focus.x + COLS / 2 - 0.5;
    const cy = rig.focus.z + ROWS / 2 - 0.5;
    c.strokeRect(
      (cx - rig.halfW + 0.5) * RT,
      (cy - rig.halfH + 0.5) * RT,
      rig.halfW * 2 * RT,
      rig.halfH * 2 * RT
    );
  }
}
