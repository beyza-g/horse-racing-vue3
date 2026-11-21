# CLAUDE.md — Horse Racing (Vue 3)

Working contract for anyone (human or agent) changing this repository: rules,
boundaries, invariants and commands. Explanations and rationale live in the
docs; this file points to them instead of repeating them.

| Document               | Owns                                                                  |
| ---------------------- | --------------------------------------------------------------------- |
| `README.md`            | Reviewer entry: live demo, quick start, the brief mapped to the code  |
| `docs/architecture.md` | Layers, determinism, time, the director, state inventory, components  |
| `docs/domain.md`       | Race rules, condition and race-time models with sources, scope limits |
| `docs/ux.md`           | Layout, interaction decisions, zero layout shift, keyboard, a11y      |
| `docs/quality.md`      | Test suites and counts, coverage, edge-case matrix, bugs caught       |

Live demo: https://horse-racing-vue3.vercel.app/ (production build on Vercel).

## Rules

1. **English only** in code, identifiers, UI copy, comments, tests, commits
   and docs. `npm run check:english` (part of `verify`) enforces it.
2. **Layers point inward:**
   `components → composables/stores → render → playback → domain`.
   - `domain` and `playback` never touch Vue, Pinia, `window`, `document`,
     `performance`, `requestAnimationFrame`, timers, `Date` or `Math.random`.
     Randomness is an injected seeded `Rng`; time is a `dt` in seconds.
   - `render` may use Canvas types, never Vue or Pinia.
   - Enforced by per-layer ESLint restrictions and by `tsconfig.core.json`,
     which type-checks `domain` + `playback` without the DOM lib.
   - Outer layers import a layer through its barrel (`@/domain`, `@/playback`,
     `@/render`). Inside `domain` and `playback`, use relative imports.
3. **Determinism.** Same seed ⇒ same horses, program, finishing order and
   official times, whatever the frame rate, speed, pauses or tab switches.
4. **Tests ship with changes.** Domain and playback changes come with Vitest
   specs using deterministic inputs only: seeded `Rng`, explicit `dt`
   sequences, no real timers or wall-clock reads.
