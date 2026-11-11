import { START } from '../config/constants';
import { faceAngle, lerpAngle } from '../core/math';
import { DirectionInput } from '../input/directionInput';
import { makeSedan } from '../render/carModel';
import type { ViewMode } from '../render/cameraRig';
import { wx, wz } from '../render/coords';
import { Fx } from '../render/fx';
import { COL } from '../render/palette';
import type { Stage3D } from '../render/stage3d';
import { WorldView } from '../render/worldView';
import { posX, posY } from '../sim/movement';
import { Sim } from '../sim/sim';
import { FixedStepper } from '../sim/stepper';
import type { Banner } from '../ui/banner';
import type { Hud } from '../ui/hud';
import type { Popups } from '../ui/popups';

/** Simulation steps at 120 Hz regardless of display refresh rate. */
const STEP = 1 / 120;

export interface GameUi {
  hud: Hud;
  banner: Banner;
  popups: Popups;
  /** Called whenever the pause state may have changed (to relabel the button). */
  onPhase?: (sim: Sim) => void;
}

/** Glue between the simulation, the 3D stage, input and the UI. */
export class Game {
  readonly sim = new Sim();
  readonly input = new DirectionInput();
  private readonly car = makeSedan(COL.player, true);
  private readonly world: WorldView;
  private readonly fx: Fx;
  private readonly stepper = new FixedStepper(STEP, 0.1);
  private heading = faceAngle(0, -1);
  private shake = 0;
  private last = 0;

  constructor(
    private readonly stage: Stage3D,
    private readonly ui: GameUi
  ) {
    this.world = new WorldView(stage);
    this.fx = new Fx(stage.fxGroup);
    stage.actorGroup.add(this.car.group);
    this.listen();
    this.onLevelLoaded();
    ui.banner.render(this.sim);
    ui.onPhase?.(this.sim);
  }

  get view(): ViewMode {
    return this.stage.rig.view;
  }

  /** Space / Enter / tap: start a game or resume from pause. */
  confirm(): void {
    if (this.sim.wantsStart) this.sim.startGame();
    else if (this.sim.phase === 'paused') this.sim.togglePause();
  }

  togglePause(): void {
    this.sim.togglePause();
  }

  setView(view: ViewMode): void {
    this.stage.rig.setView(view);
  }

  /** Re-renders text that depends on the language. */
  refreshText(): void {
    this.ui.banner.render(this.sim);
    this.ui.hud.invalidate();
    this.ui.onPhase?.(this.sim);
  }

  start(): void {
    this.last = performance.now();
    requestAnimationFrame(this.frame);
  }

  private listen(): void {
    const { events } = this.sim;
    events.on('levelLoaded', () => this.onLevelLoaded());
    events.on('respawn', () => {
      this.car.group.scale.setScalar(1);
      this.car.group.visible = true;
      this.heading = faceAngle(this.sim.player.fx, this.sim.player.fy);
      this.syncCar(0);
    });
    events.on('gemTaken', ({ gem, points }) => {
      this.world.removeGem(gem);
      this.ui.popups.show('+' + points, gem.x, gem.y, '#ffc83d');
      this.fx.ring(gem.x, gem.y, COL.gem, 1.3);
    });
    events.on('crash', ({ x, y }) => {
      this.shake = 0.45;
      this.fx.ring(x, y, COL.enemy, 2.2);
    });
    events.on('phase', () => {
      this.ui.banner.render(this.sim);
      this.ui.onPhase?.(this.sim);
    });
  }

  private onLevelLoaded(): void {
    this.stage.setMaze(this.sim.maze);
    this.world.rebuild(this.sim.gems, this.sim.rocks);
    this.fx.clear();
    this.stage.rig.snapTo(START.x, START.y);
  }

  private readonly frame = (now: number): void => {
    const dt = Math.min(0.1, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    this.stepper.advance(dt, (step) => {
      this.input.update(step);
      this.sim.update(step, this.input.want);
    });
    this.render(dt);
    requestAnimationFrame(this.frame);
  };

  private render(dt: number): void {
    const sim = this.sim;
    if (sim.phase !== 'paused') {
      this.world.update(dt, sim.time);
      this.fx.update(dt);
    }
    this.syncCar(dt);
    this.ui.hud.update(sim);
    if (this.shake > 0) this.shake -= dt;
    this.stage.render(dt, posX(sim.player), posY(sim.player), Math.max(0, this.shake) * 0.5);
  }

  private syncCar(dt: number): void {
    const { sim } = this;
    const g = this.car.group;
    g.position.set(wx(posX(sim.player)), 0, wz(posY(sim.player)));
    if (sim.phase === 'dying') {
      // spin and shrink away
      g.rotation.y += dt * 14;
      g.scale.setScalar(Math.max(0.01, 1 - Math.min(1, sim.stateT / 0.9)));
      return;
    }
    this.heading = lerpAngle(this.heading, faceAngle(sim.player.fx, sim.player.fy), 1 - Math.exp(-16 * dt));
    g.rotation.y = this.heading;
  }
}
