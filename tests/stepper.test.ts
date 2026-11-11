import { describe, expect, it } from 'vitest';
import { FixedStepper } from '../src/sim/stepper';

describe('FixedStepper', () => {
  it('runs the same number of steps regardless of how frames are sliced', () => {
    const count = (frame: number): number => {
      const s = new FixedStepper(1 / 120, 1);
      let n = 0;
      for (let t = 0; t < 2 - 1e-9; t += frame) n += s.advance(frame, () => n);
      return n;
    };
    expect(count(1 / 60)).toBe(240);
    expect(count(1 / 144)).toBeGreaterThanOrEqual(239);
    expect(count(1 / 144)).toBeLessThanOrEqual(240);
  });

  it('clamps huge frames', () => {
    const s = new FixedStepper(1 / 100, 0.1);
    expect(s.advance(5, () => {})).toBe(10);
  });

  it('ignores negative time and always passes the fixed step', () => {
    const s = new FixedStepper(0.01, 0.1);
    const seen: number[] = [];
    s.advance(-1, (dt) => seen.push(dt));
    s.advance(0.035, (dt) => seen.push(dt));
    expect(seen).toEqual([0.01, 0.01, 0.01]);
  });
});
