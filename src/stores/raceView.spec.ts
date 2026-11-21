import { describe, expect, it } from 'vitest';
import {
  createRace,
  createRng,
  forkRng,
  generateHorses,
  generateProgram,
  indexRoster,
  type RoundResult,
} from '@/domain';
import { buildLiveOrder, type DirectorPhase } from '@/playback';
import {
  BOARD_ROW_HEIGHT,
  boardRoundIndex,
  buildBoard,
  buildCompletedRounds,
  buildPlaybackControl,
  buildProgress,
  buildRounds,
  buildStable,
  buildStatus,
  isGeneratePrimary,
  type RaceViewState,
} from './raceView';

const rng = createRng(11);
const roster = generateHorses(forkRng(rng));
const program = generateProgram(roster, forkRng(rng));
const horses = indexRoster(roster);
const allResults: RoundResult[] = program.rounds.map((round) =>
  createRace(round, roster).runToCompletion(),
);

const state = (patch: Partial<RaceViewState> = {}): RaceViewState => ({
  horses,
  program,
  results: [],
  phase: 'ready',
  paused: false,
  roundIndex: 0,
  liveOrder: null,
  inspectedRound: null,
  expandedRound: 0,
  followedHorseId: null,
  ...patch,
});
const idle = state({ program: null, phase: 'idle', roundIndex: -1, expandedRound: null });

describe('buildStatus', () => {
  it.each<[Partial<RaceViewState>, string, string | null]>([
    [{ program: null, phase: 'idle', roundIndex: -1 }, 'No program', null],
    [{ phase: 'ready' }, 'Round 1 · 1200m', 'At the gates'],
    [{ phase: 'countdown' }, 'Round 1 · 1200m', 'Starting'],
    [{ phase: 'running' }, 'Round 1 · 1200m', 'Live'],
    [{ phase: 'settling', paused: true }, 'Round 1 · 1200m', 'Paused'],
    [{ phase: 'intermission', results: allResults.slice(0, 1) }, 'Round 1 · 1200m', 'Official'],
    [{ phase: 'running', roundIndex: 5 }, 'Round 6 · 2200m', 'Live'],
    [{ phase: 'complete', results: allResults }, 'Program complete', null],
  ])('%o shows %s / %s', (patch, label, pill) => {
    const status = buildStatus(state(patch));
    expect(status.label).toBe(label);
    expect(status.pill?.label ?? null).toBe(pill);
  });

  it('mutes the dot while paused', () => {
    expect(buildStatus(state({ phase: 'running' })).dot).toBe('active');
    expect(buildStatus(state({ phase: 'running', paused: true })).dot).toBe('muted');
  });
});

describe('buildProgress', () => {
  it('marks official, current and pending rounds', () => {
    const segments = buildProgress(
      state({ phase: 'running', roundIndex: 2, results: allResults.slice(0, 2) }),
    );
    expect(segments.map((s) => s.state)).toEqual([
      'done',
      'done',
      'current',
      'pending',
      'pending',
      'pending',
    ]);
    expect(buildProgress(idle).every((s) => s.state === 'pending')).toBe(true);
  });
});

describe('buildPlaybackControl', () => {
  it.each<[DirectorPhase, boolean, string, boolean, boolean]>([
    ['idle', false, 'Start', false, true],
    ['ready', false, 'Start', true, true],
    ['countdown', false, 'Pause', true, true],
    ['running', false, 'Pause', true, true],
    ['running', true, 'Resume', true, true],
    ['intermission', false, 'Pause', true, true],
    ['complete', false, 'Start', false, false],
  ])('%s (paused %s) → %s', (phase, paused, label, enabled, visible) => {
    expect(buildPlaybackControl(state({ phase, paused }))).toMatchObject({
      label,
      enabled,
      visible,
    });
  });

  it('makes Generate the primary action before a program and after completion only', () => {
    expect(isGeneratePrimary(idle)).toBe(true);
    expect(isGeneratePrimary(state({ phase: 'running' }))).toBe(false);
    expect(isGeneratePrimary(state({ phase: 'complete' }))).toBe(true);
  });
});

