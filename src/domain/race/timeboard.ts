import { OPTIMAL_CONDITION } from '../condition';
import { invariant } from '../errors';
import type { RaceView } from './createRace';
import { cruisingSpeed, PHYSICS } from './physics';

/**
 * Timeboard (display) time.
 *
 * The engine runs in compressed simulation seconds so that a race plays out
 * in roughly 10-25 seconds on screen. Spectators, however, expect broadcast
 * durations (about a minute for 1000 m). The timeboard maps simulation time
 * to display time with one factor per race distance:
 *
 *   displaySeconds = simSeconds × timeboardScale(distance)
 *
 * The factor is chosen so that a horse of nominal condition finishes in a
 * realistic time for the distance. Because it is a single positive constant
 * per round it is purely presentational: it preserves finishing order, ties
 * and every gap ratio, it never feeds back into the fixed-step engine or the
 * pause-aware playback clock, and the live clock and official times always
 * agree (a runner's official time equals the clock reading at its crossing).
 */
export const TIMEBOARD = Object.freeze({
  /** Distance at which the reference time is defined, in metres. */
  referenceDistance: 1000,
  /** Display time of a nominal-condition horse over the reference distance. */
  referenceSeconds: 60,
  /** Average speed lost per extra kilometre (stamina), in m/s. */
  speedLossPerKm: 0.35,
  /** Condition of the calibration horse: race fit, at the performance optimum. */
  nominalCondition: OPTIMAL_CONDITION,
});

const assertDistance = (distance: number): void => {
  invariant(
    Number.isFinite(distance) && distance > 0,
    'INVALID_ARGUMENT',
    `Distance must be a positive finite number, received ${String(distance)}.`,
  );
};

/** Realistic average speed (m/s) of a nominal horse over `distance`; slower over longer trips. */
export function realisticPace(distance: number): number {
  assertDistance(distance);
  const referencePace = TIMEBOARD.referenceDistance / TIMEBOARD.referenceSeconds;
  const extraKm = (distance - TIMEBOARD.referenceDistance) / 1000;
  return referencePace - extraKm * TIMEBOARD.speedLossPerKm;
}

/** Realistic display duration of a nominal horse over `distance`, in seconds. */
export function realisticDuration(distance: number): number {
  return distance / realisticPace(distance);
}

/**
 * Simulation duration of a nominal horse over `distance`: cruising time plus
 * the start lag (exponential acceleration time constant and the average gate
 * reaction delay). Derived from {@link PHYSICS}, so re-tuning the engine keeps
 * the timeboard calibrated.
 */
export function nominalSimDuration(distance: number): number {
  assertDistance(distance);
  const speed = cruisingSpeed(TIMEBOARD.nominalCondition, 0);
  const startLag = 1 / PHYSICS.accelerationRate + PHYSICS.maxStartDelay / 2;
  return distance / speed + startLag;
}

/** Display seconds per simulation second for a race over `distance`. */
export function timeboardScale(distance: number): number {
  return realisticDuration(distance) / nominalSimDuration(distance);
}

/** Converts simulation seconds of a race over `distance` into timeboard seconds. */
export function toTimeboardSeconds(simSeconds: number, distance: number): number {
  invariant(
    Number.isFinite(simSeconds) && simSeconds >= 0,
    'INVALID_ARGUMENT',
    `Simulation time must be finite and non-negative, received ${String(simSeconds)}.`,
  );
  return simSeconds * timeboardScale(distance);
}

/**
 * Formats timeboard seconds as `m:ss.cc` (e.g. `1:12.48`, `0:58.31`). The
 * width is constant below ten minutes, so ticking digits never shift layout.
 * Rounds to whole hundredths first, so 59.999 reads `1:00.00`, never `0:60.00`.
 */
export function formatTimeboard(seconds: number): string {
  const hundredths = Number.isFinite(seconds) ? Math.max(0, Math.round(seconds * 100)) : 0;
  const minutes = Math.floor(hundredths / 6000);
  const rest = hundredths - minutes * 6000;
  const secs = Math.floor(rest / 100);
  const cents = rest - secs * 100;
  return `${minutes}:${String(secs).padStart(2, '0')}.${String(cents).padStart(2, '0')}`;
}

/**
 * What the race clock shows, in timeboard seconds: elapsed race time while
 * running, frozen at the last runner's official time once all have finished.
 * Driven only by the race's tick count, so it stops while paused and never
 * jumps after a tab switch.
 */
export function timeboardReading(race: RaceView): number {
  const last = race.standings[race.standings.length - 1];
  const simSeconds =
    race.isFinished && last !== undefined && last.finishTime !== null
      ? last.finishTime
      : race.elapsed;
  return toTimeboardSeconds(simSeconds, race.distance);
}

/** Official finish time of a race over `distance` as shown to spectators. */
export function formatOfficialTime(simSeconds: number, distance: number): string {
  return formatTimeboard(toTimeboardSeconds(simSeconds, distance));
}
