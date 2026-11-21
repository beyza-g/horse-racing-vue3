import { DomainError } from '../domain';

/** Longest wall-clock frame the playback accepts, in seconds (tab switches, debugger stops). */
export const MAX_FRAME_DT = 0.05;

/** Playback speed multipliers offered by the UI. */
export const PLAYBACK_SPEEDS = [1, 2, 4] as const;

export type PlaybackSpeed = (typeof PLAYBACK_SPEEDS)[number];

/** Narrows an arbitrary number to a supported playback speed. */
export function isPlaybackSpeed(value: number): value is PlaybackSpeed {
  return (PLAYBACK_SPEEDS as readonly number[]).includes(value);
}

/**
 * Turns a raw wall-clock delta into a safe one: negative, `NaN` or infinite
 * deltas become 0, and long frames are clamped to {@link MAX_FRAME_DT}.
 */
export function sanitizeFrameDt(wallDt: number): number {
  if (!Number.isFinite(wallDt) || wallDt <= 0) return 0;
  return Math.min(wallDt, MAX_FRAME_DT);
}

/** What one frame contributes to playback. */
export interface ClockFrame {
  /**
   * Presentation seconds that elapsed this frame: the sanitized wall delta,
   * or 0 while paused. Every time-based animation (including the finish
   * slow motion) must advance on this value, never on wall-clock time.
   */
  readonly presentationDt: number;
  readonly speed: PlaybackSpeed;
  readonly paused: boolean;
}

export interface PlaybackClock {
  readonly paused: boolean;
  readonly speed: PlaybackSpeed;
  /** Total presentation seconds while unpaused. Stops while paused. */
  readonly presentationTime: number;
  pause(): void;
  resume(): void;
  /** Returns the new paused state. */
  togglePause(): boolean;
  setSpeed(speed: number): void;
  /** Consumes one wall-clock frame delta. */
  advance(wallDt: number): ClockFrame;
  /** Back to unpaused with presentation time 0. The speed is a preference and is kept. */
  reset(): void;
}

export interface PlaybackClockOptions {
  readonly speed?: number;
  readonly paused?: boolean;
}

function assertSpeed(speed: number): PlaybackSpeed {
  if (!isPlaybackSpeed(speed)) {
    throw new DomainError(
      'INVALID_ARGUMENT',
      `Playback speed must be one of ${PLAYBACK_SPEEDS.join(', ')}, received ${String(speed)}.`,
    );
  }
  return speed;
}

/** Creates the playback clock: wall dt in, clamped and pause-aware presentation dt out. */
export function createPlaybackClock(options: PlaybackClockOptions = {}): PlaybackClock {
  let speed = assertSpeed(options.speed ?? 1);
  let paused = options.paused ?? false;
  let presentationTime = 0;

  return {
    get paused() {
      return paused;
    },
    get speed() {
      return speed;
    },
    get presentationTime() {
      return presentationTime;
    },
    pause() {
      paused = true;
    },
    resume() {
      paused = false;
    },
    togglePause() {
      paused = !paused;
      return paused;
    },
    setSpeed(next) {
      speed = assertSpeed(next);
    },
    advance(wallDt) {
      const presentationDt = paused ? 0 : sanitizeFrameDt(wallDt);
      presentationTime += presentationDt;
      return { presentationDt, speed, paused };
    },
    reset() {
      paused = false;
      presentationTime = 0;
    },
  };
}
