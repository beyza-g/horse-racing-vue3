import type { RoundDistance } from './constants';

/** Horse identifier: an integer from 1 to HORSE_COUNT. */
export type HorseId = number;

/** A horse in the stable. Immutable once created. */
export interface Horse {
  readonly id: HorseId;
  readonly name: string;
  /** Unique silk colour as a CSS colour string; identifies the horse everywhere. */
  readonly color: string;
  /** Cosmetic body colour for rendering. Not unique. */
  readonly coat: string;
  /**
   * Integer in [CONDITION_MIN, CONDITION_MAX], mapped linearly onto the 1-9
   * Henneke body condition score. Performance peaks near BCS 4.5 (condition
   * ~45); thinner horses fade, heavier horses are slower (see condition.ts).
   */
  readonly condition: number;
}

/** One round of a program. `lineup[i]` runs in lane `i + 1`. */
export interface Round {
  /** Zero-based position in the program. */
  readonly index: number;
  /** Derived from ROUND_DISTANCES[index]; never supplied independently. */
  readonly distance: RoundDistance;
  readonly lineup: readonly HorseId[];
  /** Unsigned 32-bit seed that fully determines this round's race. */
  readonly raceSeed: number;
}

/** A full race program: ROUND_COUNT rounds in distance order. */
export interface Program {
  readonly rounds: readonly Round[];
}

/** Official placing of one horse in a finished round. */
export interface FinishRecord {
  readonly horseId: HorseId;
  /** One-based lane. */
  readonly lane: number;
  /** One-based place. */
  readonly place: number;
  /** Interpolated finish-line crossing time in simulation seconds. */
  readonly time: number;
}

/** Official result of a round, ordered by place. */
export interface RoundResult {
  readonly roundIndex: number;
  readonly distance: RoundDistance;
  readonly finishers: readonly FinishRecord[];
}
