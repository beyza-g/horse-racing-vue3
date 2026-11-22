/**
 * Pure view models for the race UI. Each builder turns a plain snapshot of
 * store state into exactly what a presentational component renders, so the
 * display rules are testable without Vue or Pinia.
 *
 * One module per screen area; this barrel is the public entry point, so the
 * store and components import from `@/viewModels` only. Pure TypeScript: no
 * Vue, Pinia or DOM, type-checked with the core layers.
 */
export type { Medal, Pill, PillTone, RaceViewState } from './shared';
export * from './header';
export * from './results';
export * from './horseRows';
export * from './standings';
