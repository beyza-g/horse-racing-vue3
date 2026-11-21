import { HORSE_COUNT } from '../constants';
import { createHorse, silkColor } from '../horses';
import type { Horse, HorseId, Round } from '../types';
import type { ProfileStrategy } from '../race/physics';

/** Valid 20-horse roster with explicit conditions (defaults to 50 for every horse). */
export function makeRoster(conditionFor: (id: HorseId) => number = () => 50): readonly Horse[] {
  return Array.from({ length: HORSE_COUNT }, (_, index) =>
    createHorse({
      id: index + 1,
      name: `Test Horse ${index + 1}`,
      color: silkColor(index),
      coat: '#3b2418',
      condition: conditionFor(index + 1),
    }),
  );
}

/**
 * A round literal that bypasses `createRound` validation, so race-level
 * validation can be tested on its own.
 */
export function makeRound(lineup: readonly HorseId[], raceSeed = 1, index = 0): Round {
  return { index, distance: 1200, lineup, raceSeed };
}

export const LINEUP_1_TO_10: readonly HorseId[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/** Identical profiles for every runner: no delay, no noise, fixed cruising speed. */
export function uniformProfile(baseSpeed = 100): ProfileStrategy {
  return (condition) => ({ condition, baseSpeed, startDelay: 0, noisePhases: [0, 0, 0] });
}
