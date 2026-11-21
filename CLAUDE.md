# CLAUDE.md — Horse Racing (Vue 3)

Interactive six-round horse racing simulation built with Vue 3, Pinia and a
pure, deterministic TypeScript race engine. This file holds the working rules
for anyone (human or agent) changing the code. Reviewer-facing documentation
lives in `README.md` and `docs/` (see [Documentation](#documentation)); the UX
contract and design tokens below are the visual source of truth.

## Non-negotiable rules

1. **English only.** All code, identifiers, types, UI copy, comments, test names,
   commit messages and docs are in English. No Turkish or other non-English words.
   Enforced by `npm run check:english` (part of `verify`), which scans `src`,
   `tests`, `scripts`, `public`, `docs`, `README.md` and `CLAUDE.md`.
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
4. **Every domain or playback change ships with Vitest coverage.** Unit tests
   use deterministic inputs only: seeded `Rng`, explicit `dt` sequences, fake
   clocks. No real timers, no `Math.random`, no wall-clock reads in specs.
   (Playwright tests run in real time but always with `?seed=42`.)
5. **Design fidelity.** Follow the tokens in `src/styles/tokens.css` and the
   UX contract below for spacing, typography and behaviour. Zero layout shift: fixed row heights, `min-width` on stateful
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
7. **Verification gate.** A milestone is not done until
   `npm run verify` passes (ESLint with `--max-warnings 0`, Prettier check,
   `vue-tsc --build`, English check, Vitest) and `npm run build` succeeds.
   UI changes also run `npm run test:e2e`; visual baselines are only updated
   deliberately, after reviewing the diff.
   Then make an atomic commit and stop for review.
8. **Docs stay current.** A change to rules, architecture, UX behaviour or the
   test suite updates the matching file in `docs/` (and this file) in the
   same commit. Numbers quoted in docs (test counts, coverage, outcome
   statistics) are re-measured, not guessed.

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
| E2E / visual | Playwright 1.65 against the production build (seeded via `?seed=`)              | Bonus 2 & 3                                                                                |
| Lint/format  | ESLint flat config (vue + typescript-eslint) + Prettier                         | Consistency                                                                                |

## Directory layout

```
README.md                 # Reviewer entry point: quick start, brief mapping, docs map
docs/
  domain.md               # Race rules, condition and race-time research, simplifications
  architecture.md         # Layers, determinism, time domains, director, state, rendering
  ux.md                   # Layout, interactions, accessibility, theme, zero layout shift
  quality.md              # Test strategy, edge-case matrix, bugs caught, limitations
  images/                 # Screenshots used by the docs (seed 42)
src/
  domain/                 # Pure rules engine (no Vue/DOM). Public API: src/domain/index.ts
    constants.ts          # HORSE_COUNT=20, RUNNERS_PER_ROUND=10, ROUND_DISTANCES, CONDITION_MIN/MAX
    errors.ts             # DomainError (typed `code`), invariant, assertIntegerInRange
    condition.ts          # 1-100 score <-> Henneke BCS 1-9, bands, peaked speed/stamina curve, drawCondition
    types.ts              # Horse, Round, Program, FinishRecord, RoundResult (all readonly)
    random.ts             # createRng(seed) (mulberry32), forkRng, randomInt, shuffle, sample
    data/horseNames.ts    # 28-name pool, coat colours
    horses.ts             # createHorse (validating factory), generateHorses, silkColor, roster checks
    program.ts            # createRound (validating factory), generateProgram (6 rounds x 10 + raceSeed)
    programStandings.ts   # Points across rounds (10-8-6-5-4-3-2-1), countback, shared ranks, form figures
                          # (rank movement per round is derived in stores/raceView.ts)
    race/
      physics.ts          # SIM_STEP, PHYSICS tuning table, pace/profile strategies, pure calculators
      standings.ts        # compareLive, compareCrossings, in-place insertion sort, gapToLeader
      createRace.ts       # createRace(round, roster, options) -> Race (fixed-step simulation)
      timeboard.ts        # Display-only time: sim seconds -> broadcast seconds per distance, m:ss.cc
    __fixtures__/         # Test-only builders (excluded from coverage and never imported by app code)
  playback/               # Pure timing controller (no Vue/DOM)
    clock.ts              # Wall dt → sim dt: clamp (tab switch), speed scale, pause
    fixedStep.ts          # Accumulator that runs the engine at a fixed SIM_STEP
    finishDrama.ts        # Slow-motion curve around the winning moment
    motion.ts             # Stride phase, gallop amplitude, final-stretch drive (sprint) intensity
    liveOrder.ts          # Live leaderboard rows (+Nm gaps, official times) and the 250 ms publish gate
    raceFrame.ts          # One frame of the pipeline: drama -> accumulator -> race.tick -> motion
    raceDirector.ts       # Phase machine: idle → ready → countdown → running →
                          # settling → intermission → … → complete; emits events
  render/                 # Canvas drawing (DOM types allowed, no Vue)
    geometry.ts           # Lane/x mapping + hit testing (pure, unit-tested)
    palette.ts            # Light/dark canvas palettes
    drawTrack.ts          # Turf, lanes, rails, header band (PAUSED pill), poles, finish line
    drawHorse.ts          # Horse and jockey figure driven by RunnerMotion
    drawRunners.ts        # Runners, name tags, rank badges, leader/follow markers, gates
    drawOverlays.ts       # Gate scrim (the Start card is DOM: ReadyCard), countdown, winner card
    particles.ts          # Pooled dust particles (seeded, presentation-time aging)
    renderer.ts           # createTrackRenderer(canvas): resize, render(scene), horseAt(y), laneAt(y)
  test/                   # Vitest setup (jsdom) and the recording fake 2D context
  stores/
    race.ts               # Facade over the (markRaw) director: horses, program, results,
                          # phase, throttled live order, inspect/expand state, view getters
    raceView.ts           # Pure view-model builders (status, board, rounds, stable, ...)
    preferences.ts        # Theme (persisted, storage failures ignored), speed, focus, follow
  composables/
    useAnimationFrame.ts  # rAF loop yielding raw wall dt
    useRaceLoop.ts        # Per frame: race.advance(dt) then renderer.render(scene); resize; hit test; lane hover
    shortcuts.ts          # Pure resolveShortcut(key, context) -> action (unit-tested)
    useKeyboardShortcuts.ts  # Window listener that dispatches resolved actions
    useFocusTrap.ts       # Dialog focus trap, background `inert`, focus restore
    useOutsideClick.ts    # isDismissClick (pure) + click-outside listener that stops following
    useTheme.ts           # Mirrors the theme onto <html data-theme>
  components/
    layout/   DashboardLayout (named slots + responsive grid; structure only)
    header/   AppHeader (container), RoundProgress, StatusIndicator,
              ThemeToggle, SpeedSelector, PlaybackButton
    follow/   FollowBadge (container, fixed bottom-right), FollowChip
    track/    RaceTrack (container, canvas host), EmptyProgramCard, ReadyCard (Start race at the gates)
    results/  ResultsPanel (container), ResultsLeaderboard, CompletedRounds
    program/  ProgramPanel (container), RoundCard
    stable/   StablePanel (container, Roster/Standings tabs), StableTable, StandingsList, ConditionLegend
    dialogs/  ProgramCompleteDialog, RegenerateConfirmDialog, StandingsDialog (containers)
    ui/       AppButton (primary/secondary/danger), StatusPill (live pulse), TabSwitch, MovementBadge, HorseBadge,
              ConditionBadge, ColorTick, PanelCard (wrapper),
              ModalDialog (wrapper: teleport, aria-modal, focus trap), icons/*
  styles/     tokens.css (light/dark), base.css
  App.vue  main.ts
tests/e2e/   Playwright against the production build, always with ?seed=42
  race.spec.ts     # Flow: empty state, start, pause, regenerate, follow, theme, speed, completion dialog
  layout.spec.ts   # No horizontal overflow (320-1440 px), grid order, zero layout shift
  visual.spec.ts   # Screenshot baselines (canvas masked in layout shots; track compared separately)
  __screenshots__/ # Baselines, suffixed by platform (regenerate with npm run test:e2e:update)
scripts/     check-english.mjs
.nvmrc               Node 22
playwright.config.ts builds, serves on :4173, Chromium project
tsconfig.base.json   shared strict options
tsconfig.core.json   domain + playback, no DOM lib
tsconfig.app.json    all of src with DOM lib
tsconfig.node.json   tool configs
tsconfig.e2e.json    Playwright config and specs (Node + DOM lib for page.evaluate)
```

Unit specs live next to their module as `*.spec.ts`. Vitest runs two projects:
`core` (Node environment: domain, playback, render geometry) and `ui` (jsdom:
stores, composables, components, and any `*.dom.spec.ts` such as the renderer
smoke test, which draws every phase into a recording fake 2D context). Import test APIs from `vitest` explicitly;
globals are disabled. Use the `@/` alias outside the pure layers; inside
`domain` and `playback`, use relative imports.

## Domain rules

- Exactly 20 horses, IDs 1–20, unique names (from a 28-name pool), unique colours
  (20 distinct hues), condition an integer in [1, 100].
- A program has 6 rounds, in order: 1200, 1400, 1600, 1800, 2000, 2200 m.
- Each round draws 10 distinct random horses from the 20; lane = draw order.
- Rounds run strictly one at a time; results appear as each round becomes official.
- Live order during a round; official finish times once every runner has
  crossed. Results store simulation seconds; users see them as timeboard
  times (`m:ss.cc`, about 1:00 per 1000 m). Ties broken by interpolated
  crossing time, then by horse ID for stability.
- Program standings: 10-8-6-5-4-3-2-1 points for 1st-8th per official round
  (39 per round), countback on more wins then seconds and so on, shared rank
  when fully level, derived purely from results (never stored). Rank movement
  (`▲2` / `▼1`) is shown in the standings only (changes once per round), never
  on the live leaderboard (it would flicker); none on a horse's first run.
- Deliberate simplifications (straight track, one surface, no tactics or
  weights, condition fixed per session, compressed playback) and the
  real-world surfaces and geometry they simplify are in `docs/domain.md`.

## Condition model (researched; see `src/domain/condition.ts`)

- The 1–100 score (required by the brief) maps linearly onto the Henneke body
  condition score (BCS 1–9: 1 poor, 5 moderate, 9 extremely fat), the scale
  used for horses in practice. It is **not** "higher is better".
- Performance peaks at **BCS 4.5** (condition 44): Thoroughbreds in heavy race
  training are lean, around BCS 4 (Ohio State extension) and measured near 4.5
  in racing Thoroughbreds and Arabians (Braz J Vet Res Anim Sci, 2019).
- Thin horses lack reserves and muscle → mainly a **stamina** penalty (they
  fade, more over longer trips). Heavy horses have a worse power-to-weight
  ratio → mainly a **speed** penalty plus some fade. Per BCS point, excess
  costs more speed than deficit (underweight-to-ideal horses out-earn
  overweight ones in a retrospective study). Evidence is limited, so the
  constants are a documented modelling choice in `CONDITION_MODEL`.
- Bands: underweight < 3.5 ≤ lean < 4 ≤ race fit ≤ 5 < fleshy < 6.5 ≤ overweight.
  The UI shows the score with a band marker (dot / ring / bar, never colour
  alone) and the full description as its accessible label.
- Stables are drawn with ~70% of horses around race fitness and the rest
  uniform over 1–100 (lay-offs, poor doers, heavy horses), using only
  arithmetic on the seeded `Rng` so seeds replay identically.
- Expected outcomes (300 seeded programs): ~5 distinct winners per 6-round
  program; race-fit horses win ~1.7× their share, overweight horses rarely.
- Research sources and the full rationale are in `docs/domain.md`.

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
  debugger pauses), then multiplied by `speed ∈ {1, 2, 4}` and the finish
  slow-motion factor. Paused ⇒ sim dt is 0.
- Sim dt feeds an accumulator that advances the engine in `SIM_STEP` increments,
  so race outcomes never depend on frame timing or speed.
- Phase durations: countdown 2.4 s, post-finish settle 1.2 s,
  intermission 2.6 s (intermission speed capped at 2x).
- Regenerating the program at any phase resets the director synchronously;
  no timers (`setTimeout`) are used for game flow, so nothing stale can fire.
- Visual motion (stride phase, gallop amplitude, final-stretch drive, finish
  slow-motion, countdown progress, intermission progress) is computed by pure
  functions in `src/playback`, so the renderer only maps numbers to pixels.
- Per-frame positions never enter reactive state. The store receives the live
  order at most every 250 ms (or immediately when a runner finishes), and
  only the board view model reads it: it is kept out of the shared view-model
  input so a publication never rebuilds the other panels. The full store
  inventory (what is stored and why) is in `docs/architecture.md`.
- **Three kinds of time, never mixed:**
  - _Simulation time_ (`race.elapsed`, `finishTime`): fixed-step engine
    seconds; decides results. A race lasts roughly 10-25 s of it.
  - _Presentation time_ (`presentationDt`): wall time, clamped and 0 while
    paused; drives effects (see below). At 1x, sim time ≈ presentation time,
    so a race takes about 10-25 s on screen.
  - _Timeboard time_ (`src/domain/race/timeboard.ts`): what spectators read.
    `display = sim × timeboardScale(distance)`, calibrated from `PHYSICS` so a
    race-fit horse runs 1000 m in about 60 s, slowing with distance
    (1200 m ≈ 1:12, 2200 m ≈ 2:15). This matches the handicapping rule of
    thumb of ~12 s per furlong up to a mile and ~14 s per furlong beyond
    within 3% (asserted in `timeboard.spec.ts`). One positive factor per round, so
    order, ties and gaps are preserved, and the live clock always agrees with
    the official times. Always format with `formatTimeboard` /
    `formatOfficialTime` (`m:ss.cc`, constant width); never show raw sim
    seconds to users.
- **One time source.** Every time-based effect (finish slow motion, winner
  card fade-in, name-tag fade-out, countdown, intermission) advances on the
  playback clock's `presentationDt`, which is 0 while paused and clamped on
  long frames. Never time an effect against wall-clock timestamps
  (`performance.now()` minus a start time): wall time keeps running during a
  pause or hidden tab, so the effect expires and is skipped on resume.
- Frame pipeline order (`runRaceFrame`), where the drama observes the race as
  it was at the start of the frame:

  ```
  clock.advance(wallDt)
    → drama.step(presentationDt, observeFinish(race))
    → accumulator.push(presentationDt × speed × factor)
    → race.tick(ticks)
    → motion.advance(race, simDt, presentationDt)
  ```

## Edge cases that must be covered (tests + implementation)

| Area                    | Expected behaviour                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Before a program exists | Start disabled; Space/1/2/4/F/T still safe; track shows the empty-program card; clicking the canvas is a no-op                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Tab switch / long frame | Wall `dt` clamped to 0.05 s; negative or `NaN` dt treated as 0; no jump in race state                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Rapid toggles           | Any interleaving of pause/resume/speed changes yields sim time = Σ(clamped dt × speed while unpaused); identical results to an untouched run with the same seed                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Pause in every phase    | Countdown, running, settling and intermission all freeze; resume continues exactly where it stopped                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Mid-race regeneration   | Generate asks first (`requestNewProgram`) when a round is underway or results exist, pausing the race; cancel resumes only if it paused; confirm clears results, live order and inspect/view (the followed horse is kept); director resets to `ready` for round 1; no stale events                                                                                                                                                                                                                                                                                                                              |
| Completion              | Status `complete`; Start hidden; Generate is the single primary "new program" path; Space or Start cannot restart a finished program                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Dialogs                 | Completion, discard confirmation and standings: `aria-modal`, focus trap, background `inert`, focus restored; only one open at a time. Completion: initial focus on Generate, Enter = new program, Esc = view track. Confirmation: initial focus on Keep, Esc = keep, Enter never confirms. Standings: pauses a running race (resumes only if it paused), Esc closes; opened from the summary it hides (never dismisses) the summary, its ✕ reads "Back to summary" and returns to it; ✕, backdrop click and Esc close it, initial focus on the table region; Enter generates only once the program is complete |
| Keyboard shortcuts      | Ignored while typing in inputs; Space ignored when a button has focus (native activation instead); dialog shortcuts take precedence                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Follow dismissal        | Esc, the chip's close button, or a click on anything non-interactive (not buttons, links, fields, dialogs; the canvas clears only outside the lanes)                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Boundaries              | Condition 1, 44 (optimum) and 100 all finish; 100 is out of condition, not the best; band edges (BCS 3.5 / 4 / 5 / 6.5) tested; photo finishes ordered by interpolated time, then horse ID; runners past the line are clamped visually                                                                                                                                                                                                                                                                                                                                                                          |
| Responsive              | Desktop/tablet/mobile grids with no horizontal overflow at 320 px; no layout shift when status, pills, times, labels or the followed horse change                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Storage                 | `localStorage` unavailable or throwing ⇒ theme falls back to dark silently                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

## Component conventions

- **Containers** (`AppHeader`, `RaceTrack`, `ResultsPanel`, `ProgramPanel`,
  `StablePanel`, `FollowBadge`, `ProgramCompleteDialog`,
  `RegenerateConfirmDialog`, `StandingsDialog`) read stores and wire events.
  **Presentational** components take typed props (view models from
  `stores/raceView.ts`) and emit events; they never import stores.
  **Wrappers** (`PanelCard`, `ModalDialog`, `DashboardLayout`) provide chrome,
  behaviour or structure through slots.
- Every clickable row is a native `<button>`; toggles expose `aria-pressed`,
  disclosures `aria-expanded`, the status line is `aria-live="polite"`.
- Theme-dependent values belong in tokens (e.g. `--dim-opacity`, `--row-hover`,
  `--inactive-*`, `--medal-*`, `--danger`, `--move-up` / `--move-down`). Do not use
  `:global(...) .x` in scoped styles: Vue compiles it to the global part only.

## Git workflow

- Branch: `main`. One atomic commit per milestone (more if a milestone splits
  naturally), Conventional Commit style in English, e.g.
  `chore: scaffold Vue 3 + TypeScript + Pinia + Vitest toolchain`.
- Never commit with a failing `npm run verify`.

## UX contract

- Header: title, 6-segment round progress, status dot + pill,
  theme toggle, Focus, Generate Program, 1x/2x/4x segmented control,
  Start/Pause/Resume (min-width 124 px). The header never shows follow state.
- "Following <horse>" badge: shown only while a horse is followed (never as
  hint text), fixed to the viewport's bottom-right corner, outside every
  layout and never over the header or the track. Desktop: inside the
  Program panel's empty lower corner. Below 1180 px: the page keeps a
  permanent bottom clearance (`--float-clearance`) so the badge rests below
  the last panel at the end of the scroll.
- At the gates (round 1 only), a ReadyCard over the track offers **Start race**
  plus an "or press Space" hint; the canvas only dims. Focus moves to it only
  right after a Generate action (`data-action="generate"`).
- After completion the Start button is hidden and Generate becomes the primary
  action (single "new program" path); a blocking modal lists the six winners
  with "Generate new program" (full width, primary) above two equal
  secondary actions, "Final standings" and "View track". Only "View track"
  dismisses the summary; "Final standings" opens the standings in front of
  it. Esc / "Back to summary" return to it with focus on "Final standings";
  Enter or the footer's primary button generates a new program.
- Decision dialogs (completion, discard) have no ✕ and ignore backdrop
  clicks: every action is a labelled footer button. The standings viewer
  has a top-right ✕ ("Close standings" / "Back to summary"), closes on a
  backdrop click (`ModalDialog` `dismissible`; only when press and release
  are both on the backdrop) and Esc; its footer holds only "Generate new
  program" once complete, pinned while the table scrolls. The table region
  (`aria-label="Standings table"`) takes initial focus.
- Generate during countdown, running, settling or intermission opens
  "Discard the current program?" naming what would be lost; no confirmation
  at the gates or after completion.
- Live pills carry a pulsing dot (transform/opacity only, `aria-hidden`,
  still under reduced motion). Results board podium uses gold/silver/bronze
  pills in a fixed 32 px position box.
- PAUSED pill is drawn after the round distance in the track header and
  distance-pole labels never overlap it.
- Follow a horse by clicking the track lane, stable, program or leaderboard row;
  Esc clears follow, then focus; clicking outside controls clears follow.
- The Stable panel has Roster and Standings tabs (WAI-ARIA tabs); both views
  list 20 rows with equal footers, so switching never shifts layout. The
  Standings footer is one line of context plus a tonal "Full table" button
  (chevron, `aria-haspopup="dialog"`); the scoring rule lives in the dialog.
  "Full table" (and "Final standings" in the completion dialog) opens the
  standings dialog: rank, horse and points pinned, R1-R6 scroll on narrow
  screens.
- Hover on rows is a background wash only (`--row-hover`); the followed row
  keeps the accent fill and ring. On the track, the lane under a mouse or pen
  pointer gets a neutral wash with hairline edges (`hoverLane` /
  `hoverLaneEdge` in the canvas palette), nothing extra on the followed lane,
  and the pointer cursor appears only over lanes. Hovered lane is local state
  in `useRaceLoop` (scene field `hoveredLane`), never in a store. Horses sitting out the round use one
  inactive treatment (`--inactive-fg` / `--inactive-bg`), never filters.
- Keyboard: Space start/pause, F focus, T theme, 1/2/4 speed, Esc. Enter =
  new program in the completion summary and final standings only (never in
  the discard confirmation or mid-program standings).
- Breakpoints: desktop ≥ 1180 px (3-column grid), tablet ≥ 760 px, mobile below.
  Implemented with CSS media queries only (no JS breakpoint composable); the
  canvas switches to its compact layout below 560 px of its own width.
- Theme persisted in `localStorage` (guarded with try/catch).

## Commands

```bash
nvm use               # Node 22.22+ (see .nvmrc; jsdom and Vitest need it)
npm run dev            # Vite dev server
npm run build          # vue-tsc --build + vite build
npm run verify         # lint + format:check + typecheck + check:english + test (milestone gate)
npm run test           # Vitest (core + ui projects)
npm run test:coverage  # Vitest with v8 coverage
npm run typecheck      # vue-tsc --build
npm run lint           # ESLint, zero warnings allowed
npm run format         # Prettier write
npm run check:english  # English-only guard
npm run test:e2e       # Playwright E2E + visual (builds and serves on :4173)
npm run test:e2e:update  # Refresh visual baselines after an intended UI change
npx playwright install chromium  # One-time browser download for E2E
```

## Documentation

| File                   | Audience and scope                                                          |
| ---------------------- | --------------------------------------------------------------------------- |
| `README.md`            | Reviewers: live demo link, quick start, requirement mapping, links          |
| `docs/domain.md`       | Rules, researched condition and time models (with sources), simplifications |
| `docs/architecture.md` | Layers and enforcement, determinism, time domains, director, state          |
| `docs/ux.md`           | Layout, interactions, keyboard, accessibility, zero layout shift            |
| `docs/quality.md`      | Test suites and counts, coverage, edge-case matrix, bugs caught             |
| `CLAUDE.md`            | Working rules and conventions (this file)                                   |

The live demo is https://horse-racing-vue3.vercel.app/ (Vercel, production
build); the README links it first.

Screenshots in `docs/images/` are captured from the production build with
`?seed=42`; refresh them when the UI changes visibly.

## Roadmap

- [x] M1 — Project setup: Vite/Vue/TS/Pinia/Vitest/ESLint/Prettier, fonts, tokens, guards, CLAUDE.md
- [x] M2 — Domain engine (`src/domain`) + exhaustive Vitest specs
- [x] M3 — Playback controller + motion (`src/playback`) + Vitest specs (clamp, speed, pause, drift, phases, reset, stride/drive)
- [x] M4 — Canvas renderer (`src/render`) + geometry specs
- [x] M5 — Pinia stores + Vue components + responsive layout + keyboard shortcuts + modal focus lock (+ store/component specs)
- [x] M6 — Polish (transitions, a11y, zero-layout-shift audit) + Playwright E2E/visual (bonus)
