import { DomainError, gapToLeader, type HorseId, type Race } from '../domain';

/** Minimum presentation seconds between live-order publications. */
export const LIVE_ORDER_INTERVAL = 0.25;

/** One row of the live leaderboard. */
export interface LiveOrderEntry {
  readonly horseId: HorseId;
  /** Zero-based live rank. */
  readonly rank: number;
  /** Official time ("10.74s") once finished, "+3m" behind the leader, or "" for the leader. */
  readonly label: string;
  readonly finished: boolean;
}

/** Formats an official time in seconds with two decimals. */
export function formatRaceTime(seconds: number): string {
  return `${seconds.toFixed(2)}s`;
}

/** Ordinal for a 1-based place: 1st, 2nd, 3rd, 4th, ..., 11th, 12th, 13th, 21st. */
export function formatOrdinal(place: number): string {
  const lastTwo = place % 100;
  const last = place % 10;
  const suffix =
    lastTwo >= 11 && lastTwo <= 13
      ? 'th'
      : last === 1
        ? 'st'
        : last === 2
          ? 'nd'
          : last === 3
            ? 'rd'
            : 'th';
  return `${place}${suffix}`;
}

/** Builds the live leaderboard from the race's current standings. */
export function buildLiveOrder(race: Race): readonly LiveOrderEntry[] {
  const standings = race.standings;
  const leader = standings[0];
  return standings.map((runner, rank) => {
    const finished = runner.finishTime !== null;
    let label = '';
    if (runner.finishTime !== null) label = formatRaceTime(runner.finishTime);
    else if (rank > 0 && leader !== undefined) {
      label = `+${Math.max(1, Math.round(gapToLeader(leader, runner, race.distance)))}m`;
    }
    return { horseId: runner.horseId, rank, label, finished };
  });
}

/**
 * Rate limiter for publishing the live order into reactive state. Publishes
 * at most once per `interval`, or immediately when forced (a runner
 * finished), and never when nothing changed.
 */
export interface PublishGate {
  /** Returns true if the caller should publish now. */
  update(dt: number, changed: boolean, force: boolean): boolean;
  reset(): void;
}

export function createPublishGate(interval: number = LIVE_ORDER_INTERVAL): PublishGate {
  if (!Number.isFinite(interval) || interval < 0) {
    throw new DomainError(
      'INVALID_ARGUMENT',
      `Interval must be finite and non-negative, received ${String(interval)}.`,
    );
  }
  let sincePublish = interval;
  let pending = false;

  return {
    update(dt, changed, force) {
      sincePublish += Number.isFinite(dt) && dt > 0 ? dt : 0;
      pending ||= changed;
      if (!pending && !force) return false;
      if (force || sincePublish >= interval) {
        sincePublish = 0;
        pending = false;
        return true;
      }
      return false;
    },
    reset() {
      sincePublish = interval;
      pending = false;
    },
  };
}
