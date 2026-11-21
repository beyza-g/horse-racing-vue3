import { CONDITION_MAX } from '../constants';
import { invariant } from '../errors';
import { randomBetween, type Rng } from '../random';

/**
 * Fixed simulation timestep in seconds. The race engine only ever advances by
 * whole ticks of this size, so outcomes never depend on frame rate or
 * playback speed.
 */
export const SIM_STEP = 1 / 120;

/** Hard ceiling on simulated race duration, guarding against runaway loops. */
export const MAX_RACE_SECONDS = 120;

/**
 * Tuning constants for the default pace model (the single source of truth
 * for race physics). Speeds are metres per simulation second.
 */
export const PHYSICS = Object.freeze({
  /** Base cruising speed before condition and jitter. */
  baseSpeed: 88,
  /** Extra cruising speed per condition point. */
  conditionSpeedGain: 0.32,
  /** Per-race random cruising-speed offset, +/- this value. */
  baseSpeedJitter: 4,
  /** Maximum random reaction delay when the gates open. */
  maxStartDelay: 0.3,
  /** Relative amplitude of in-race speed variation. */
  noiseAmplitude: 0.045,
  /** Sine waves summed into the pace noise. Weights sum to 1. */
  noiseWaves: Object.freeze([
    Object.freeze({ frequency: 0.8, weight: 0.5 }),
    Object.freeze({ frequency: 2.1, weight: 0.3 }),
    Object.freeze({ frequency: 0.37, weight: 0.2 }),
  ]),
  /** Race progress after which fatigue starts. */
  fatigueOnset: 0.5,
  /** Maximum speed lost to fatigue by a condition-0 horse at the line. */
  fatigueStrength: 0.07,
  /** Distance scaling: fatigue multiplier = base + gain * distance / reference. */
  fatigueDistanceBase: 0.6,
  fatigueDistanceGain: 0.6,
  fatigueReferenceDistance: 2200,
  /** Exponential approach rates (per second) towards the target speed. */
  accelerationRate: 1.1,
  decelerationRate: 0.8,
  /** After the line: pull-up speed as a share of base speed, fading to zero. */
  pullUpSpeedRatio: 0.55,
  /** After the line: distance (share of race distance) over which horses pull up. */
  pullUpDistanceRatio: 0.1,
  pullUpRate: 1.6,
});

const NOISE_PHASE_COUNT = 3;

/** Per-runner constants drawn once when a race is created. */
export interface RunnerProfile {
  readonly condition: number;
  /** Cruising speed in m/s. */
  readonly baseSpeed: number;
  /** Seconds after the start before the runner moves. */
  readonly startDelay: number;
  /** Phase offsets (radians) for the pace noise waves. */
  readonly noisePhases: readonly [number, number, number];
}

/** Builds a runner's profile from its condition. Consumes the rng in a fixed order. */
export type ProfileStrategy = (condition: number, rng: Rng) => RunnerProfile;

/**
 * Target speed for an unfinished runner. Receives primitives only, so the
 * hot loop allocates nothing.
 */
export type PaceStrategy = (
  profile: RunnerProfile,
  progress: number,
  elapsed: number,
  distance: number,
) => number;

/** Cruising speed for a condition plus a jitter offset. */
export function cruisingSpeed(condition: number, jitter: number): number {
  return PHYSICS.baseSpeed + condition * PHYSICS.conditionSpeedGain + jitter;
}

/** Default profile: condition-driven cruising speed with seeded jitter, delay and noise phases. */
export const defaultProfile: ProfileStrategy = (condition, rng) => {
  const jitter = randomBetween(rng, -PHYSICS.baseSpeedJitter, PHYSICS.baseSpeedJitter);
  const startDelay = randomBetween(rng, 0, PHYSICS.maxStartDelay);
  const phases: [number, number, number] = [0, 0, 0];
  for (let i = 0; i < NOISE_PHASE_COUNT; i++) phases[i] = randomBetween(rng, 0, Math.PI * 2);
  return Object.freeze({
    condition,
    baseSpeed: cruisingSpeed(condition, jitter),
    startDelay,
    noisePhases: Object.freeze(phases),
  });
};

/**
 * Speed multiplier in (0, 1] from fatigue. 1 until the onset point, then
 * falling linearly to the line. Better condition and shorter races fade less.
 */
export function fatigueFactor(progress: number, condition: number, distance: number): number {
  if (progress <= PHYSICS.fatigueOnset) return 1;
  const late = (Math.min(progress, 1) - PHYSICS.fatigueOnset) / (1 - PHYSICS.fatigueOnset);
  const weakness = 1 - condition / CONDITION_MAX;
  const distanceScale =
    PHYSICS.fatigueDistanceBase +
    (distance / PHYSICS.fatigueReferenceDistance) * PHYSICS.fatigueDistanceGain;
  return 1 - late * weakness * PHYSICS.fatigueStrength * distanceScale;
}

/** Smooth pace variation in [-1, 1]: a weighted sum of phase-shifted sine waves. */
export function paceNoise(elapsed: number, phases: readonly [number, number, number]): number {
  let sum = 0;
  const waves = PHYSICS.noiseWaves;
  for (let i = 0; i < NOISE_PHASE_COUNT; i++) {
    const wave = waves[i];
    const phase = phases[i];
    if (wave !== undefined && phase !== undefined) {
      sum += Math.sin(elapsed * wave.frequency + phase) * wave.weight;
    }
  }
  return sum;
}

/** Default pace: cruising speed, modulated by noise and reduced by fatigue. */
export const conditionPace: PaceStrategy = (profile, progress, elapsed, distance) =>
  profile.baseSpeed *
  (1 + PHYSICS.noiseAmplitude * paceNoise(elapsed, profile.noisePhases)) *
  fatigueFactor(progress, profile.condition, distance);

/**
 * Moves `current` towards `target` with exponential smoothing. The blend
 * factor is capped at 1, so a large `dt` lands on the target, never past it.
 */
export function approachSpeed(
  current: number,
  target: number,
  dt: number,
  riseRate: number,
  fallRate: number,
): number {
  const rate = current < target ? riseRate : fallRate;
  return current + (target - current) * Math.min(1, dt * rate);
}

/** Target speed after crossing the line: fades linearly to 0 over the pull-up distance. */
export function pullUpTargetSpeed(baseSpeed: number, overrun: number, distance: number): number {
  const pullUpDistance = distance * PHYSICS.pullUpDistanceRatio;
  return baseSpeed * PHYSICS.pullUpSpeedRatio * Math.max(0, 1 - overrun / pullUpDistance);
}

/**
 * Exact time the nose crossed `distance` within one step, assuming constant
 * speed across the step (linear interpolation between the two positions).
 */
export function interpolateCrossingTime(
  stepStart: number,
  dt: number,
  fromPosition: number,
  toPosition: number,
  distance: number,
): number {
  invariant(
    toPosition > fromPosition && fromPosition <= distance && toPosition >= distance,
    'INVALID_ARGUMENT',
    `Positions ${String(fromPosition)} -> ${String(toPosition)} do not cross ${String(distance)}.`,
  );
  return stepStart + (dt * (distance - fromPosition)) / (toPosition - fromPosition);
}
