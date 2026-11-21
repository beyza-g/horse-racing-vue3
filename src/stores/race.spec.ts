import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';
import { createRace, HORSE_COUNT, ROUND_COUNT } from '@/domain';
import type { DirectorPhase } from '@/playback';
import { usePreferencesStore } from './preferences';
import { parseSeed, useRaceStore } from './race';

const FRAME = 1 / 60;

beforeEach(() => {
  setActivePinia(createPinia());
});

function setup(seed = 42) {
  const race = useRaceStore();
  race.initialize(seed);
  return { race, prefs: usePreferencesStore() };
}

function advanceUntil(race: ReturnType<typeof useRaceStore>, done: () => boolean, max = 200_000) {
  for (let i = 0; i < max && !done(); i++) race.advance(FRAME);
  expect(done()).toBe(true);
}

const atPhase = (race: ReturnType<typeof useRaceStore>, phase: DirectorPhase) => () =>
  race.phase === phase;

describe('parseSeed', () => {
  it('reads an integer seed from the query string', () => {
    expect(parseSeed('?seed=42')).toBe(42);
    expect(parseSeed('?a=1&seed=7')).toBe(7);
    expect(parseSeed('?seed=-1')).toBe(2 ** 32 - 1);
  });

  it.each(['', '?seed=', '?seed=abc', '?seed=1.5', '?other=1'])('ignores %j', (search) => {
    expect(parseSeed(search)).toBeNull();
  });
});

describe('initialize', () => {
  it('creates the 20-horse roster and no program', () => {
    const { race } = setup();
    expect(race.horses).toHaveLength(HORSE_COUNT);
    expect(race.horsesById.size).toBe(HORSE_COUNT);
    expect(race.program).toBeNull();
    expect(race.phase).toBe('idle');
    expect(race.stable).toHaveLength(HORSE_COUNT);
  });

  it('is reproducible for a seed', () => {
    const a = setup(9).race.horses;
    setActivePinia(createPinia());
    expect(setup(9).race.horses).toEqual(a);
  });
});

describe('before a program exists', () => {
  it('ignores Start and frames, and shows the idle status', () => {
    const { race } = setup();
    race.togglePlayback();
    for (let i = 0; i < 100; i++) race.advance(FRAME);
    expect(race.phase).toBe('idle');
    expect(race.status.label).toBe('No program');
    expect(race.playbackControl.enabled).toBe(false);
    expect(race.generatePrimary).toBe(true);
    expect(race.board.rows).toEqual([]);
    expect(race.completedRounds.showHint).toBe(true);
  });

  it('cannot expand rounds', () => {
    const { race } = setup();
    race.toggleRoundExpanded(1);
    expect(race.expandedRound).toBeNull();
  });
});

describe('generateProgram', () => {
  it('loads six rounds and waits at the gates with round 1 expanded', () => {
    const { race } = setup();
    race.generateProgram();
    expect(race.program?.rounds).toHaveLength(ROUND_COUNT);
    expect(race.phase).toBe('ready');
    expect(race.roundIndex).toBe(0);
    expect(race.expandedRound).toBe(0);
    expect(race.status.pill?.label).toBe('At the gates');
    expect(race.playbackControl).toMatchObject({ enabled: true, label: 'Start', visible: true });
    expect(race.board.rows.map((r) => r.position)).toEqual(
      Array.from({ length: 10 }, (_, i) => `L${i + 1}`),
    );
  });

  it('mid-race: clears results, live order and inspection, and stops the race', () => {
    const { race } = setup();
    race.generateProgram();
    race.togglePlayback();
    advanceUntil(race, () => race.results.length === 1);
    advanceUntil(race, () => race.liveOrder !== null);
    race.inspectRound(0);
    race.togglePlayback();
    expect(race.paused).toBe(true);
    const before = race.program;
    race.generateProgram();
    expect(race.program).not.toBe(before);
    expect(race.results).toEqual([]);
    expect(race.liveOrder).toBeNull();
    expect(race.inspectedRound).toBeNull();
    expect(race.paused).toBe(false);
    expect(race.phase).toBe('ready');
    for (let i = 0; i < 300; i++) race.advance(FRAME);
    expect(race.phase).toBe('ready');
  });

  it('keeps the followed horse (the roster does not change)', () => {
    const { race, prefs } = setup();
    prefs.toggleFollow(4);
    race.generateProgram();
    race.generateProgram();
    expect(prefs.followedHorseId).toBe(4);
  });
});

