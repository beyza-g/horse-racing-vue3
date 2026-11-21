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
