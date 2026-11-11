import type { StorageLike } from '../../src/storage/storage';

/** In-memory storage with an optional size cap, to exercise quota handling. */
export class MemoryStorage implements StorageLike {
  readonly map = new Map<string, string>();
  /** Writes whose value is longer than this throw, like a full browser quota. */
  maxValueLength = Infinity;
  broken = false;

  getItem(key: string): string | null {
    if (this.broken) throw new Error('storage blocked');
    return this.map.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (this.broken) throw new Error('storage blocked');
    if (value.length > this.maxValueLength) throw new Error('QuotaExceededError');
    this.map.set(key, value);
  }
}
