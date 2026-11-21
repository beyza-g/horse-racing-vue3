import type { Race } from '../domain';

/**
 * Tuning for the purely visual motion of each runner. None of these values
 * influence race outcomes; they only shape how a runner is drawn.
 */
export const MOTION = Object.freeze({
  /** Metres covered per full stride cycle. */
  strideLength: 42,
  /** Speed (m/s) at which the gallop reaches full amplitude. */
  fullGallopSpeed: 90,
  /** Race progress at which the jockey starts driving for the line. */
  driveStart: 0.74,
  /** Progress over which the drive ramps from 0 to 1. */
  driveRamp: 0.1,
  /** Presentation seconds for the drive to relax after the line. */
  driveFadeSeconds: 0.7,
  /** Presentation seconds for a finished runner's name tag to fade out. */
  tagFadeSeconds: 0.45,
  /** Offset between neighbouring lanes' initial stride phases, so the field is not in lockstep. */
  lanePhaseOffset: 0.37,
});

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

/** Gallop amplitude in [0, 1]: 0 standing still, 1 at or above full gallop speed. */
export function gallopAmplitude(speed: number): number {
  return clamp01(speed / MOTION.fullGallopSpeed);
}

/**
 * Advances a stride phase in [0, 1) by the distance covered in `simDt`.
 * Negative speeds count as standing still.
 */
export function advanceStridePhase(phase: number, speed: number, simDt: number): number {
  const next = phase + (simDt * Math.max(0, speed)) / MOTION.strideLength;
  return next - Math.floor(next);
}

/**
 * Drive (sprint) intensity in [0, 1]. Ramps up over the final stretch and,
 * once the runner has finished, relaxes over `driveFadeSeconds` of
 * presentation time.
 *
 * @param sinceFinish Presentation seconds since the runner finished, or null while racing.
 */
export function driveIntensity(progress: number, sinceFinish: number | null): number {
  if (sinceFinish !== null) return clamp01(1 - sinceFinish / MOTION.driveFadeSeconds);
  return clamp01((progress - MOTION.driveStart) / MOTION.driveRamp);
}

/** Name tag opacity in [0, 1]: fully visible while racing, fading out after the finish. */
export function nameTagAlpha(sinceFinish: number | null): number {
  if (sinceFinish === null) return 1;
  return clamp01(1 - sinceFinish / MOTION.tagFadeSeconds);
}

/** Initial stride phase for a 0-based lane index. */
export function initialStridePhase(laneIndex: number): number {
  const value = laneIndex * MOTION.lanePhaseOffset;
  return value - Math.floor(value);
}

/** Visual state of one runner, read by the renderer. */
export interface RunnerMotion {
  readonly stridePhase: number;
  readonly amplitude: number;
  readonly drive: number;
  readonly tagAlpha: number;
  /** Presentation seconds since the runner finished, or null while racing. */
  readonly sinceFinish: number | null;
}

/** Tracks per-lane visual motion for the current race. */
export interface MotionTracker {
  /**
   * Advances every runner. `simDt` drives the stride (it scales with
   * playback speed), `presentationDt` drives post-finish fades (it stops
   * while paused).
   */
  advance(race: Race, simDt: number, presentationDt: number): void;
  /** Motion for the runner in 0-based lane index `laneIndex`. */
  runner(race: Race, laneIndex: number): RunnerMotion;
  reset(): void;
}

export function createMotionTracker(laneCount: number): MotionTracker {
  const phases = Array.from({ length: laneCount }, (_, index) => initialStridePhase(index));
  const sinceFinish: (number | null)[] = new Array<number | null>(laneCount).fill(null);

  return {
    advance(race, simDt, presentationDt) {
      race.runners.forEach((runner, index) => {
        phases[index] = advanceStridePhase(phases[index] ?? 0, runner.speed, simDt);
        if (runner.place > 0) {
          const current = sinceFinish[index] ?? null;
          sinceFinish[index] = current === null ? 0 : current + presentationDt;
        }
      });
    },
    runner(race, laneIndex) {
      const runner = race.runners[laneIndex];
      const finished = sinceFinish[laneIndex] ?? null;
      if (runner === undefined) {
        return { stridePhase: 0, amplitude: 0, drive: 0, tagAlpha: 1, sinceFinish: null };
      }
      return {
        stridePhase: phases[laneIndex] ?? 0,
        amplitude: gallopAmplitude(runner.speed),
        drive: driveIntensity(runner.position / race.distance, finished),
        tagAlpha: nameTagAlpha(finished),
        sinceFinish: finished,
      };
    },
    reset() {
      for (let index = 0; index < laneCount; index++) {
        phases[index] = initialStridePhase(index);
        sinceFinish[index] = null;
      }
    },
  };
}
