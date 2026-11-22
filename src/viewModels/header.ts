/** Header view models: status line, round progress, playback control and the regenerate guard. */
import { ROUND_DISTANCES } from '../domain';
import type { DirectorPhase } from '../playback';
import {
  currentRoundPill,
  hasProgram,
  IN_ROUND_PHASES,
  roundLabel,
  type Pill,
  type RaceViewState,
} from './shared';

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

/** Phases in which generating a new program would discard a race or results. */
const DISCARDING_PHASES: readonly DirectorPhase[] = [
  'countdown',
  'running',
  'settling',
  'intermission',
];

/**
 * Whether Generate must ask first: only when a round is underway or official
 * results would be lost. At the gates, before any program and after
 * completion, generating is immediate.
 */
export function regenerateNeedsConfirmation(s: RaceViewState): boolean {
  return hasProgram(s) && DISCARDING_PHASES.includes(s.phase);
}

/** What a regeneration would discard, e.g. "Round 3 in progress and 2 official results". */
export function describeDiscardedProgress(s: RaceViewState): string {
  const parts: string[] = [];
  if (s.results[s.roundIndex] === undefined && s.roundIndex >= 0) {
    parts.push(`Round ${s.roundIndex + 1} in progress`);
  }
  const official = s.results.length;
  if (official > 0) parts.push(`${official} official result${official === 1 ? '' : 's'}`);
  return parts.join(' and ');
}

/** Generate is the primary action before the first program and after completion. */
export function isGeneratePrimary(s: RaceViewState): boolean {
  return !hasProgram(s) || s.phase === 'complete';
}
