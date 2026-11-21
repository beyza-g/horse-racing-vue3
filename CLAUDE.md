# CLAUDE.md — Horse Racing (Vue 3)

Interactive horse racing game built for the Insider One front-end case study.
Visual source of truth: the "Horse Racing" page of the Claude Design project
"Furlong Race Night" (latest version; older v2–v5 pages are superseded).

## Non-negotiable rules

1. **English only.** All code, identifiers, types, UI copy, comments, test names,
   commit messages and docs are in English. No Turkish or other non-English words.
   Enforced by `npm run check:english` (part of `verify`).
2. **Layered architecture.** Dependencies point inward only:
   `components → composables/stores → render → playback → domain`.
   - `src/domain/**` and `src/playback/**` must not import Vue, Pinia, or touch
     `window`, `document`, `performance`, `requestAnimationFrame`, `Math.random`
     or `Date`. Randomness comes from an injected seeded `Rng`; time comes from
     the caller as a `dt` in seconds.
   - `src/render/**` may use Canvas 2D types but never Vue or Pinia.
   - Enforced twice: ESLint `no-restricted-imports` / `no-restricted-globals` /
     `no-restricted-properties` per layer, and `tsconfig.core.json`, which
     type-checks `domain` + `playback` **without the DOM lib**, so any
     `window`/`document`/`performance` reference is a compile error.
3. **Determinism.** Same seed ⇒ same horses, program, finish order and official
   times, regardless of frame rate, playback speed, pauses or tab switches.
   This is guaranteed by a fixed simulation timestep (see Playback).
4. **Every domain or playback change ships with Vitest coverage.** Tests use
   deterministic inputs only: seeded `Rng`, explicit `dt` sequences, fake
   clocks. No real timers, no `Math.random`, no wall-clock reads in specs.
5. **Design fidelity.** Match the design's tokens, spacing, typography and
   behaviour. Zero layout shift: fixed row heights, `min-width` on stateful
   buttons, tabular mono digits, absolutely positioned leaderboard rows.
6. **Strict TypeScript.** `strict`, `noUncheckedIndexedAccess`,
   `exactOptionalPropertyTypes`, `noImplicitOverride`, `noImplicitReturns`,
   `noUnused*`, `noPropertyAccessFromIndexSignature` (see `tsconfig.base.json`),
   checked with `vue-tsc --build`. ESLint runs `strictTypeChecked`.
   - `any` is forbidden. A justified exception requires an inline
     `// eslint-disable-next-line @typescript-eslint/no-explicit-any -- <reason>`;
     disable comments without a `-- reason` fail lint.
   - Prefer `unknown` + narrowing, discriminated unions for phases/status, and
     `readonly` data in the domain. Non-null assertions are allowed only in specs.
7. **Milestone verification gate.** A milestone is not done until
   `npm run verify` passes (ESLint with `--max-warnings 0`, Prettier check,
   `vue-tsc --build`, English check, Vitest) and `npm run build` succeeds.
   Then make an atomic commit and stop for review.

## Stack

| Concern      | Choice                                                                          | Why                                                                                        |
| ------------ | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Build        | Vite + Vue 3 (`<script setup lang="ts">`)                                       | Required by brief, fast DX                                                                 |
| Types        | TypeScript 6.0 `strict` + `noUncheckedIndexedAccess`, `vue-tsc`                 | Safety at scale (TS 7 is not yet supported by typescript-eslint)                           |
| State        | Pinia (setup stores)                                                            | Required by brief                                                                          |
| Styling      | Plain CSS custom-property tokens + scoped SFC styles                            | Design is token-driven; Tailwind adds bundle/config cost and fights the inline-token style |
| Icons        | Tiny inline-SVG Vue components (sun, moon, play, pause, close, chevron)         | Design uses ~6 glyphs; no icon library needed                                              |
| Track        | Canvas 2D (HiDPI, ResizeObserver)                                               | Matches design; 10 animated horses + particles at 60 fps without DOM churn                 |
| Fonts        | Archivo (variable, `wdth` axis) + JetBrains Mono, self-hosted via `@fontsource` | No CDN dependency, no FOUT layout shift                                                    |
| Unit tests   | Vitest (+ `@vue/test-utils`, jsdom for components)                              | Required bonus                                                                             |
| E2E / visual | Playwright (seeded via `?seed=`)                                                | Bonus 2 & 3                                                                                |
| Lint/format  | ESLint flat config (vue + typescript-eslint) + Prettier                         | Consistency                                                                                |

## Directory layout

