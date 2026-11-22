# Architecture

Everything that decides **what happens** in a race is pure, deterministic
TypeScript that can be tested without a browser. Vue, Pinia and the canvas
only **show** it.

## Layers

```
App.vue            Root shell: app-wide concerns (theme), renders the page
   │
views/             Pages: compose layout, panels and dialogs; own page-wide interaction
   │
layouts/ ── components/   Page skeleton (grid, breakpoints) │ containers, presentational, wrappers
   │
stores/ ── composables/   Pinia state and actions │ game loop, shortcuts, focus trap
   │
viewModels/ ── render/    Pure display rules │ Canvas 2D drawing (reads the director, never mutates it)
   │
playback/          Pure timing: clock, fixed-step accumulator, slow motion, phase machine
   │
domain/            Pure rules: horses, programs, condition, physics, standings, timeboard
```

Dependencies point downwards only. `domain`, `playback` and `viewModels` have
no access to Vue, Pinia, the DOM, wall-clock time or `Math.random`:
randomness is an injected seeded generator and time arrives as an explicit
delta. Each folder has one job: views compose, layouts place, components
render, stores hold state, view models decide what to display.

| Mechanism                                      | What it catches                                                                                                                                                                                               |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ESLint `no-restricted-imports`                 | `domain`, `playback` or `viewModels` importing Vue, Pinia or an outer layer; `render` importing view models or UI code; stores importing components, layouts or views; components and layouts importing views |
| ESLint `no-restricted-globals` / `-properties` | `window`, `document`, `performance`, timers, `Date`, `Math.random` inside `domain`, `playback` and `viewModels`                                                                                               |
| `tsconfig.core.json`                           | Type-checks `domain`, `playback` and `viewModels` **without the DOM library**, so a stray `window` does not compile                                                                                           |
| Vitest `core` project                          | Runs those layers' specs in plain Node, so a hidden DOM dependency fails at runtime too                                                                                                                       |

## Determinism

The same seed gives the same horses, programs, finishing orders and official
times, whatever the frame rate, speed, pauses or tab switches:

1. **Forked randomness.** `createRng(seed)` is mulberry32; each concern draws
   from its own `forkRng` stream, so one cannot shift another.
2. **A seed per round.** Each round carries a `raceSeed`; the program alone
   decides every race.
3. **Fixed timestep.** `Race.tick(count)` advances in whole `SIM_STEP`
   (1/120 s) ticks via an accumulator that carries the remainder, so there is
   no drift.
4. **No timers in game flow.** Phases advance on frame deltas, so
   regenerating can never leave a stale `setTimeout` behind.

## Three kinds of time

Mixing these up caused a real playback bug (slow motion skipped after a
pause), so they are kept strictly apart:

| Time              | Source                                  | Pauses? | Used for                                         |
| ----------------- | --------------------------------------- | ------- | ------------------------------------------------ |
| Simulation time   | Engine ticks (`race.elapsed`)           | yes     | Positions, placings, official results            |
| Presentation time | Playback clock (`presentationDt`)       | yes     | Countdown, slow motion, fades, dust, winner card |
| Timeboard time    | `simulation × timeboardScale(distance)` | yes     | Race clock and finish times shown to users       |

Presentation time is wall time clamped to 0.05 s per frame and zero while
paused; effects never subtract wall-clock timestamps.

## The frame pipeline

```
wallDt ─► clock.advance          clamp, apply pause, read speed
        ─► drama.step             slow-motion factor from the race as it was
        ─► accumulator.push       presentationDt × speed × factor → whole ticks
        ─► race.tick(ticks)       fixed-step physics, placings
        ─► motion.advance         stride phase, drive, post-finish fades
```

`runRaceFrame` (`src/playback/raceFrame.ts`) is this pipeline as one pure
function.

## The race director

```
idle ─load─► ready ─start─► countdown ─2.4 s─► running ─last finisher─► settling
                                ▲                                         │ 1.2 sim s
                                └──── 2.6 s ◄── intermission ◄── official ┤
                                                              (round 6) ──► complete
```

Pause freezes every active phase; `load` (Generate) works in any phase and
resets synchronously; a completed program cannot be restarted. Frames return
typed events that the store applies.

