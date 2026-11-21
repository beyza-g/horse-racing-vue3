import { describe, expect, it } from 'vitest';
import {
  CONDITION_MAX,
  CONDITION_MIN,
  HORSE_COUNT,
  ROUND_COUNT,
  ROUND_DISTANCES,
  RUNNERS_PER_ROUND,
} from './constants';

describe('domain constants', () => {
  it('defines a stable of 20 horses with 10 runners per round', () => {
    expect(HORSE_COUNT).toBe(20);
    expect(RUNNERS_PER_ROUND).toBe(10);
    expect(RUNNERS_PER_ROUND).toBeLessThanOrEqual(HORSE_COUNT);
  });

  it('defines six rounds from 1200m to 2200m in 200m steps', () => {
    expect(ROUND_COUNT).toBe(6);
    expect(ROUND_DISTANCES).toEqual([1200, 1400, 1600, 1800, 2000, 2200]);
  });

  it('bounds the condition score to 1-100', () => {
    expect(CONDITION_MIN).toBe(1);
    expect(CONDITION_MAX).toBe(100);
  });
});
