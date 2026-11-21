import { describe, expect, it } from 'vitest';
import {
  createRace,
  createRng,
  forkRng,
  generateHorses,
  generateProgram,
  ROUND_COUNT,
  type Program,
} from '../domain';
import {
  countdownStep,
  createRaceDirector,
  DIRECTOR_TIMING,
  type DirectorEvent,
  type DirectorPhase,
  type RaceDirector,
} from './raceDirector';

const FRAME = 1 / 60;
const rng = createRng(42);
const roster = generateHorses(forkRng(rng));
const program: Program = generateProgram(roster, forkRng(rng));
const otherProgram: Program = generateProgram(roster, createRng(7));

/** Runs frames until `done` holds, collecting events. Fails if it never does. */
function runUntil(
  director: RaceDirector,
  done: (d: RaceDirector) => boolean,
  dt: number | (() => number) = FRAME,
  maxFrames = 200_000,
): DirectorEvent[] {
  const events: DirectorEvent[] = [];
  for (let i = 0; i < maxFrames; i++) {
    if (done(director)) return events;
    events.push(...director.frame(typeof dt === 'number' ? dt : dt()));
  }
  throw new Error(`Condition not reached within ${maxFrames} frames (phase ${director.phase}).`);
}

const inPhase = (phase: DirectorPhase) => (d: RaceDirector) => d.phase === phase;

function started(options: Parameters<typeof createRaceDirector>[0] = {}): RaceDirector {
  const director = createRaceDirector(options);
  director.load(roster, program);
  expect(director.togglePlayback()).toBe('started');
  return director;
}

const referenceResults = program.rounds.map((round) => createRace(round, roster).runToCompletion());

describe('countdownStep', () => {
  it('counts 3, 2, 1, GO in 0.6 s steps', () => {
    expect(countdownStep(0)).toEqual({ label: '3', progress: 0, isGo: false });
    expect(countdownStep(0.3).progress).toBeCloseTo(0.5);
    expect(countdownStep(0.6).label).toBe('2');
    expect(countdownStep(1.2).label).toBe('1');
    expect(countdownStep(1.8)).toMatchObject({ label: 'GO', isGo: true });
    expect(countdownStep(99)).toMatchObject({ label: 'GO', progress: 1 });
    expect(countdownStep(-1).label).toBe('3');
  });
});

describe('before a program exists', () => {
  it('is idle and ignores every playback control', () => {
    const director = createRaceDirector();
    expect(director.phase).toBe('idle');
    expect(director.roundIndex).toBe(-1);
    expect(director.race).toBeNull();
    expect(director.canTogglePlayback).toBe(false);
    expect(director.togglePlayback()).toBe('ignored');
    expect(director.pause()).toBe(false);
    expect(director.resume()).toBe(false);
    director.setSpeed(4);
    expect(director.frame(FRAME)).toEqual([]);
    expect(director.runnerMotion(0)).toBeNull();
  });
});

describe('load', () => {
  it('puts round 1 at the gates and waits for Start', () => {
    const director = createRaceDirector();
    expect(director.load(roster, program)).toEqual([
      { type: 'phaseChanged', phase: 'ready', roundIndex: 0 },
    ]);
    expect(director.roundIndex).toBe(0);
    expect(director.race?.round).toBe(program.rounds[0]);
    expect(director.canTogglePlayback).toBe(true);
    for (let i = 0; i < 600; i++) director.frame(FRAME);
    expect(director.phase).toBe('ready');
    expect(director.race?.tickCount).toBe(0);
  });

  it('cannot be paused while at the gates', () => {
    const director = createRaceDirector();
    director.load(roster, program);
    expect(director.pause()).toBe(false);
    expect(director.paused).toBe(false);
  });

  it('rejects a program without six rounds', () => {
    const director = createRaceDirector();
    expect(() => director.load(roster, { rounds: program.rounds.slice(0, 3) })).toThrow(
      expect.objectContaining({ code: 'INVALID_ROUND' }),
    );
  });
});

