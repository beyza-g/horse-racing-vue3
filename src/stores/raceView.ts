/**
 * Pure view models for the race UI. Each builder turns a plain snapshot of
 * store state into exactly what a presentational component renders, so the
 * display rules are testable without Vue or Pinia.
 *
 * One module per screen area under `./views/`; this file is the public entry
 * point, so components and the store import from `@/stores/raceView` only.
 */
export type { Medal, Pill, PillTone, RaceViewState } from './views/shared';
export * from './views/header';
export * from './views/results';
export * from './views/horseRows';
export * from './views/standings';