5. **Zero layout shift and design tokens.** Theme values come from
   `src/styles/tokens.css`. State changes never move layout (see
   [conventions](#ui-conventions)).
6. **Strict TypeScript** (`tsconfig.base.json`: `strict`,
   `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
   `erasableSyntaxOnly` and friends; ESLint `strictTypeChecked` +
   `switch-exhaustiveness-check`).
   - No `any`. A justified exception needs
     `// eslint-disable-next-line … -- <reason>`; disables without a reason fail.
   - Prefer narrowing (`instanceof`, `invariant`) over `as`; non-null
     assertions only in specs. Model states as discriminated unions and keep
     domain data `readonly`.
7. **Verification gate.** Done means `npm run verify` and `npm run build`
   pass; UI changes also pass `npm run test:e2e`. Visual baselines are
   updated only deliberately, after reviewing the diff. Then commit
   atomically.
8. **Docs stay current** in the same commit as the change. Numbers in docs
   (test counts, coverage, outcome statistics, bundle size) are re-measured,
   never estimated.

## Invariants that must not break

Rationale and diagrams: [architecture](docs/architecture.md).

- **Fixed timestep.** `Race.tick(count)` advances in whole `SIM_STEP` (1/120 s)
  ticks through an accumulator; outcomes never depend on frame timing.
- **Seeds.** Separate concerns use separate `forkRng` streams; each `Round`
  carries a `raceSeed`, so the program alone decides every race.
- **Validated, frozen entities.** `createHorse`, `createRound`, `createRace`
  throw a typed `DomainError` on bad input; never return `NaN` or a partial
  entity.
- **No timers in game flow.** Countdown, settle and intermission are phase
  durations advanced by frame deltas; regenerating resets synchronously.
- **Three kinds of time, never mixed.** Simulation time decides results;
  presentation time (`presentationDt`, clamped, 0 while paused) drives every
  effect; timeboard time is what users read. Never time an effect with
  wall-clock timestamps, and never show raw simulation seconds: format with
  `formatTimeboard` / `formatOfficialTime` (`m:ss.cc`).
- **Reactivity.** The director is `markRaw` inside the race store and exposed
  only as a read-only `RaceDirectorView`. Per-frame positions never enter
  reactive state; the live order publishes at most every 250 ms and only the
  board reads it.
- **Hot loop allocates nothing** per tick (reused buffers, primitive-argument
  strategies, in-place insertion sort).

## Domain constraints

Rules, research and simplifications: [domain](docs/domain.md).

- 20 horses (IDs 1–20, unique names and silk colours), condition an integer
  in 1–100; six rounds at 1200–2200 m; ten distinct runners per round, lane
  = draw order; rounds run one at a time.
- Condition maps onto the Henneke body condition score and **peaks at 44**:
  higher is not better. Keep `CONDITION_MODEL` and the docs in step;
  re-measure outcomes with `npm run measure:outcomes`.
- Placings: interpolated crossing time, then horse ID. Program standings are
  derived from results, never stored.

## UI conventions

Behaviour and rationale: [ux](docs/ux.md).

- **Containers** read stores and wire events; **presentational** components
  take view models from `@/stores/raceView` as props and emit events, never
  importing stores; **wrappers** (`PanelCard`, `ModalDialog`,
  `DashboardLayout`) provide structure through slots.
- Clickable rows are native `<button>`s with ARIA state (`aria-pressed`,
  `aria-expanded`); the status line is `aria-live="polite"`.
- Zero layout shift: fixed row heights, `min-width` on stateful buttons,
  tabular mono digits, absolutely positioned leaderboard rows, overlays out of
  flow (ReadyCard, the `FollowBadge`). Indicators appear only while active,
  never as placeholder hint text.
- Dialogs: decision dialogs (completion, discard) have no ✕ and ignore the
  backdrop; the standings viewer closes with ✕, backdrop or Esc. Only one
  dialog is open at a time, with focus trapped and the app `inert`.
- Theme-dependent values are tokens. Never write `:global(...) .x` in scoped
  styles: Vue compiles it to the global part only.
- Breakpoints by CSS only: desktop ≥ 1180 px, tablet ≥ 760 px; the canvas has
  its own compact mode below 560 px.

## Testing

Suites, counts and the edge-case matrix: [quality](docs/quality.md). The
matrix is part of the contract: changes keep every row covered.

- Specs sit next to their module (`*.spec.ts`); import test APIs from
  `vitest` (no globals). Project `core` (Node) runs domain, playback and
  render specs; `ui` (jsdom) runs stores, composables, components and
  `*.dom.spec.ts`.
- Playwright runs the production build on port 4183 and always opens
  `?seed=42`. Baselines are macOS-specific.

## Repository map

```
src/domain/       rules engine: constants, condition, horses, program, standings, race/
src/playback/     clock, fixed-step accumulator, finish drama, motion, live order, director
src/render/       canvas renderer, pure geometry, palettes
src/stores/       race (facade over the director), preferences, raceView + views/*
src/composables/  animation frame, race loop, shortcuts, focus trap, outside click, theme
src/components/   layout, header, track, follow, results, program, stable, dialogs, ui
src/styles/       tokens.css (light/dark), base.css
tests/e2e/        race (flows), layout (overflow, zero shift), visual (baselines)
scripts/          check-english.mjs, measure-outcomes.mjs
docs/images/      screenshots from the production build with ?seed=42
```

## Commands

```bash
nvm use                   # Node 22.22+ (.nvmrc)
npm run dev               # Vite dev server
npm run verify            # lint, format check, vue-tsc, English check, unit tests
npm run build             # vue-tsc --build + vite build
npm run test              # Vitest (core + ui); test:coverage adds V8 coverage
npm run test:e2e          # Playwright E2E + visual on the production build
npm run test:e2e:update   # refresh baselines after an intended UI change
npm run measure:outcomes  # reproduce the outcome statistics in docs/domain.md
npx playwright install chromium  # one-time browser download
```

## Git

Work on `main`. Atomic Conventional Commits in English; never commit with a
failing `npm run verify`.
