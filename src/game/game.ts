import { CARS, carUnlocked, isCarId, unlockedCars, type CarId } from '../config/cars';
import type { DirName } from '../config/constants';
import { normCode, type ChallengeMode } from '../core/challenge';
import { PlayerInput } from '../input/playerInput';
import type { ViewMode } from '../render/cameraRig';
import { COL } from '../render/palette';
import { EnemyView } from '../render/enemyView';
import { GhostView } from '../render/ghostView';
import { Fx } from '../render/fx';
import { PlayerView } from '../render/playerView';
import { SmokeView } from '../render/smokeView';
import { SpecialView } from '../render/specialView';
import type { Stage3D } from '../render/stage3d';
import { WorldView } from '../render/worldView';
import { posX, posY } from '../sim/movement';
import { Sim } from '../sim/sim';
import { ChallengeState } from './challenge';
import { Achievements } from './achievements';
import { Progress } from './progress';
import { FixedStepper } from '../sim/stepper';
import { t } from '../i18n';
import type { GhostStore } from '../storage/ghosts';
import type { Prefs } from '../storage/prefs';
import type { Records } from '../storage/records';
import { Banner, type ScreenContext } from '../ui/banner';
import type { Garage } from '../ui/garage';
import { Modal } from '../ui/modal';
import { aboutHtml } from '../ui/aboutModal';
import { unlockModalHtml } from '../ui/unlockModal';
import { achPanelHtml, achToastHtml, ToastQueue } from '../ui/achievementsUi';
import type { ChallengePanel, PanelModel } from '../ui/challengePanel';
import type { Hud } from '../ui/hud';
import type { Popups } from '../ui/popups';
import type { Radar } from '../ui/radar';

/** Simulation steps at 120 Hz regardless of display refresh rate. */
const STEP = 1 / 120;

/** Saved data the game reads and writes. */
export interface GameServices {
  records: Records;
  ghosts: GhostStore;
  prefs: Prefs;
}

export interface GameUi {
  hud: Hud;
  /** Element the title / pause / clear cards are drawn into. */
  bannerEl: HTMLElement;
  popups: Popups;
  radar: Radar;
  panel: ChallengePanel;
  garage: Garage;
  /** Element the dialogs (new car) are drawn into. */
  modalEl: HTMLElement;
  /** The achievement unlock pop-up. */
  achToastEl: HTMLElement;
  /** Achievement count or latest unlock changed (update the buttons). */
  onAchChange?: (info: { count: number; total: number; latest: string | null }) => void;
  /** The new-car dialog just opened (play a jingle). */
  onUnlockShown?: () => void;
  /** Called whenever the phase may have changed (to relabel buttons, close the mobile drawer). */
  onPhase?: (sim: Sim) => void;
  /** Start was requested with a level code that is not valid yet. */
  onInvalidStart?: () => void;
}

const CODE_APPLY_DELAY_MS = 150;
const BEST_TIME_STAGES = 30;

/** Glue between the simulation, the 3D stage, input and the UI. */
export class Game {
  readonly sim = new Sim();
  readonly input = new PlayerInput();
  readonly progress: Progress;
  readonly achievements: Achievements;
  private readonly toasts: ToastQueue;
  readonly challenge: ChallengeState;
  private readonly banner: Banner;
  readonly modal: Modal;
  private readonly player: PlayerView;
  private readonly world: WorldView;
  private readonly fx: Fx;
  private readonly enemyView: EnemyView;
  private readonly smokeView: SmokeView;
  private readonly specialView: SpecialView;
  private readonly ghostView: GhostView;
  private codeTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly stepper = new FixedStepper(STEP, 0.1);
  private shake = 0;
  private readonly reduceMotion =
    typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  private last = 0;

