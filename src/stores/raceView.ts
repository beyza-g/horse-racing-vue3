/**
 * Pure view models for the race UI. Each builder turns a plain snapshot of
 * store state into exactly what a presentational component renders, so the
 * display rules are testable without Vue or Pinia.
 */
import {
  conditionBand,
  formatOfficialTime,
  hennekeGrade,
  ROUND_DISTANCES,
  toBodyConditionScore,
  type ConditionBand,
  type Horse,
  type HorseId,
  type Program,
  type RoundResult,
} from '@/domain';
import { formatOrdinal, type DirectorPhase, type LiveOrderEntry } from '@/playback';

export type PillTone = 'live' | 'paused' | 'gates' | 'official';

export interface Pill {
  readonly label: string;
  readonly tone: PillTone;
}

export interface RaceViewState {
  readonly horses: ReadonlyMap<HorseId, Horse>;
  readonly program: Program | null;
  readonly results: readonly RoundResult[];
  readonly phase: DirectorPhase;
  readonly paused: boolean;
  readonly roundIndex: number;
  readonly liveOrder: readonly LiveOrderEntry[] | null;
  readonly inspectedRound: number | null;
  readonly expandedRound: number | null;
  readonly followedHorseId: HorseId | null;
}

/** Board row height in pixels; rows are absolutely positioned so reordering never shifts layout. */
export const BOARD_ROW_HEIGHT = 26;

const IN_ROUND_PHASES: readonly DirectorPhase[] = [
  'ready',
  'countdown',
  'running',
  'settling',
  'intermission',
];

const hasProgram = (s: RaceViewState): boolean => s.program !== null;
const isRacing = (s: RaceViewState): boolean => s.phase === 'running' || s.phase === 'settling';
const roundLabel = (index: number): string =>
  `Round ${index + 1} · ${ROUND_DISTANCES[index] ?? 0}m`;
const pad = (id: number): string => String(id).padStart(2, '0');

/** Pill for the current, not yet official round. */
function currentRoundPill(s: RaceViewState): Pill {
  if (s.paused) return { label: 'Paused', tone: 'paused' };
  if (s.phase === 'countdown') return { label: 'Starting', tone: 'gates' };
  if (isRacing(s)) return { label: 'Live', tone: 'live' };
  return { label: 'At the gates', tone: 'gates' };
}

export type StatusDot = 'idle' | 'active' | 'muted' | 'steady';

export interface StatusView {
  readonly label: string;
  readonly pill: Pill | null;
  readonly dot: StatusDot;
}

/** Header status: what is happening right now. */
export function buildStatus(s: RaceViewState): StatusView {
  switch (s.phase) {
    case 'idle':
      return { label: 'No program', pill: null, dot: 'idle' };
    case 'ready':
      return { label: roundLabel(s.roundIndex), pill: currentRoundPill(s), dot: 'steady' };
    case 'countdown':
    case 'running':
    case 'settling':
      return {
        label: roundLabel(s.roundIndex),
        pill: currentRoundPill(s),
        dot: s.paused ? 'muted' : 'active',
      };
    case 'intermission':
      return {
        label: roundLabel(s.roundIndex),
        pill: s.paused
          ? { label: 'Paused', tone: 'paused' }
          : { label: 'Official', tone: 'official' },
        dot: s.paused ? 'muted' : 'steady',
      };
    case 'complete':
      return { label: 'Program complete', pill: null, dot: 'steady' };
  }
}

export type SegmentState = 'done' | 'current' | 'pending';

export interface ProgressSegment {
  readonly title: string;
  readonly state: SegmentState;
}

/** Six-segment round progress for the header. */
export function buildProgress(s: RaceViewState): readonly ProgressSegment[] {
  return ROUND_DISTANCES.map((distance, index) => ({
    title: `Round ${index + 1} · ${distance}m`,
    state:
      s.results[index] !== undefined
        ? 'done'
        : hasProgram(s) && index === s.roundIndex && s.phase !== 'complete'
          ? 'current'
          : 'pending',
  }));
}

export interface PlaybackControlView {
  /** Hidden once the program is complete; Generate is then the only path forward. */
  readonly visible: boolean;
  readonly enabled: boolean;
  readonly label: 'Start' | 'Pause' | 'Resume';
  readonly icon: 'play' | 'pause';
}

export function buildPlaybackControl(s: RaceViewState): PlaybackControlView {
  const enabled = IN_ROUND_PHASES.includes(s.phase);
  const running = enabled && s.phase !== 'ready' && !s.paused;
  return {
    visible: s.phase !== 'complete',
    enabled,
    label: running ? 'Pause' : s.paused ? 'Resume' : 'Start',
    icon: running ? 'pause' : 'play',
  };
}

/** Generate is the primary action before the first program and after completion. */
export function isGeneratePrimary(s: RaceViewState): boolean {
  return !hasProgram(s) || s.phase === 'complete';
}

