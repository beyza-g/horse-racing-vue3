# Quality: tests, edge cases and bugs caught

## Test strategy

The pure layers carry most of the weight because they decide outcomes and
can be tested exhaustively with hand-written inputs: seeded generators and
explicit frame deltas, never real timers or random numbers.

| Suite         | Runs in                    | Tests | Covers                                                                                                                                                                                                                                                       |
| ------------- | -------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Vitest `core` | Node                       | 406   | Domain rules, condition model, physics, standings (live and program), timeboard, playback clock, slow motion, phase machine, render geometry and particles                                                                                                   |
| Vitest `ui`   | jsdom                      | 196   | Stores and view models, keyboard resolver, focus trap, outside-click rule, tabs, components (including the floating follow badge, track lane hover, standings and movement), a renderer smoke test, an `App` integration suite (including the results panel) |
| Playwright    | Chromium, production build | 46    | Full user flows, dialogs, standings, track lane hover, responsive layout, zero layout shift (playback and following), reduced motion, visual baselines                                                                                                       |

Statement coverage is 97.2% overall: 100% in `domain`, 99.3% in `playback`,
99.1% in `stores` and 96.6% in `render` (`npm run test:coverage`).

Notable techniques:

- **Determinism as an assertion.** Specs replay a race in uneven tick batches,
  or a whole program with pauses, speed changes, `NaN` deltas and 30-second
  frames, and require results identical to an uninterrupted run.
- **A recording fake canvas.** `src/test/fakeCanvas.ts` stands in for the 2D
  context, so the renderer smoke test draws every phase in both themes and
  checks the text it would paint (the race clock, PAUSED, winner card)
  without a browser.
- **Mutation check on a fix.** After fixing the slow-motion bug below, the
  old behaviour was reintroduced temporarily: eight of the new tests failed,
  which shows they test the fix rather than pass by accident.
- **Seeded end-to-end tests.** Every Playwright test opens `?seed=42`, so
  horses, programs and results are the same on every run.
- **Visual baselines** mask the animated canvas in layout screenshots and
  compare the track separately with a looser threshold. Baselines are
  per platform (recorded on macOS) and only regenerated deliberately with
  `npm run test:e2e:update` after reviewing the change.

## Verification gate

Nothing is committed unless `npm run verify` passes: ESLint with zero
warnings, Prettier, `vue-tsc` across four TypeScript projects, the
English-only check and every unit test. UI changes also run
`npm run build` and `npm run test:e2e`.

## Edge cases

