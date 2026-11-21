import { describe, expect, it } from 'vitest';
import { LINEUP_1_TO_10, makeRoster, makeRound } from '../__fixtures__/roster';
import { ROUND_DISTANCES } from '../constants';
import { generateHorses } from '../horses';
import { generateProgram } from '../program';
import { createRng, forkRng } from '../random';
import type { Round } from '../types';
import { createRace } from './createRace';
import { SIM_STEP } from './physics';
import {
  formatOfficialTime,
  formatTimeboard,
  nominalSimDuration,
  realisticDuration,
  realisticPace,
  TIMEBOARD,
  timeboardReading,
  timeboardScale,
  toTimeboardSeconds,
} from './timeboard';

/** A round at any distance (the program only uses 1200-2200 m; 1000 m is the reference). */
const roundAt = (distance: number, seed: number): Round =>
  ({ ...makeRound(LINEUP_1_TO_10, seed), distance }) as unknown as Round;

const nominalField = makeRoster(() => TIMEBOARD.nominalCondition);

/** Mean displayed finish time of nominal-condition fields over several seeds. */
function meanDisplayedTime(distance: number): number {
  const times: number[] = [];
  for (let seed = 0; seed < 25; seed++) {
    const result = createRace(roundAt(distance, seed), nominalField).runToCompletion();
    for (const f of result.finishers) times.push(toTimeboardSeconds(f.time, distance));
  }
  return times.reduce((sum, t) => sum + t, 0) / times.length;
}

describe('realistic durations', () => {
  it('puts a nominal 1000 m race at about a minute', () => {
    expect(realisticDuration(1000)).toBeCloseTo(TIMEBOARD.referenceSeconds, 10);
    expect(realisticDuration(1000)).toBeGreaterThanOrEqual(55);
    expect(realisticDuration(1000)).toBeLessThanOrEqual(65);
  });

  it('grows with distance, faster than linearly because horses tire', () => {
    let previous = 0;
    for (const distance of [1000, ...ROUND_DISTANCES]) {
      const duration = realisticDuration(distance);
      expect(duration).toBeGreaterThan(previous);
      previous = duration;
    }
    expect(realisticPace(2200)).toBeLessThan(realisticPace(1200));
    expect(realisticDuration(2200) / realisticDuration(1100)).toBeGreaterThan(2);
  });

  it.each([
    [1200, 68, 76],
    [1600, 92, 102],
    [2000, 118, 128],
    [2200, 130, 140],
  ])('places %s m between %s and %s seconds', (distance, low, high) => {
    expect(realisticDuration(distance)).toBeGreaterThan(low);
    expect(realisticDuration(distance)).toBeLessThan(high);
  });
});

describe('timeboard calibration against the engine', () => {
  it.each([1000, ...ROUND_DISTANCES])(
    'a nominal field over %s m displays within 3% of the realistic duration',
    (distance) => {
      const mean = meanDisplayedTime(distance);
      expect(
        Math.abs(mean - realisticDuration(distance)) / realisticDuration(distance),
      ).toBeLessThan(0.03);
    },
  );

  it('a nominal 1000 m race displays between 55 and 65 seconds', () => {
    const mean = meanDisplayedTime(1000);
    expect(mean).toBeGreaterThanOrEqual(55);
    expect(mean).toBeLessThanOrEqual(65);
  });

  it('keeps on-screen pacing fast: simulated races stay around 10-25 seconds', () => {
    expect(nominalSimDuration(1000)).toBeGreaterThan(9);
    expect(nominalSimDuration(1000)).toBeLessThan(12);
    for (const distance of ROUND_DISTANCES) {
      expect(nominalSimDuration(distance)).toBeLessThan(25);
      expect(timeboardScale(distance)).toBeGreaterThan(4);
      expect(timeboardScale(distance)).toBeLessThan(8);
    }
  });
});

