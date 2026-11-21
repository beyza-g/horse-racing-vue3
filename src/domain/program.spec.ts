import { describe, expect, it } from 'vitest';
import { HORSE_COUNT, ROUND_COUNT, ROUND_DISTANCES, RUNNERS_PER_ROUND } from './constants';
import { generateHorses } from './horses';
import { createRound, generateProgram } from './program';
import { createRng } from './random';

const roster = generateHorses(createRng(1));
const lineup = [3, 1, 4, 15, 9, 2, 6, 5, 20, 7];

describe('generateProgram', () => {
  const program = generateProgram(roster, createRng(99));

  it('creates six rounds at 1200m to 2200m in order', () => {
    expect(program.rounds).toHaveLength(ROUND_COUNT);
    expect(program.rounds.map((round) => round.distance)).toEqual([...ROUND_DISTANCES]);
    expect(program.rounds.map((round) => round.index)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('draws ten distinct roster horses for every round', () => {
    for (const round of program.rounds) {
      expect(round.lineup).toHaveLength(RUNNERS_PER_ROUND);
      expect(new Set(round.lineup).size).toBe(RUNNERS_PER_ROUND);
      for (const id of round.lineup) {
        expect(id).toBeGreaterThanOrEqual(1);
        expect(id).toBeLessThanOrEqual(HORSE_COUNT);
      }
    }
  });

  it('gives each round an unsigned 32-bit race seed', () => {
    for (const round of program.rounds) {
      expect(Number.isInteger(round.raceSeed)).toBe(true);
      expect(round.raceSeed).toBeGreaterThanOrEqual(0);
      expect(round.raceSeed).toBeLessThan(2 ** 32);
    }
  });

  it('draws line-ups independently per round', () => {
    const lineups = program.rounds.map((round) => round.lineup.join(','));
    expect(new Set(lineups).size).toBe(ROUND_COUNT);
  });

  it('is frozen all the way down', () => {
    expect(Object.isFrozen(program)).toBe(true);
    expect(Object.isFrozen(program.rounds)).toBe(true);
    for (const round of program.rounds) {
      expect(Object.isFrozen(round)).toBe(true);
      expect(Object.isFrozen(round.lineup)).toBe(true);
    }
  });

  it('is deterministic per seed and varies across seeds', () => {
    expect(generateProgram(roster, createRng(99))).toEqual(program);
    expect(generateProgram(roster, createRng(100))).not.toEqual(program);
  });

  it('rejects an invalid roster', () => {
    expect(() => generateProgram(roster.slice(0, 10), createRng(1))).toThrow(
      expect.objectContaining({ code: 'INVALID_ROSTER' }),
    );
  });
});

describe('createRound', () => {
  it('derives the distance from the index', () => {
    ROUND_DISTANCES.forEach((distance, index) => {
      expect(createRound({ index, lineup, raceSeed: 1 }).distance).toBe(distance);
    });
  });

  it('copies the line-up so later mutation of the input has no effect', () => {
    const input = lineup.slice();
    const round = createRound({ index: 0, lineup: input, raceSeed: 1 });
    input[0] = 99;
    expect(round.lineup[0]).toBe(3);
  });

  it.each([
    ['index -1', { index: -1 }, 'INVALID_ROUND'],
    ['index 6', { index: ROUND_COUNT }, 'INVALID_ROUND'],
    ['a fractional index', { index: 0.5 }, 'INVALID_ROUND'],
    ['a negative seed', { raceSeed: -1 }, 'INVALID_ROUND'],
    ['a seed above 2^32 - 1', { raceSeed: 2 ** 32 }, 'INVALID_ROUND'],
    ['a fractional seed', { raceSeed: 1.5 }, 'INVALID_ROUND'],
    ['nine runners', { lineup: lineup.slice(0, 9) }, 'INVALID_LINEUP'],
    ['eleven runners', { lineup: [...lineup, 8] }, 'INVALID_LINEUP'],
    ['an empty line-up', { lineup: [] }, 'INVALID_LINEUP'],
    ['a duplicate runner', { lineup: [...lineup.slice(0, 9), 3] }, 'INVALID_LINEUP'],
    ['horse 0', { lineup: [0, ...lineup.slice(1)] }, 'INVALID_LINEUP'],
    ['horse 21', { lineup: [21, ...lineup.slice(1)] }, 'INVALID_LINEUP'],
  ])('rejects %s', (_, patch, code) => {
    expect(() => createRound({ index: 0, lineup, raceSeed: 1, ...patch })).toThrow(
      expect.objectContaining({ code }),
    );
  });
});