## State management

The director is owned by the race store and marked `markRaw`, so Vue never
proxies the hot simulation state. Outside the store, `getDirector()` returns a
read-only `RaceDirectorView`: state and runner motion, no commands, so the
renderer cannot advance or reset the game. The compiler enforces this.

| State                                                           | Why stored                                 |
| --------------------------------------------------------------- | ------------------------------------------ |
| `horses`, `program`                                             | Inputs to every panel; immutable           |
| `results`                                                       | Mirrors official results from the director |
| `phase`, `paused`, `roundIndex`                                 | Reactive mirror of the director            |
| `liveOrder`                                                     | Throttled live board, read only there      |
| `inspectedRound`, `expandedRound`                               | View choices that game events reset        |
| `completionDismissed`, `confirmRegenerateOpen`, `standingsOpen` | Dialogs coordinated with game flow         |
| Preferences: `theme`, `speed`, `focusMode`, `followedHorseId`   | Read by many panels; theme persisted       |

**Deliberately not stored:** per-frame positions (the renderer reads the
director), the hovered lane and the active Stable tab (local state), program
standings (derived from results) and every display value (pure view-model
builders in `src/viewModels/`, one module per screen area behind the
`@/viewModels` barrel; the store wraps them in `computed`).

**Reactivity granularity.** All view models share one computed input except
the live order, which only the board reads. A live-order update therefore
rebuilds the board alone, and a store spec fails if that regresses.

## Components

| Kind           | Examples                                                                                                      | Rule                                                    |
| -------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Containers     | `AppHeader`, `RaceTrack`, `ResultsPanel`, `ProgramPanel`, `StablePanel`, `FollowBadge`, the three dialogs     | Read stores, wire events                                |
| Presentational | `ResultsLeaderboard`, `CompletedRounds`, `RoundCard`, `StableTable`, `StatusIndicator`, `ConditionBadge`, ... | Typed props in, events out; no stores                   |
| Wrappers       | `PanelCard`, `ModalDialog`                                                                                    | Structure or behaviour through slots                    |
| Layout         | `layouts/DashboardLayout` (named slots, responsive grid)                                                      | Places regions; no data                                 |
| View (page)    | `views/RaceDashboardView`                                                                                     | Composes the page, owns page-wide keys and dialog state |

## Rendering

The track is Canvas 2D: ten multi-part animated horses, particles and
per-frame text would otherwise mean hundreds of style updates per frame. Small
drawing modules sit around a pure `geometry` module that owns lane mapping,
hit testing and label placement; the canvas scales with device pixel ratio
(capped at 2) and follows its container with a `ResizeObserver`.

## Performance

- The physics loop allocates nothing per tick (reused buffers, in-place
  insertion sort).
- The live order reaches the store at most every 250 ms, and only the board
  reads it.
- Production bundle: about 170 kB of JavaScript (62 kB gzipped) and 41 kB of
  CSS, with self-hosted fonts.

## Error handling

- Domain factories validate input and throw a typed `DomainError`; they never
  return `NaN` or a partial entity.
- User input is sanitised at the edge: an invalid `?seed=` falls back to a
  random seed (`parseSeed`), and an unsupported speed is ignored
  (`setSpeed`).
- The animation loop (`useAnimationFrame`) reports a throwing frame once and
  keeps running. In production this is where an error reporter such as Sentry
  would plug in, together with `app.config.errorHandler`; attaching the seed
  makes any reported race reproducible.

## Extending

- **Web Worker:** `domain` and `playback` compile without the DOM, so the
  director can run in a worker and post a small snapshot per frame.
- **Several races:** `createRaceDirector` is a factory; only the race store is
  a singleton.
- **Shared live viewing:** results depend only on the program and its seeds,
  so clients can replay the same race locally (deterministic lockstep).

## Tooling

Non-default choices only: strict TypeScript beyond `strict`
(`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
`erasableSyntaxOnly`), no `any`, zero-warning ESLint with type-aware rules
(`strictTypeChecked`, `switch-exhaustiveness-check`), and a script that keeps
code, tests and docs in English.
