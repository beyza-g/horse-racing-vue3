/** Results panel view models: the board (live, official or gate order) and completed rounds. */
import { formatOfficialTime, ROUND_DISTANCES, type HorseId } from '@/domain';
import { formatOrdinal } from '@/playback';
import {
  currentRoundPill,
  hasProgram,
  isRacing,
  MEDALS,
  type Medal,
  type Pill,
  type RaceViewState,
} from './shared';

/** Board row height in pixels; rows are absolutely positioned so reordering never shifts layout. */
export const BOARD_ROW_HEIGHT = 26;

export interface BoardRow {
  readonly horseId: HorseId;
  readonly name: string;
  readonly color: string;
  /** Pixel offset for the row; changes animate, layout never shifts. */
  readonly top: number;
  /** "1st" ... or "L3" (lane) while at the gates. */
  readonly position: string;
  readonly podium: boolean;
  /** Gold, silver or bronze for the top three once the field has left the gates. */
  readonly medal: Medal | null;
  readonly time: string;
  readonly finished: boolean;
  readonly emphasized: boolean;
  readonly followed: boolean;
}

export interface BoardView {
  /** Round shown, or -1 with no program. */
  readonly roundIndex: number;
  readonly title: string;
  readonly distance: string;
  readonly pill: Pill | null;
  readonly rows: readonly BoardRow[];
  readonly showBackToLive: boolean;
}

/** Round the results board shows: the inspected one, else the live one, else the latest official one. */
export function boardRoundIndex(s: RaceViewState): number {
  if (s.inspectedRound !== null) return s.inspectedRound;
  if (!hasProgram(s)) return -1;
  const latest = s.results.length - 1;
  if (['ready', 'countdown', 'running', 'settling'].includes(s.phase)) return s.roundIndex;
  return latest >= 0 ? latest : s.roundIndex;
}

/** The results board: live order, official result, or gate order. */
export function buildBoard(s: RaceViewState): BoardView {
  const index = boardRoundIndex(s);
  const round = index >= 0 ? s.program?.rounds[index] : undefined;
  if (round === undefined) {
    return {
      roundIndex: -1,
      title: 'Results',
      distance: '',
      pill: null,
      rows: [],
      showBackToLive: false,
    };
  }
  const result = s.results[index];
  const liveOrder =
    index === s.roundIndex && isRacing(s) && result === undefined ? s.liveOrder : null;
  const live = liveOrder !== null;
  const atGates = result === undefined && !live;

  const ranks = new Map<HorseId, { rank: number; label: string; finished: boolean }>();
  if (result !== undefined) {
    result.finishers.forEach((f, rank) => {
      ranks.set(f.horseId, {
        rank,
        label: formatOfficialTime(f.time, result.distance),
        finished: true,
      });
    });
  } else if (liveOrder !== null) {
    for (const entry of liveOrder) ranks.set(entry.horseId, entry);
  }

  const rows = round.lineup.map((horseId, lane): BoardRow => {
    const horse = s.horses.get(horseId);
    const entry = ranks.get(horseId) ?? { rank: lane, label: '', finished: false };
    const followed = horseId === s.followedHorseId;
    return {
      horseId,
      name: horse?.name ?? `Horse ${horseId}`,
      color: horse?.color ?? 'transparent',
      top: entry.rank * BOARD_ROW_HEIGHT,
      position: atGates ? `L${lane + 1}` : formatOrdinal(entry.rank + 1),
      podium: !atGates && entry.rank < 3,
      medal: atGates ? null : (MEDALS[entry.rank] ?? null),
      time: entry.label,
      finished: entry.finished,
      emphasized: followed || (entry.rank === 0 && entry.finished),
      followed,
    };
  });

  let pill: Pill | null = null;
  if (result !== undefined) pill = { label: 'Official', tone: 'official' };
  else if (live)
    pill = s.paused ? { label: 'Paused', tone: 'paused' } : { label: 'Live order', tone: 'live' };
  else pill = currentRoundPill(s);

  return {
    roundIndex: index,
    title: `Round ${index + 1}`,
    distance: `${round.distance}m`,
    pill,
    rows,
    showBackToLive:
      s.inspectedRound !== null &&
      hasProgram(s) &&
      s.phase !== 'complete' &&
      s.inspectedRound !== s.roundIndex,
  };
}

export interface CompletedRoundRow {
  readonly roundIndex: number;
  readonly label: string;
  readonly distance: string;
  readonly winnerId: HorseId;
  readonly winnerName: string;
  readonly winnerColor: string;
  readonly time: string;
  readonly selected: boolean;
  readonly followed: boolean;
}

export interface LiveRoundRow {
  readonly label: string;
  readonly distance: string;
  readonly text: string;
  readonly pill: Pill;
}

export interface CompletedRoundsView {
  readonly rows: readonly CompletedRoundRow[];
  readonly liveRow: LiveRoundRow | null;
  readonly count: string;
  readonly showHint: boolean;
}

/** Winners of finished rounds plus a row for the round in progress. */
export function buildCompletedRounds(s: RaceViewState): CompletedRoundsView {
  const selected = boardRoundIndex(s);
  const rows = s.results.flatMap((result): CompletedRoundRow[] => {
    const winner = result.finishers[0];
    if (winner === undefined) return [];
    const horse = s.horses.get(winner.horseId);
    return [
      {
        roundIndex: result.roundIndex,
        label: `R${result.roundIndex + 1}`,
        distance: `${result.distance}m`,
        winnerId: winner.horseId,
        winnerName: horse?.name ?? `Horse ${winner.horseId}`,
        winnerColor: horse?.color ?? 'transparent',
        time: formatOfficialTime(winner.time, result.distance),
        selected: result.roundIndex === selected,
        followed: winner.horseId === s.followedHorseId,
      },
    ];
  });
  const inProgress =
    hasProgram(s) && s.phase !== 'complete' && s.results[s.roundIndex] === undefined;
  const liveRow: LiveRoundRow | null = inProgress
    ? {
        label: `R${s.roundIndex + 1}`,
        distance: `${ROUND_DISTANCES[s.roundIndex] ?? 0}m`,
        text: isRacing(s) ? 'Running now' : 'Next up',
        pill: currentRoundPill(s),
      }
    : null;
  return {
    rows,
    liveRow,
    count: `${rows.length} / ${ROUND_DISTANCES.length}`,
    showHint: rows.length === 0 && liveRow === null,
  };
}

/** Winners for the completion dialog. */
export function buildCompletionWinners(s: RaceViewState): readonly CompletedRoundRow[] {
  return buildCompletedRounds({ ...s, inspectedRound: null }).rows;
}
