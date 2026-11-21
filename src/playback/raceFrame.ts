import type { Race } from '../domain';
import type { ClockFrame } from './clock';
import { observeFinish, type FinishDrama } from './finishDrama';
import type { FixedStepAccumulator } from './fixedStep';
import type { MotionTracker } from './motion';

/** The per-race collaborators one frame drives. */
export interface RaceFrameParts {
  readonly race: Race;
  readonly drama: FinishDrama;
  readonly accumulator: FixedStepAccumulator;
  readonly motion: MotionTracker;
}

/** What one frame did to the race. */
export interface RaceFrameOutcome {
  /** Slow-motion multiplier applied this frame. */
  readonly timeScale: number;
  /** Simulation seconds requested this frame (before quantisation into ticks). */
  readonly simDt: number;
  /** Whole engine ticks executed. */
  readonly ticks: number;
  /** Runners that crossed the line this frame. */
  readonly finishedNow: number;
  /** True if the live order or a placing changed this frame. */
  readonly standingsChanged: boolean;
}

/**
 * Runs one frame of the documented pipeline:
 * `drama.step(presentationDt, observeFinish(race))` →
 * `accumulator.push(presentationDt × speed × timeScale)` → `race.tick(ticks)` →
 * `motion.advance(...)`.
 *
 * The clock has already been advanced by the caller, so a paused frame
 * (presentationDt = 0) changes nothing.
 */
export function runRaceFrame(parts: RaceFrameParts, frame: ClockFrame): RaceFrameOutcome {
  const { race, drama, accumulator, motion } = parts;
  const versionBefore = race.standingsVersion;
  const timeScale = drama.step(frame.presentationDt, observeFinish(race));
  const simDt = frame.presentationDt * frame.speed * timeScale;
  const ticks = accumulator.push(simDt);
  const finishedNow = ticks > 0 ? race.tick(ticks) : 0;
  motion.advance(race, simDt, frame.presentationDt);
  return {
    timeScale,
    simDt,
    ticks,
    finishedNow,
    standingsChanged: race.standingsVersion !== versionBefore,
  };
}
