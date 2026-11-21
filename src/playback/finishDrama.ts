import { DomainError, type Race } from '../domain';

/** Tuning for the slow motion around the winning moment. */
export const FINISH_DRAMA = Object.freeze({
  /** Time-scale multiplier while the drama is at full strength. */
  slowFactor: 0.42,
  /** Leader progress (share of the distance) at which slow motion begins. */
  approachProgress: 0.985,
  /** Presentation seconds the full slow motion is held after the winner crosses. */
  holdSeconds: 0.35,
  /** Presentation seconds to ease back from the slow factor to 1. */
  recoverSeconds: 0.5,
});

/** The race facts the drama reacts to. */
export interface FinishObservation {
  /** Furthest runner's share of the race distance, clamped to [0, 1]. */
  readonly leaderProgress: number;
  /** True once the winner has crossed the line. */
  readonly winnerDecided: boolean;
}

/**
 * Pure time-scale curve.
 *
 * @param sinceWin Presentation seconds since the winner crossed (paused time
 *   excluded), or null if nobody has finished yet.
 */
export function slowMotionFactor(leaderProgress: number, sinceWin: number | null): number {
  const { slowFactor, approachProgress, holdSeconds, recoverSeconds } = FINISH_DRAMA;
  if (sinceWin === null) return leaderProgress > approachProgress ? slowFactor : 1;
  if (sinceWin < holdSeconds) return slowFactor;
  const recovered = Math.min(1, (sinceWin - holdSeconds) / recoverSeconds);
  return slowFactor + (1 - slowFactor) * recovered;
}

/** Reads a {@link FinishObservation} from a race without allocating intermediate arrays. */
export function observeFinish(race: Race): FinishObservation {
  let lead = 0;
  for (const runner of race.runners) if (runner.position > lead) lead = runner.position;
  return {
    leaderProgress: Math.min(1, lead / race.distance),
    winnerDecided: race.winnerTime !== null,
  };
}

export interface FinishDrama {
  /** Presentation seconds since the winner was observed, or null before that. */
  readonly sinceWin: number | null;
  /**
   * Advances the drama by one frame and returns this frame's time scale.
   *
   * `presentationDt` must come from the playback clock: it is 0 while paused,
   * so the drama freezes with the race and resumes exactly where it stopped.
   * `observation` describes the race as it was at the start of the frame.
   */
  step(presentationDt: number, observation: FinishObservation): number;
  reset(): void;
}

/** Creates the finish slow-motion controller. When disabled it always returns 1. */
export function createFinishDrama(enabled = true): FinishDrama {
  let sinceWin: number | null = null;

  return {
    get sinceWin() {
      return sinceWin;
    },
    step(presentationDt, observation) {
      if (!Number.isFinite(presentationDt) || presentationDt < 0) {
        throw new DomainError(
          'INVALID_ARGUMENT',
          `Presentation delta must be finite and non-negative, received ${String(presentationDt)}.`,
        );
      }
      if (sinceWin !== null) sinceWin += presentationDt;
      else if (observation.winnerDecided) sinceWin = 0;
      return enabled ? slowMotionFactor(observation.leaderProgress, sinceWin) : 1;
    },
    reset() {
      sinceWin = null;
    },
  };
}
