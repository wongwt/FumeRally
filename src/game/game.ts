import { START } from '../config/constants';
import { PlayerInput } from '../input/playerInput';
import type { ViewMode } from '../render/cameraRig';
import { COL } from '../render/palette';
import { EnemyView } from '../render/enemyView';
import { Fx } from '../render/fx';
import { PlayerView } from '../render/playerView';
import { SmokeView } from '../render/smokeView';
import { SpecialView } from '../render/specialView';
import type { Stage3D } from '../render/stage3d';
import { WorldView } from '../render/worldView';
import { posX, posY } from '../sim/movement';
import { Sim } from '../sim/sim';
import { FixedStepper } from '../sim/stepper';
import type { Banner } from '../ui/banner';
import type { Hud } from '../ui/hud';
import type { Popups } from '../ui/popups';
import type { Radar } from '../ui/radar';

/** Simulation steps at 120 Hz regardless of display refresh rate. */
const STEP = 1 / 120;

export interface GameUi {
  hud: Hud;
  banner: Banner;
  popups: Popups;
  radar: Radar;
  /** Called whenever the pause state may have changed (to relabel the button). */
  onPhase?: (sim: Sim) => void;
}

/** Glue between the simulation, the 3D stage, input and the UI. */
export class Game {
  readonly sim = new Sim();
  readonly input = new PlayerInput();
  private readonly player: PlayerView;
  private readonly world: WorldView;
  private readonly fx: Fx;
  private readonly enemyView: EnemyView;
  private readonly smokeView: SmokeView;
  private readonly specialView: SpecialView;
  private readonly stepper = new FixedStepper(STEP, 0.1);
  private shake = 0;
  private last = 0;

  constructor(
    private readonly stage: Stage3D,
    private readonly ui: GameUi
  ) {
    this.player = new PlayerView(stage);
    this.world = new WorldView(stage);
    this.fx = new Fx(stage.fxGroup);
    this.enemyView = new EnemyView(stage, this.sim.enemies);
    this.smokeView = new SmokeView(stage.fxGroup);
    this.specialView = new SpecialView(stage);
    this.listen();
    this.onLevelLoaded();
    ui.banner.render(this.sim);
    ui.onPhase?.(this.sim);
  }

  get view(): ViewMode {
    return this.stage.rig.view;
  }

  /** Space / Enter / tap: start a game or resume from pause. Returns true if it did either. */
  confirm(): boolean {
    if (this.sim.wantsStart) this.sim.startGame();
    else if (this.sim.phase === 'paused') this.sim.togglePause();
    else return false;
    return true;
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
    const { popups } = this.ui;
    events.on('levelLoaded', () => this.onLevelLoaded());
    events.on('respawn', () => {
      this.player.reset(this.sim);
      this.enemyView.snapHeadings();
      this.smokeView.clear();
    });
    events.on('gemTaken', ({ gem, points }) => {
      this.world.removeGem(gem);
      popups.show('+' + points, gem.x, gem.y, '#ffc83d');
      this.fx.ring(gem.x, gem.y, COL.gem, 1.3);
    });
    events.on('powerUp', ({ x, y }) => {
      popups.show('+500', x, y, '#ffffff');
      this.fx.ring(x, y, 0xffffff, 2.2);
    });
    events.on('rockSmashed', ({ rock, points }) => {
      this.world.removeRock(rock);
      popups.show('+' + points, rock.x, rock.y, '#b8b0a2');
      this.fx.ring(rock.x, rock.y, 0xb8b0a2, 1.5);
      this.shake = Math.max(this.shake, 0.15);
    });
    events.on('enemyKnocked', ({ points, x, y }) => {
      popups.show('+' + points, x, y, '#ff8a7c');
      this.fx.ring(x, y, COL.enemy, 1.8);
      this.shake = Math.max(this.shake, 0.2);
    });
    events.on('enemyStunned', ({ points, x, y }) => {
      popups.show('+' + points, x, y, '#d5dde2');
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
    this.ui.radar.setMaze(this.sim.maze);
    this.fx.clear();
    this.smokeView.clear();
    this.stage.rig.snapTo(START.x, START.y);
  }

  private readonly frame = (now: number): void => {
    const dt = Math.min(0.1, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    this.stepper.advance(dt, (step) => {
      this.input.update(step);
      this.sim.update(step, this.input.want, this.input.takeSmoke());
    });
    this.render(dt);
    requestAnimationFrame(this.frame);
  };

  private render(dt: number): void {
    const sim = this.sim;
    if (sim.phase !== 'paused') {
      this.world.update(dt, sim.time);
      this.fx.update(dt);
      this.enemyView.update(dt, sim.time);
      this.smokeView.update(sim.clouds);
      this.specialView.update(dt, sim.time, sim.special);
    }
    this.player.update(dt, sim);
    this.ui.hud.update(sim);
    if (this.shake > 0) this.shake -= dt;
    this.stage.render(dt, posX(sim.player), posY(sim.player), Math.max(0, this.shake) * 0.5);
    if (this.view === 'scroll') this.ui.radar.draw(sim, this.stage.rig);
  }
}
