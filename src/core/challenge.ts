import { fnv1a } from './rng';

/**
 * Challenge modes. A level code fixes the seed of every maze, rock and gem layout in a run, so
 * anyone entering the same code plays the same maps. 'normal' uses the built-in fixed maps.
 */
export type ChallengeMode = 'normal' | 'daily' | 'custom';

export const CHALLENGE_MODES: readonly ChallengeMode[] = ['normal', 'daily', 'custom'];
export const isChallengeMode = (v: unknown): v is ChallengeMode =>
  CHALLENGE_MODES.includes(v as ChallengeMode);

/** Letters and digits without the look-alikes 0/O and 1/I. */
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const MIN_CODE_LENGTH = 2;
export const MAX_CODE_LENGTH = 12;

/** Board key of the normal mode. */
export const NORMAL_KEY = 'N';

/** Local calendar date as YYYYMMDD. */
export function todayDate(now: Date = new Date()): string {
  return (
    now.getFullYear() + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0')
  );
}

/** The daily code: a hash of the local date, six characters, so it cannot be guessed in advance. */
export function todayCode(now: Date = new Date()): string {
  let h = fnv1a('FUME-RALLY-DAILY-' + todayDate(now));
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  let code = '';
  for (let i = 0; i < 6; i++) code += CODE_ALPHABET[(h >>> (i * 5)) & 31];
  return code;
}

/** Upper-cases and strips everything but letters, digits, - _ and CJK; limits the length. */
export function normCode(s: unknown): string {
  return String(s ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9_\-一-鿿]/g, '')
    .slice(0, MAX_CODE_LENGTH);
}

export function randomCode(rand: () => number = Math.random): string {
  let code = '';
  for (let i = 0; i < 6; i++) code += CODE_ALPHABET[Math.floor(rand() * CODE_ALPHABET.length)];
  return code;
}

/** The code in effect for a mode ('' for normal). */
export function activeCode(mode: ChallengeMode, custom: string, now: Date = new Date()): string {
  return mode === 'daily' ? todayCode(now) : mode === 'custom' ? normCode(custom) : '';
}

/** Key under which a mode's scores are stored: 'N' or 'C:<code>'. */
export function challengeKey(mode: ChallengeMode, custom: string, now: Date = new Date()): string {
  return mode === 'normal' ? NORMAL_KEY : 'C:' + activeCode(mode, custom, now);
}

/** Level seed for a board key; 0 selects the built-in maps. */
export function challengeSeed(key: string): number {
  return key === NORMAL_KEY ? 0 : fnv1a(key.slice(2));
}

/** A custom code must have at least two characters before a game can start. */
export function isChallengeValid(mode: ChallengeMode, custom: string): boolean {
  return mode !== 'custom' || normCode(custom).length >= MIN_CODE_LENGTH;
}