describe('playing a full program', () => {
  it('publishes results in order that match the pure engine, then completes', () => {
    const { race, prefs } = setup();
    prefs.setSpeed(4);
    race.generateProgram();
    race.togglePlayback();
    advanceUntil(race, atPhase(race, 'complete'));
    expect(race.results).toHaveLength(ROUND_COUNT);
    race.results.forEach((result, i) => {
      const round = race.program!.rounds[i]!;
      expect(result).toEqual(createRace(round, race.horses).runToCompletion());
    });
    expect(race.completionOpen).toBe(true);
    expect(race.completionWinners).toHaveLength(ROUND_COUNT);
    expect(race.playbackControl.visible).toBe(false);
    expect(race.generatePrimary).toBe(true);
    expect(race.status.label).toBe('Program complete');
  });

  it('cannot restart a finished program with Start', () => {
    const { race, prefs } = setup();
    prefs.setSpeed(4);
    race.generateProgram();
    race.togglePlayback();
    advanceUntil(race, atPhase(race, 'complete'));
    race.togglePlayback();
    for (let i = 0; i < 100; i++) race.advance(FRAME);
    expect(race.phase).toBe('complete');
    race.dismissCompletion();
    expect(race.completionOpen).toBe(false);
    race.generateProgram();
    expect(race.phase).toBe('ready');
    expect(race.completionOpen).toBe(false);
  });

  it('throttles the live order to at most one update per 250 ms between finishes', () => {
    const { race } = setup();
    race.generateProgram();
    race.togglePlayback();
    advanceUntil(race, atPhase(race, 'running'));
    let updates = 0;
    let last = race.liveOrder;
    let frames = 0;
    while (race.phase === 'running' && frames < 60) {
      race.advance(FRAME);
      frames++;
      if (race.liveOrder !== last) {
        updates++;
        last = race.liveOrder;
      }
    }
    expect(updates).toBeGreaterThan(0);
    expect(updates).toBeLessThanOrEqual(Math.ceil((frames * FRAME) / 0.25) + 1);
  });

  it('shows the live board while racing and the official board afterwards', () => {
    const { race } = setup();
    race.generateProgram();
    race.togglePlayback();
    advanceUntil(race, () => race.liveOrder !== null);
    expect(race.board.pill?.label).toBe('Live order');
    advanceUntil(race, atPhase(race, 'intermission'));
    expect(race.board.pill?.label).toBe('Official');
    expect(race.board.rows.filter((r) => r.finished)).toHaveLength(10);
  });

  it('moves to the next round, expands it and resets inspection', () => {
    const { race, prefs } = setup();
    prefs.setSpeed(4);
    race.generateProgram();
    race.togglePlayback();
    advanceUntil(race, atPhase(race, 'intermission'));
    race.inspectRound(0);
    advanceUntil(race, () => race.roundIndex === 1);
    expect(race.expandedRound).toBe(1);
    expect(race.inspectedRound).toBeNull();
    expect(race.phase).toBe('countdown');
  });

  it('applies the speed preference to the director immediately', () => {
    const { race, prefs } = setup();
    prefs.setSpeed(2);
    expect(race.getDirector().speed).toBe(2);
  });
});

describe('inspection and program panel', () => {
  it('inspects a finished round and offers Back to live', () => {
    const { race, prefs } = setup();
    prefs.setSpeed(4);
    race.generateProgram();
    race.togglePlayback();
    advanceUntil(race, () => race.roundIndex === 1 && race.phase === 'running');
    race.inspectRound(0);
    expect(race.board.roundIndex).toBe(0);
    expect(race.board.showBackToLive).toBe(true);
    race.inspectRound(null);
    expect(race.board.roundIndex).toBe(1);
  });

  it('toggles a round card open and closed', () => {
    const { race } = setup();
    race.generateProgram();
    race.toggleRoundExpanded(3);
    expect(race.rounds[3]!.expanded).toBe(true);
    race.toggleRoundExpanded(3);
    expect(race.expandedRound).toBeNull();
  });
});
