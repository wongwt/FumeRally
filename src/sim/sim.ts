import {
  CLEAR_TIME,
  CLOUD_LIFE,
  CLOUD_RADIUS,
  CLOUD_STUN_AGE,
  COMBO_TIME,
  DYING_TIME,
  FUEL_BONUS,
  FUEL_DRAIN,
  FUEL_MAX,
  GEM_FUEL,
  GEM_POINTS,
  HIT_RADIUS,
  MAX_COMBO,
  PLAYER_SPEED,
  PUFF_COOLDOWN,
  PUFF_COST,
  PUFF_DROP_DISTANCE,
  READY_TIME,
  RESPAWN_FUEL,
  START,
  START_LIVES,
  STUN_IMMUNITY,
  STUN_POINTS,
  STUN_TIME,
  COLS,
  ROWS,
  type Vec
} from '../config/constants';
import { Emitter } from '../core/events';
import { buildMaze, mazeSeed, type Maze } from '../core/maze';
import { Pathfinder } from '../core/pathfinding';
import {
  type ChaseContext,
  chooseEnemyDir,
  configureEnemies,
  createEnemies,
  type Enemy,
  resetEnemies
} from './enemies';
import { advance, choosePlayerDir, createMover, posX, posY, resetPlayer, reverseIfWanted } from './movement';
import { type Gem, type Rock, spawnGems, spawnRocks } from './spawn';

export type Phase = 'title' | 'ready' | 'play' | 'dying' | 'clear' | 'over' | 'paused';
export type CrashReason = 'fuel' | 'rock' | 'caught';

/** A puff of exhaust on the road. It stuns chasers that touch it while it is fresh. */
export interface Cloud {
  x: number;
  y: number;
  age: number;
}

/** Everything the simulation announces. Presenters (render, audio, UI) subscribe to these. */
export interface SimEvents {
  phase: { phase: Phase; prev: Phase };
  levelLoaded: { level: number; bonus: boolean };
  /** The player is back on the start tile (new level or after a crash). */
  respawn: Record<string, never>;
  go: Record<string, never>;
  gemTaken: { gem: Gem; points: number; mult: number };
  puff: { cloud: Cloud };
  /** The exhaust button was pressed without enough fuel. */
  puffEmpty: Record<string, never>;
  enemyStunned: { enemy: Enemy; points: number; x: number; y: number };
  crash: { why: CrashReason; x: number; y: number };
  levelClear: { fuelBonus: number; time: number };
  gameOver: { score: number; newRecord: boolean };
}

/**
 * The game rules and state machine. It knows nothing about the DOM, Three.js or audio:
 * feed it time and the wanted direction, and listen to `events`.
 */
export class Sim {
  readonly events = new Emitter<SimEvents>();
  readonly player = createMover(START.x, START.y);

  phase: Phase = 'title';
  /** Phase to return to when un-pausing. */
  private resumePhase: Phase = 'ready';
  /** Seconds spent in the current phase. */
  stateT = 0;
  /** Total simulated seconds (drives animations). */
  time = 0;

  level = 1;
  startLevel = 1;
  /** 0 for the built-in maps; a hash of the level code otherwise. */
  challengeSeed = 0;
  bonus = false;

  score = 0;
  hi = 0;
  private hiAtStart = 0;
  lives = START_LIVES;
  mult = 1;
  comboT = 0;
  fuel = FUEL_MAX;
  runTime = 0;
  /** Time on the current level, and how many cars were lost on it. */
  lvT = 0;
  lvDeaths = 0;
  clearedInRun = 0;
  lastFuelBonus = 0;
  crashWhy: CrashReason = 'rock';
  newRecord = false;

  maze: Maze = buildMaze(mazeSeed(1, 0, false));
  gems: Gem[] = [];
  rocks: Rock[] = [];
  readonly enemies = createEnemies();
  clouds: Cloud[] = [];
  /** Source of randomness for chaser decisions; tests replace it with a seeded one. */
  rand: () => number = Math.random;
  private smokeCd = 0;
  private readonly rockGrid = new Uint8Array(COLS * ROWS);
  private readonly pathfinder = new Pathfinder(COLS, ROWS);
  private readonly chase: ChaseContext = {
    player: this.player,
    isOpen: (x, y) => this.isOpenForChasers(x, y),
    pathfinder: this.pathfinder,
    rand: () => this.rand()
  };