| Situation                             | Expected behaviour                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Tested in                                                                                                        |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| Before a program exists               | Start disabled; shortcuts harmless; empty-track card; canvas clicks ignored                                                                                                                                                                                                                                                                                                                                                                                        | `stores/race.spec.ts`, `App.spec.ts`, `e2e/race.spec.ts`                                                         |
| Long frame or tab switch              | Frame time clamped to 0.05 s; negative, `NaN` or infinite deltas count as zero                                                                                                                                                                                                                                                                                                                                                                                     | `playback/clock.spec.ts`, `raceDirector.spec.ts`                                                                 |
| Rapid pause, resume and speed changes | Simulated time equals the sum of clamped unpaused frames × speed; same results                                                                                                                                                                                                                                                                                                                                                                                     | `clock.spec.ts`, `raceDirector.spec.ts`                                                                          |
| Pause in every phase                  | Countdown, running, settling and intermission all freeze and resume exactly                                                                                                                                                                                                                                                                                                                                                                                        | `raceDirector.spec.ts`                                                                                           |
| Pause during the finish slow motion   | Slow motion and race clock freeze and continue from the same point                                                                                                                                                                                                                                                                                                                                                                                                 | `finishDrama.spec.ts`, `playback/timeboard.spec.ts`                                                              |
| Regenerate mid-race                   | Asks first and pauses; keeping resumes only if the dialog paused; discarding clears results, live order and inspection and returns to round 1 at the gates; cancelling never changes results                                                                                                                                                                                                                                                                       | `raceView.spec.ts`, `stores/race.spec.ts`, `App.spec.ts`, e2e                                                    |
| Program complete                      | Start hidden; Start and Space cannot restart; Generate is the only path                                                                                                                                                                                                                                                                                                                                                                                            | `raceDirector.spec.ts`, `App.spec.ts`, e2e                                                                       |
| Dialogs                               | Focus trapped, background inert, focus restored; completion: Enter and Esc, two equal secondary actions; discard confirmation: safe button focused, Esc keeps, Enter never confirms; standings: pauses a running race, Esc closes, never stacks with the completion summary, and when opened from the summary returns to it (top-left ‹ Summary back button, focus on Final standings) instead of dismissing it; Enter in the final standings starts a new program | `useFocusTrap.spec.ts`, `shortcuts.spec.ts`, `stores/race.spec.ts`, `App.spec.ts`, e2e (flow and baselines)      |
| Keyboard while typing or on a button  | Shortcuts ignored in fields and with modifiers; Space left to the focused button                                                                                                                                                                                                                                                                                                                                                                                   | `composables/shortcuts.spec.ts`                                                                                  |
| Stop following by clicking outside    | Non-interactive areas and the track outside the lanes clear it; controls, the canvas lanes and dialogs never do; text selection ignored                                                                                                                                                                                                                                                                                                                            | `useOutsideClick.spec.ts`, `App.spec.ts`, e2e                                                                    |
| Start from the gates                  | Start race card shown only at the gates; focus moves there only right after generating                                                                                                                                                                                                                                                                                                                                                                             | `App.spec.ts`, e2e                                                                                               |
| Track lane hover                      | Mouse or pen only; neutral wash on exactly the hovered lane, nothing extra on the followed lane, none without a race; clears on leave; pointer cursor only over lanes; never changes the race                                                                                                                                                                                                                                                                      | `renderer.dom.spec.ts`, `RaceTrack.spec.ts`, e2e (pixels and baseline)                                           |
| Program standings                     | 39 points per official round; countback; shared ranks; unraced horses last; per-round cells placed, pending or absent; movement only for horses ranked before and after the latest round; Roster and Standings tabs identical in size (desktop and mobile); no truncated names; full table never scrolls the page sideways                                                                                                                                         | `programStandings.spec.ts`, `raceView.spec.ts`, `StandingsList.spec.ts`, `TabSwitch.spec.ts`, `App.spec.ts`, e2e |
| Inspecting results                    | Selecting a finished round shows it on the board; Back to live returns; a board row follows its horse                                                                                                                                                                                                                                                                                                                                                              | `stores/race.spec.ts`, `App.spec.ts`                                                                             |
| Reactivity granularity                | A live-order publication rebuilds only the board; other view models keep their identity                                                                                                                                                                                                                                                                                                                                                                            | `stores/race.spec.ts`                                                                                            |
| Reduced motion                        | Live pulse animates normally and stops under `prefers-reduced-motion`                                                                                                                                                                                                                                                                                                                                                                                              | e2e                                                                                                              |
| Condition boundaries                  | 1, 44 and 100 all finish; 100 is not the best; band edges at BCS 3.5, 4, 5, 6.5                                                                                                                                                                                                                                                                                                                                                                                    | `domain/condition.spec.ts`, `createRace.spec.ts`                                                                 |
| Dead heats and photo finishes         | Interpolated crossing time, then horse ID                                                                                                                                                                                                                                                                                                                                                                                                                          | `createRace.spec.ts`, `standings.spec.ts`                                                                        |
| Invalid input                         | Typed `DomainError` for bad seeds, line-ups, conditions, deltas and distances                                                                                                                                                                                                                                                                                                                                                                                      | domain specs                                                                                                     |
| Timeboard formatting                  | `m:ss.cc`, constant width, 59.999 s reads `1:00.00`                                                                                                                                                                                                                                                                                                                                                                                                                | `domain/race/timeboard.spec.ts`                                                                                  |
| Narrow track                          | Labels yield to the PAUSED pill and the race clock                                                                                                                                                                                                                                                                                                                                                                                                                 | `render/geometry.spec.ts`, visual baselines                                                                      |
| Responsive layout                     | No horizontal scroll at 320–1440 px; no truncated names; grid order per breakpoint                                                                                                                                                                                                                                                                                                                                                                                 | `e2e/layout.spec.ts`                                                                                             |
| Zero layout shift                     | Boxes identical across Start, Pause and Resume, and when following or unfollowing a horse at 320, 375, 820, 1180, 1280 and 1440 px; the floating badge covers no content                                                                                                                                                                                                                                                                                           | `e2e/layout.spec.ts`, `follow.spec.ts`                                                                           |
| Blocked `localStorage`                | Theme still switches; falls back to dark                                                                                                                                                                                                                                                                                                                                                                                                                           | `stores/preferences.spec.ts`                                                                                     |

## Bugs caught

Each entry says how it was found, because not every bug was caught by an
automated test first.

### Found while investigating or writing tests

1. **The finish slow motion skipped after a pause.** The slow motion was
   timed against wall-clock time since the winner crossed. Pausing stopped
   the race but not that timer, so after a pause (or a hidden tab) longer
   than about 0.85 s the race resumed at full speed. The fix gave every
   effect a single pause-aware time source; eight regression tests replay a
   race paused during the approach, the hold and the recovery and require
   frame-by-frame identical slow-motion factors and results.
2. **The documented condition asymmetry was not true.** The condition module
   claimed that excess costs more speed than an equal deficit, but each side
   was normalised over a different span, so the opposite held. Writing the
   per-point assertion exposed it; the penalty is now defined per BCS point.
