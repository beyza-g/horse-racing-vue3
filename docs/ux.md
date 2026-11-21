# UI and UX

![Round 2 in progress on desktop in the dark theme, following one horse](images/race-dark.png)

## Layout

The page is one dashboard with four areas, arranged by viewport width using
CSS grid and media queries only (no JavaScript breakpoints):

| Width          | Arrangement                                                                                        |
| -------------- | -------------------------------------------------------------------------------------------------- |
| ≥ 1180 px      | Three columns: **Stable** \| **Track** over **Results** \| **Program**; the page fits the viewport |
| 760 to 1179 px | Track, then Results, then Program and Stable side by side                                          |
| < 760 px       | One column: Track, Results, Program, Stable; header controls wrap into two rows                    |

The track canvas has its own compact mode below 560 px of its width: name
tags are hidden and labels that would collide with the race clock give way.
End-to-end tests check there is no horizontal scrolling from 320 to 1440 px
and that no horse name is truncated in the tables at those widths.

<p>
  <img src="images/race-light-mobile.png" alt="Mobile layout, light theme" width="320">
</p>

## What each area does

**Header.** Title, six-segment round progress, a live status line with a
pill (At the gates, Starting, Live, Paused, Official), the followed horse,
theme switch, Focus mode, Generate Program, speed (1x, 2x, 4x) and the
Start/Pause/Resume button.

**Track.** Ten lanes with distance poles, a chequered finish, starting gates
and a "3, 2, 1, GO" countdown. Horses gallop with a stride driven by their
speed, jockeys drive in the final stretch, the leader gets a marker, and the
top three carry gold, silver and bronze rank badges. The finish slows to
slow motion around the winner, then a winner card shows the official time.
The race clock in the header reads realistic durations (about 1:12 over
1200 m) while the race itself takes seconds on screen.

**Results.** A leaderboard of ten rows that reorder live during a race and
show official times afterwards, plus a list of completed rounds. Selecting a
finished round shows its full result; **Back to live** returns to the current
round.

**Program.** One card per round with its distance, status pill and line-up.
The current round is highlighted and opens automatically.

**Stable.** All 20 horses with number, name, lane in the current round and
condition. Horses not running in the current round are greyed out.

**Completion dialog.** After round 6, a summary of the six winners with
**Generate new program** (the primary action) and **View track**.

## Key decisions

**Condition is shown as a band, not just a number.** Because condition peaks
in the middle of the scale ([domain](domain.md#condition-model)), a bare "98"
would mislead. Each score carries a marker whose shape changes with the band:
a filled dot for race fit, a ring for lean or fleshy, a bar for out of
condition. Shape, not only colour, carries the meaning, and the stable panel
has a key. The full description ("Condition 44 of 100 · Race fit · body
condition 4.5 of 9 (Moderately thin)") is the badge's accessible label and
tooltip.

**One path to a new program.** Once a program is complete, Start disappears
and Generate becomes the primary button, so there is never a confusing
"restart" of a finished program. Generate works at any moment, including
mid-race, and always resets to round 1 at the gates.

**Follow a horse from anywhere.** Clicking a lane on the track, or a row in
the stable, program or results, follows that horse: its lane is highlighted,
the other horses dim, a guide line tracks it and the header shows a
"Following" chip. `Esc` stops following.

**Focus mode** (`F`) dims the side panels so the track stands out, without
hiding any information.

**The PAUSED pill never covers anything.** It is drawn after the round
distance in the track header, and distance labels that would overlap it, or
the race clock, are skipped.

## Zero layout shift

Live data changes every frame, so the layout is built not to move:

- Leaderboard rows are absolutely positioned and reorder with `transform`;
  the list keeps a fixed height.
- Times and numbers use a tabular monospace font, and the timeboard format
  `m:ss.cc` has a constant width.
- The Start/Pause/Resume button has a minimum width, so its label can change
  without resizing the header.
- Pills and rows have fixed heights.

An end-to-end test measures the header, canvas, results and panels before
and after Start, Pause and Resume and requires identical boxes.

## Keyboard

| Key         | Action                                           |
| ----------- | ------------------------------------------------ |
| `Space`     | Start, pause or resume                           |
| `1` `2` `4` | Playback speed                                   |
| `F`         | Focus mode                                       |
| `T`         | Light or dark theme                              |
| `Esc`       | Stop following, then leave focus mode            |
| `Enter`     | In the completion dialog: generate a new program |
| `Esc`       | In the completion dialog: view the track         |

Shortcuts are ignored while typing in a field and with modifier keys. Space
on a focused button activates that button instead of toggling playback twice.
While the dialog is open, only its own keys work.

## Accessibility

- Every clickable row is a native `<button>`. Toggles expose `aria-pressed`,
  round cards `aria-expanded`, and the theme control is a `switch`.
- The status line is an `aria-live="polite"` region, so state changes are
  announced without interrupting.
- The canvas has `role="img"` with a label that describes the current state.
- The completion dialog is `aria-modal`: focus moves to its primary button,
  Tab cycles inside it, the page behind it is made `inert`, and focus returns
  to where it was when it closes.
- Visible focus rings on every control; icon-only buttons have labels.
- Theme colours are tokens tuned separately for light and dark; colour is
  never the only carrier of meaning (condition markers, medals with text).
- `prefers-reduced-motion` shortens CSS transitions. The canvas animation is
  the game itself and still runs.

## Theme and visual language

Dark is the default; light is one keystroke away and remembered in
`localStorage` (if storage is blocked, the theme still switches for the
session). Colours, radii and spacing are CSS custom properties in
`src/styles/tokens.css`; the canvas palette in `src/render/palette.ts`
mirrors them. Typography is Archivo (a variable font whose width axis gives
the condensed headings) with JetBrains Mono for numbers, both self-hosted.

## Component structure

| Kind           | Components                                                                                                    | Rule                                  |
| -------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| Containers     | `AppHeader`, `RaceTrack`, `ResultsPanel`, `ProgramPanel`, `StablePanel`, `ProgramCompleteDialog`              | Read stores, wire events              |
| Presentational | `ResultsLeaderboard`, `CompletedRounds`, `RoundCard`, `StableTable`, `StatusIndicator`, `ConditionBadge`, ... | Typed props in, events out; no stores |
| Wrappers       | `DashboardLayout`, `PanelCard`, `ModalDialog`                                                                 | Structure or behaviour through slots  |

Presentational components receive view models built by pure functions, so a
component test only needs props.
