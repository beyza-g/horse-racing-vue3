/** Program standings view model: points, per-round placings, form and rank movement. */
import { computeProgramStandings, formFigures, ROUND_DISTANCES, type HorseId } from '../domain';
import { formatOrdinal } from '../playback';
import { MEDALS, pad, type Medal, type RaceViewState } from './shared';

/** A horse's result in one round of the program. */
export interface StandingCell {
  /** "1st" when placed, "" otherwise. */
  readonly label: string;
  readonly medal: Medal | null;
  /** placed: official result; pending: entered, not yet official; absent: not running. */
  readonly state: 'placed' | 'pending' | 'absent';
}

/**
 * Change in standings rank caused by the latest official round, like a
 * league table's movement column. Only for horses ranked both before and
 * after that round, and only when they moved.
 */
export interface StandingMovement {
  readonly direction: 'up' | 'down';
  readonly places: number;
  /** e.g. "up 2 places since round 3". */
  readonly spoken: string;
}

export interface StandingRow {
  readonly horseId: HorseId;
  /** "1", "=3" for a shared rank, or "–" before the horse has an official run. */
  readonly rank: string;
  readonly number: string;
  readonly name: string;
  readonly color: string;
  readonly points: number;
  readonly starts: number;
  readonly wins: number;
  /** Racing form figures, e.g. "2107". */
  readonly form: string;
  readonly cells: readonly StandingCell[];
  readonly followed: boolean;
  readonly movement: StandingMovement | null;
  /** Full sentence for tooltips and screen readers. */
  readonly description: string;
}

export interface StandingsView {
  readonly rows: readonly StandingRow[];
  /** Official rounds counted so far. */
  readonly officialRounds: number;
  readonly hasResults: boolean;
  /** Round column headers, e.g. "R1". */
  readonly rounds: readonly { readonly label: string; readonly title: string }[];
}

const plural = (count: number, noun: string): string => `${count} ${noun}${count === 1 ? '' : 's'}`;

/** Program standings across rounds: points, placings per round and form. */
export function buildStandings(s: RaceViewState): StandingsView {
  const ids = [...s.horses.keys()];
  const table = computeProgramStandings(ids, s.results);
  const hasResults = s.results.length > 0;
  // Ranks before the latest official round, for the movement column.
  const previousRound = s.results.length - 1;
  const previousRanks = new Map<HorseId, number>(
    s.results.length >= 2
      ? computeProgramStandings(ids, s.results.slice(0, -1))
          .filter((standing) => standing.starts > 0)
          .map((standing) => [standing.horseId, standing.rank])
      : [],
  );
  const rows = table.map((standing): StandingRow => {
    const horse = s.horses.get(standing.horseId);
    const name = horse?.name ?? `Horse ${standing.horseId}`;
    const cells = ROUND_DISTANCES.map((_, roundIndex): StandingCell => {
      const place = standing.places[roundIndex] ?? null;
      if (place !== null) {
        return { label: formatOrdinal(place), medal: MEDALS[place - 1] ?? null, state: 'placed' };
      }
      const entered = s.program?.rounds[roundIndex]?.lineup.includes(standing.horseId) ?? false;
      return { label: '', medal: null, state: entered ? 'pending' : 'absent' };
    });
    const placings = standing.places
      .map((place, i) => (place === null ? null : `${formatOrdinal(place)} in round ${i + 1}`))
      .filter((text): text is string => text !== null);
    const raced = standing.starts > 0;
    const before = previousRanks.get(standing.horseId);
    const shift = before === undefined || !raced ? 0 : before - standing.rank;
    const movement: StandingMovement | null =
      shift === 0
        ? null
        : {
            direction: shift > 0 ? 'up' : 'down',
            places: Math.abs(shift),
            spoken: `${shift > 0 ? 'up' : 'down'} ${plural(Math.abs(shift), 'place')} since round ${previousRound}`,
          };
    return {
      horseId: standing.horseId,
      rank: raced ? `${standing.tied ? '=' : ''}${standing.rank}` : '–',
      number: pad(standing.horseId),
      name,
      color: horse?.color ?? 'transparent',
      points: standing.points,
      starts: standing.starts,
      wins: standing.wins,
      form: formFigures(standing.places),
      cells,
      followed: standing.horseId === s.followedHorseId,
      movement,
      description: raced
        ? `${name}: rank ${standing.tied ? 'equal ' : ''}${standing.rank}${movement ? ` (${movement.spoken})` : ''}, ${plural(standing.points, 'point')} from ${plural(standing.starts, 'run')} (${placings.join(', ')})`
        : `${name}: no official run yet`,
    };
  });
  return {
    rows,
    officialRounds: s.results.length,
    hasResults,
    rounds: ROUND_DISTANCES.map((distance, i) => ({
      label: `R${i + 1}`,
      title: `Round ${i + 1} · ${distance}m`,
    })),
  };
}
