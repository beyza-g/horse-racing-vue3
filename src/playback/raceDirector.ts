import {
  createRace,
  DomainError,
  ROUND_COUNT,
  RUNNERS_PER_ROUND,
  SIM_STEP,
  type Horse,
  type HorseId,
  type Program,
  type Race,
  type RaceOptions,
  type RaceView,
  type RoundResult,
} from '../domain';
import { createPlaybackClock, type PlaybackSpeed } from './clock';
import { createFinishDrama } from './finishDrama';
import { createFixedStepAccumulator } from './fixedStep';
import { createMotionTracker, type RunnerMotion } from './motion';
import { runRaceFrame, type RaceFrameParts } from './raceFrame';

/** Phase durations, in presentation seconds unless noted. */
export const DIRECTOR_TIMING = Object.freeze({
  /** "3, 2, 1, GO" before the gates open. */
  countdownSeconds: 2.4,
  /** Length of each countdown step. */
  countdownStepSeconds: 0.6,
  /** Time for the starting gates to fade once the race is running. */
  gateFadeSeconds: 0.35,
  /** Simulation seconds the field pulls up after the last runner finishes before the result is official. */
  settleSeconds: 1.2,
  /** Pause between rounds while the winner card is shown. */
  intermissionSeconds: 2.6,
  /** Playback speed above which the intermission no longer speeds up. */
  intermissionMaxSpeed: 2,
});

/**
 * Lifecycle of a program:
 * `idle → ready → countdown → running → settling → intermission → countdown → … → complete`.
 */
export type DirectorPhase =
  'idle' | 'ready' | 'countdown' | 'running' | 'settling' | 'intermission' | 'complete';

/** Phases in which playback can be paused and resumed. */
export const PAUSABLE_PHASES: readonly DirectorPhase[] = Object.freeze([
  'countdown',
  'running',
  'settling',
  'intermission',
]);

export type DirectorEvent =
  | { readonly type: 'phaseChanged'; readonly phase: DirectorPhase; readonly roundIndex: number }
  | { readonly type: 'standingsChanged'; readonly roundIndex: number }
  | {
      readonly type: 'runnerFinished';
      readonly roundIndex: number;
      readonly horseId: HorseId;
      readonly place: number;
      readonly time: number;
    }
  | { readonly type: 'roundOfficial'; readonly result: RoundResult }
  | { readonly type: 'programComplete' };

/** Outcome of the Start / Pause / Resume control. */
export type PlaybackCommand = 'started' | 'paused' | 'resumed' | 'ignored';

export interface CountdownStep {
  /** "3", "2", "1" or "GO". */
  readonly label: string;
  /** Progress through the current step, in [0, 1]. */
  readonly progress: number;
  /** True for the final "GO" step. */
  readonly isGo: boolean;
}

/** Countdown label for `elapsed` presentation seconds into the countdown. */
export function countdownStep(elapsed: number): CountdownStep {
  const { countdownStepSeconds: step } = DIRECTOR_TIMING;
  const safe = Math.max(0, elapsed);
  const index = Math.min(3, Math.floor(safe / step));
  return {
    label: index < 3 ? String(3 - index) : 'GO',
    progress: Math.min(1, (safe - index * step) / step),
    isGo: index === 3,
  };
}

export interface RaceDirectorOptions {
  readonly speed?: number;
  /** Finish slow motion on or off (default on). */
  readonly finishDrama?: boolean;
  /** Physics overrides, used by tests. */
  readonly raceOptions?: RaceOptions;
}

/** What the last frame did, for renderers (particles, effects). */
export interface DirectorFrameInfo {
  readonly presentationDt: number;
  readonly simDt: number;
  readonly timeScale: number;
}