```
src/
  domain/                 # Pure rules engine (no Vue/DOM). Public API: src/domain/index.ts
    constants.ts          # HORSE_COUNT=20, RUNNERS_PER_ROUND=10, ROUND_DISTANCES, CONDITION_MIN/MAX
    errors.ts             # DomainError (typed `code`), invariant, assertIntegerInRange
    types.ts              # Horse, Round, Program, FinishRecord, RoundResult (all readonly)
    random.ts             # createRng(seed) (mulberry32), forkRng, randomInt, shuffle, sample
    data/horseNames.ts    # 28-name pool, coat colours
    horses.ts             # createHorse (validating factory), generateHorses, silkColor, roster checks
    program.ts            # createRound (validating factory), generateProgram (6 rounds x 10 + raceSeed)
    race/
      physics.ts          # SIM_STEP, PHYSICS tuning table, pace/profile strategies, pure calculators
      standings.ts        # compareLive, compareCrossings, in-place insertion sort, gapToLeader
      createRace.ts       # createRace(round, roster, options) -> Race (fixed-step simulation)
    __fixtures__/         # Test-only builders (excluded from coverage and never imported by app code)
  playback/               # Pure timing controller (no Vue/DOM)
    clock.ts              # Wall dt → sim dt: clamp (tab switch), speed scale, pause
    fixedStep.ts          # Accumulator that runs the engine at a fixed SIM_STEP
    finishDrama.ts        # Slow-motion curve around the winning moment
    motion.ts             # Stride phase, gallop amplitude, final-furlong drive (sprint) intensity
    raceDirector.ts       # Phase machine: idle → ready → countdown → running →
                          # settling → intermission → … → complete; emits events
  render/                 # Canvas drawing (DOM types allowed, no Vue)
    geometry.ts           # Lane/x mapping + hit testing (pure, unit-tested)
    palette.ts            # Light/dark canvas palettes
    drawTrack.ts drawHorse.ts drawOverlays.ts particles.ts
  stores/
    race.ts               # Horses, program, results, status, live order, inspect/view
    preferences.ts        # Theme (persisted), speed, focus mode, followed horse
  composables/
    useAnimationFrame.ts  # rAF loop yielding wall dt
    useRaceLoop.ts        # Wires director ↔ store ↔ renderer (throttled live updates)
    useKeyboardShortcuts.ts  useBreakpoint.ts  useTheme.ts
  components/
    header/   AppHeader, RoundProgress, StatusIndicator, FollowChip, ThemeToggle,
              SpeedSelector, PlaybackButton
    track/    RaceTrack (canvas host), EmptyProgramCard
    results/  ResultsPanel, Leaderboard, CompletedRounds
    program/  ProgramPanel, RoundCard
    stable/   StablePanel
    dialogs/  ProgramCompleteDialog
    ui/       StatusPill, HorseBadge, AppButton, icons/*
  styles/     tokens.css (light/dark), base.css
  App.vue  main.ts
tests/e2e/   Playwright specs (+ visual snapshots)
scripts/     check-english.mjs
tsconfig.base.json   shared strict options
tsconfig.core.json   domain + playback, no DOM lib
tsconfig.app.json    all of src with DOM lib
tsconfig.node.json   tool configs
```

Unit specs live next to their module as `*.spec.ts`. Vitest runs two projects:
`core` (Node environment: domain, playback, render geometry) and `ui` (jsdom:
stores, composables, components). Import test APIs from `vitest` explicitly;
globals are disabled. Use the `@/` alias outside the pure layers; inside
`domain` and `playback`, use relative imports.

## Domain rules

- Exactly 20 horses, IDs 1–20, unique names (from a 28-name pool), unique colours
  (20 distinct hues), condition an integer in [1, 100].
- A program has 6 rounds, in order: 1200, 1400, 1600, 1800, 2000, 2200 m.
- Each round draws 10 distinct random horses from the 20; lane = draw order.
- Rounds run strictly one at a time; results appear as each round becomes official.
- Live order during a round; official finish times (sim seconds, 2 decimals)
  once every runner has crossed. Ties broken by interpolated crossing time,
  then by horse ID for stability.

## Domain engine contract

- Outer layers import from `@/domain` (the barrel) only.
- Every entity is built by a validating factory (`createHorse`, `createRound`,
  `createRace`) and returned frozen. Invalid input throws `DomainError` with a
  typed `code`; the domain never returns `NaN` or a partially valid entity.
- Each `Round` carries a `raceSeed`, so the program alone determines every
  race outcome. Separate concerns use separate generators (`forkRng`).
- `Race` advances only in whole `SIM_STEP` ticks (`tick(count)`); `elapsed`
  is `ticks * SIM_STEP`, so there is no floating-point drift. After the last
  runner finishes, ticks only animate the pull-up; the result is frozen.
- Runner state lives behind ES private fields; callers get `RunnerView`
  (read-only) objects. `standingsVersion` increments only when the live order
  or a placing changes, so consumers can skip redundant updates.
- Hot loop: no per-tick allocation (reused crossing buffer, primitive-argument
  strategies, in-place insertion sort, sorting skipped once settled).

## Playback model

- Wall `dt` from rAF is clamped to `MAX_FRAME_DT = 0.05 s` (tab switches,
  debugger pauses), then multiplied by `speed ∈ {1, 2, 4}`, pace and the finish
  slow-motion factor. Paused ⇒ sim dt is 0.
