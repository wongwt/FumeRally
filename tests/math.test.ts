import { describe, expect, it } from 'vitest';
import { faceAngle, lerpAngle, pad6 } from '../src/core/math';

describe('math', () => {
  it('pads scores to six digits', () => {
    expect(pad6(42)).toBe('000042');
    expect(pad6(1234567)).toBe('1234567');
  });

  it('lerpAngle takes the shortest arc across the ±π seam', () => {
    const r = lerpAngle(Math.PI - 0.1, -Math.PI + 0.1, 0.5);
    expect(Math.cos(r)).toBeCloseTo(-1, 5);
  });

  it('faceAngle maps grid directions to headings', () => {
    expect(faceAngle(1, 0)).toBeCloseTo(0);
    expect(faceAngle(0, -1)).toBeCloseTo(Math.PI / 2);
  });
});
