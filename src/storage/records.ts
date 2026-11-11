import { NORMAL_KEY } from '../core/challenge';
import { readJson, writeJson, type StorageLike } from './storage';

export const RECORDS_KEY = 'fumeRallyRec';
/** Bump when the saved shape changes and add a step to `migrate`. */
export const RECORDS_VERSION = 1;

const BOARD_SIZE = 5;
const MAX_CODE_BOARDS = 40;
const MAX_BEST_TIMES = 300;

/** One finished run on a leaderboard. */
export interface RunRow {
  /** score */
  s: number;
  /** stages cleared */
  l: number;
  /** run length in seconds */
  t: number;
  /** date (ms since epoch) */
  d: number;
  /** car id */
  c?: string;
}

export interface RecordsData {
  v: number;
  /** Best score in normal mode. */
  hi: number;
  /** Highest stage cleared in normal mode; the start-stage picker allows one more. */
  cleared: number;
  /** Highest stage cleared in any mode; unlocks cars. */
  carLv: number;
  /** Top runs per board: 'N' or 'C:<code>'. */
  boards: Record<string, RunRow[]>;
  /** Fastest flawless clear per '<board>:<stage>[@car]', in seconds. */
  bestT: Record<string, number>;
  /** Unlocked achievements: id → timestamp. */
  ach: Record<string, number>;
  /** Lifetime counters for achievements. */
  st: Record<string, number>;
  achLast?: string;
}

const emptyData = (): RecordsData => ({
  v: RECORDS_VERSION,
  hi: 0,
  cleared: 0,
  carLv: 0,
  boards: {},
  bestT: {},
  ach: {},
  st: {}
});

const isRow = (r: unknown): r is RunRow =>
  !!r && typeof r === 'object' && Number.isFinite((r as RunRow).s) && Number.isFinite((r as RunRow).l);
const num = (v: unknown): number => (Number.isFinite(Number(v)) ? Number(v) : 0);

/**
 * Upgrades saved data from older versions. Version 0 is the PoC's format (no `v` field, and an old
 * `runs` list instead of `boards`), which is otherwise the same shape.
 */
function migrate(raw: Record<string, unknown>): Record<string, unknown> {
  const out = { ...raw };
  if (out.v === undefined) {
    if (!out.boards && Array.isArray(out.runs)) out.boards = { [NORMAL_KEY]: out.runs };
    out.v = 1;
  }
  return out;
}

/** Scores, progress and best times, persisted to storage. */
export class Records {
  data: RecordsData = emptyData();

  constructor(private readonly storage: StorageLike | null) {}

  load(): void {
    const raw = readJson(this.storage, RECORDS_KEY);
    const d = emptyData();
    if (raw) {
      const o = migrate(raw);
      d.hi = Math.max(0, num(o.hi));
      d.cleared = Math.max(0, num(o.cleared));
      d.carLv = Math.max(d.cleared, num(o.carLv));
      if (o.boards && typeof o.boards === 'object') {
        for (const [k, rows] of Object.entries(o.boards))
          if (Array.isArray(rows)) d.boards[k] = rows.filter(isRow).slice(0, BOARD_SIZE);
      }
      if (o.bestT && typeof o.bestT === 'object') {
        for (const [k, v] of Object.entries(o.bestT)) if (Number.isFinite(v)) d.bestT[k] = Number(v);
      }
      if (o.ach && typeof o.ach === 'object') {
        for (const [k, v] of Object.entries(o.ach)) if (Number.isFinite(v)) d.ach[k] = Number(v);
      }
      if (o.st && typeof o.st === 'object') {
        for (const [k, v] of Object.entries(o.st)) if (Number.isFinite(v)) d.st[k] = Math.max(0, Number(v));
      }
      if (typeof o.achLast === 'string') d.achLast = o.achLast;
    }
    this.data = d;
  }

  save(): void {
    writeJson(this.storage, RECORDS_KEY, this.data);
  }

  boardOf(key: string): RunRow[] {
    return this.data.boards[key] ?? [];
  }

  /** The score to beat on a board: the saved best in normal mode, the top row for a code. */
  bestOf(key: string): number {
    if (key === NORMAL_KEY) return this.data.hi;
    return this.boardOf(key)[0]?.s ?? 0;
  }

  /** Adds a finished run to a board (top five by score) and, in normal mode, updates the best score. */
  addRun(key: string, row: RunRow): void {
    if (row.s > 0) {
      const rows = this.boardOf(key)
        .concat([row])
        .sort((a, b) => b.s - a.s)
        .slice(0, BOARD_SIZE);
      this.setBoard(key, rows);
    }
    if (key === NORMAL_KEY) this.data.hi = Math.max(this.data.hi, row.s);
    this.save();
  }

  /** Replaces a board, keeping at most 40 code boards (the least recently written are dropped). */
  private setBoard(key: string, rows: RunRow[]): void {
    delete this.data.boards[key];
    this.data.boards[key] = rows;
    const codeBoards = Object.keys(this.data.boards).filter((k) => k !== NORMAL_KEY);
    while (codeBoards.length > MAX_CODE_BOARDS) delete this.data.boards[codeBoards.shift() as string];
  }

  /** A stage was cleared. Normal mode moves the picker's limit; any mode counts towards car unlocks. */
  noteStageCleared(boardKey: string, level: number): void {
    if (boardKey === NORMAL_KEY) this.data.cleared = Math.max(this.data.cleared, level);
    this.data.carLv = Math.max(this.data.carLv, level);
  }

  bestTime(stageKey: string): number | undefined {
    return this.data.bestT[stageKey];
  }

  setBestTime(stageKey: string, seconds: number): void {
    delete this.data.bestT[stageKey];
    this.data.bestT[stageKey] = seconds;
    const keys = Object.keys(this.data.bestT);
    while (keys.length > MAX_BEST_TIMES) delete this.data.bestT[keys.shift() as string];
  }
}

/** Key for a stage's best time and ghost: '<board>:<stage>' plus '@car' for non-default cars. */
export const stageKey = (boardKey: string, level: number, carId: string): string =>
  `${boardKey}:${level}${carId === 'sedan' ? '' : '@' + carId}`;
