/**
 * Horse rows shared by the Program and Stable panels: the condition badge
 * (score plus body condition band), round line-ups and the stable roster.
 */
import {
  conditionBand,
  hennekeGrade,
  ROUND_DISTANCES,
  toBodyConditionScore,
  type ConditionBand,
  type HorseId,
} from '../domain';
import {
  currentRoundPill,
  hasProgram,
  IN_ROUND_PHASES,
  pad,
  type Pill,
  type RaceViewState,
} from './shared';

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
