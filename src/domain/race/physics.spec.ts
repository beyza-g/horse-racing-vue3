import { describe, expect, it } from 'vitest';
import { conditionStaminaWeakness, OPTIMAL_CONDITION } from '../condition';
import { createRng } from '../random';
import {
  approachSpeed,
  conditionPace,
  cruisingSpeed,
  defaultProfile,
  fatigueFactor,
  interpolateCrossingTime,
  paceNoise,
  PHYSICS,
  pullUpTargetSpeed,
  type RunnerProfile,
} from './physics';

const profile = (condition: number): RunnerProfile => ({
  condition,
  baseSpeed: cruisingSpeed(condition, 0),
  staminaWeakness: conditionStaminaWeakness(condition),
  startDelay: 0,
  noisePhases: [0, 0, 0],
});

describe('cruisingSpeed', () => {
  it('peaks at the optimal condition, not at the top of the scale', () => {
    const peak = cruisingSpeed(OPTIMAL_CONDITION, 0);
    expect(peak).toBeCloseTo(PHYSICS.peakSpeed, 2);
    for (const condition of [1, 20, 40, 60, 80, 100]) {
      expect(cruisingSpeed(condition, 0)).toBeLessThanOrEqual(peak);
    }
    expect(cruisingSpeed(100, 0)).toBeLessThan(cruisingSpeed(1, 0));
  });

  it('adds the form jitter linearly', () => {
    expect(cruisingSpeed(60, 2) - cruisingSpeed(60, 0)).toBeCloseTo(2, 10);
  });
});

describe('defaultProfile', () => {
  it('draws jitter, delay and phases within their bounds', () => {
    const rng = createRng(4);
    for (let i = 0; i < 500; i++) {
      const result = defaultProfile(50, rng);
      const jitter = result.baseSpeed - cruisingSpeed(50, 0);
      expect(result.staminaWeakness).toBe(conditionStaminaWeakness(50));
      expect(Math.abs(jitter)).toBeLessThanOrEqual(PHYSICS.baseSpeedJitter);
      expect(result.startDelay).toBeGreaterThanOrEqual(0);
      expect(result.startDelay).toBeLessThan(PHYSICS.maxStartDelay);
      for (const phase of result.noisePhases) {
        expect(phase).toBeGreaterThanOrEqual(0);
        expect(phase).toBeLessThan(Math.PI * 2);
      }
    }
  });

  it('is deterministic and frozen', () => {
    const a = defaultProfile(70, createRng(8));
    expect(defaultProfile(70, createRng(8))).toEqual(a);
    expect(Object.isFrozen(a)).toBe(true);
    expect(Object.isFrozen(a.noisePhases)).toBe(true);
  });
});

describe('fatigueFactor', () => {
  it('is 1 up to the onset point', () => {
    for (const progress of [0, 0.25, PHYSICS.fatigueOnset]) {
      expect(fatigueFactor(progress, 1, 2200)).toBe(1);
    }
  });

  it('never affects a horse with no stamina weakness', () => {
    expect(fatigueFactor(1, 0, 2200)).toBe(1);
  });

  it('reaches its documented maximum for weakness 1 at the line of the longest race', () => {
    const expected = 1 - PHYSICS.fatigueStrength * 1.2;
    expect(fatigueFactor(1, 1, 2200)).toBeCloseTo(expected, 10);
  });

  it('decreases monotonically with progress after the onset', () => {
    let previous = 1;
    for (let progress = 0.5; progress <= 1; progress += 0.05) {
      const value = fatigueFactor(progress, 0.6, 1800);
      expect(value).toBeLessThanOrEqual(previous);
      previous = value;
    }
  });

  it('bites harder on longer races and weaker stamina', () => {
    expect(fatigueFactor(0.9, 0.6, 2200)).toBeLessThan(fatigueFactor(0.9, 0.6, 1200));
    expect(fatigueFactor(0.9, 0.9, 1600)).toBeLessThan(fatigueFactor(0.9, 0.2, 1600));
  });

  it('clamps progress past the line', () => {
    expect(fatigueFactor(1.4, 0.5, 2000)).toBe(fatigueFactor(1, 0.5, 2000));
  });
});