  /** Car stats; the garage swaps these in M9. */
  speed = PLAYER_SPEED;
  drain = 1;

  constructor() {
    this.loadLevel(1, false);
  }

  /** Replaces the level's rocks. Rocks block chasers, so the lookup grid is rebuilt with them. */
  setRocks(rocks: Rock[]): void {
    this.rocks = rocks;
    this.rockGrid.fill(0);
    for (const r of rocks) if (!r.broken) this.rockGrid[r.y * COLS + r.x] = 1;
  }

  /** Chasers can use corridors, but not tiles with a rock on them. */
  isOpenForChasers(x: number, y: number): boolean {
    return this.maze.isOpen(x, y) && !this.rockGrid[y * COLS + x];
  }

  get gemsLeft(): number {
    let n = 0;
    for (const g of this.gems) if (!g.taken) n++;
    return n;
  }

  /** True on the title and game-over screens, where a start request is accepted. */
  get wantsStart(): boolean {
    return this.phase === 'title' || this.phase === 'over';
  }

  startGame(): void {
    this.hiAtStart = this.hi;
    this.score = 0;
    this.lives = START_LIVES;
    this.mult = 1;
    this.comboT = 0;
    this.newRecord = false;
    this.runTime = 0;
    this.clearedInRun = 0;
    this.loadLevel(this.startLevel, false);
    this.setPhase('ready');
  }

  loadLevel(level: number, bonus: boolean): void {
    this.level = level;
    this.bonus = bonus;
    this.maze = buildMaze(mazeSeed(level, this.challengeSeed, bonus));
    this.setRocks(spawnRocks(this.maze, level, this.challengeSeed, bonus));
    this.gems = spawnGems(level, this.challengeSeed, bonus);
    configureEnemies(this.enemies, level, bonus);
    this.fuel = FUEL_MAX;
    this.lvT = 0;
    this.lvDeaths = 0;
    this.resetActors();
    this.events.emit('levelLoaded', { level, bonus });
  }

  togglePause(): void {
    if (this.phase === 'play' || this.phase === 'ready') {
      this.resumePhase = this.phase;
      this.setPhase('paused');
    } else if (this.phase === 'paused') {
      this.setPhase(this.resumePhase);
    }
  }

  /** Advances the simulation by `dt` seconds. `want` is the direction the player asks for. */
  update(dt: number, want: Vec | null, smoke = false): void {
    this.time += dt;
    if (this.phase === 'paused') return;
    this.stateT += dt;
    this.ageClouds(dt);
    switch (this.phase) {
      case 'ready':
        if (this.stateT >= READY_TIME) {
          this.events.emit('go', {});
          this.setPhase('play');
        }
        break;
      case 'play':
        this.updatePlay(dt, want, smoke);
        break;
      case 'dying':
        if (this.stateT >= DYING_TIME) {
          if (this.lives <= 0) {
            this.gameOver();
          } else {
            this.fuel = Math.max(this.fuel, RESPAWN_FUEL);
            this.mult = 1;
            this.resetActors();
            this.setPhase('ready');
          }
        }
        break;
      case 'clear':
        if (this.stateT >= CLEAR_TIME) {
          this.loadLevel(this.level + 1, false);
          this.setPhase('ready');
        }
        break;
      default:
        break;
    }
  }

  private setPhase(phase: Phase): void {
    const prev = this.phase;
    this.phase = phase;
    this.stateT = 0;
    this.events.emit('phase', { phase, prev });
  }

  private resetActors(): void {
    resetPlayer(this.player, this.maze, START.x, START.y);
    resetEnemies(this.enemies);
    this.clouds = [];
    this.smokeCd = 0;
    this.events.emit('respawn', {});
  }

  private addScore(n: number): void {
    this.score += n;
    if (this.score > this.hi) this.hi = this.score;
  }

