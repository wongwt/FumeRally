import {
  BONUS_EVERY,
  BONUS_PERFECT_POINTS,
  BONUS_SECOND_POINTS,
  BONUS_TIME,
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
  KNOCK_POINTS,
  KNOCK_RELEASE,
  MAX_COMBO,
  PLAYER_SPEED,
  POWER_TIME,
  PUFF_COOLDOWN,
  PUFF_COST,
  PUFF_DROP_DISTANCE,
  READY_TIME,
  RESPAWN_FUEL,
  ROCK_POINTS,
  SPECIAL_FIRST,
  SPECIAL_FUEL,
  SPECIAL_MIN_DISTANCE,
  SPECIAL_POINTS,
  SPECIAL_RESPAWN,
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
import { GhostRecorder, type GhostData } from './ghost';
import { type Gem, type Rock, spawnGems, spawnRocks, specialOrder } from './spawn';

export type Phase = 'title' | 'ready' | 'play' | 'dying' | 'clear' | 'over' | 'paused';
export type CrashReason = 'fuel' | 'rock' | 'caught';

/** The rainbow gem: grants a few seconds of invincibility. */
export interface Special {
  x: number;
  y: number;
}

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
  levelClear: {
    fuelBonus: number;
    time: number;
    /** No car was lost on this stage, so the run may set a best time. */
    flawless: boolean;
    /** The recorded run: positions and gem times. */
    path: number[];
    gems: number[];
  };
  /** A gem was picked up while racing a ghost; `delta` is seconds behind (+) or ahead (−) of it. */
  ghostSplit: { delta: number; x: number; y: number };
  /** The bonus stage ended; `award` is 0 when time ran out. */
  bonusEnd: { perfect: boolean; award: number };
  powerUp: { x: number; y: number };
  rockSmashed: { rock: Rock; points: number };
  enemyKnocked: { enemy: Enemy; points: number; x: number; y: number };
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
  /** Board key: 'N' or 'C:<code>'. Set with the seed by whoever picks the challenge. */
  challengeKey = 'N';
  /** Id of the car being driven (affects which best times and ghosts apply). */
  carId = 'sedan';
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
  /** Which kind of stage the current 'clear' phase is celebrating. */
  clearKind: 'level' | 'bonus' = 'level';
  bonusT = BONUS_TIME;
  bonusPerfect = false;
  bonusAward = 0;
  crashWhy: CrashReason = 'rock';
  newRecord = false;

  maze: Maze = buildMaze(mazeSeed(1, 0, false));
  gems: Gem[] = [];
  rocks: Rock[] = [];
  readonly enemies = createEnemies();
  clouds: Cloud[] = [];
  readonly recorder = new GhostRecorder();
  /** The run to race against on this stage, if any; set by whoever stores ghosts. */
  ghost: GhostData | null = null;
  ghostOn = true;
  /** Seconds ahead (−) or behind (+) the ghost at the last gem. */
  ghostDelta: number | null = null;
  /** Seconds of invincibility left. */
  power = 0;
  special: Special | null = null;
  private specialT = 0;
  private specialIdx = 0;
  private specialCells: Vec[] = [];
  /** Chasers knocked out during the current invincibility. */
  knockPow = 0;
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
    this.special = null;
    this.specialT = SPECIAL_FIRST;
    this.specialIdx = 0;
    this.specialCells = specialOrder(level, this.challengeSeed);
    this.bonusT = BONUS_TIME;
    this.recorder.reset();
    this.ghost = null;
    this.ghostDelta = null;
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
          // every third level is followed by a bonus stage, which then leads to the next level
          if (!this.bonus && this.level % BONUS_EVERY === 0) this.loadLevel(this.level, true);
          else this.loadLevel(this.level + 1, false);
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
    this.power = 0;
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
    this.recorder.sample(dt, posX(p), posY(p));

    if (this.bonus) {
      this.bonusT -= dt;
      if (this.bonusT <= 0) {
        this.bonusT = 0;
        this.endBonus(false);
        return;
      }
    } else {
      this.fuel -= FUEL_DRAIN * this.drain * dt;
      if (this.fuel <= 0) {
        this.fuel = 0;
        this.crash('fuel');
        return;
      }
      if (!this.special) {
        this.specialT -= dt;
        if (this.specialT <= 0) this.spawnSpecial();
      }
    }
    if (this.power > 0) this.power = Math.max(0, this.power - dt);
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
      this.raceGhost(g);
    }
    const sp = this.special;
    if (sp && Math.abs(sp.x - px) < 0.55 && Math.abs(sp.y - py) < 0.55) this.takeSpecial(sp);
    if (this.gemsLeft === 0) {
      if (this.bonus) this.endBonus(true);
      else this.levelClear();
      return;
    }

    for (const r of this.rocks) {
      if (r.broken || Math.hypot(r.x - px, r.y - py) >= 0.62) continue;
      if (this.power > 0) {
        this.breakRock(r);
      } else {
        this.crash('rock');
        return;
      }
    }

    for (const en of this.enemies) {
      if (!en.active || en.release > 0) continue;
      if (Math.hypot(posX(en) - px, posY(en) - py) >= HIT_RADIUS) continue;
      if (this.power > 0) {
        this.knockOut(en);
        this.knockPow += 1;
      } else if (en.stun <= 0) {
        this.crash('caught');
        return;
      }
    }
  }

  /** Logs the pickup time for the ghost and, if racing one, how far ahead or behind it we are. */
  private raceGhost(g: Gem): void {
    const t = Math.round(this.lvT * 100) / 100;
    this.recorder.addGem(t);
    const k = this.recorder.gems.length - 1;
    const split = this.ghost?.g[k];
    if (!this.ghostOn || split == null) return;
    this.ghostDelta = t - split;
    this.events.emit('ghostSplit', { delta: this.ghostDelta, x: g.x, y: g.y });
  }

  /** Puts the next rainbow gem on the map, skipping spots near the player or on uncollected gems. */
  private spawnSpecial(): void {
    const cells = this.specialCells;
    if (this.bonus || !cells.length) return;
    const px = Math.round(posX(this.player));
    const py = Math.round(posY(this.player));
    const gemSpots = new Set(this.gems.filter((g) => !g.taken).map((g) => g.x + ',' + g.y));
    for (let k = 0; k < cells.length; k++) {
      const c = cells[(this.specialIdx + k) % cells.length] as Vec;
      if (gemSpots.has(c.x + ',' + c.y)) continue;
      if (Math.abs(c.x - px) + Math.abs(c.y - py) < SPECIAL_MIN_DISTANCE) continue;
      this.specialIdx = (this.specialIdx + k + 1) % cells.length;
      this.special = { x: c.x, y: c.y };
      return;
    }
  }

  private takeSpecial(sp: Special): void {
    this.special = null;
    this.specialT = SPECIAL_RESPAWN;
    this.power = POWER_TIME;
    this.knockPow = 0;
    this.fuel = Math.min(FUEL_MAX, this.fuel + SPECIAL_FUEL);
    this.addScore(SPECIAL_POINTS);
    this.events.emit('powerUp', { x: sp.x, y: sp.y });
  }

  /** Smashes a rock (invincible player): it disappears and stops blocking chasers. */
  private breakRock(r: Rock): void {
    r.broken = true;
    this.rockGrid[r.y * COLS + r.x] = 0;
    this.addScore(ROCK_POINTS);
    this.events.emit('rockSmashed', { rock: r, points: ROCK_POINTS });
  }

  /** Sends a chaser back home for a while (invincible player ramming it). */
  private knockOut(en: Enemy): void {
    const x = posX(en);
    const y = posY(en);
    Object.assign(en, { tx: en.home.x, ty: en.home.y, prog: 0, dx: 0, dy: 0 });
    en.release = KNOCK_RELEASE;
    en.stun = 0;
    en.immune = 0;
    this.addScore(KNOCK_POINTS);
    this.events.emit('enemyKnocked', { enemy: en, points: KNOCK_POINTS, x, y });
  }

  private endBonus(perfect: boolean): void {
    this.clearKind = 'bonus';
    this.bonusPerfect = perfect;
    this.bonusAward = perfect ? Math.ceil(this.bonusT) * BONUS_SECOND_POINTS + BONUS_PERFECT_POINTS : 0;
    this.addScore(this.bonusAward);
    this.events.emit('bonusEnd', { perfect, award: this.bonusAward });
    this.setPhase('clear');
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
    this.clearKind = 'level';
    this.lastFuelBonus = Math.round(this.fuel) * FUEL_BONUS;
    this.addScore(this.lastFuelBonus);
    this.clearedInRun += 1;
    this.events.emit('levelClear', {
      fuelBonus: this.lastFuelBonus,
      time: this.lvT,
      flawless: this.lvDeaths === 0,
      path: this.recorder.path.slice(),
      gems: this.recorder.gems.slice()
    });
    this.setPhase('clear');
  }

  private gameOver(): void {
    this.newRecord = this.score > 0 && this.score > this.hiAtStart;
    this.events.emit('gameOver', { score: this.score, newRecord: this.newRecord });
    this.setPhase('over');
  }
}
