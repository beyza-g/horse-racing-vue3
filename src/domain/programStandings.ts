import { HORSE_COUNT, ROUND_COUNT, RUNNERS_PER_ROUND } from './constants';
import { invariant } from './errors';
import type { HorseId, RoundResult } from './types';

/**
 * Program standings: how each horse has done across the rounds of a program.
 *
 * Placings earn championship-style points, as in multi-race jockey
 * challenges: 10, 8, 6, 5, 4, 3, 2 and 1 for 1st to 8th, nothing for 9th and
 * 10th. Only official results count. Horses level on points are separated by
 * countback (more wins, then more seconds, and so on down the placings);
 * horses still level share a rank (standard competition ranking: 1, 2, 2, 4)
 * and are listed by horse ID for a stable order.
 */
export const PLACING_POINTS: readonly number[] = Object.freeze([10, 8, 6, 5, 4, 3, 2, 1, 0, 0]);

export interface ProgramStanding {
  readonly horseId: HorseId;
  /** 1-based rank; tied horses share it. */
  readonly rank: number;
  /** True if another horse shares this rank. */
  readonly tied: boolean;
  readonly points: number;
  /** Official rounds this horse ran. */
  readonly starts: number;
  readonly wins: number;
  /** Place per round index, or null if the horse did not run it or it is not official yet. */
  readonly places: readonly (number | null)[];
}

/** Points for a 1-based place. */
export function pointsForPlace(place: number): number {
  invariant(
    Number.isInteger(place) && place >= 1 && place <= RUNNERS_PER_ROUND,
    'INVALID_ARGUMENT',
    `Place must be an integer in [1, ${RUNNERS_PER_ROUND}], received ${String(place)}.`,
  );
  return PLACING_POINTS[place - 1] ?? 0;
}

/**
 * Racing-style form figures, oldest run first: one character per run, the
 * place for 1-9 and `0` for 10th (so "2107" reads 2nd, 1st, 10th, 7th).
 */
export function formFigures(places: readonly (number | null)[]): string {
  return places
    .filter((place): place is number => place !== null)
    .map((place) => (place >= 10 ? '0' : String(place)))
    .join('');
}

/** Counts of each place (index 0 = wins), used for countback. */
function placeCounts(places: readonly (number | null)[]): number[] {
  const counts = new Array<number>(RUNNERS_PER_ROUND).fill(0);
  for (const place of places) if (place !== null) counts[place - 1] = (counts[place - 1] ?? 0) + 1;
  return counts;
}

/** Negative if `a` ranks ahead of `b`, positive if behind, 0 if fully level. */
function compareStanding(
  a: { readonly points: number; readonly counts: readonly number[] },
  b: { readonly points: number; readonly counts: readonly number[] },
): number {
  if (a.points !== b.points) return b.points - a.points;
  for (let i = 0; i < RUNNERS_PER_ROUND; i++) {
    const diff = (b.counts[i] ?? 0) - (a.counts[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/**
 * Builds the standings of every horse in `horseIds` from the official
 * results so far. Pure and deterministic: the same results always give the
 * same table.
 */
export function computeProgramStandings(
  horseIds: readonly HorseId[],
  results: readonly RoundResult[],
): readonly ProgramStanding[] {
  invariant(
    horseIds.length <= HORSE_COUNT && new Set(horseIds).size === horseIds.length,
    'INVALID_ARGUMENT',
    'Standings need a list of distinct horse IDs.',
  );
  invariant(results.length <= ROUND_COUNT, 'INVALID_ARGUMENT', 'Too many round results.');

  const places = new Map<HorseId, (number | null)[]>(
    horseIds.map((id) => [id, new Array<number | null>(ROUND_COUNT).fill(null)]),
  );
  for (const result of results) {
    for (const finisher of result.finishers) {
      const row = places.get(finisher.horseId);
      invariant(row, 'INVALID_ARGUMENT', `Result names unknown horse ${finisher.horseId}.`);
      row[result.roundIndex] = finisher.place;
    }
  }

  const entries = horseIds.map((horseId) => {
    const row = places.get(horseId) ?? [];
    const counts = placeCounts(row);
    const points = row.reduce<number>(
      (sum, place) => sum + (place === null ? 0 : pointsForPlace(place)),
      0,
    );
    return {
      horseId,
      points,
      counts,
      starts: row.filter((place) => place !== null).length,
      wins: counts[0] ?? 0,
      places: Object.freeze(row.slice()),
    };
  });
  entries.sort((a, b) => compareStanding(a, b) || a.horseId - b.horseId);

  const standings: ProgramStanding[] = [];
  entries.forEach((entry, index) => {
    const previous = entries[index - 1];
    const next = entries[index + 1];
    const levelWithPrevious = previous !== undefined && compareStanding(previous, entry) === 0;
    const levelWithNext = next !== undefined && compareStanding(entry, next) === 0;
    const rank = levelWithPrevious ? (standings[index - 1]?.rank ?? index + 1) : index + 1;
    standings.push(
      Object.freeze({
        horseId: entry.horseId,
        rank,
        tied: levelWithPrevious || levelWithNext,
        points: entry.points,
        starts: entry.starts,
        wins: entry.wins,
        places: entry.places,
      }),
    );
  });
  return Object.freeze(standings);
}
