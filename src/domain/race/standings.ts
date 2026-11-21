import type { HorseId } from '../types';

/** The fields standings logic needs from a runner. */
export interface StandingEntry {
  readonly horseId: HorseId;
  /** One-based lane. */
  readonly lane: number;
  /** Metres from the start (may exceed the race distance after finishing). */
  readonly position: number;
  /** One-based official place, or 0 while still running. */
  readonly place: number;
  /** Interpolated crossing time, or null while still running. */
  readonly finishTime: number | null;
}

type CrossingEntry = Pick<StandingEntry, 'horseId' | 'finishTime'>;

/**
 * Official tie-break: earlier crossing time first, then lower horse ID.
 * Runners without a crossing time sort last.
 */
export function compareCrossings(a: CrossingEntry, b: CrossingEntry): number {
  const aTime = a.finishTime ?? Number.POSITIVE_INFINITY;
  const bTime = b.finishTime ?? Number.POSITIVE_INFINITY;
  if (aTime !== bTime) return aTime < bTime ? -1 : 1;
  return a.horseId - b.horseId;
}

/**
 * Live order: placed runners first (by place), then runners still racing
 * (furthest first). Runners level on distance keep gate order (lane), so
 * the board matches the gates before the start.
 */
export function compareLive(a: StandingEntry, b: StandingEntry): number {
  const aPlaced = a.place > 0;
  const bPlaced = b.place > 0;
  if (aPlaced && bPlaced) return a.place - b.place;
  if (aPlaced !== bPlaced) return aPlaced ? -1 : 1;
  return b.position - a.position || a.lane - b.lane;
}

/**
 * Stable in-place insertion sort. Runs in O(n) on nearly sorted input,
 * which live standings almost always are, and allocates nothing.
 * Returns true if any element moved.
 */
export function insertionSortInPlace<T>(items: T[], compare: (a: T, b: T) => number): boolean {
  let moved = false;
  for (let i = 1; i < items.length; i++) {
    const current = items[i] as T;
    let j = i - 1;
    while (j >= 0 && compare(items[j] as T, current) > 0) {
      items[j + 1] = items[j] as T;
      j--;
    }
    if (j !== i - 1) {
      items[j + 1] = current;
      moved = true;
    }
  }
  return moved;
}

/**
 * Metres a runner trails the leader, measured up to the finish line. A
 * runner that has finished, or is the leader, is 0 behind.
 */
export function gapToLeader(
  leader: StandingEntry,
  runner: StandingEntry,
  distance: number,
): number {
  if (runner.place > 0) return 0;
  return Math.max(0, Math.min(distance, leader.position) - runner.position);
}
