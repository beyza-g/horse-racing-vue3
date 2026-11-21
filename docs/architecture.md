# Architecture

The guiding idea: everything that decides **what happens** in a race is pure,
deterministic TypeScript that can be tested without a browser. Vue, Pinia and
the canvas only **show** it.

## Layers

```
components/        Vue SFCs: containers, presentational components, wrappers
   │
stores/ ── composables/   Pinia stores + pure view models │ game loop, shortcuts, focus trap
   │
render/            Canvas 2D drawing; reads the director, never mutates it
   │
playback/          Pure timing: clock, fixed-step accumulator, slow motion, phase machine
   │
domain/            Pure rules: horses, programs, condition, physics, standings, timeboard
```

Dependencies point downwards only. The two bottom layers have no access to
Vue, Pinia, the DOM, wall-clock time or `Math.random`: randomness comes from
an injected seeded generator and time arrives as an explicit delta.

**How the boundaries are enforced**, so they survive refactoring:

| Mechanism                                      | What it catches                                                                                       |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| ESLint `no-restricted-imports`                 | `domain` importing `vue`, `pinia` or any outer layer; `render` importing stores or components         |
| ESLint `no-restricted-globals` / `-properties` | `window`, `document`, `performance`, timers, `Date`, `Math.random` inside `domain` and `playback`     |
| `tsconfig.core.json`                           | Type-checks `domain` and `playback` **without the DOM library**, so a stray `window` does not compile |
| Vitest `core` project                          | Runs those layers' specs in plain Node, so a hidden DOM dependency fails at runtime too               |

Each layer exposes a barrel (`@/domain`, `@/playback`, `@/render`); internal
helpers stay private to their modules.

## Determinism

The same seed produces the same horses, programs, finishing orders and
official times, whatever the frame rate, playback speed, pauses or tab
switches. Four design decisions make that structural rather than a matter of
discipline:

1. **Seeded, forked randomness.** `createRng(seed)` is a mulberry32 generator.
   Separate concerns draw from separate forks (`forkRng`), so changing how one
   concern consumes randomness cannot shift another's outcomes.
2. **Each round carries its own `raceSeed`.** The program alone determines
   every race; nothing about playback feeds back into the engine.
3. **Fixed timestep.** `Race.tick(count)` advances in whole `SIM_STEP`
   (1/120 s) ticks and `elapsed` is `ticks × SIM_STEP`, so there is no
   floating-point drift. A frame converts its simulation time into ticks
   through an accumulator that carries the remainder.
4. **No timers in game flow.** Countdown, settling and intermission are phase
   durations advanced by frame deltas, so regenerating mid-race cannot leave a
   stale `setTimeout` to fire later.

Tests assert the outcome directly: a full program run with random pauses,
speed changes, `NaN` deltas and 30-second tab-switch frames produces results
identical to `runToCompletion()`.

## Three kinds of time