  constructor(
    private readonly stage: Stage3D,
    private readonly ui: GameUi,
    private readonly services: GameServices
  ) {
    this.progress = new Progress(this.sim, services.records, services.ghosts);
    this.achievements = new Achievements(this.sim, this.progress, services.records);
    this.toasts = new ToastQueue(
      (id) => {
        ui.achToastEl.innerHTML = achToastHtml(id);
        ui.achToastEl.hidden = false;
      },
      () => {
        ui.achToastEl.hidden = true;
      }
    );
    this.achievements.events.on('unlocked', ({ id }) => {
      this.toasts.push(id);
      this.announceAchievements();
    });
    this.challenge = new ChallengeState(services.prefs);
    this.banner = new Banner(ui.bannerEl, () => this.screenContext());
    this.modal = new Modal(ui.modalEl);
    this.modal.onClose = () => {
      this.sim.holdClear = false;
    };
    this.player = new PlayerView(stage);
    this.world = new WorldView(stage);
    this.fx = new Fx(stage.fxGroup);
    this.enemyView = new EnemyView(stage, this.sim.enemies);
    this.smokeView = new SmokeView(stage.fxGroup);
    this.specialView = new SpecialView(stage);
    this.ghostView = new GhostView(stage);
    this.listen();
  }

  /** Applies the saved challenge and draws the first screen. Call once after construction. */
  init(): void {
    this.announceAchievements();
    const saved = this.services.prefs.car;
    this.applyCar(isCarId(saved) && carUnlocked(saved, this.services.records.data.carLv) ? saved : 'sedan');
    this.applyChallenge();
  }

  /** Puts the player in this car: stats, model and camera reach. Does not touch the stage. */
  private applyCar(id: CarId): void {
    this.sim.setCar(id);
    this.player.setCar(id);
    this.stage.rig.setViewScale(CARS[id].view ?? 1);
  }

  /** Chooses a car (title and game-over screens only); ghosts and best times follow the car. */
  selectCar(id: CarId): void {
    const { sim, services } = this;
    if (!sim.wantsStart || id === sim.carId || !carUnlocked(id, services.records.data.carLv)) return;
    this.applyCar(id);
    services.prefs.car = id;
    services.prefs.saveChallenge();
    this.applyChallenge();
  }

  /** Left/right on the menu: next or previous unlocked car. */
  cycleCar(delta: 1 | -1): void {
    const list = unlockedCars(this.services.records.data.carLv);
    if (list.length < 2) return;
    const i = list.indexOf(this.sim.carId);
    this.selectCar(list[(i + delta + list.length) % list.length] as CarId);
  }

  get view(): ViewMode {
    return this.stage.rig.view;
  }

  /** Space / Enter / tap: start a game or resume from pause. Returns true if it did either. */
  confirm(): boolean {
    if (this.sim.wantsStart) this.begin();
    else if (this.sim.phase === 'paused') this.sim.togglePause();
    else return false;
    return true;
  }

  /** Starts a game with the selected challenge, unless a level code is still missing. */
  begin(): void {
    const { sim } = this;
    if (!sim.wantsStart) return;
    if (!this.challenge.valid) {
      this.ui.onInvalidStart?.();
      return;
    }
    clearTimeout(this.codeTimer);
    // a code board always starts at stage 1; only normal mode has a start-stage picker
    if (this.challenge.key !== 'N') sim.startLevel = 1;
    sim.startGame();
  }

  /** Arrow keys on the menu screens: up/down pick the start stage. Returns true if handled. */
  menuDir(dir: DirName): boolean {
    if (!this.sim.wantsStart) return false;
    if (dir === 'up' || dir === 'down') this.changeStartLevel(dir === 'up' ? 1 : -1);
    else this.cycleCar(dir === 'right' ? 1 : -1);
    return true;
  }

  changeStartLevel(delta: 1 | -1): void {
    const { sim } = this;
    if (!sim.wantsStart || this.challenge.key !== 'N') return;
    const max = this.services.records.data.cleared + 1;
    const next = Math.max(1, Math.min(max, sim.startLevel + delta));
    if (next === sim.startLevel) return;
    sim.startLevel = next;
    this.banner.render(sim);
  }