describe('buildBoard', () => {
  it('is empty before a program exists', () => {
    expect(buildBoard(idle)).toMatchObject({ roundIndex: -1, title: 'Results', rows: [] });
  });

  it('shows gate order with lanes at the gates', () => {
    const board = buildBoard(state());
    expect(board.pill?.label).toBe('At the gates');
    expect(board.rows.map((r) => r.position)).toEqual(
      Array.from({ length: 10 }, (_, i) => `L${i + 1}`),
    );
    expect(board.rows.map((r) => r.top)).toEqual(
      Array.from({ length: 10 }, (_, i) => i * BOARD_ROW_HEIGHT),
    );
    expect(board.rows.some((r) => r.podium)).toBe(false);
  });

  it('orders rows by live rank while racing', () => {
    const race = createRace(program.rounds[0]!, roster);
    race.tick(600);
    const liveOrder = buildLiveOrder(race);
    const board = buildBoard(state({ phase: 'running', liveOrder }));
    expect(board.pill?.label).toBe('Live order');
    const leader = board.rows.find((r) => r.top === 0);
    expect(leader?.horseId).toBe(liveOrder[0]!.horseId);
    expect(leader?.position).toBe('1st');
    expect(leader?.podium).toBe(true);
  });

  it('shows official times once the round is official', () => {
    const board = buildBoard(state({ phase: 'intermission', results: allResults.slice(0, 1) }));
    expect(board.pill?.label).toBe('Official');
    const winner = board.rows.find((r) => r.top === 0)!;
    expect(winner.horseId).toBe(allResults[0]!.finishers[0]!.horseId);
    expect(winner.emphasized).toBe(true);
    expect(winner.time).toMatch(/^\d+\.\d{2}s$/);
  });

  it('follows the inspected round and offers a way back', () => {
    const s = state({
      phase: 'running',
      roundIndex: 2,
      results: allResults.slice(0, 2),
      inspectedRound: 0,
    });
    expect(boardRoundIndex(s)).toBe(0);
    expect(buildBoard(s).showBackToLive).toBe(true);
    expect(
      buildBoard(state({ phase: 'complete', results: allResults, inspectedRound: 1 }))
        .showBackToLive,
    ).toBe(false);
  });

  it('shows the latest official round after completion', () => {
    expect(boardRoundIndex(state({ phase: 'complete', roundIndex: 5, results: allResults }))).toBe(
      5,
    );
  });

  it('marks the followed horse', () => {
    const followed = program.rounds[0]!.lineup[4]!;
    const row = buildBoard(state({ followedHorseId: followed })).rows.find(
      (r) => r.horseId === followed,
    );
    expect(row).toMatchObject({ followed: true, emphasized: true });
  });
});

describe('buildCompletedRounds', () => {
  it('starts with a hint before a program and a live row once one exists', () => {
    expect(buildCompletedRounds(idle)).toMatchObject({
      rows: [],
      liveRow: null,
      showHint: true,
      count: '0 / 6',
    });
    const ready = buildCompletedRounds(state());
    expect(ready.liveRow).toMatchObject({ label: 'R1', text: 'Next up' });
    expect(ready.showHint).toBe(false);
  });

  it('lists winners and drops the live row after completion', () => {
    const done = buildCompletedRounds(
      state({ phase: 'complete', roundIndex: 5, results: allResults }),
    );
    expect(done.rows).toHaveLength(6);
    expect(done.liveRow).toBeNull();
    expect(done.count).toBe('6 / 6');
    expect(done.rows[0]!.winnerId).toBe(allResults[0]!.finishers[0]!.horseId);
  });
});

describe('buildRounds', () => {
  it('shows six cards, the current one tagged and expandable line-ups', () => {
    const cards = buildRounds(
      state({ phase: 'running', roundIndex: 1, results: allResults.slice(0, 1), expandedRound: 1 }),
    );
    expect(cards).toHaveLength(6);
    expect(cards[0]).toMatchObject({ official: true, pill: { label: 'Official' } });
    expect(cards[1]).toMatchObject({ current: true, expanded: true, pill: { label: 'Live' } });
    expect(cards[1]!.lineup).toHaveLength(10);
    expect(cards[2]!.pill).toBeNull();
  });

  it('has no line-ups before a program exists', () => {
    for (const card of buildRounds(idle))
      expect(card).toMatchObject({ available: false, lineup: [] });
  });
});

describe('buildStable', () => {
  it('lists all 20 horses and greys out those sitting out the current round', () => {
    const rows = buildStable(state());
    expect(rows).toHaveLength(20);
    expect(rows.filter((r) => r.inRound)).toHaveLength(10);
    expect(rows.filter((r) => r.sittingOut)).toHaveLength(10);
    const first = program.rounds[0]!.lineup[0]!;
    expect(rows.find((r) => r.horseId === first)?.lane).toBe('L1');
  });

  it('never greys out the followed horse and shows no lanes when idle', () => {
    const out = buildStable(state()).find((r) => r.sittingOut)!;
    expect(
      buildStable(state({ followedHorseId: out.horseId })).find((r) => r.horseId === out.horseId)
        ?.sittingOut,
    ).toBe(false);
    expect(buildStable(idle).every((r) => r.lane === '–' && !r.sittingOut)).toBe(true);
  });
});
