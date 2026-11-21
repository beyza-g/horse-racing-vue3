import { describe, expect, it } from 'vitest';
import { HORSE_COUNT, ROUND_COUNT, ROUND_DISTANCES } from './constants';
import { generateHorses } from './horses';
import { generateProgram } from './program';
import {
  computeProgramStandings,
  formFigures,
  PLACING_POINTS,
  pointsForPlace,
} from './programStandings';
import { createRace } from './race/createRace';
import { createRng, forkRng } from './random';
import type { HorseId, RoundResult } from './types';

const ALL_IDS = Array.from({ length: HORSE_COUNT }, (_, i) => i + 1);

/** A result where `order[i]` finished in place i + 1. */
function result(roundIndex: number, order: readonly HorseId[]): RoundResult {
  return {
    roundIndex,
    distance: ROUND_DISTANCES[roundIndex]!,
    finishers: order.map((horseId, i) => ({ horseId, lane: i + 1, place: i + 1, time: 10 + i })),
  };
}

describe('points', () => {
  it('awards 10-8-6-5-4-3-2-1 to the first eight and nothing to 9th and 10th', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(pointsForPlace)).toEqual([
      10, 8, 6, 5, 4, 3, 2, 1, 0, 0,
    ]);
    expect(PLACING_POINTS.reduce((a, b) => a + b, 0)).toBe(39);
  });

  it.each([0, 11, 1.5, Number.NaN])('rejects the place %s', (place) => {
    expect(() => pointsForPlace(place)).toThrow(
      expect.objectContaining({ code: 'INVALID_ARGUMENT' }),
    );
  });
});

describe('formFigures', () => {
  it('lists places oldest first, 0 for 10th, skipping rounds not run', () => {
    expect(formFigures([2, null, 1, 10, null, 7])).toBe('2107');
    expect(formFigures([null, null])).toBe('');
  });
});

describe('computeProgramStandings', () => {
  it('lists every horse with zero points before any result', () => {
    const table = computeProgramStandings(ALL_IDS, []);
    expect(table).toHaveLength(HORSE_COUNT);
    expect(table.every((s) => s.points === 0 && s.starts === 0 && s.rank === 1 && s.tied)).toBe(
      true,
    );
    expect(table.map((s) => s.horseId)).toEqual(ALL_IDS);
    expect(table[0]!.places).toEqual(new Array(ROUND_COUNT).fill(null));
  });

  it('accumulates points and records the place per round', () => {
    const r1 = result(0, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    const r2 = result(1, [11, 1, 12, 13, 14, 15, 16, 17, 18, 19]);
    const table = computeProgramStandings(ALL_IDS, [r1, r2]);
    const horse1 = table.find((s) => s.horseId === 1)!;
    expect(horse1).toMatchObject({ points: 18, starts: 2, wins: 1, rank: 1, tied: false });
    expect(horse1.places).toEqual([1, 2, null, null, null, null]);
    expect(table.find((s) => s.horseId === 20)).toMatchObject({ points: 0, starts: 0 });
  });

  it('breaks points ties on countback: more wins first', () => {
    // Horse 1: 1st (10) + 9th (0) = 10. Horse 2: 2nd (8) + 7th (2) = 10. One win beats none.
    const r1 = result(0, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    const r2 = result(1, [11, 12, 13, 14, 15, 16, 2, 17, 1, 18]);
    const table = computeProgramStandings(ALL_IDS, [r1, r2]);
    const one = table.find((s) => s.horseId === 1)!;
    const two = table.find((s) => s.horseId === 2)!;
    expect(one.points).toBe(10);
    expect(two.points).toBe(10);
    expect(one.rank).toBeLessThan(two.rank);
    expect(one.tied).toBe(false);
  });

  it('shares a rank when points and countback are identical, ordered by ID', () => {
    const r1 = result(0, [5, 3, 1, 2, 4, 6, 7, 8, 9, 10]);
    const r2 = result(1, [3, 5, 11, 12, 13, 14, 15, 16, 17, 18]);
    const table = computeProgramStandings(ALL_IDS, [r1, r2]);
    expect(table.slice(0, 2).map((s) => [s.horseId, s.rank, s.tied])).toEqual([
      [3, 1, true],
      [5, 1, true],
    ]);
    expect(table[2]!.rank).toBe(3);
  });

  it('distributes exactly 39 points per official round', () => {
    const rng = createRng(42);
    const roster = generateHorses(forkRng(rng));
    const program = generateProgram(roster, forkRng(rng));
    const results = program.rounds.map((round) => createRace(round, roster).runToCompletion());
    for (let n = 0; n <= ROUND_COUNT; n++) {
      const table = computeProgramStandings(ALL_IDS, results.slice(0, n));
      expect(table.reduce((sum, s) => sum + s.points, 0)).toBe(39 * n);
      expect(table.reduce((sum, s) => sum + s.starts, 0)).toBe(10 * n);
    }
  });

  it('ranks are non-decreasing and points non-increasing down the table', () => {
    const rng = createRng(7);
    const roster = generateHorses(forkRng(rng));
    const program = generateProgram(roster, forkRng(rng));
    const results = program.rounds.map((round) => createRace(round, roster).runToCompletion());
    const table = computeProgramStandings(ALL_IDS, results);
    for (let i = 1; i < table.length; i++) {
      expect(table[i]!.points).toBeLessThanOrEqual(table[i - 1]!.points);
      expect(table[i]!.rank).toBeGreaterThanOrEqual(table[i - 1]!.rank);
    }
  });

  it('is deterministic and frozen', () => {
    const r1 = result(0, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    const a = computeProgramStandings(ALL_IDS, [r1]);
    expect(computeProgramStandings(ALL_IDS, [r1])).toEqual(a);
    expect(Object.isFrozen(a)).toBe(true);
    expect(Object.isFrozen(a[0])).toBe(true);
    expect(Object.isFrozen(a[0]!.places)).toBe(true);
  });

  it('rejects results naming unknown horses and duplicate IDs', () => {
    expect(() =>
      computeProgramStandings([1, 2], [result(0, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10])]),
    ).toThrow(expect.objectContaining({ code: 'INVALID_ARGUMENT' }));
    expect(() => computeProgramStandings([1, 1], [])).toThrow(
      expect.objectContaining({ code: 'INVALID_ARGUMENT' }),
    );
  });
});