  selectMode(mode: ChallengeMode): void {
    if (!this.sim.wantsStart) return;
    this.challenge.setMode(mode);
    this.applyChallenge();
  }

  /** The level-code field changed. Custom codes re-roll the maze preview shortly after typing stops. */
  typeCode(raw: string): void {
    if (!this.sim.wantsStart) return;
    this.challenge.setCode(normCode(raw));
    if (this.challenge.mode !== 'custom') return;
    clearTimeout(this.codeTimer);
    this.codeTimer = setTimeout(() => this.applyChallenge(), CODE_APPLY_DELAY_MS);
    this.refreshPanel();
  }

  randomCode(): void {
    if (!this.sim.wantsStart) return;
    this.challenge.randomize();
    this.applyChallenge();
  }

  setGhost(on: boolean): void {
    this.services.prefs.ghostOn = on;
    this.services.prefs.saveChallenge();
    this.sim.ghostOn = on;
  }

  /**
   * Makes the selected challenge current: its board, seed, best score and preview maze.
   * Only valid on the title and game-over screens.
   */
  applyChallenge(): void {
    const { sim, challenge } = this;
    const key = challenge.key;
    sim.challengeKey = key;
    sim.challengeSeed = challenge.seed;
    sim.ghostOn = this.services.prefs.ghostOn;
    sim.hi = this.progress.best();
    sim.startLevel =
      key === 'N' ? Math.max(1, Math.min(sim.startLevel, this.services.records.data.cleared + 1)) : 1;
    sim.loadLevel(sim.startLevel, false);
    this.refreshScreens();
  }

  /** Redraws the banner and the challenge panel. */
  refreshScreens(): void {
    this.banner.render(this.sim);
    this.refreshPanel();
    this.ui.onPhase?.(this.sim);
  }

  refreshPanel(): void {
    this.ui.panel.update(this.panelModel());
    this.ui.garage.update({
      selected: this.sim.carId,
      carLv: this.services.records.data.carLv,
      locked: !this.sim.wantsStart
    });
  }

  private challengeLabel(): string {
    const { challenge } = this;
    if (challenge.mode === 'normal') return t('mode.labelNormal');
    if (challenge.mode === 'daily') return t('mode.labelDaily', { code: challenge.code });
    return t('mode.labelCustom', { code: challenge.customCode || '—' });
  }

  private panelModel(): PanelModel {
    const { sim, challenge, services } = this;
    const stageTimes: PanelModel['stageTimes'] = [];
    for (let lv = 1; lv <= BEST_TIME_STAGES; lv++) {
      const seconds = services.records.bestTime(this.progress.stageKey(lv));
      if (seconds !== undefined) stageTimes.push({ level: lv, seconds });
    }
    return {
      mode: challenge.mode,
      customCode: challenge.customCode,
      dailyCode: challenge.mode === 'daily' ? challenge.code : '',
      valid: challenge.valid,
      locked: !sim.wantsStart,
      ghostOn: services.prefs.ghostOn,
      label: this.challengeLabel(),
      rows: services.records.boardOf(sim.challengeKey),
      stageTimes,
      carName: t(`car.${sim.carId}.name`)
    };
  }

  private screenContext(): ScreenContext {
    const { sim, services } = this;
    const cleared = services.records.data.cleared;
    return {
      challengeLabel: this.challengeLabel(),
      carPicker:
        unlockedCars(services.records.data.carLv).length >= 2
          ? { id: sim.carId, name: t(`car.${sim.carId}.name`) }
          : null,
      picker: sim.challengeKey === 'N' && cleared >= 1 ? { level: sim.startLevel, max: cleared + 1 } : null,
      records: services.records.boardOf(sim.challengeKey),
      clear: this.progress.lastClear
    };
  }

  /** Tells the UI the achievement count / latest unlock (for the button and the side box). */
  announceAchievements(): void {
    const a = this.achievements;
    this.ui.onAchChange?.({
      count: a.count,
      total: a.total,
      latest: a.latest ? t(`ach.${a.latest}.name`) : null
    });
  }