describe('phase sequence', () => {
  it('runs countdown → running → settling → intermission for each round, then completes', () => {
    const director = started({ speed: 4 });
    const events = runUntil(director, inPhase('complete'));
    const phases = events.flatMap((e) => (e.type === 'phaseChanged' ? [e.phase] : []));
    const perRound: DirectorPhase[] = ['running', 'settling', 'intermission', 'countdown'];
    const expected = [
      ...Array.from({ length: ROUND_COUNT - 1 }, () => perRound).flat(),
      'running',
      'settling',
      'complete',
    ];
    expect(phases).toEqual(expected);
    expect(events.at(-1)).toEqual({ type: 'programComplete' });
  });

  it('makes each result official in order and matches the pure engine', () => {
    const director = started({ speed: 4 });
    const events = runUntil(director, inPhase('complete'));
    const official = events.flatMap((e) => (e.type === 'roundOfficial' ? [e.result] : []));
    expect(official.map((r) => r.roundIndex)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(official).toEqual(referenceResults);
    expect(director.results).toEqual(referenceResults);
  });

  it('reports every finisher once with its official place and time', () => {
    const director = started({ speed: 4 });
    const events = runUntil(director, inPhase('complete'));
    const finishes = events.filter((e) => e.type === 'runnerFinished');
    expect(finishes).toHaveLength(ROUND_COUNT * 10);
    for (const finish of finishes) {
      const record = referenceResults[finish.roundIndex]!.finishers.find(
        (f) => f.horseId === finish.horseId,
      );
      expect(finish.place).toBe(record?.place);
      expect(finish.time).toBe(record?.time);
    }
  });

  it('only emits standings updates while a race is running', () => {
    const director = started({ speed: 2 });
    const events = runUntil(director, inPhase('intermission'));
    expect(events.some((e) => e.type === 'standingsChanged')).toBe(true);
    const settledAt = events.findIndex((e) => e.type === 'phaseChanged' && e.phase === 'settling');
    expect(events.slice(settledAt).some((e) => e.type === 'standingsChanged')).toBe(false);
  });

  it('takes 2.4 s of countdown before the gates open, regardless of speed', () => {
    for (const speed of [1, 4]) {
      const director = started({ speed });
      let frames = 0;
      runUntil(director, (d) => {
        frames++;
        return d.phase === 'running';
      });
      expect((frames - 1) * FRAME).toBeCloseTo(DIRECTOR_TIMING.countdownSeconds, 1);
      expect(director.race?.tickCount).toBe(0);
    }
  });

  it('caps the intermission speed-up at 2x', () => {
    const measure = (speed: number) => {
      const director = started({ speed });
      runUntil(director, inPhase('intermission'));
      let frames = 0;
      runUntil(director, (d) => {
        frames++;
        return d.phase !== 'intermission';
      });
      return (frames - 1) * FRAME;
    };
    expect(measure(1)).toBeCloseTo(DIRECTOR_TIMING.intermissionSeconds, 1);
    expect(measure(2)).toBeCloseTo(DIRECTOR_TIMING.intermissionSeconds / 2, 1);
    expect(measure(4)).toBeCloseTo(DIRECTOR_TIMING.intermissionSeconds / 2, 1);
  });

  it('settles for 1.2 simulation seconds after the last runner finishes', () => {
    const director = started({ speed: 1 });
    runUntil(director, inPhase('settling'));
    const ticksAtSettle = director.race!.tickCount;
    runUntil(director, inPhase('intermission'));
    const settledSeconds = (director.race!.tickCount - ticksAtSettle) / 120;
    expect(settledSeconds).toBeGreaterThanOrEqual(DIRECTOR_TIMING.settleSeconds);
    expect(settledSeconds).toBeLessThan(DIRECTOR_TIMING.settleSeconds + 0.1);
  });
});

describe('pause and resume in every phase', () => {
  it.each<DirectorPhase>(['countdown', 'running', 'settling', 'intermission'])(
    'freezes during %s and resumes exactly where it stopped',
    (phase) => {
      const director = started({ speed: 2 });
      runUntil(director, inPhase(phase));
      director.frame(FRAME);
      const before = {
        phase: director.phase,
        elapsed: director.phaseElapsed,
        ticks: director.race!.tickCount,
        time: director.presentationTime,
        round: director.roundIndex,
      };
      expect(director.togglePlayback()).toBe('paused');
      expect(director.paused).toBe(true);
      for (let i = 0; i < 300; i++) expect(director.frame(FRAME)).toEqual([]);
      director.frame(30);
      expect({
        phase: director.phase,
        elapsed: director.phaseElapsed,
        ticks: director.race!.tickCount,
        time: director.presentationTime,
        round: director.roundIndex,
      }).toEqual(before);
      expect(director.togglePlayback()).toBe('resumed');
      director.frame(FRAME);
      expect(director.presentationTime).toBeGreaterThan(before.time);
    },
  );

  it('produces identical results with pauses, speed changes and tab switches', () => {
    const director = started({ speed: 1 });
    const speeds = [1, 2, 4] as const;
    let frame = 0;
    runUntil(director, inPhase('complete'), () => {
      frame++;
      if (frame % 97 === 0) director.togglePlayback();
      if (frame % 131 === 0) director.setSpeed(speeds[frame % 3]!);
      if (frame % 389 === 0) return 12;
      if (frame % 211 === 0) return Number.NaN;
      return frame % 7 === 0 ? 1 / 30 : FRAME;
    });
    expect(director.results).toEqual(referenceResults);
  });

  it('pause() and resume() are idempotent', () => {
    const director = started();
    expect(director.pause()).toBe(true);
    expect(director.pause()).toBe(false);
    expect(director.resume()).toBe(true);
    expect(director.resume()).toBe(false);
  });
});

describe('regenerating the program', () => {
  it.each<DirectorPhase>(['countdown', 'running', 'settling', 'intermission'])(
    'during %s resets to round 1 at the gates with no stale state',
    (phase) => {
      const director = started({ speed: 4 });
      runUntil(director, (d) => d.roundIndex === 2 && d.phase === phase);
      director.pause();
      expect(director.load(roster, otherProgram)).toEqual([
        { type: 'phaseChanged', phase: 'ready', roundIndex: 0 },
      ]);
      expect(director.paused).toBe(false);
      expect(director.results).toEqual([]);
      expect(director.roundIndex).toBe(0);
      expect(director.race?.round).toBe(otherProgram.rounds[0]);
      expect(director.race?.tickCount).toBe(0);
      expect(director.sinceWin).toBeNull();
      for (let i = 0; i < 600; i++) expect(director.frame(FRAME)).toEqual([]);
      expect(director.phase).toBe('ready');
    },
  );

  it('runs the new program to the same result as a fresh director', () => {
    const director = started({ speed: 4 });
    runUntil(director, (d) => d.roundIndex === 3);
    director.load(roster, otherProgram);
    director.togglePlayback();
    runUntil(director, inPhase('complete'));
    const expected = otherProgram.rounds.map((round) =>
      createRace(round, roster).runToCompletion(),
    );
    expect(director.results).toEqual(expected);
  });
});

describe('completion', () => {
  it('cannot be restarted with Start or Space; only a new program restarts', () => {
    const director = started({ speed: 4 });
    runUntil(director, inPhase('complete'));
    expect(director.canTogglePlayback).toBe(false);
    expect(director.togglePlayback()).toBe('ignored');
    expect(director.pause()).toBe(false);
    for (let i = 0; i < 300; i++) expect(director.frame(FRAME)).toEqual([]);
    expect(director.results).toHaveLength(ROUND_COUNT);
    director.load(roster, program);
    expect(director.phase).toBe('ready');
    expect(director.results).toEqual([]);
  });

  it('clear() returns to idle', () => {
    const director = started();
    runUntil(director, inPhase('running'));
    expect(director.clear()).toEqual([{ type: 'phaseChanged', phase: 'idle', roundIndex: -1 }]);
    expect(director.race).toBeNull();
    expect(director.program).toBeNull();
    expect(director.canTogglePlayback).toBe(false);
  });
});

describe('frame info and motion', () => {
  it('reports the slow-motion time scale near the finish', () => {
    const director = started({ speed: 1 });
    const scales = new Set<number>();
    runUntil(director, (d) => {
      scales.add(d.lastFrame.timeScale);
      return d.phase === 'settling';
    });
    expect(Math.min(...scales)).toBeLessThan(1);
  });

  it('disables slow motion on request', () => {
    const director = started({ speed: 1, finishDrama: false });
    runUntil(director, (d) => {
      expect(d.lastFrame.timeScale).toBe(1);
      return d.phase === 'intermission';
    });
  });

  it('exposes per-lane motion for the renderer', () => {
    const director = started({ speed: 1 });
    runUntil(director, inPhase('running'));
    runUntil(director, (d) => d.race!.elapsed > 3);
    const motion = director.runnerMotion(0)!;
    expect(motion.amplitude).toBeGreaterThan(0.5);
    expect(motion.sinceFinish).toBeNull();
  });

  it('rejects unsupported speeds', () => {
    expect(() => {
      createRaceDirector().setSpeed(3);
    }).toThrow(expect.objectContaining({ code: 'INVALID_ARGUMENT' }));
  });
});