export interface RaceDirector {
  readonly phase: DirectorPhase;
  readonly paused: boolean;
  readonly speed: PlaybackSpeed;
  /** Zero-based current round, or -1 with no program. */
  readonly roundIndex: number;
  readonly program: Program | null;
  readonly race: Race | null;
  /** Official results so far, in round order. */
  readonly results: readonly RoundResult[];
  /** Presentation seconds spent in the current phase (intermission time is speed-scaled). */
  readonly phaseElapsed: number;
  /** Presentation seconds since the current round's winner crossed, or null. */
  readonly sinceWin: number | null;
  /** Total presentation seconds (stops while paused). Drives cosmetic animation. */
  readonly presentationTime: number;
  readonly lastFrame: DirectorFrameInfo;
  /** True when the Start / Pause control does something. */
  readonly canTogglePlayback: boolean;

  /** Loads a new program and resets everything to round 1 at the gates. Valid in any phase. */
  load(roster: readonly Horse[], program: Program): readonly DirectorEvent[];
  /** Back to `idle` with no program. */
  clear(): readonly DirectorEvent[];
  /** Start from `ready`, otherwise pause or resume. Ignored when idle or complete. */
  togglePlayback(): PlaybackCommand;
  pause(): boolean;
  resume(): boolean;
  setSpeed(speed: number): void;
  /** Advances by one wall-clock frame and returns what happened. */
  frame(wallDt: number): readonly DirectorEvent[];
  /** Visual motion of the runner in 0-based lane index `laneIndex`. */
  runnerMotion(laneIndex: number): RunnerMotion | null;
}

/** The director's commands; everything else on it is read-only state. */
type DirectorCommand =
  'load' | 'clear' | 'togglePlayback' | 'pause' | 'resume' | 'setSpeed' | 'frame';

/**
 * Read-only view of a director: phase, timing, the current race (itself
 * read-only) and runner motion, but no commands. The renderer and the UI
 * receive this, so only the race store can drive the game.
 */
export interface RaceDirectorView extends Omit<RaceDirector, DirectorCommand | 'race'> {
  readonly race: RaceView | null;
}

const NO_EVENTS: readonly DirectorEvent[] = Object.freeze([]);

