import { describe, expect, it } from 'vitest';
import { fmtTime } from '../src/core/format';

describe('fmtTime', () => {
  it('formats whole seconds', () => {
    expect(fmtTime(0)).toBe('0:00');
    expect(fmtTime(75.9)).toBe('1:15');
  });

  it('formats tenths with zero padding', () => {
    expect(fmtTime(5.04, true)).toBe('0:05.0');
    expect(fmtTime(61.26, true)).toBe('1:01.3');
  });

  it('shows a dash for missing values', () => {
    expect(fmtTime(null)).toBe('—');
    expect(fmtTime(NaN)).toBe('—');
  });
});