describe('toTimeboardSeconds', () => {
  it('is a pure linear map per distance (0 stays 0)', () => {
    expect(toTimeboardSeconds(0, 1600)).toBe(0);
    expect(toTimeboardSeconds(10, 1600)).toBeCloseTo(timeboardScale(1600) * 10, 12);
    expect(toTimeboardSeconds(20, 1600)).toBeCloseTo(2 * toTimeboardSeconds(10, 1600), 12);
  });

  it('preserves finishing order, ties and gaps in every round of a real program', () => {
    const rng = createRng(42);
    const roster = generateHorses(forkRng(rng));
    const program = generateProgram(roster, forkRng(rng));
    for (const round of program.rounds) {
      const result = createRace(round, roster).runToCompletion();
      const display = result.finishers.map((f) => toTimeboardSeconds(f.time, round.distance));
      for (let i = 1; i < display.length; i++) {
        expect(display[i]).toBeGreaterThanOrEqual(display[i - 1]!);
        if (result.finishers[i]!.time === result.finishers[i - 1]!.time) {
          expect(display[i]).toBe(display[i - 1]);
        }
      }
    }
  });

  it('is deterministic', () => {
    expect(toTimeboardSeconds(12.345, 1800)).toBe(toTimeboardSeconds(12.345, 1800));
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])('rejects simulation time %s', (t) => {
    expect(() => toTimeboardSeconds(t, 1200)).toThrow(
      expect.objectContaining({ code: 'INVALID_ARGUMENT' }),
    );
  });

  it.each([0, -1200, Number.NaN])('rejects distance %s', (distance) => {
    expect(() => toTimeboardSeconds(1, distance)).toThrow(
      expect.objectContaining({ code: 'INVALID_ARGUMENT' }),
    );
    expect(() => timeboardScale(distance)).toThrow(
      expect.objectContaining({ code: 'INVALID_ARGUMENT' }),
    );
  });
});

describe('formatTimeboard', () => {
  it.each([
    [0, '0:00.00'],
    [58.314, '0:58.31'],
    [59.999, '1:00.00'],
    [72.485, '1:12.49'],
    [135.4, '2:15.40'],
    [599.994, '9:59.99'],
    [-3, '0:00.00'],
    [Number.NaN, '0:00.00'],
  ])('formats %s as %s', (seconds, expected) => {
    expect(formatTimeboard(seconds)).toBe(expected);
  });

  it('keeps a constant width while ticking (no layout shift)', () => {
    const widths = new Set<number>();
    for (let t = 0; t < 300; t += 0.37) widths.add(formatTimeboard(t).length);
    expect([...widths]).toEqual([7]);
  });
});

describe('formatOfficialTime', () => {
  it('formats the scaled time of a finisher', () => {
    expect(formatOfficialTime(12, 1200)).toBe(formatTimeboard(12 * timeboardScale(1200)));
    expect(formatOfficialTime(12, 1200)).toMatch(/^1:\d{2}\.\d{2}$/);
  });
});

describe('timeboardReading', () => {
  it('starts at zero and follows elapsed race time while running', () => {
    const race = createRace(makeRound(LINEUP_1_TO_10, 3), nominalField);
    expect(timeboardReading(race)).toBe(0);
    race.tick(Math.round(5 / SIM_STEP));
    expect(timeboardReading(race)).toBeCloseTo(race.elapsed * timeboardScale(1200), 10);
  });

  it('never decreases and freezes on the last official time once everyone finished', () => {
    const race = createRace(makeRound(LINEUP_1_TO_10, 3), nominalField);
    let previous = 0;
    while (!race.isFinished) {
      race.tick(7);
      const reading = timeboardReading(race);
      expect(reading).toBeGreaterThanOrEqual(previous);
      previous = reading;
    }
    const last = race.result()!.finishers.at(-1)!;
    const frozen = timeboardReading(race);
    expect(formatTimeboard(frozen)).toBe(formatOfficialTime(last.time, 1200));
    race.tick(600);
    expect(timeboardReading(race)).toBe(frozen);
  });

  it('agrees with official times: each finisher crosses while the clock shows its time', () => {
    const race = createRace(makeRound(LINEUP_1_TO_10, 8), nominalField);
    const seen = new Map<number, number>();
    while (!race.isFinished) {
      const before = timeboardReading(race);
      race.tick();
      for (const runner of race.runners) {
        if (runner.finishTime !== null && !seen.has(runner.horseId)) {
          seen.set(runner.horseId, before);
          const official = toTimeboardSeconds(runner.finishTime, race.distance);
          expect(official).toBeGreaterThanOrEqual(before - 1e-9);
          expect(official).toBeLessThanOrEqual(before + timeboardScale(race.distance) * SIM_STEP);
        }
      }
    }
    expect(seen.size).toBe(10);
  });
});
