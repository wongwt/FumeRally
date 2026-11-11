import { ACHS, ACH_BY_ID, type AchId, type StatKey } from '../config/achievements';
import { CAR_ORDER, unlockedCars } from '../config/cars';
import { Emitter } from '../core/events';
import type { Sim } from '../sim/sim';
import type { Records } from '../storage/records';
import type { Progress } from './progress';

export interface AchievementEvents {
  unlocked: { id: AchId };
}

/** Score that earns the "Ten-Thousandaire" achievement. */
const SCORE_GOAL = 10_000;
/** Combo multiplier needed for "Five in a Row". */
const COMBO_GOAL = 5;
/** Knock-outs in one invincibility for "Bowling Night". */
const KNOCK_GOAL = 3;
/** Clean clears in a row for "Smooth Sailing". */
const FLAWLESS_GOAL = 3;
/** Stages cleared in one run for "Winning Streak". */
const RUN_GOAL = 5;
/** "Running on Fumes": cleared with less fuel than this. */
const LOW_FUEL = 10;

/**
 * Watches what the simulation announces and awards achievements. Progress and lifetime counters
 * live in the saved records. Create it after `Progress`, so a stage's progress is already saved when
 * the clear is evaluated.
 */
export class Achievements {
  readonly events = new Emitter<AchievementEvents>();
  private flawStreak = 0;
  private knocks = 0;

  constructor(
    private readonly sim: Sim,
    private readonly progress: Progress,
    private readonly records: Records
  ) {
    this.grantSilently();
    this.listen();
  }

  get total(): number {
    return ACHS.length;
  }

  get count(): number {
    return ACHS.filter((a) => this.has(a.id)).length;
  }

  /** The most recently unlocked achievement, if any. */
  get latest(): AchId | null {
    const id = this.records.data.achLast;
    return id && ACH_BY_ID[id] && this.has(id as AchId) ? (id as AchId) : null;
  }

  has(id: AchId): boolean {
    return this.records.data.ach[id] !== undefined;
  }

  /** Awards an achievement once. Returns true if it was new. */
  unlock(id: AchId): boolean {
    if (this.has(id)) return false;
    this.records.data.ach[id] = Date.now();
    this.records.data.achLast = id;
    this.records.save();
    this.events.emit('unlocked', { id });
    return true;
  }

  /** Raises a lifetime counter and awards any achievement whose target it reached. */
  bump(stat: StatKey, n = 1): void {
    const v = (this.records.data.st[stat] ?? 0) + n;
    this.records.data.st[stat] = v;
    for (const a of ACHS) if (a.stat === stat && a.need !== undefined && v >= a.need) this.unlock(a.id);
  }

  /** Progress made before achievements existed is granted without a pop-up. */
  private grantSilently(): void {
    const { data } = this.records;
    const now = Date.now();
    for (const a of ACHS)
      if (a.lvl !== undefined && data.carLv >= a.lvl && data.ach[a.id] === undefined) data.ach[a.id] = now;
    if (unlockedCars(data.carLv).length >= CAR_ORDER.length && data.ach.garage_full === undefined)
      data.ach.garage_full = now;
  }

  private listen(): void {
    const { events } = this.sim;
    events.on('phase', ({ phase, prev }) => {
      if (phase === 'ready' && (prev === 'title' || prev === 'over')) this.flawStreak = 0; // a new run
    });
    events.on('crash', ({ why }) => {
      if (why === 'caught') {
        this.unlock('first_catch');
        this.bump('hits');
      } else if (why === 'rock') {
        this.unlock('first_rock');
        this.bump('hits');
        this.bump('rocks');
      } else {
        this.unlock('no_fuel');
      }
      this.records.save();
    });
    events.on('gemTaken', ({ mult }) => {
      if (Math.min(COMBO_GOAL, mult + 1) >= COMBO_GOAL) this.unlock('combo5');
    });
    events.on('score', ({ score }) => {
      if (score >= SCORE_GOAL) this.unlock('score_10k');
    });
    events.on('puff', () => this.bump('puff'));
    events.on('enemyStunned', () => this.bump('stun'));
    events.on('powerUp', () => {
      this.knocks = 0;
      this.unlock('first_power');
    });
    events.on('enemyKnocked', ({ points }) => {
      if (points > 0 && ++this.knocks >= KNOCK_GOAL) this.unlock('knock3');
    });
    events.on('rockSmashed', ({ crush }) => {
      if (crush) this.bump('crush');
    });
    events.on('armorBroke', ({ by }) => {
      this.unlock('armor_block');
      this.bump('hits');
      if (by === 'rock') this.bump('rocks');
    });
    events.on('siren', () => this.unlock('siren_1'));
    events.on('bonusEnd', ({ perfect }) => {
      if (perfect) this.unlock('bonus_perfect');
    });
    events.on('levelClear', () => this.onStageClear());
  }

  private onStageClear(): void {
    const { sim, records, progress } = this;
    const carLv = records.data.carLv;
    for (const a of ACHS) if (a.lvl !== undefined && carLv >= a.lvl) this.unlock(a.id);
    this.flawStreak = sim.lvDeaths === 0 ? this.flawStreak + 1 : 0;
    if (this.flawStreak >= FLAWLESS_GOAL) this.unlock('flawless3');
    if (sim.clearedInRun >= RUN_GOAL) this.unlock('run5');
    if (sim.fuel < LOW_FUEL) this.unlock('low_fuel');
    if (progress.lastClear.newBest && sim.ghost && sim.ghostOn) this.unlock('beat_ghost');
    if (sim.challengeKey !== 'N') this.unlock('code_clear');
    if (sim.carId === 'moto') this.unlock('moto_clear');
    if (unlockedCars(carLv).length >= CAR_ORDER.length) this.unlock('garage_full');
  }
}
