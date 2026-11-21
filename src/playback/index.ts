/** Public API of the playback layer. Pure: no Vue, Pinia, DOM or wall-clock access. */
export {
  createPlaybackClock,
  isPlaybackSpeed,
  MAX_FRAME_DT,
  PLAYBACK_SPEEDS,
  sanitizeFrameDt,
  type ClockFrame,
  type PlaybackClock,
  type PlaybackClockOptions,
  type PlaybackSpeed,
} from './clock';
export {
  createFinishDrama,
  FINISH_DRAMA,
  observeFinish,
  slowMotionFactor,
  type FinishDrama,
  type FinishObservation,
} from './finishDrama';
export { createFixedStepAccumulator, type FixedStepAccumulator } from './fixedStep';
export {
  buildLiveOrder,
  createPublishGate,
  formatRaceTime,
  LIVE_ORDER_INTERVAL,
  type LiveOrderEntry,
  type PublishGate,
} from './liveOrder';
export {
  advanceStridePhase,
  createMotionTracker,
  driveIntensity,
  gallopAmplitude,
  MOTION,
  nameTagAlpha,
  type MotionTracker,
  type RunnerMotion,
} from './motion';
export {
  countdownStep,
  createRaceDirector,
  DIRECTOR_TIMING,
  PAUSABLE_PHASES,
  type CountdownStep,
  type DirectorEvent,
  type DirectorFrameInfo,
  type DirectorPhase,
  type PlaybackCommand,
  type RaceDirector,
  type RaceDirectorOptions,
} from './raceDirector';
export { runRaceFrame, type RaceFrameOutcome, type RaceFrameParts } from './raceFrame';