export interface BoardRow {
  readonly horseId: HorseId;
  readonly name: string;
  readonly color: string;
  /** Pixel offset for the row; changes animate, layout never shifts. */
  readonly top: number;
  /** "1st" ... or "L3" (lane) while at the gates. */
  readonly position: string;
  readonly podium: boolean;
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

/** Visual tone of a condition: at the optimum, close to it, or well off it. */
export type ConditionTone = 'fit' | 'near' | 'off';

export interface ConditionView {
  readonly value: number;
  readonly band: ConditionBand;
  readonly tone: ConditionTone;
  /** Short band name, e.g. "Race fit". */
  readonly bandLabel: string;
  /** Full description for tooltips and screen readers. */
  readonly description: string;
}

const BAND_LABELS: Readonly<Record<ConditionBand, string>> = {
  underweight: 'Underweight',
  lean: 'Lean',
  'race-fit': 'Race fit',
  fleshy: 'Fleshy',
  overweight: 'Overweight',
};

const BAND_TONES: Readonly<Record<ConditionBand, ConditionTone>> = {
  underweight: 'off',
  lean: 'near',
  'race-fit': 'fit',
  fleshy: 'near',
  overweight: 'off',
};

/** Condition 1-100 with its body condition band, e.g. "44 · Race fit · BCS 4.5 (Moderately thin)". */
export function buildCondition(condition: number): ConditionView {
  const band = conditionBand(condition);
  const bcs = toBodyConditionScore(condition).toFixed(1);
  return {
    value: condition,
    band,
    tone: BAND_TONES[band],
    bandLabel: BAND_LABELS[band],
    description: `Condition ${condition} of 100 · ${BAND_LABELS[band]} · body condition ${bcs} of 9 (${hennekeGrade(condition)})`,
  };
}

const UNKNOWN_CONDITION: ConditionView = {
  value: 0,
  band: 'race-fit',
  tone: 'near',
  bandLabel: 'Unknown',
  description: 'Condition unknown',
};

export interface LineupRow {
  readonly lane: number;
  readonly horseId: HorseId;
  readonly number: string;
  readonly name: string;
  readonly color: string;
  readonly condition: ConditionView;
  readonly followed: boolean;
}

export interface RoundCardView {
  readonly index: number;
  readonly title: string;
  readonly distance: string;
  readonly pill: Pill | null;
  readonly current: boolean;
  readonly official: boolean;
  readonly expanded: boolean;
  readonly available: boolean;
  readonly lineup: readonly LineupRow[];
}

/** Program panel: one card per round with its line-up. */
export function buildRounds(s: RaceViewState): readonly RoundCardView[] {
  return ROUND_DISTANCES.map((distance, index): RoundCardView => {
    const round = s.program?.rounds[index];
    const official = s.results[index] !== undefined;
    const current = hasProgram(s) && index === s.roundIndex && s.phase !== 'complete' && !official;
    const pill: Pill | null = official
      ? { label: 'Official', tone: 'official' }
      : current
        ? currentRoundPill(s)
        : null;
    return {
      index,
      title: `Round ${index + 1}`,
      distance: `${distance}m`,
      pill,
      current,
      official,
      expanded: round !== undefined && index === s.expandedRound,
      available: round !== undefined,
      lineup: (round?.lineup ?? []).map((horseId, lane) => {
        const horse = s.horses.get(horseId);
        return {
          lane: lane + 1,
          horseId,
          number: pad(horseId),
          name: horse?.name ?? `Horse ${horseId}`,
          color: horse?.color ?? 'transparent',
          condition: horse ? buildCondition(horse.condition) : UNKNOWN_CONDITION,
          followed: horseId === s.followedHorseId,
        };
      }),
    };
  });
}

export interface StableRow {
  readonly horseId: HorseId;
  readonly number: string;
  readonly name: string;
  readonly color: string;
  readonly condition: ConditionView;
  /** "L4" if running in the current round, otherwise "–". */
  readonly lane: string;
  readonly inRound: boolean;
  /** Not drawn for the current round (shown greyed). */
  readonly sittingOut: boolean;
  readonly followed: boolean;
}

/** Stable panel: all 20 horses with their lane in the current round. */
export function buildStable(s: RaceViewState): readonly StableRow[] {
  const lineup =
    hasProgram(s) && IN_ROUND_PHASES.includes(s.phase)
      ? (s.program?.rounds[s.roundIndex]?.lineup ?? null)
      : null;
  return [...s.horses.values()].map((horse) => {
    const laneIndex = lineup === null ? -1 : lineup.indexOf(horse.id);
    const followed = horse.id === s.followedHorseId;
    return {
      horseId: horse.id,
      number: pad(horse.id),
      name: horse.name,
      color: horse.color,
      condition: buildCondition(horse.condition),
      lane: laneIndex >= 0 ? `L${laneIndex + 1}` : '–',
      inRound: laneIndex >= 0,
      sittingOut: lineup !== null && laneIndex < 0 && !followed,
      followed,
    };
  });
}

/** Winners for the completion dialog. */
export function buildCompletionWinners(s: RaceViewState): readonly CompletedRoundRow[] {
  return buildCompletedRounds({ ...s, inspectedRound: null }).rows;
}