  /** Opens the achievements dialog, pausing a running game first. */
  openAchievements(): void {
    if (this.modal.isOpen) return;
    if (this.sim.phase === 'play' || this.sim.phase === 'ready') this.sim.togglePause();
    this.input.clear();
    this.modal.show(achPanelHtml(this.achievements));
  }

  /** Opens the About dialog, pausing a running game first. */
  openAbout(): void {
    if (this.modal.isOpen) return;
    if (this.sim.phase === 'play' || this.sim.phase === 'ready') this.sim.togglePause();
    this.input.clear();
    this.modal.show(aboutHtml());
  }

  togglePause(): void {
    this.sim.togglePause();
  }

  setView(view: ViewMode): void {
    this.stage.rig.setView(view);
  }

  /** Re-renders text that depends on the language. */
  refreshText(): void {
    this.announceAchievements();
    this.ui.hud.invalidate();
    this.refreshScreens();
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
    events.on('armorBroke', ({ x, y }) => {
      popups.show(t('popup.armorBroke'), x, y - 0.6, '#ffe29a');
      this.fx.ring(x, y, 0xffe29a, 2.0);
      this.shake = Math.max(this.shake, 0.3);
    });
    events.on('siren', ({ x, y }) => {
      popups.show(t('popup.siren'), x, y - 0.6, '#9fb4ff');
      this.fx.ring(x, y, 0x5b7bff, 2.8);
    });
    events.on('enemyKnocked', ({ points, x, y }) => {
      if (points > 0) popups.show('+' + points, x, y, '#ff8a7c');
      this.fx.ring(x, y, COL.enemy, 1.8);
      this.shake = Math.max(this.shake, 0.2);
    });
    events.on('ghostSplit', ({ delta, x, y }) => {
      popups.show(
        (delta <= 0 ? '' : '+') + delta.toFixed(1) + 's',
        x,
        y - 0.8,
        delta <= 0 ? '#79e07a' : '#ff5b4b'
      );
    });
    events.on('gameOver', () => {
      // progress made this run may have raised the start-stage limit
      const cleared = this.services.records.data.cleared;
      this.sim.startLevel =
        this.challenge.key === 'N' ? Math.max(1, Math.min(this.sim.startLevel, cleared + 1)) : 1;
    });
    events.on('enemyStunned', ({ points, x, y }) => {
      popups.show('+' + points, x, y, '#d5dde2');
    });
    events.on('crash', ({ x, y }) => {
      this.shake = 0.45;
      this.fx.ring(x, y, COL.enemy, 2.2);
    });
    events.on('phase', () => this.refreshScreens());
  }

  private onLevelLoaded(): void {
    this.stage.setMaze(this.sim.maze);
    this.world.rebuild(this.sim.gems, this.sim.rocks);
    this.ui.radar.setMaze(this.sim.maze);
    this.fx.clear();
    this.smokeView.clear();
    this.stage.rig.snapTo(this.sim.maze.start.x, this.sim.maze.start.y);
  }

  /** A little way into the clear screen, announce a newly unlocked car and hold the screen until it is closed. */
  private announceUnlock(): void {
    const car = this.progress.pendingUnlock;
    if (!car || this.sim.phase !== 'clear' || this.sim.stateT < 1.6 || this.modal.isOpen) return;
    this.progress.pendingUnlock = null;
    this.sim.holdClear = true;
    this.input.clear();
    this.modal.show(unlockModalHtml(car));
    this.ui.onUnlockShown?.();
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
    this.announceUnlock();
    this.ghostView.update(dt, sim);
    this.ui.hud.update(sim);
    if (this.shake > 0) this.shake -= dt;
    this.stage.render(
      dt,
      posX(sim.player),
      posY(sim.player),
      this.reduceMotion?.matches ? 0 : Math.max(0, this.shake) * 0.5
    );
    if (this.view === 'scroll') this.ui.radar.draw(sim, this.stage.rig);
  }
}
