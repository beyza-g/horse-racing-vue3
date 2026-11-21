import { describe, expect, it } from 'vitest';
import { createRace, SIM_STEP } from '../domain';
import { LINEUP_1_TO_10, makeRoster, makeRound } from '../domain/__fixtures__/roster';
import { createPlaybackClock } from './clock';
import { createFinishDrama } from './finishDrama';
import { createFixedStepAccumulator } from './fixedStep';
import { createMotionTracker } from './motion';
import { runRaceFrame, type RaceFrameParts } from './raceFrame';

const roster = makeRoster((id) => id * 5);

const makeParts = (): RaceFrameParts => ({
  race: createRace(makeRound(LINEUP_1_TO_10, 9), roster),
  drama: createFinishDrama(),
  accumulator: createFixedStepAccumulator(),
  motion: createMotionTracker(10),
});

describe('runRaceFrame', () => {
  it('turns one 1x frame into whole engine ticks', () => {
    const parts = makeParts();
    const outcome = runRaceFrame(parts, { presentationDt: 0.05, speed: 1, paused: false });
    expect(outcome.ticks).toBe(6);
    expect(outcome.simDt).toBeCloseTo(0.05);
    expect(outcome.timeScale).toBe(1);
    expect(parts.race.tickCount).toBe(6);
  });

  it('scales simulation time by speed', () => {
    const parts = makeParts();
    const outcome = runRaceFrame(parts, { presentationDt: 0.05, speed: 4, paused: false });
    expect(outcome.ticks).toBe(24);
  });

  it('does nothing on a paused frame', () => {
    const parts = makeParts();
    runRaceFrame(parts, { presentationDt: 0.05, speed: 1, paused: false });
    const ticks = parts.race.tickCount;
    const outcome = runRaceFrame(parts, { presentationDt: 0, speed: 4, paused: true });
    expect(outcome).toMatchObject({ ticks: 0, simDt: 0, finishedNow: 0, standingsChanged: false });
    expect(parts.race.tickCount).toBe(ticks);
  });

  it('reports finishes and standings changes', () => {
    const parts = makeParts();
    let finished = 0;
    let changes = 0;
    for (let i = 0; i < 5000 && !parts.race.isFinished; i++) {
      const outcome = runRaceFrame(parts, { presentationDt: 1 / 60, speed: 4, paused: false });
      finished += outcome.finishedNow;
      if (outcome.standingsChanged) changes++;
    }
    expect(finished).toBe(10);
    expect(changes).toBeGreaterThan(0);
  });

  it('matches the uninterrupted engine result at any frame rate and speed', () => {
    const reference = createRace(makeRound(LINEUP_1_TO_10, 9), roster).runToCompletion();
    for (const [dt, speed] of [
      [1 / 30, 1],
      [1 / 144, 2],
      [0.05, 4],
    ] as const) {
      const parts = makeParts();
      const clock = createPlaybackClock({ speed });
      for (let i = 0; i < 100_000 && !parts.race.isFinished; i++) {
        runRaceFrame(parts, clock.advance(dt));
      }
      expect(parts.race.result()).toEqual(reference);
    }
    expect(SIM_STEP).toBeGreaterThan(0);
  });
});