  private updatePlay(dt: number, want: Vec | null, smoke: boolean): void {
    const p = this.player;
    this.runTime += dt;
    this.lvT += dt;

    this.fuel -= FUEL_DRAIN * this.drain * dt;
    if (this.fuel <= 0) {
      this.fuel = 0;
      this.crash('fuel');
      return;
    }
    if (this.mult > 1) {
      this.comboT -= dt;
      if (this.comboT <= 0) this.mult = 1;
    }

    reverseIfWanted(p, want);
    advance(p, this.speed * dt, (e) => choosePlayerDir(e, want, (x, y) => this.maze.isOpen(x, y)));

    this.smokeCd -= dt;
    if (smoke && this.smokeCd <= 0 && !this.bonus) this.puff();
    this.moveEnemies(dt);
    this.stunEnemiesInSmoke();

    const px = posX(p);
    const py = posY(p);
    for (const g of this.gems) {
      if (g.taken || Math.abs(g.x - px) >= 0.55 || Math.abs(g.y - py) >= 0.55) continue;
      g.taken = true;
      const points = GEM_POINTS * this.mult;
      this.addScore(points);
      this.fuel = Math.min(FUEL_MAX, this.fuel + GEM_FUEL);
      const mult = this.mult;
      this.mult = Math.min(MAX_COMBO, this.mult + 1);
      this.comboT = COMBO_TIME;
      this.events.emit('gemTaken', { gem: g, points, mult });
    }
    if (this.gemsLeft === 0) {
      this.levelClear();
      return;
    }

    for (const r of this.rocks) {
      if (r.broken || Math.hypot(r.x - px, r.y - py) >= 0.62) continue;
      this.crash('rock');
      return;
    }

    for (const en of this.enemies) {
      if (!en.active || en.release > 0 || en.stun > 0) continue;
      if (Math.hypot(posX(en) - px, posY(en) - py) >= HIT_RADIUS) continue;
      this.crash('caught');
      return;
    }
  }

  private puff(): void {
    if (this.fuel < PUFF_COST) {
      this.smokeCd = 0.3;
      this.events.emit('puffEmpty', {});
      return;
    }
    this.fuel -= PUFF_COST;
    this.smokeCd = PUFF_COOLDOWN;
    const p = this.player;
    const cloud: Cloud = {
      x: posX(p) - p.fx * PUFF_DROP_DISTANCE,
      y: posY(p) - p.fy * PUFF_DROP_DISTANCE,
      age: 0
    };
    this.clouds.push(cloud);
    this.events.emit('puff', { cloud });
  }

  private ageClouds(dt: number): void {
    for (const c of this.clouds) c.age += dt;
    if (this.clouds.some((c) => c.age >= CLOUD_LIFE))
      this.clouds = this.clouds.filter((c) => c.age < CLOUD_LIFE);
  }

  private moveEnemies(dt: number): void {
    for (const en of this.enemies) {
      if (!en.active) continue;
      if (en.release > 0) {
        en.release -= dt;
        continue;
      }
      if (en.stun > 0) {
        en.stun -= dt;
        if (en.stun <= 0) {
          en.stun = 0;
          en.immune = STUN_IMMUNITY;
        }
        continue;
      }
      if (en.immune > 0) en.immune -= dt;
      advance(en, en.speed * dt, (e) => chooseEnemyDir(e as Enemy, this.chase));
    }
  }

  private stunEnemiesInSmoke(): void {
    for (const en of this.enemies) {
      if (!en.active || en.release > 0 || en.stun > 0 || en.immune > 0) continue;
      const ex = posX(en);
      const ey = posY(en);
      const hit = this.clouds.some(
        (c) => c.age <= CLOUD_STUN_AGE && Math.hypot(ex - c.x, ey - c.y) < CLOUD_RADIUS
      );
      if (!hit) continue;
      en.stun = STUN_TIME;
      this.addScore(STUN_POINTS);
      this.events.emit('enemyStunned', { enemy: en, points: STUN_POINTS, x: ex, y: ey });
    }
  }

  private crash(why: CrashReason): void {
    if (this.phase !== 'play') return;
    this.lives -= 1;
    this.lvDeaths += 1;
    this.crashWhy = why;
    this.events.emit('crash', { why, x: posX(this.player), y: posY(this.player) });
    this.setPhase('dying');
  }

  private levelClear(): void {
    this.lastFuelBonus = Math.round(this.fuel) * FUEL_BONUS;
    this.addScore(this.lastFuelBonus);
    this.clearedInRun += 1;
    this.events.emit('levelClear', { fuelBonus: this.lastFuelBonus, time: this.lvT });
    this.setPhase('clear');
  }

  private gameOver(): void {
    this.newRecord = this.score > 0 && this.score > this.hiAtStart;
    this.events.emit('gameOver', { score: this.score, newRecord: this.newRecord });
    this.setPhase('over');
  }
}
