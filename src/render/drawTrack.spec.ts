import { describe, expect, it } from 'vitest';
import { formatClock } from './drawTrack';

describe('formatClock', () => {
  it('formats minutes, seconds and hundredths', () => {
    expect(formatClock(0)).toBe('0:00.00');
    expect(formatClock(10.745)).toBe('0:10.74');
    expect(formatClock(75.5)).toBe('1:15.50');
    expect(formatClock(-3)).toBe('0:00.00');
  });
});