Mixing these up caused the one real playback bug in the project (see
[quality](quality.md#bugs-caught)), so they are kept strictly apart:

| Time              | Source                                  | Pauses? | Used for                                         |
| ----------------- | --------------------------------------- | ------- | ------------------------------------------------ |
| Simulation time   | Engine ticks (`race.elapsed`)           | yes     | Positions, placings, official results            |
| Presentation time | Playback clock (`presentationDt`)       | yes     | Countdown, slow motion, fades, dust, winner card |
| Timeboard time    | `simulation × timeboardScale(distance)` | yes     | Race clock and finish times shown to users       |

Presentation time is wall time clamped to 0.05 s per frame and zero while
paused. Effects never subtract wall-clock timestamps: wall time keeps running
during a pause or a hidden tab, so an effect timed that way expires unseen.

## The frame pipeline

Each animation frame does the same thing, in this order:

```
wallDt ─► clock.advance          clamp, apply pause, read speed
        ─► drama.step             slow-motion factor from the race as it was
        ─► accumulator.push       presentationDt × speed × factor → whole ticks
        ─► race.tick(ticks)       fixed-step physics, placings
        ─► motion.advance         stride phase, drive, post-finish fades
```

`runRaceFrame` (`src/playback/raceFrame.ts`) implements this as one pure
function, so every step is unit-testable with hand-written deltas.

## The race director

`createRaceDirector` is a phase machine driven only by frame deltas:

```
idle ─load─► ready ─start─► countdown ─2.4 s─► running ─last finisher─► settling
                                ▲                                         │ 1.2 sim s
                                └──── 2.6 s ◄── intermission ◄── official ┤
                                                              (round 6) ──► complete
```

- Pause works in `countdown`, `running`, `settling` and `intermission`, and
  freezes everything, including the slow motion and the race clock.
- `load` (Generate) is valid in every phase and resets synchronously.
- `complete` cannot be restarted by Start or Space; a new program is the only
  way forward.
- The intermission speeds up with 2x but not beyond, so the winner card stays
  readable at 4x.
- Frames return typed events (`phaseChanged`, `runnerFinished`,
  `standingsChanged`, `roundOfficial`, `programComplete`). A frame with no
  events returns a shared empty array, so idle frames allocate nothing.

## State management

The director is a plain object owned by the race store and marked `markRaw`,
so Vue never proxies the hot simulation state. The store mirrors only what
the UI needs:

| Reactive state                | Updated                                                  |
| ----------------------------- | -------------------------------------------------------- |
| Phase, round, paused          | On director events and user actions                      |
| Results                       | When a round becomes official                            |
| Live order                    | At most every 250 ms, immediately when a runner finishes |
| Inspected and expanded rounds | On user actions and round changes                        |
| Regenerate confirmation open  | When Generate would discard progress                     |

Per-frame positions never enter reactive state; the renderer reads them from
the director directly. Derived displays come from **pure view-model builders**
in `stores/raceView.ts` (status line, board rows, program cards, stable rows,
condition badges, medals, and whether regenerating needs confirmation), which
are tested without Vue or Pinia. A second store holds viewer preferences:
theme (persisted, tolerant of blocked storage), speed, focus mode and the
followed horse.

**Guarded regeneration.** The director itself accepts a new program in any
phase. The store's `requestNewProgram` adds the user-facing guard: when a
round is underway or official results exist, it pauses the race (remembering
whether it was the one to pause) and opens a confirmation; cancelling resumes
only if it paused. Pausing is already deterministic, so a cancelled
confirmation leaves the eventual results unchanged, which a store spec
asserts over a full program.

## Rendering

The track is a Canvas 2D surface rather than DOM elements: ten animated
horses, particles and per-frame text would otherwise mean hundreds of style
updates per frame. The renderer is split into small drawing modules
(`drawTrack`, `drawHorse`, `drawRunners`, `drawOverlays`, `particles`) around
a pure `geometry` module that owns lane mapping, hit testing and label
placement. It sizes the backing store by device pixel ratio (capped at 2) and
follows its container with a `ResizeObserver`.

## Performance notes

- The physics loop allocates nothing per tick: a reused crossing buffer,
  strategies that take primitives, an in-place insertion sort (O(n) on nearly
  sorted standings) and no sorting once a race has settled.
- `standingsVersion` changes only when the order or a placing changes, so the
  store skips redundant updates.
- Stamina weakness is computed once per runner per race, not per tick.
- Production bundle: about 156 kB of JavaScript (57 kB gzipped) and 31 kB of
  CSS; fonts are self-hosted, so there is no external request or font swap.

## Tooling

| Concern        | Choice                                                                                                            |
| -------------- | ----------------------------------------------------------------------------------------------------------------- |
| Language       | TypeScript 6 with `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` and friends; `any` is banned |
| Lint           | ESLint `strictTypeChecked` + `eslint-plugin-vue`; disable comments require a reason; zero warnings allowed        |
| Formatting     | Prettier                                                                                                          |
| Unit tests     | Vitest with two projects: `core` (Node) and `ui` (jsdom)                                                          |
| E2E            | Playwright against the production build with a fixed seed                                                         |
| Language guard | `scripts/check-english.mjs` keeps code, tests and docs in English                                                 |

Styling uses CSS custom-property tokens with scoped component styles rather
than a utility framework: the visual language is token-driven, and six icons
do not justify an icon library. See [UI/UX](ux.md).
