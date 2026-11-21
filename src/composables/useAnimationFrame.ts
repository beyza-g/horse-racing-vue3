import { onBeforeUnmount, onMounted } from 'vue';

/**
 * Calls `callback` once per animation frame with the raw wall-clock delta in
 * seconds (0 on the first frame). Clamping and pausing are the playback
 * clock's job, not this loop's. Starts on mount and stops on unmount.
 */
export function useAnimationFrame(callback: (wallDt: number) => void): {
  start: () => void;
  stop: () => void;
} {
  let handle: number | null = null;
  let last: number | null = null;

  const loop = (timestamp: number): void => {
    const dt = last === null ? 0 : (timestamp - last) / 1000;
    last = timestamp;
    callback(dt);
    handle = requestAnimationFrame(loop);
  };

  const start = (): void => {
    if (handle !== null) return;
    last = null;
    handle = requestAnimationFrame(loop);
  };

  const stop = (): void => {
    if (handle !== null) cancelAnimationFrame(handle);
    handle = null;
  };

  onMounted(start);
  onBeforeUnmount(stop);
  return { start, stop };
}
