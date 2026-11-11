import { PLAYER_SPEED, START } from '../config/constants';
import { lerpAngle, faceAngle } from '../core/math';
import { buildMaze, mazeSeed, type Maze } from '../core/maze';
import { DirectionInput } from '../input/directionInput';
import { type CarModel, makeSedan } from '../render/carModel';
import { COL } from '../render/palette';
import { wx, wz } from '../render/coords';
import type { Stage3D } from '../render/stage3d';
import {
  advance,
  choosePlayerDir,
  createMover,
  posX,
  posY,
  resetPlayer,
  reverseIfWanted
} from '../sim/movement';
import { FixedStepper } from '../sim/stepper';

export interface LevelOptions {
  level: number;
  /** Seed derived from a level code; 0 for the normal built-in maps. */
  challengeSeed: number;
  bonus: boolean;
}

/** Simulation steps at 120 Hz regardless of display refresh rate. */
const STEP = 1 / 120;

/** Glue between the simulation, the 3D stage and input. Grows milestone by milestone. */
export class Game {
  readonly input = new DirectionInput();
  readonly player = createMover(START.x, START.y);
  private maze: Maze = buildMaze(mazeSeed(1, 0, false));
  private readonly car: CarModel = makeSedan(COL.player, true);
  private readonly stepper = new FixedStepper(STEP, 0.1);
  private heading = faceAngle(0, -1);
  private last = 0;
  // M3 only: the car waits for the first key press. M4's ready/play states replace this.
  private started = false;

  constructor(private readonly stage: Stage3D) {
    stage.actorGroup.add(this.car.group);
    this.loadLevel({ level: 1, challengeSeed: 0, bonus: false });
  }

  loadLevel(opts: LevelOptions): void {
    this.maze = buildMaze(mazeSeed(opts.level, opts.challengeSeed, opts.bonus));
    this.stage.setMaze(this.maze);
    resetPlayer(this.player, this.maze, START.x, START.y);
    this.heading = faceAngle(this.player.fx, this.player.fy);
    this.started = false;
    this.input.clear();
    this.stage.rig.snapTo(START.x, START.y);
    this.syncCar(0);
  }

  start(): void {
    this.last = performance.now();
    requestAnimationFrame(this.frame);
  }

  private readonly frame = (now: number): void => {
    const dt = Math.min(0.1, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    this.stepper.advance(dt, (step) => this.update(step));
    this.syncCar(dt);
    this.stage.render(dt, posX(this.player), posY(this.player));
    requestAnimationFrame(this.frame);
  };

  private update(dt: number): void {
    const p = this.player;
    this.input.update(dt);
    if (!this.started) {
      if (!this.input.want) return;
      this.started = true;
    }
    reverseIfWanted(p, this.input.want);
    advance(p, PLAYER_SPEED * dt, (e) =>
      choosePlayerDir(e, this.input.want, (x, y) => this.maze.isOpen(x, y))
    );
  }

  private syncCar(dt: number): void {
    const g = this.car.group;
    g.position.set(wx(posX(this.player)), 0, wz(posY(this.player)));
    this.heading = lerpAngle(this.heading, faceAngle(this.player.fx, this.player.fy), 1 - Math.exp(-16 * dt));
    g.rotation.y = this.heading;
  }
}
