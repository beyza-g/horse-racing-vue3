import { describe, expect, it } from 'vitest';
import { makeRoster, makeRound } from '../domain/__fixtures__/roster';
import { createRace, type Race, type RoundResult } from '../domain';
import { createPlaybackClock, type PlaybackClock } from './clock';
import { createFinishDrama, FINISH_DRAMA, observeFinish, slowMotionFactor } from './finishDrama';
import { createFixedStepAccumulator } from './fixedStep';

const { slowFactor, approachProgress, holdSeconds, recoverSeconds } = FINISH_DRAMA;
const FRAME = 1 / 60;

describe('slowMotionFactor', () => {
  it('runs at normal speed until the leader nears the line', () => {
    expect(slowMotionFactor(0, null)).toBe(1);
    expect(slowMotionFactor(approachProgress, null)).toBe(1);
    expect(slowMotionFactor(approachProgress + 0.001, null)).toBe(slowFactor);
  });

  it('holds the slow factor right after the win, then eases back to 1', () => {
    expect(slowMotionFactor(1, 0)).toBe(slowFactor);
    expect(slowMotionFactor(1, holdSeconds - 0.001)).toBe(slowFactor);
    expect(slowMotionFactor(1, holdSeconds + recoverSeconds / 2)).toBeCloseTo(
      (slowFactor + 1) / 2,
      12,
    );
    expect(slowMotionFactor(1, holdSeconds + recoverSeconds)).toBe(1);
    expect(slowMotionFactor(1, 100)).toBe(1);
  });

  it('never speeds up while recovering', () => {
    let previous = 0;
    for (let t = 0; t < 1.5; t += 0.01) {
      const value = slowMotionFactor(1, t);
      expect(value).toBeGreaterThanOrEqual(previous);
      expect(value).toBeLessThanOrEqual(1);
      previous = value;
    }
  });
});

describe('createFinishDrama', () => {
  const approaching = { leaderProgress: 0.99, winnerDecided: false };
  const decided = { leaderProgress: 1, winnerDecided: true };

  it('starts timing the win on the first frame that observes it', () => {
    const drama = createFinishDrama();
    expect(drama.step(FRAME, approaching)).toBe(slowFactor);
    expect(drama.sinceWin).toBeNull();
    drama.step(FRAME, decided);
    expect(drama.sinceWin).toBe(0);
    drama.step(FRAME, decided);
    expect(drama.sinceWin).toBe(FRAME);
  });

  it('freezes while it receives zero (paused) deltas', () => {
    const drama = createFinishDrama();
    drama.step(FRAME, decided);
    drama.step(0.2, decided);
    const factor = drama.step(0, decided);
    for (let i = 0; i < 1000; i++) expect(drama.step(0, decided)).toBe(factor);
    expect(drama.sinceWin).toBe(0.2);
  });

  it('returns 1 when disabled', () => {
    const drama = createFinishDrama(false);
    expect(drama.step(FRAME, approaching)).toBe(1);
    expect(drama.step(FRAME, decided)).toBe(1);
  });

  it('reset forgets the win', () => {
    const drama = createFinishDrama();
    drama.step(FRAME, decided);
    drama.reset();
    expect(drama.sinceWin).toBeNull();
  });

  it.each([-FRAME, Number.NaN, Number.POSITIVE_INFINITY])('rejects the delta %s', (dt) => {
    expect(() => createFinishDrama().step(dt, decided)).toThrow(
      expect.objectContaining({ code: 'INVALID_ARGUMENT' }),
    );
  });
});

