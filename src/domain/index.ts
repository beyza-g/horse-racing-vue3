/**
 * Public API of the domain layer. Outer layers import from `@/domain` only;
 * internal helpers stay private to their modules.
 */
export {
  CONDITION_MAX,
  CONDITION_MIN,
  HORSE_COUNT,
  ROUND_COUNT,
  ROUND_DISTANCES,
  RUNNERS_PER_ROUND,
  type RoundDistance,
} from './constants';
export {
  BODY_CONDITION,
  conditionBand,
  conditionForBodyScore,
  conditionSpeedFactor,
  conditionStaminaWeakness,
  hennekeGrade,
  OPTIMAL_CONDITION,
  toBodyConditionScore,
  type ConditionBand,
} from './condition';
export { DomainError, type DomainErrorCode } from './errors';
export { createHorse, generateHorses, indexRoster, silkColor } from './horses';
export { createRound, generateProgram, type RoundInput } from './program';
export { createRng, forkRng, type Rng } from './random';
export {
  createRace,
  type Race,
  type RaceOptions,
  type RaceView,
  type RunnerView,
} from './race/createRace';
export {
  MAX_RACE_SECONDS,
  SIM_STEP,
  type PaceStrategy,
  type ProfileStrategy,
  type RunnerProfile,
} from './race/physics';
export { gapToLeader } from './race/standings';
export {
  computeProgramStandings,
  formFigures,
  PLACING_POINTS,
  pointsForPlace,
  type ProgramStanding,
} from './programStandings';
export {
  formatOfficialTime,
  formatTimeboard,
  nominalSimDuration,
  realisticDuration,
  realisticPace,
  TIMEBOARD,
  timeboardReading,
  timeboardScale,
  toTimeboardSeconds,
} from './race/timeboard';
export type { FinishRecord, Horse, HorseId, Program, Round, RoundResult } from './types';
