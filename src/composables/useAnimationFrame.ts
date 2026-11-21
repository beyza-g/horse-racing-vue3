import { onBeforeUnmount, onMounted } from 'vue';

export interface AnimationFrameOptions {
  /**
   * Receives an error thrown by the frame callback. Defaults to
   * `console.error`. Reported once per run of consecutive failing frames, so
   * a persistent fault does not flood the console at 60 frames per second.
   */
  readonly onError?: (error: unknown) => void;
}

const reportToConsole = (error: unknown): void => {
  console.error('Animation frame callback failed; the loop keeps running.', error);
};

/**
 * Calls `callback` once per animation frame with the raw wall-clock delta in
 * seconds (0 on the first frame). Clamping and pausing are the playback
 * clock's job, not this loop's. Starts on mount and stops on unmount.
 *
 * A throwing callback never kills the loop: the error is reported and the
 * next frame is still scheduled, so a transient fault cannot silently freeze
 * the game. `stop()` called from inside the callback is honoured.
 */
export function useAnimationFrame(
  callback: (wallDt: number) => void,
  options: AnimationFrameOptions = {},
): {
  start: () => void;
  stop: () => void;
} {
  const report = options.onError ?? reportToConsole;
  let handle: number | null = null;
  let last: number | null = null;
  let running = false;
  let failing = false;

  const loop = (timestamp: number): void => {
    const dt = last === null ? 0 : (timestamp - last) / 1000;
    last = timestamp;
    try {
      callback(dt);
      failing = false;
    } catch (error) {
      if (!failing) report(error);
      failing = true;
    }
    handle = running ? requestAnimationFrame(loop) : null;
  };

  const start = (): void => {
    if (running) return;
    running = true;
    failing = false;
    last = null;
    handle = requestAnimationFrame(loop);
  };

  const stop = (): void => {
    running = false;
    if (handle !== null) cancelAnimationFrame(handle);
    handle = null;
  };

  onMounted(start);
  onBeforeUnmount(stop);
  return { start, stop };
}
