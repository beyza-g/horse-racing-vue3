import { DomainError, SIM_STEP } from '../domain';

/** Tolerance that keeps e.g. 0.05 / (1/120) from flooring to 5 instead of 6. */
const TICK_EPSILON = 1e-9;

/**
 * Converts variable simulation deltas into whole engine ticks, carrying the
 * remainder between frames. The engine therefore always advances in
 * identical steps, whatever the frame rate, speed or slow-motion factor.
 */
export interface FixedStepAccumulator {
  /** Simulation seconds received but not yet converted into a tick. */
  readonly remainder: number;
  /** Adds simulation seconds and returns how many whole ticks are now due. */
  push(simDt: number): number;
  reset(): void;
}

export function createFixedStepAccumulator(step: number = SIM_STEP): FixedStepAccumulator {
  if (!Number.isFinite(step) || step <= 0) {
    throw new DomainError(
      'INVALID_ARGUMENT',
      `Step must be positive and finite, received ${String(step)}.`,
    );
  }
  let remainder = 0;

  return {
    get remainder() {
      return remainder;
    },
    push(simDt) {
      if (!Number.isFinite(simDt) || simDt < 0) {
        throw new DomainError(
          'INVALID_ARGUMENT',
          `Simulation delta must be finite and non-negative, received ${String(simDt)}.`,
        );
      }
      remainder += simDt;
      const ticks = Math.floor(remainder / step + TICK_EPSILON);
      remainder = Math.max(0, remainder - ticks * step);
      return ticks;
    },
    reset() {
      remainder = 0;
    },
  };
}
