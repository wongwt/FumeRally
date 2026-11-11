import { describe, expect, it } from 'vitest';
import {
  CODE_ALPHABET,
  activeCode,
  challengeKey,
  challengeSeed,
  isChallengeMode,
  isChallengeValid,
  normCode,
  randomCode,
  todayCode,
  todayDate
} from '../src/core/challenge';
import { fnv1a, mulberry32 } from '../src/core/rng';
import poc from './fixtures/poc-challenge.json';

describe('daily code', () => {
  it('matches the PoC for several dates', () => {
    const dates: [number, number, number][] = [
      [2026, 0, 1],
      [2026, 10, 12],
      [2027, 1, 28],
      [2026, 11, 31]
    ];
    for (const [y, m, d] of dates) {
      const when = new Date(y, m, d, 12);
      const ref = (poc.daily as Record<string, { date: string; code: string }>)[todayDate(when)];
      expect(ref).toBeDefined();
      expect(todayDate(when)).toBe(ref?.date);
      expect(todayCode(when)).toBe(ref?.code);
    }
  });

  it('is six characters from the alphabet and changes day to day', () => {
    const a = todayCode(new Date(2026, 5, 1, 9));
    const b = todayCode(new Date(2026, 5, 2, 9));
    expect(a).toMatch(new RegExp(`^[${CODE_ALPHABET}]{6}$`));
    expect(a).not.toBe(b);
  });

  it('is stable for the whole day', () => {
    expect(todayCode(new Date(2026, 5, 1, 0, 0, 1))).toBe(todayCode(new Date(2026, 5, 1, 23, 59, 59)));
  });

  it('pads single-digit months and days', () => {
    expect(todayDate(new Date(2026, 0, 5))).toBe('20260105');
  });
});

describe('normCode', () => {
  it('matches the PoC', () => {
    for (const [input, expected] of Object.entries(poc.norm)) expect(normCode(input)).toBe(expected);
  });

  it('copes with non-strings', () => {
    expect(normCode(undefined)).toBe('');
    expect(normCode(null)).toBe('');
    expect(normCode(42)).toBe('42');
  });
});

describe('keys, seeds and validity', () => {
  const day = new Date(2026, 10, 12, 8);

  it('normal mode uses the built-in maps', () => {
    expect(challengeKey('normal', 'IGNORED', day)).toBe('N');
    expect(challengeSeed('N')).toBe(0);
    expect(activeCode('normal', 'x', day)).toBe('');
  });

  it('daily mode is keyed by the date-hashed code', () => {
    expect(challengeKey('daily', '', day)).toBe('C:' + todayCode(day));
    expect(challengeSeed('C:XL38QJ')).toBe(fnv1a('XL38QJ'));
  });

  it('custom mode normalises the entered code', () => {
    expect(challengeKey('custom', ' rally7 ', day)).toBe('C:RALLY7');
    expect(challengeSeed('C:RALLY7')).toBe(2342527264);
  });

  it('requires a custom code of at least two characters', () => {
    expect(isChallengeValid('custom', '')).toBe(false);
    expect(isChallengeValid('custom', 'a!')).toBe(false);
    expect(isChallengeValid('custom', 'ab')).toBe(true);
    expect(isChallengeValid('normal', '')).toBe(true);
    expect(isChallengeValid('daily', '')).toBe(true);
  });

  it('recognises modes', () => {
    expect(isChallengeMode('daily')).toBe(true);
    expect(isChallengeMode('hard')).toBe(false);
  });
});

describe('randomCode', () => {
  it('makes six characters without look-alikes', () => {
    const rand = mulberry32(3);
    for (let i = 0; i < 50; i++) expect(randomCode(rand)).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
  });
});