- Sim dt feeds an accumulator that advances the engine in `SIM_STEP` increments,
  so race outcomes never depend on frame timing or speed.
- Phase durations (design values): countdown 2.4 s, post-finish settle 1.2 s,
  intermission 2.6 s (intermission speed capped at 2x).
- Regenerating the program at any phase resets the director synchronously;
  no timers (`setTimeout`) are used for game flow, so nothing stale can fire.
- Visual motion (stride phase, gallop amplitude, final-furlong drive, finish
  slow-motion, countdown progress, intermission progress) is computed by pure
  functions in `src/playback`, so the renderer only maps numbers to pixels.
- Per-frame positions never enter reactive state. The store receives the live
  order at most every 250 ms (or immediately when a runner finishes).

## Edge cases that must be covered (tests + implementation)

| Area                    | Expected behaviour                                                                                                                                                |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Before a program exists | Start disabled; Space/1/2/4/F/T still safe; track shows the empty-program card; clicking the canvas is a no-op                                                    |
| Tab switch / long frame | Wall `dt` clamped to 0.05 s; negative or `NaN` dt treated as 0; no jump in race state                                                                             |
| Rapid toggles           | Any interleaving of pause/resume/speed changes yields sim time = Σ(clamped dt × speed while unpaused); identical results to an untouched run with the same seed   |
| Pause in every phase    | Countdown, running, settling and intermission all freeze; resume continues exactly where it stopped                                                               |
| Mid-race regeneration   | Clears results, live order, inspect/view and follow targets that no longer apply; director resets to `ready` for round 1; no stale events                         |
| Completion              | Status `complete`; Start hidden; Generate is the single primary "new program" path; Space or Start cannot restart a finished program                              |
| Completion modal        | Blocks interaction (`aria-modal`, focus trap, initial focus on primary action, background `inert`); Enter = new program, Esc = view track; focus returns on close |
| Keyboard shortcuts      | Ignored while typing in inputs; Space ignored when a button has focus (native activation instead); modal shortcuts take precedence                                |
| Boundaries              | Condition 1 and 100 both finish; photo finishes ordered by interpolated time, then horse ID; runners past the line are clamped visually                           |
| Responsive              | Desktop/tablet/mobile grids with no horizontal overflow at 320 px; no layout shift when status, pills, times or labels change                                     |
| Storage                 | `localStorage` unavailable or throwing ⇒ theme falls back to dark silently                                                                                        |

## Git workflow

- Branch: `main`. One atomic commit per milestone (more if a milestone splits
  naturally), Conventional Commit style in English, e.g.
  `chore: scaffold Vue 3 + TypeScript + Pinia + Vitest toolchain`.
- Never commit with a failing `npm run verify`.

## UX contract (from the design)

- Header: title, 6-segment round progress, status dot + pill, "Following" chip,
  theme toggle, Focus, Generate Program, 1x/2x/4x segmented control,
  Start/Pause/Resume (min-width 124 px).
- After completion the Start button is hidden and Generate becomes the primary
  action (single "new program" path); a blocking modal lists the six winners
  with "Generate new program" / "View track".
- PAUSED pill is drawn after the round distance in the track header and
  distance-pole labels never overlap it.
- Follow a horse by clicking the track lane, stable, program or leaderboard row;
  Esc clears follow, then focus.
- Keyboard: Space start/pause, F focus, T theme, 1/2/4 speed, Esc, Enter in modal.
- Breakpoints: desktop ≥ 1180 px (3-column grid), tablet ≥ 760 px, mobile below.
- Theme persisted in `localStorage` (guarded with try/catch).

## Commands

```bash
npm run dev            # Vite dev server
npm run build          # vue-tsc --build + vite build
npm run verify         # lint + format:check + typecheck + check:english + test (milestone gate)
npm run test           # Vitest (core + ui projects)
npm run test:coverage  # Vitest with v8 coverage
npm run typecheck      # vue-tsc --build
npm run lint           # ESLint, zero warnings allowed
npm run format         # Prettier write
npm run check:english  # English-only guard
npm run test:e2e       # Playwright (added in M6)
```

## Roadmap

- [x] M1 — Project setup: Vite/Vue/TS/Pinia/Vitest/ESLint/Prettier, fonts, tokens, guards, CLAUDE.md
- [x] M2 — Domain engine (`src/domain`) + exhaustive Vitest specs
- [ ] M3 — Playback controller + motion (`src/playback`) + Vitest specs (clamp, speed, pause, drift, phases, reset, stride/drive)
- [ ] M4 — Canvas renderer (`src/render`) + geometry specs
- [ ] M5 — Pinia stores + Vue components + responsive layout + keyboard shortcuts + modal focus lock (+ store/component specs)
- [ ] M6 — Polish (transitions, a11y, zero-layout-shift audit) + Playwright E2E/visual (bonus)
