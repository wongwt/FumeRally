import { describe, expect, it } from 'vitest';
import { GhostStore, GHOSTS_KEY, type GhostData } from '../src/storage/ghosts';
import { Prefs } from '../src/storage/prefs';
import { Records, RECORDS_KEY, RECORDS_VERSION, stageKey, type RunRow } from '../src/storage/records';
import { browserStorage, readJson, writeJson } from '../src/storage/storage';
import { MemoryStorage } from './helpers/storage';

const row = (s: number, l = 1, extra: Partial<RunRow> = {}): RunRow => ({
  s,
  l,
  t: 60,
  d: 1,
  c: 'sedan',
  ...extra
});

describe('storage helpers', () => {
  it('reads JSON objects and shrugs off junk', () => {
    const s = new MemoryStorage();
    expect(readJson(s, 'k')).toBeNull();
    s.map.set('k', '{"a":1}');
    expect(readJson(s, 'k')).toEqual({ a: 1 });
    s.map.set('k', 'not json');
    expect(readJson(s, 'k')).toBeNull();
    s.map.set('k', '[1,2]');
    expect(readJson(s, 'k')).toBeNull();
    s.map.set('k', '"text"');
    expect(readJson(s, 'k')).toBeNull();
  });

  it('survives blocked or missing storage', () => {
    const s = new MemoryStorage();
    s.broken = true;
    expect(readJson(s, 'k')).toBeNull();
    expect(writeJson(s, 'k', { a: 1 })).toBe(false);
    expect(readJson(null, 'k')).toBeNull();
    expect(writeJson(null, 'k', {})).toBe(false);
  });

  it('browserStorage returns null where localStorage is unavailable', () => {
    expect(browserStorage()).toBeNull(); // the test environment has none
  });
});

describe('Records', () => {
  it('starts empty and round-trips through storage', () => {
    const s = new MemoryStorage();
    const a = new Records(s);
    a.load();
    expect(a.data).toMatchObject({ v: RECORDS_VERSION, hi: 0, cleared: 0, carLv: 0, boards: {}, bestT: {} });
    a.addRun('N', row(500, 2));
    a.noteStageCleared('N', 2);
    a.setBestTime('N:2', 12.3);
    a.save();
    const b = new Records(s);
    b.load();
    expect(b.bestOf('N')).toBe(500);
    expect(b.data.cleared).toBe(2);
    expect(b.bestTime('N:2')).toBe(12.3);
    expect(b.boardOf('N')[0]).toMatchObject({ s: 500, l: 2 });
  });

  it('keeps the five best runs per board, best first', () => {
    const r = new Records(new MemoryStorage());
    r.load();
    for (const s of [100, 900, 300, 700, 500, 800, 200]) r.addRun('N', row(s));
    expect(r.boardOf('N').map((x) => x.s)).toEqual([900, 800, 700, 500, 300]);
    expect(r.bestOf('N')).toBe(900);
  });

  it('ignores zero-score runs on the board but still saves', () => {
    const r = new Records(new MemoryStorage());
    r.load();
    r.addRun('N', row(0));
    expect(r.boardOf('N')).toEqual([]);
  });

  it('normal mode tracks the high score separately from the board', () => {
    const r = new Records(new MemoryStorage());
    r.load();
    r.addRun('N', row(400));
    r.addRun('N', row(300));
    expect(r.data.hi).toBe(400);
    r.addRun('C:RALLY7', row(5000));
    expect(r.data.hi).toBe(400);
    expect(r.bestOf('C:RALLY7')).toBe(5000);
    expect(r.bestOf('C:OTHER')).toBe(0);
  });

  it('stage clears raise the picker limit only in normal mode, but unlock cars in any mode', () => {
    const r = new Records(new MemoryStorage());
    r.load();
    r.noteStageCleared('C:RALLY7', 6);
    expect(r.data.cleared).toBe(0);
    expect(r.data.carLv).toBe(6);
    r.noteStageCleared('N', 3);
    expect(r.data.cleared).toBe(3);
    expect(r.data.carLv).toBe(6);
    r.noteStageCleared('N', 2);
    expect(r.data.cleared).toBe(3);
  });

  it('limits the number of code boards and best times, dropping the oldest', () => {
    const r = new Records(new MemoryStorage());
    r.load();
    r.addRun('N', row(1));
    for (let i = 0; i < 45; i++) r.addRun('C:' + i, row(10 + i));
    const keys = Object.keys(r.data.boards);
    expect(keys.filter((k) => k !== 'N')).toHaveLength(40);
    expect(keys).toContain('N');
    expect(r.boardOf('C:0')).toEqual([]);
    expect(r.boardOf('C:44')).toHaveLength(1);
    for (let i = 0; i < 305; i++) r.setBestTime('N:' + i, i);
    expect(Object.keys(r.data.bestT)).toHaveLength(300);
    expect(r.bestTime('N:0')).toBeUndefined();
  });

  it('survives corrupt data by falling back to defaults', () => {
    const s = new MemoryStorage();
    s.map.set(
      RECORDS_KEY,
      '{"hi":"lots","cleared":-5,"boards":{"N":"nope","C:X":[{"s":1,"l":2},{"s":"x"},null]},"bestT":{"a":"b","N:1":9}}'
    );
    const r = new Records(s);
    r.load();
    expect(r.data.hi).toBe(0);
    expect(r.data.cleared).toBe(0);
    expect(r.boardOf('N')).toEqual([]);
    expect(r.boardOf('C:X')).toHaveLength(1);
    expect(r.data.bestT).toEqual({ 'N:1': 9 });
  });

  it('loads the PoC format (no version, legacy runs) and writes the current one', () => {
    const s = new MemoryStorage();
    s.map.set(
      RECORDS_KEY,
      JSON.stringify({
        hi: 1200,
        cleared: 4,
        carLv: 6,
        runs: [{ s: 1200, l: 4, t: 90, d: 5 }],
        bestT: { 'N:1': 20.5 },
        ach: { t3: 99 },
        st: { puff: 7 }
      })
    );
    const r = new Records(s);
    r.load();
    expect(r.data).toMatchObject({ hi: 1200, cleared: 4, carLv: 6, ach: { t3: 99 }, st: { puff: 7 } });
    expect(r.boardOf('N')).toHaveLength(1);
    r.save();
    expect(JSON.parse(s.map.get(RECORDS_KEY) as string).v).toBe(RECORDS_VERSION);
  });

  it('carLv never falls below cleared', () => {
    const s = new MemoryStorage();
    s.map.set(RECORDS_KEY, '{"cleared":7,"carLv":2}');
    const r = new Records(s);
    r.load();
    expect(r.data.carLv).toBe(7);
  });

  it('works without any storage', () => {
    const r = new Records(null);
    r.load();
    expect(() => r.addRun('N', row(5))).not.toThrow();
    expect(r.bestOf('N')).toBe(5);
  });

  it('builds stage keys with a car suffix for non-default cars', () => {
    expect(stageKey('N', 3, 'sedan')).toBe('N:3');
    expect(stageKey('C:AB', 3, 'moto')).toBe('C:AB:3@moto');
  });
});