describe('observeFinish', () => {
  it('reports leader progress clamped to 1 and whether a winner exists', () => {
    const race = createRace(makeRound([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 3), makeRoster());
    expect(observeFinish(race)).toEqual({ leaderProgress: 0, winnerDecided: false });
    race.runToCompletion();
    expect(observeFinish(race)).toEqual({ leaderProgress: 1, winnerDecided: true });
  });
});

/**
 * Pause and resume during the finish slow motion.
 *
 * Regression: the slow motion used to be timed against wall-clock time since
 * the winner crossed. Pausing stopped the race but not that timer, so after a
 * pause longer than the hold+recover window the race resumed at full speed.
 * The drama now runs on the playback clock's presentation time, which stops
 * while paused, so these runs must match an uninterrupted run exactly.
 */
describe('finish slow motion across pause and resume', () => {
  type Phase = 'approach' | 'hold' | 'recover';

  interface Run {
    /** Time scale of every unpaused frame, in order. */
    readonly factors: readonly number[];
    readonly result: RoundResult | null;
    readonly ticks: number;
    readonly sinceWinBeforePause: number | null;
    readonly sinceWinAfterPause: number | null;
    readonly firstFactorAfterResume: number | null;
  }

  const roster = makeRoster((id) => id * 5);
  const round = makeRound([12, 3, 18, 7, 1, 20, 9, 14, 5, 16], 2024);

  const phaseOf = (race: Race, sinceWin: number | null): Phase | null => {
    const { leaderProgress } = observeFinish(race);
    if (sinceWin === null) return leaderProgress > approachProgress ? 'approach' : null;
    if (sinceWin > 0 && sinceWin < holdSeconds) return 'hold';
    if (sinceWin > holdSeconds && sinceWin < holdSeconds + recoverSeconds) return 'recover';
    return null;
  };

  /**
   * Drives one race through the real frame pipeline:
   * clock -> drama -> accumulator -> fixed-step engine.
   */
  function simulate(pauseIn: Phase | null, pausedFrames: readonly number[] = []): Run {
    const race = createRace(round, roster);
    const clock: PlaybackClock = createPlaybackClock({ speed: 2 });
    const drama = createFinishDrama();
    const acc = createFixedStepAccumulator();
    const factors: number[] = [];
    let paused = false;
    let sinceWinBeforePause: number | null = null;
    let sinceWinAfterPause: number | null = null;
    let firstFactorAfterResume: number | null = null;

    const frame = (wallDt: number): number => {
      const { presentationDt, speed } = clock.advance(wallDt);
      const factor = drama.step(presentationDt, observeFinish(race));
      race.tick(acc.push(presentationDt * speed * factor));
      if (presentationDt > 0) factors.push(factor);
      return factor;
    };

    for (let i = 0; i < 10_000 && !(race.isFinished && drama.sinceWin! > 2); i++) {
      if (!paused && pauseIn !== null && phaseOf(race, drama.sinceWin) === pauseIn) {
        paused = true;
        sinceWinBeforePause = drama.sinceWin;
        const ticksBefore = race.tickCount;
        clock.pause();
        for (const wallDt of pausedFrames) frame(wallDt);
        expect(race.tickCount).toBe(ticksBefore);
        sinceWinAfterPause = drama.sinceWin;
        clock.resume();
        firstFactorAfterResume = frame(FRAME);
        continue;
      }
      frame(FRAME);
    }
    return {
      factors,
      result: race.result(),
      ticks: race.tickCount,
      sinceWinBeforePause,
      sinceWinAfterPause,
      firstFactorAfterResume,
    };
  }

  // A long pause: two seconds of frames plus a 30 s gap (tab hidden), far
  // longer than the whole hold + recover window.
  const longPause = [...Array<number>(120).fill(FRAME), 30, FRAME];
  const reference = simulate(null);

  it('the reference run enters and leaves slow motion', () => {
    expect(reference.factors).toContain(slowFactor);
    expect(reference.factors.some((f) => f > slowFactor && f < 1)).toBe(true);
    expect(reference.factors.at(-1)).toBe(1);
    expect(reference.result).toEqual(createRace(round, roster).runToCompletion());
  });

  it.each<Phase>(['approach', 'hold', 'recover'])(
    'pausing during the %s phase resumes the slow motion exactly where it stopped',
    (phase) => {
      const run = simulate(phase, longPause);
      expect(run.sinceWinAfterPause).toBe(run.sinceWinBeforePause);
      expect(run.factors).toEqual(reference.factors);
    },
  );

  it.each<Phase>(['approach', 'hold', 'recover'])(
    'pausing during the %s phase keeps the official result and tick count unchanged',
    (phase) => {
      const run = simulate(phase, longPause);
      expect(run.result).toEqual(reference.result);
      expect(run.ticks).toBe(reference.ticks);
    },
  );

  it('the first frame after resuming during the hold is still slowed', () => {
    const run = simulate('hold', longPause);
    expect(run.firstFactorAfterResume).toBe(slowFactor);
  });

  it('the first frame after resuming during the recovery continues the ease, not full speed', () => {
    const run = simulate('recover', longPause);
    expect(run.firstFactorAfterResume).toBeGreaterThan(slowFactor);
    expect(run.firstFactorAfterResume).toBeLessThan(1);
  });

  it('time spent in slow motion is the same with or without a pause', () => {
    const slowFrames = (factors: readonly number[]) => factors.filter((f) => f < 1).length;
    expect(slowFrames(simulate('hold', longPause).factors)).toBe(slowFrames(reference.factors));
    expect(slowFrames(simulate('recover', longPause).factors)).toBe(slowFrames(reference.factors));
  });

  it('a pause fed zero, negative, NaN and huge wall deltas still matches the reference', () => {
    const toggling = [0, FRAME, 0.5, FRAME, Number.NaN, -1, 10];
    const run = simulate('hold', toggling);
    expect(run.factors).toEqual(reference.factors);
    expect(run.result).toEqual(reference.result);
  });
});