3. **A test was passing by luck.** A pull-up test required horses to stop
   within exactly 10% past the line. Horses ease towards that target, so they
   can coast slightly beyond it; the old physics happened to stay inside.
   The assertion now states the real invariant (stopped, within 15%).
4. **A rounding edge in the timeboard** (`59.999` displaying as `0:60.00`)
   was prevented up front: the formatter rounds to whole hundredths before
   carrying into minutes, and a test pins it.

### Caught by the verification gate

5. **The English-only check flagged itself.** Prettier turned escaped
   Unicode in the check's regular expression into literal characters, so the
   script reported its own source. The character list is now built from code
   points.
6. **A non-ASCII word in the docs** ("Facade" written with a cedilla) was
   rejected by the same check before it reached a commit.
7. **Strict optional property types** (`exactOptionalPropertyTypes`)
   rejected an explicit `undefined` default for an optional prop; the panel
   heading now always has a real `id` for `aria-labelledby`.

### Caught by reviewing screenshots, then locked in with tests

8. **The light theme dimmed the whole page.** A scoped style used
   `:global([data-theme='light']) .panel-card.is-dimmed`; Vue compiles
   `:global(...)` to the global part only, so the rule set `opacity: 0.4` on
   `<html>`. Fixed with a `--dim-opacity` token; `CLAUDE.md` now forbids the
   pattern and a visual baseline covers light focus mode.
9. **The race clock covered the FINISH label on phones.** Labels now take the
   header's occupied areas into account (`labelFits`), with geometry tests and
   a mobile baseline.
10. **Horse names were truncated** after the condition column widened. The
    stable grid was tightened, and an end-to-end test now checks every name
    at five widths.
11. **Inactive horses showed twenty different grays.** A UX audit of the
    stable found that `grayscale(1)` on each silk colour preserves its
    lightness, so every sitting-out horse got its own gray, next to separate
    faint text and still-coloured condition markers. One token pair
    (`--inactive-fg`, `--inactive-bg`) now drives a single treatment, covered
    by a component test and the light focus-mode baseline.
12. **Hover and selection outlines stacked.** Hovering the followed row added
    a gray outline on top of its accent ring. Hover is now a background wash
    only (`--row-hover`), so the two states stay distinct.

### Reported in review, then locked in with tests

13. **Final standings acted like View track.** Opening the standings from
    the completion summary marked the summary as dismissed, so closing the
    standings dropped the user onto the track and hid the "Generate new
    program" path. The summary is now only hidden while the standings are
    in front of it; closing returns to it with focus on **Final standings**,
    and the standings footer offers **Generate new program**. Store, App and
    end-to-end tests cover the round trip, and the button layout (one
    primary, two equal secondaries; footer actions that never clip at
    320 px) has its own baselines.

### Found in a code audit

14. **Every panel re-rendered four times a second during races.** All view
    models shared one computed input that included the live order, so each
    live-order publication (up to every 250 ms) rebuilt the status, program,
    stable and standings view models and re-rendered about a hundred
    unchanged rows. Measured: 15 rebuilds of each in 5 seconds of racing.
    Only the board reads the live order, so it now combines it with the
    shared input separately; a store spec asserts the other view models keep
    their identity, and it fails if the live order is put back.
15. **Unused reactive state.** The race store kept a `seed` ref that was
    written but never read; it was removed. The audit also added the missing
    component test for inspecting a finished round and **Back to live**.

16. **Following a horse moved the page.** The "Following" badge was added
    to the header row only when needed, so on most widths below about
    1400 px it grew the header and pushed the controls and track down (5 to
    42 px). Two intermediate fixes were rejected in review: a reserved slot
    with hint text (clutter), and an inline slot that re-centred the status
    or left empty rows (the round text jumped sideways, gaps on tablets and
    phones). Placements on the header divider and inside the track's
    canvas were rejected too: one crowded the round text, the others covered
    a runner or the distance markers. The badge is now fixed to the
    viewport's bottom-right corner, outside every layout, with a permanent
    page-bottom clearance on scrolling layouts: nothing moves when
    following, and end-to-end tests assert no movement and no overlap with
    the header, the track or panel content at six widths.

### Environment

17. **Tests failed on the wrong Node build.** Dependencies installed under an
    x64 Node 20 lacked the native bindings for arm64 Node 22 (and jsdom needs
    Node 22.22 or newer). An `.nvmrc` and a matching `engines` range now pin
    the runtime.

## Known limitations

- Visual baselines are macOS-specific; a Linux CI would need its own.
- The canvas is not described to screen readers beyond its summary label;
  the tables carry the same information accessibly.
- Reduced-motion preferences shorten CSS transitions but do not slow the race
  animation.
- See [domain simplifications](domain.md#deliberate-simplifications) for
  modelling scope.
