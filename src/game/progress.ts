import type { Sim } from '../sim/sim';
import type { GhostStore } from '../storage/ghosts';
import { stageKey, type Records } from '../storage/records';

/** What the stage-clear screen says about the run's time. */
export interface ClearInfo {
  /** The best time before this clear, if one existed. */
  bestPrev: number | null;
  /** This clear set a new best time (and replaced the ghost). */
  newBest: boolean;
}

/**
 * Turns what the simulation announces into saved progress: stages cleared, best times, ghosts and
 * leaderboard runs. It also hands the right ghost to each stage as it loads.
 */
export class Progress {
  lastClear: ClearInfo = { bestPrev: null, newBest: false };

  constructor(
    private readonly sim: Sim,
    readonly records: Records,
    readonly ghosts: GhostStore
  ) {
    sim.events.on('levelLoaded', ({ level, bonus }) => {
      sim.ghost = bonus ? null : ghosts.get(this.stageKey(level));
    });
    sim.events.on('levelClear', (e) => this.onClear(e));
    sim.events.on('gameOver', () => this.onGameOver());
  }

  /** Key of a stage's best time and ghost for the current board and car. */
  stageKey(level: number): string {
    return stageKey(this.sim.challengeKey, level, this.sim.carId);
  }

  /** The score to beat on the current board. */
  best(): number {
    return this.records.bestOf(this.sim.challengeKey);
  }

  private onClear(e: { time: number; flawless: boolean; path: number[]; gems: number[] }): void {
    const { sim, records } = this;
    records.noteStageCleared(sim.challengeKey, sim.level);
    if (sim.challengeKey === 'N') records.data.hi = Math.max(records.data.hi, sim.hi);
    const key = this.stageKey(sim.level);
    const prev = records.bestTime(key);
    this.lastClear = { bestPrev: prev ?? null, newBest: false };
    // only flawless clears (no car lost on this stage) may set the best time and the ghost
    if (e.flawless && (prev === undefined || e.time < prev) && e.path.length >= 4) {
      const t = Math.round(e.time * 10) / 10;
      records.setBestTime(key, t);
      this.ghosts.save(key, { t, p: e.path, g: e.gems });
      this.lastClear.newBest = true;
    }
    records.save();
  }

  private onGameOver(): void {
    const { sim } = this;
    this.records.addRun(sim.challengeKey, {
      s: sim.score,
      l: sim.clearedInRun,
      t: Math.round(sim.runTime * 10) / 10,
      d: Date.now(),
      c: sim.carId
    });
  }
}
