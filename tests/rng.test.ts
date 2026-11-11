import { describe, expect, it } from 'vitest';
import { fnv1a, mulberry32, shuffle } from '../src/core/rng';

describe('rng', () => {
  it('mulberry32 is deterministic and stays in [0, 1)', () => {
    const a = mulberry32(123);
    const b = mulberry32(123);
    for (let i = 0; i < 1000; i++) {
      const v = a();
      expect(v).toBe(b());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('different seeds give different sequences', () => {
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });

  it('fnv1a matches known vectors', () => {
    expect(fnv1a('')).toBe(0x811c9dc5);
    expect(fnv1a('a')).toBe(0xe40c292c);
    expect(fnv1a('foobar')).toBe(0xbf9cf968);
  });

  it('shuffle permutes deterministically', () => {
    const base = Array.from({ length: 20 }, (_, i) => i);
    const one = shuffle([...base], mulberry32(7));
    const two = shuffle([...base], mulberry32(7));
    expect(one).toEqual(two);
    expect([...one].sort((x, y) => x - y)).toEqual(base);
    expect(one).not.toEqual(base);
  });
});