export function createRaceDirector(options: RaceDirectorOptions = {}): RaceDirector {
  const clock = createPlaybackClock({ speed: options.speed ?? 1 });
  const drama = createFinishDrama(options.finishDrama ?? true);
  const accumulator = createFixedStepAccumulator();
  const motion = createMotionTracker(RUNNERS_PER_ROUND);
  const raceOptions = options.raceOptions ?? {};

  let phase: DirectorPhase = 'idle';
  let roster: readonly Horse[] = [];
  let program: Program | null = null;
  let race: Race | null = null;
  let roundIndex = -1;
  let results: RoundResult[] = [];
  let phaseElapsed = 0;
  let settleTicks = 0;
  let lastFrame: DirectorFrameInfo = { presentationDt: 0, simDt: 0, timeScale: 1 };

  const enter = (next: DirectorPhase, events: DirectorEvent[]): void => {
    phase = next;
    phaseElapsed = 0;
    events.push({ type: 'phaseChanged', phase: next, roundIndex });
  };

  const loadRound = (index: number): void => {
    const round = program?.rounds[index];
    if (round === undefined) {
      throw new DomainError('INVALID_ROUND', `Program has no round ${index + 1}.`);
    }
    race = createRace(round, roster, raceOptions);
    roundIndex = index;
    drama.reset();
    accumulator.reset();
    motion.reset();
    settleTicks = 0;
  };

  const makeOfficial = (current: Race, events: DirectorEvent[]): void => {
    const result = current.result();
    if (result === null) throw new DomainError('INVALID_ROUND', 'Round is not finished.');
    results = [...results, result];
    events.push({ type: 'roundOfficial', result });
    if (roundIndex >= ROUND_COUNT - 1) {
      enter('complete', events);
      events.push({ type: 'programComplete' });
    } else {
      enter('intermission', events);
    }
  };

  const isPausable = (): boolean => PAUSABLE_PHASES.includes(phase);

  return {
    get phase() {
      return phase;
    },
    get paused() {
      return clock.paused;
    },
    get speed() {
      return clock.speed;
    },
    get roundIndex() {
      return roundIndex;
    },
    get program() {
      return program;
    },
    get race() {
      return race;
    },
    get results() {
      return results;
    },
    get phaseElapsed() {
      return phaseElapsed;
    },
    get sinceWin() {
      return drama.sinceWin;
    },
    get presentationTime() {
      return clock.presentationTime;
    },
    get lastFrame() {
      return lastFrame;
    },
    get canTogglePlayback() {
      return phase === 'ready' || isPausable();
    },

    load(nextRoster, nextProgram) {
      if (nextProgram.rounds.length !== ROUND_COUNT) {
        throw new DomainError(
          'INVALID_ROUND',
          `A program needs ${ROUND_COUNT} rounds, received ${nextProgram.rounds.length}.`,
        );
      }
      roster = nextRoster;
      program = nextProgram;
      results = [];
      clock.reset();
      loadRound(0);
      const events: DirectorEvent[] = [];
      enter('ready', events);
      return events;
    },

    clear() {
      program = null;
      race = null;
      roundIndex = -1;
      results = [];
      clock.reset();
      drama.reset();
      accumulator.reset();
      motion.reset();
      const events: DirectorEvent[] = [];
      enter('idle', events);
      return events;
    },

    togglePlayback() {
      if (phase === 'ready') {
        phase = 'countdown';
        phaseElapsed = 0;
        clock.resume();
        return 'started';
      }
      if (!isPausable()) return 'ignored';
      return clock.togglePause() ? 'paused' : 'resumed';
    },

    pause() {
      if (!isPausable() || clock.paused) return false;
      clock.pause();
      return true;
    },

    resume() {
      if (!isPausable() || !clock.paused) return false;
      clock.resume();
      return true;
    },

    setSpeed(speed) {
      clock.setSpeed(speed);
    },

    frame(wallDt) {
      const tick = clock.advance(wallDt);
      lastFrame = { presentationDt: tick.presentationDt, simDt: 0, timeScale: 1 };
      if (phase === 'countdown') {
        phaseElapsed += tick.presentationDt;
        if (phaseElapsed < DIRECTOR_TIMING.countdownSeconds) return NO_EVENTS;
        const events: DirectorEvent[] = [];
        enter('running', events);
        return events;
      }
      if (
        race === null ||
        (phase !== 'running' && phase !== 'settling' && phase !== 'intermission')
      ) {
        return NO_EVENTS;
      }

      const current = race;
      const finishedBefore = current.finishedCount;
      const parts: RaceFrameParts = { race: current, drama, accumulator, motion };
      const outcome = runRaceFrame(parts, tick);
      lastFrame = {
        presentationDt: tick.presentationDt,
        simDt: outcome.simDt,
        timeScale: outcome.timeScale,
      };

      const events: DirectorEvent[] = [];

      if (outcome.finishedNow > 0) {
        const standings = current.standings;
        for (let k = finishedBefore; k < finishedBefore + outcome.finishedNow; k++) {
          const runner = standings[k];
          if (runner !== undefined && runner.finishTime !== null) {
            events.push({
              type: 'runnerFinished',
              roundIndex,
              horseId: runner.horseId,
              place: runner.place,
              time: runner.finishTime,
            });
          }
        }
      }
      if (outcome.standingsChanged && phase === 'running') {
        events.push({ type: 'standingsChanged', roundIndex });
      }

      if (phase === 'running') {
        phaseElapsed += tick.presentationDt;
        if (current.isFinished) enter('settling', events);
      } else if (phase === 'settling') {
        phaseElapsed += tick.presentationDt;
        settleTicks += outcome.ticks;
        if (settleTicks * SIM_STEP >= DIRECTOR_TIMING.settleSeconds) makeOfficial(current, events);
      } else {
        phaseElapsed +=
          tick.presentationDt * Math.min(DIRECTOR_TIMING.intermissionMaxSpeed, tick.speed);
        if (phaseElapsed >= DIRECTOR_TIMING.intermissionSeconds) {
          loadRound(roundIndex + 1);
          enter('countdown', events);
        }
      }
      return events.length > 0 ? events : NO_EVENTS;
    },

    runnerMotion(laneIndex) {
      return race === null ? null : motion.runner(race, laneIndex);
    },
  };
}
