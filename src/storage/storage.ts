/** The subset of the Web Storage API the game uses. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** localStorage if the browser allows it (it can throw in private windows or when blocked). */
export function browserStorage(): StorageLike | null {
  try {
    const s = globalThis.localStorage;
    // touching it is what throws in locked-down browsers
    s.getItem('fumeRally:probe');
    return s;
  } catch {
    return null;
  }
}

/** Reads and parses JSON, returning null for anything missing, unreadable or not an object. */
export function readJson(storage: StorageLike | null, key: string): Record<string, unknown> | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/** Writes JSON; returns false when the browser refuses (quota, privacy mode). */
export function writeJson(storage: StorageLike | null, key: string, value: unknown): boolean {
  if (!storage) return false;
  try {
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