describe('paceNoise', () => {
  it('stays within [-1, 1]', () => {
    for (let t = 0; t < 60; t += 0.1) {
      const value = paceNoise(t, [0.3, 2, 5]);
      expect(Math.abs(value)).toBeLessThanOrEqual(1);
    }
  });

  it('is a pure function of time and phases', () => {
    expect(paceNoise(3.21, [1, 2, 3])).toBe(paceNoise(3.21, [1, 2, 3]));
    expect(paceNoise(0, [0, 0, 0])).toBe(0);
  });
});

describe('conditionPace', () => {
  it('equals cruising speed with no noise and no fatigue', () => {
    expect(conditionPace(profile(60), 0.2, 0, 1400)).toBeCloseTo(cruisingSpeed(60, 0), 10);
  });

  it('is fastest for a race-fit horse late in a long race', () => {
    const fit = conditionPace(profile(OPTIMAL_CONDITION), 0.9, 0, 2200);
    expect(fit).toBeGreaterThan(conditionPace(profile(1), 0.9, 0, 2200));
    expect(fit).toBeGreaterThan(conditionPace(profile(100), 0.9, 0, 2200));
  });

  it('stays positive for the worst case', () => {
    for (const condition of [1, 100]) {
      const worst: RunnerProfile = {
        ...profile(condition),
        baseSpeed: cruisingSpeed(condition, -PHYSICS.baseSpeedJitter),
      };
      for (let t = 0; t < 30; t += 0.05) {
        expect(conditionPace(worst, 1, t, 2200)).toBeGreaterThan(0);
      }
    }
  });
});

describe('approachSpeed', () => {
  it('uses the rise rate when accelerating and the fall rate when slowing', () => {
    expect(approachSpeed(0, 100, 0.1, 1, 0.5)).toBeCloseTo(10);
    expect(approachSpeed(100, 0, 0.1, 1, 0.5)).toBeCloseTo(95);
  });

  it('never overshoots the target, even for a huge step', () => {
    expect(approachSpeed(0, 100, 50, 1.1, 0.8)).toBe(100);
    expect(approachSpeed(100, 20, 50, 1.1, 0.8)).toBe(20);
  });

  it('is stable at the target', () => {
    expect(approachSpeed(42, 42, 0.01, 1, 1)).toBe(42);
  });
});

describe('pullUpTargetSpeed', () => {
  it('starts at a share of cruising speed and fades to zero', () => {
    expect(pullUpTargetSpeed(100, 0, 1200)).toBeCloseTo(100 * PHYSICS.pullUpSpeedRatio);
    expect(pullUpTargetSpeed(100, 60, 1200)).toBeCloseTo(50 * PHYSICS.pullUpSpeedRatio);
    expect(pullUpTargetSpeed(100, 120, 1200)).toBe(0);
    expect(pullUpTargetSpeed(100, 500, 1200)).toBe(0);
  });
});

describe('interpolateCrossingTime', () => {
  it('interpolates linearly within the step', () => {
    expect(interpolateCrossingTime(10, 0.01, 1195, 1205, 1200)).toBeCloseTo(10.005, 12);
  });

  it('handles landing exactly on the line', () => {
    expect(interpolateCrossingTime(4, 0.5, 1190, 1200, 1200)).toBeCloseTo(4.5, 12);
  });

  it('handles starting exactly on the line', () => {
    expect(interpolateCrossingTime(4, 0.5, 1200, 1210, 1200)).toBe(4);
  });

  it.each([
    [1190, 1195],
    [1205, 1210],
    [1200, 1200],
    [1210, 1190],
  ])('rejects a step from %s to %s that does not cross 1200', (from, to) => {
    expect(() => interpolateCrossingTime(0, 0.1, from, to, 1200)).toThrow(
      expect.objectContaining({ code: 'INVALID_ARGUMENT' }),
    );
  });
});
