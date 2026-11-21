# Horse Racing

An interactive six-round horse racing game built with Vue 3, Pinia and a pure,
deterministic TypeScript race engine. Generate a program of six races, start
it, and watch each round run on an animated track while the live order,
official results and a broadcast-style race clock update alongside.

**Live demo: [horse-racing-vue3.vercel.app](https://horse-racing-vue3.vercel.app/)**
(production build on Vercel; add `?seed=42` for a reproducible program).

![Round 2 in progress on desktop in the dark theme, following one horse](docs/images/desktop-dark-following.png)

## Quick start

Requires Node 22.22 or newer (`.nvmrc` pins 22).

```bash
nvm use
npm ci
npm run dev        # http://localhost:5173
```

Append `?seed=42` (any integer) to the URL to make horses, programs and
results fully reproducible; the end-to-end tests rely on this.

| Command                   | What it does                                                          |
| ------------------------- | --------------------------------------------------------------------- |
| `npm run verify`          | ESLint, Prettier check, `vue-tsc`, English-only check, all unit tests |
| `npm run build`           | Type-check and production build                                       |
| `npm run test`            | Vitest unit and component tests (619)                                 |
| `npm run test:coverage`   | The same, with V8 coverage                                            |
| `npm run test:e2e`        | Playwright end-to-end, layout and visual tests (46) on the build      |
| `npm run test:e2e:update` | Refresh visual baselines after an intended UI change                  |

The first E2E run needs a browser: `npx playwright install chromium`.

## How to play

1. **Generate Program** draws six rounds (1200 m to 2200 m), each with ten of
   the twenty horses.
2. **Start race** on the track (or Space, or Start in the header) runs the
   rounds one after another: countdown, race, result, short intermission,
   next round.
3. Pause and resume at any time, switch between 1x, 2x and 4x, and click any
   horse (on the track or in a table) to follow it. Click anywhere that is
   not a control, or press `Esc`, to stop following.
4. When all six rounds are official, a summary lists the winners and
   **Generate new program** starts again. Generating while a program is
   still in progress asks for confirmation first, and pauses the race while
   you decide.

Keyboard: `Space` start/pause, `1` `2` `4` speed, `F` focus mode, `T` theme,
`Esc` stop following, then leave focus mode. In the summary dialog, `Enter`
starts a new program and `Esc` returns to the track. In the "discard the
current program?" dialog, `Esc` keeps the program; only the focused button
can confirm.

## The brief, requirement by requirement

| Requirement                                | Where and how                                                                                                    |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| Vue                                        | Vue 3.5 with `<script setup lang="ts">`                                                                          |
| 20 horses, unique colours, condition 1–100 | Fixed roster with IDs 1–20, 20 distinct silk hues, condition drawn per session ([domain](docs/domain.md#horses)) |
| Generate a six-round schedule              | **Generate Program**; rounds at 1200, 1400, 1600, 1800, 2000 and 2200 m, 10 random runners each                  |
| Start runs one round at a time             | A pause-aware phase machine ([architecture](docs/architecture.md#the-race-director))                             |
| Results appear as each race concludes      | Results board, completed-rounds list, program panel, and program standings across rounds                         |
| Horses visibly move                        | Canvas 2D track with gallop, sprint and finish animation                                                         |
| Clean, scalable code                       | Layered architecture with enforced boundaries ([architecture](docs/architecture.md))                             |
| Vuex or Pinia                              | Pinia setup stores                                                                                               |
| Component-based design                     | Containers, presentational components and slot wrappers ([UI/UX](docs/ux.md#component-structure))                |
| Bonus: unit, E2E and visual tests          | 619 Vitest tests, 46 Playwright tests including screenshot baselines ([quality](docs/quality.md))                |

One interpretation to note: the brief says the horse list contains "between 1
and 20 horses" but also requires exactly 20 available horses. The game always
generates the full roster of 20.

## Documentation

| Document                                     | Read it for                                                                                      |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| [docs/domain.md](docs/domain.md)             | Race rules, the researched condition model, realistic race times, and deliberate simplifications |
| [docs/architecture.md](docs/architecture.md) | Layers and how they are enforced, determinism, the three kinds of time, state management         |
| [docs/ux.md](docs/ux.md)                     | Layout, interactions, accessibility, theming and zero layout shift                               |
| [docs/quality.md](docs/quality.md)           | Test strategy, the edge-case matrix, and the bugs the process caught                             |
| [CLAUDE.md](CLAUDE.md)                       | The working rules for contributors (and coding agents) in this repository                        |

## Project layout

```
src/
  domain/       Pure race rules: horses, programs, condition model, physics, timeboard
  playback/     Pure timing: clock, fixed-step accumulator, slow motion, phase machine
  render/       Canvas drawing of the track (no Vue or Pinia)
  stores/       Pinia stores and pure view models
  composables/  Game loop, keyboard shortcuts, focus trap, theme
  components/   Vue components by area (header, track, results, program, stable, dialogs, ui)
  styles/       Design tokens (light and dark) and base styles
tests/e2e/      Playwright specs and visual baselines
docs/           Project documentation
```
