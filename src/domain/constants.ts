/** Fixed size of the stable. Horse IDs run from 1 to HORSE_COUNT. */
export const HORSE_COUNT = 20;

/** Number of distinct horses drawn into each round. */
export const RUNNERS_PER_ROUND = 10;

/** Inclusive bounds for a horse's condition score. */
export const CONDITION_MIN = 1;
export const CONDITION_MAX = 100;

/** Round distances in metres, in the order the rounds are run. */
export const ROUND_DISTANCES = [1200, 1400, 1600, 1800, 2000, 2200] as const;

/** Number of rounds in a program, derived from the distance table. */
export const ROUND_COUNT = ROUND_DISTANCES.length;

export type RoundDistance = (typeof ROUND_DISTANCES)[number];
