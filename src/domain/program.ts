import { HORSE_COUNT, ROUND_COUNT, ROUND_DISTANCES, RUNNERS_PER_ROUND } from './constants';
import { assertIntegerInRange, invariant } from './errors';
import { assertValidRoster } from './horses';
import { sample, type Rng } from './random';
import type { Horse, HorseId, Program, Round } from './types';

const UINT32_MAX = 0xffff_ffff;

/** Input for {@link createRound}. The distance is derived, never supplied. */
export interface RoundInput {
  readonly index: number;
  readonly lineup: readonly HorseId[];
  readonly raceSeed: number;
}

/**
 * Validates and freezes a round: a valid index (which fixes the distance),
 * exactly RUNNERS_PER_ROUND distinct horse IDs within 1..HORSE_COUNT, and a
 * 32-bit race seed.
 */
export function createRound(input: RoundInput): Round {
  assertIntegerInRange(input.index, 0, ROUND_COUNT - 1, 'INVALID_ROUND', 'Round index');
  assertIntegerInRange(input.raceSeed, 0, UINT32_MAX, 'INVALID_ROUND', 'Race seed');
  invariant(
    input.lineup.length === RUNNERS_PER_ROUND,
    'INVALID_LINEUP',
    `Round ${input.index + 1} needs exactly ${RUNNERS_PER_ROUND} runners, received ${input.lineup.length}.`,
  );
  const seen = new Set<HorseId>();
  for (const id of input.lineup) {
    assertIntegerInRange(id, 1, HORSE_COUNT, 'INVALID_LINEUP', `Round ${input.index + 1} horse id`);
    invariant(
      !seen.has(id),
      'INVALID_LINEUP',
      `Horse ${id} appears twice in round ${input.index + 1}.`,
    );
    seen.add(id);
  }
  const distance = ROUND_DISTANCES[input.index];
  invariant(distance !== undefined, 'INVALID_ROUND', `No distance for round ${input.index + 1}.`);
  return Object.freeze({
    index: input.index,
    distance,
    lineup: Object.freeze(input.lineup.slice()),
    raceSeed: input.raceSeed,
  });
}

/**
 * Draws a program: for each distance in order, RUNNERS_PER_ROUND distinct
 * horses from the roster (lane = draw order) and a race seed.
 */
export function generateProgram(horses: readonly Horse[], rng: Rng): Program {
  assertValidRoster(horses);
  const ids = horses.map((horse) => horse.id);
  const rounds = ROUND_DISTANCES.map((_, index) =>
    createRound({ index, lineup: sample(rng, ids, RUNNERS_PER_ROUND), raceSeed: rng.nextUint32() }),
  );
  return Object.freeze({ rounds: Object.freeze(rounds) });
}
