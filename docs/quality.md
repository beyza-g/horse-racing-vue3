# Quality: tests and edge cases

## Test suites

| Suite         | Runs in                    | Tests | Focus                                                                  |
| ------------- | -------------------------- | ----- | ---------------------------------------------------------------------- |
| Vitest `core` | Node                       | 454   | Rules, condition model, physics, time, playback, view models, geometry |
| Vitest `ui`   | jsdom                      | 165   | Stores, composables, components, app integration                       |
| Playwright    | Chromium, production build | 46    | User flows, responsive layout, zero layout shift, visuals              |

Statement coverage is 97.9% (100% in `domain`), measured with `npm run test:coverage`.

## What makes the tests trustworthy

- **Determinism is asserted, not assumed.** A full program run with pauses,
  speed changes, `NaN` deltas and 30-second frames must match an
  uninterrupted run exactly.
- **A recording fake canvas** (`src/test/fakeCanvas.ts`) lets the renderer
  draw every phase in both themes and check what it painted, without a
  browser.
- **Every E2E test opens `?seed=42`**, so horses, programs and results are
  identical on every run.
- **Visual baselines mask the animated canvas** in layout shots; the track is
  compared separately with a looser threshold.

Nothing is committed unless `npm run verify` passes (zero-warning lint,
formatting, type checks, English check, unit tests); UI changes also pass the
build and the E2E suite.

## Edge cases

| Situation                | Expected behaviour                                                            | Tested in                                                          |
| ------------------------ | ----------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Tab switch or long frame | Frame time is clamped to 0.05 s; bad deltas count as zero.                    | `clock.spec.ts`, `raceDirector.spec.ts`                            |
| Pause in any phase       | Everything freezes, slow motion included, and resumes exactly.                | `raceDirector.spec.ts`, `finishDrama.spec.ts`                      |
| Speed change mid-race    | Results are identical to a run at constant speed.                             | `clock.spec.ts`, `raceDirector.spec.ts`                            |
| Generate mid-race        | Asks first and pauses; cancelling never changes results.                      | `stores/race.spec.ts`, `App.spec.ts`, `e2e/race.spec.ts`           |
| Program complete         | Start and Space cannot restart; Generate is the only path.                    | `raceDirector.spec.ts`, `App.spec.ts`                              |
| Dead heat                | Interpolated crossing time, then lower horse ID.                              | `createRace.spec.ts`, `standings.spec.ts`                          |
| Condition 1, 44 and 100  | All finish; 100 loses to race fitness.                                        | `condition.spec.ts`, `createRace.spec.ts`                          |
| Invalid input            | Factories throw a typed `DomainError`; a bad URL seed is ignored.             | domain specs, `stores/race.spec.ts`                                |
| Dialogs                  | One at a time, focus trapped, Enter never confirms a discard.                 | `ModalDialog.spec.ts`, `useFocusTrap.spec.ts`, `shortcuts.spec.ts` |
| Typing in a field        | Keyboard shortcuts are ignored.                                               | `shortcuts.spec.ts`                                                |
| 320 to 1440 px           | No horizontal scroll, no truncated names, no shift when playing or following. | `e2e/layout.spec.ts`                                               |
| Blocked `localStorage`   | The theme still switches and falls back to dark.                              | `stores/preferences.spec.ts`                                       |

## Known limitations

- No CI yet, and visual baselines are recorded on macOS; a Linux CI would
  need its own.
- The canvas exposes only a summary label; the same data is in accessible
  tables.
- Reduced motion shortens CSS transitions but does not slow the race.
