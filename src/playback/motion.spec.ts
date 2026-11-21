import { describe, expect, it } from 'vitest';
import { createRace } from '../domain';
import { LINEUP_1_TO_10, makeRoster, makeRound } from '../domain/__fixtures__/roster';
import {
  advanceStridePhase,
  createMotionTracker,
  driveIntensity,
  gallopAmplitude,
  initialStridePhase,
  MOTION,
  nameTagAlpha,
} from './motion';

describe('gallopAmplitude', () => {
  it('is 0 standing still, proportional while accelerating and capped at 1', () => {
    expect(gallopAmplitude(0)).toBe(0);
    expect(gallopAmplitude(MOTION.fullGallopSpeed / 2)).toBeCloseTo(0.5);
    expect(gallopAmplitude(MOTION.fullGallopSpeed)).toBe(1);
    expect(gallopAmplitude(500)).toBe(1);
    expect(gallopAmplitude(-10)).toBe(0);
  });
});

describe('advanceStridePhase', () => {
  it('advances by distance over stride length and wraps into [0, 1)', () => {
    expect(advanceStridePhase(0, MOTION.strideLength, 0.5)).toBeCloseTo(0.5);
    expect(advanceStridePhase(0.75, MOTION.strideLength, 0.5)).toBeCloseTo(0.25);
    expect(advanceStridePhase(0.2, MOTION.strideLength * 10, 1)).toBeCloseTo(0.2);
  });

  it('does not move when paused (simDt 0) or standing still', () => {
    expect(advanceStridePhase(0.3, 100, 0)).toBe(0.3);
    expect(advanceStridePhase(0.3, 0, 1)).toBe(0.3);
    expect(advanceStridePhase(0.3, -50, 1)).toBe(0.3);
  });

  it('moves twice as far per frame at 2x (sim dt doubles)', () => {
    const at1x = advanceStridePhase(0, 84, 1 / 60);
    const at2x = advanceStridePhase(0, 84, 2 / 60);
    expect(at2x).toBeCloseTo(at1x * 2, 12);
  });
});

describe('driveIntensity', () => {
  it('is 0 before the final stretch and ramps to 1', () => {
    expect(driveIntensity(0.5, null)).toBe(0);
    expect(driveIntensity(MOTION.driveStart, null)).toBe(0);
    expect(driveIntensity(MOTION.driveStart + MOTION.driveRamp / 2, null)).toBeCloseTo(0.5);
    expect(driveIntensity(0.95, null)).toBe(1);
  });

  it('relaxes over the fade window after the finish', () => {
    expect(driveIntensity(1, 0)).toBe(1);
    expect(driveIntensity(1, MOTION.driveFadeSeconds / 2)).toBeCloseTo(0.5);
    expect(driveIntensity(1, MOTION.driveFadeSeconds)).toBe(0);
    expect(driveIntensity(1, 99)).toBe(0);
  });
});

describe('nameTagAlpha', () => {
  it('is visible while racing and fades after the finish', () => {
    expect(nameTagAlpha(null)).toBe(1);
    expect(nameTagAlpha(0)).toBe(1);
    expect(nameTagAlpha(MOTION.tagFadeSeconds / 2)).toBeCloseTo(0.5);
    expect(nameTagAlpha(MOTION.tagFadeSeconds)).toBe(0);
  });
});

describe('initialStridePhase', () => {
  it('staggers the lanes within [0, 1)', () => {
    const phases = Array.from({ length: 10 }, (_, i) => initialStridePhase(i));
    expect(new Set(phases).size).toBe(10);
    for (const phase of phases) {
      expect(phase).toBeGreaterThanOrEqual(0);
      expect(phase).toBeLessThan(1);
    }
  });
});

describe('createMotionTracker', () => {
  const roster = makeRoster((id) => id * 5);

  it('starts every lane at its staggered phase with no finish', () => {
    const race = createRace(makeRound(LINEUP_1_TO_10), roster);
    const tracker = createMotionTracker(10);
    for (let i = 0; i < 10; i++) {
      expect(tracker.runner(race, i)).toEqual({
        stridePhase: initialStridePhase(i),
        amplitude: 0,
        drive: 0,
        tagAlpha: 1,
        sinceFinish: null,
      });
    }
  });

  it('times the post-finish fade on presentation time only', () => {
    const race = createRace(makeRound(LINEUP_1_TO_10), roster);
    const tracker = createMotionTracker(10);
    race.runToCompletion();
    tracker.advance(race, 0, 0.1);
    expect(tracker.runner(race, 0).sinceFinish).toBe(0);
    tracker.advance(race, 0.5, 0.1);
    expect(tracker.runner(race, 0).sinceFinish).toBeCloseTo(0.1);
    for (let i = 0; i < 100; i++) tracker.advance(race, 0, 0);
    expect(tracker.runner(race, 0).sinceFinish).toBeCloseTo(0.1);
  });

  it('returns a neutral motion for an empty lane and resets cleanly', () => {
    const race = createRace(makeRound(LINEUP_1_TO_10), roster);
    const tracker = createMotionTracker(10);
    expect(tracker.runner(race, 42).amplitude).toBe(0);
    race.tick(240);
    tracker.advance(race, 2, 2);
    tracker.reset();
    expect(tracker.runner(race, 3).stridePhase).toBe(initialStridePhase(3));
  });
});
