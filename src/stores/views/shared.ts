/**
 * Shared input and helpers for the view-model modules: the store snapshot
 * every builder receives, status pills, medals and small formatting rules.
 * Internal to the view layer; `stores/raceView.ts` re-exports the public types.
 */
import {
  ROUND_DISTANCES,
  type Horse,
  type HorseId,
  type Program,
  type RoundResult,
} from '@/domain';
import type { DirectorPhase, LiveOrderEntry } from '@/playback';

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

export const IN_ROUND_PHASES: readonly DirectorPhase[] = [
  'ready',
  'countdown',
  'running',
  'settling',
  'intermission',
];

export const hasProgram = (s: RaceViewState): boolean => s.program !== null;
export const isRacing = (s: RaceViewState): boolean =>
  s.phase === 'running' || s.phase === 'settling';
export const roundLabel = (index: number): string =>
  `Round ${index + 1} · ${ROUND_DISTANCES[index] ?? 0}m`;
export const pad = (id: number): string => String(id).padStart(2, '0');

/** Pill for the current, not yet official round. */
export function currentRoundPill(s: RaceViewState): Pill {
  if (s.paused) return { label: 'Paused', tone: 'paused' };
  if (s.phase === 'countdown') return { label: 'Starting', tone: 'gates' };
  if (isRacing(s)) return { label: 'Live', tone: 'live' };
  return { label: 'At the gates', tone: 'gates' };
}

export type Medal = 'gold' | 'silver' | 'bronze';

export const MEDALS: readonly Medal[] = ['gold', 'silver', 'bronze'];