const ghost = (t: number, n = 10): GhostData => ({
  t,
  p: Array.from({ length: n * 2 }, (_, i) => i),
  g: [1, 2]
});

describe('GhostStore', () => {
  it('saves, reloads and returns ghosts that are long enough to replay', () => {
    const s = new MemoryStorage();
    const a = new GhostStore(s);
    a.save('N:1', ghost(12.3));
    a.save('N:2', { t: 5, p: [1, 2], g: [] }); // too short to be useful
    const b = new GhostStore(s);
    b.load();
    expect(b.get('N:1')?.t).toBe(12.3);
    expect(b.get('N:2')).toBeNull();
    expect(b.get('N:9')).toBeNull();
  });

  it('keeps only the newest 30 ghosts', () => {
    const g = new GhostStore(new MemoryStorage());
    for (let i = 0; i < 35; i++) g.save('N:' + i, ghost(i));
    expect(g.size).toBe(30);
    expect(g.get('N:0')).toBeNull();
    expect(g.get('N:34')).not.toBeNull();
  });

  it('replacing a ghost makes it the newest', () => {
    const g = new GhostStore(new MemoryStorage());
    for (let i = 0; i < 30; i++) g.save('N:' + i, ghost(i));
    g.save('N:0', ghost(0.5));
    g.save('N:new', ghost(1));
    expect(g.get('N:0')?.t).toBe(0.5);
    expect(g.get('N:1')).toBeNull();
  });

  it('drops the oldest ghosts when the browser quota is hit, keeping the new one', () => {
    const s = new MemoryStorage();
    const g = new GhostStore(s);
    for (let i = 0; i < 6; i++) g.save('N:' + i, ghost(i, 50));
    const oneGhost = JSON.stringify({ x: ghost(0, 50) }).length;
    s.maxValueLength = oneGhost * 3; // room for about three
    g.save('N:6', ghost(6, 50));
    expect(g.get('N:6')).not.toBeNull();
    expect(g.get('N:0')).toBeNull();
    expect(g.size).toBeLessThanOrEqual(3);
    expect(s.map.get(GHOSTS_KEY)).toBeDefined();
  });

  it('gives up quietly when even one ghost does not fit', () => {
    const s = new MemoryStorage();
    s.maxValueLength = 10;
    const g = new GhostStore(s);
    expect(() => g.save('N:1', ghost(1, 50))).not.toThrow();
  });

  it('ignores malformed saved ghosts', () => {
    const s = new MemoryStorage();
    s.map.set(GHOSTS_KEY, JSON.stringify({ 'N:1': { t: 1, p: ['a'], g: [] }, 'N:2': ghost(2), 'N:3': 5 }));
    const g = new GhostStore(s);
    g.load();
    expect(g.size).toBe(1);
  });
});

describe('Prefs', () => {
  it('defaults, then round-trips', () => {
    const s = new MemoryStorage();
    const a = new Prefs(s);
    a.load();
    expect(a).toMatchObject({ mode: 'normal', code: '', ghostOn: true, car: 'sedan', view: 'scroll' });
    a.mode = 'custom';
    a.code = 'RALLY7';
    a.ghostOn = false;
    a.car = 'moto';
    a.view = 'full';
    a.saveChallenge();
    a.saveView();
    const b = new Prefs(s);
    b.load();
    expect(b).toMatchObject({ mode: 'custom', code: 'RALLY7', ghostOn: false, car: 'moto', view: 'full' });
  });

  it('rejects invalid saved values', () => {
    const s = new MemoryStorage();
    s.map.set('fumeRallyChallenge', '{"mode":"hard","code":"a b!","ghost":"yes","car":5}');
    s.map.set('fumeRallyView', 'sideways');
    const p = new Prefs(s);
    p.load();
    expect(p).toMatchObject({ mode: 'normal', code: 'AB', ghostOn: true, car: 'sedan', view: 'scroll' });
  });

  it('works with blocked storage', () => {
    const s = new MemoryStorage();
    s.broken = true;
    const p = new Prefs(s);
    expect(() => {
      p.load();
      p.saveChallenge();
      p.saveView();
    }).not.toThrow();
  });
});
