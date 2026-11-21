# Domain: rules, research and simplifications

This document describes what the game simulates and why. The rules engine
lives in `src/domain/`; it is pure TypeScript with no framework or browser
dependencies (see [architecture](architecture.md)).

## Race rules

| Rule            | Implementation                                                                                           |
| --------------- | -------------------------------------------------------------------------------------------------------- |
| Roster          | Exactly 20 horses, IDs 1–20 (`HORSE_COUNT`)                                                              |
| Unique identity | Names drawn without replacement from a 28-name pool; 20 silk colours on evenly spaced, non-adjacent hues |
| Condition       | Integer 1–100 per horse ([condition model](#condition-model))                                            |
| Program         | Six rounds in order: 1200, 1400, 1600, 1800, 2000, 2200 m (`ROUND_DISTANCES`)                            |
| Field           | Ten distinct horses per round, drawn at random; lane = draw order                                        |
| Sequencing      | Rounds run strictly one at a time; each result becomes official before the next round starts             |
| Placings        | By interpolated finish-line crossing time; exact dead heats broken by lower horse ID                     |

Every entity is built by a validating factory (`createHorse`, `createRound`,
`createRace`) and frozen. Invalid input (a 9-horse line-up, a duplicate
runner, condition 101, a non-finite seed) throws a `DomainError` with a typed
`code` instead of producing a half-valid object or `NaN`.

### Horses

Horses are generated once per session from the seeded random generator and
kept for every program in that session. Each has a name, a unique silk colour
(used everywhere the horse appears), a cosmetic coat colour and a condition.
Neighbouring IDs are spread at least 90 degrees apart on the colour wheel so
adjacent rows and lanes stay distinguishable.

## Condition model

### What the research says

The brief asks for a condition score from 1 to 100. The natural reading,
"higher is better", does not match how horse condition is assessed in
practice, so the model is based on the scoring system actually used:

- **The Henneke body condition score (BCS)** is the standard scale: 1 (poor)
  to 9 (extremely fat), 5 being moderate. It measures fat cover, not
  cardiovascular fitness. [^henneke] [^umaine]
- **Racehorses are lean.** Thoroughbreds in heavy race training typically sit
  around BCS 4 [^osu], and racing Thoroughbreds and Arabians have been measured
  close to 4.5 [^braz]. Trainer guidance puts the target for intense exercise
  at roughly 4–5 [^trainer].
- **Both directions hurt.** Thin horses lack energy reserves and lean muscle
  for strenuous work; heavy horses carry extra weight that interferes with
  stamina and biomechanics, and have a worse power-to-weight ratio.
  [^alabama] [^trainer]
- **Excess is the bigger problem.** A retrospective study found that horses in
  the underweight-to-ideal range earned significantly more than overweight to
  obese horses (body weights in that study were estimated). [^trainer]
- **Evidence is limited.** There is little controlled research directly
  linking BCS to race performance [^henneke], so the curve below is a
  documented modelling choice, not an established formula.

### What the game does

The 1–100 score maps linearly onto BCS 1–9 (`toBodyConditionScore`), and
performance follows a peaked, asymmetric curve (`src/domain/condition.ts`):

| Effect          | Shape                                                                                                                                                                  |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Peak            | BCS 4.5, which is condition **44** (`OPTIMAL_CONDITION`)                                                                                                               |
| Speed           | Quadratic loss per BCS point away from the peak, larger for excess: about 3.7% at BCS 1, 7.5% at BCS 9                                                                 |
| Stamina         | Fade in the second half of a race, scaled by a stamina weakness that is worst for thin horses (1.0 at BCS 1) and partly applies to heavy ones; longer races amplify it |
| Form on the day | Random ±2.5 m/s cruising-speed offset per race, plus smooth in-race pace variation                                                                                     |

So a thin horse can hold its own over 1200 m but fades over 2200 m, while a
heavy horse is slow from the start. Both behaviours are asserted in
`createRace.spec.ts`.

Bands drive the UI:

| Band        | BCS        | Condition | Marker                 |
| ----------- | ---------- | --------- | ---------------------- |
| Underweight | below 3.5  | 1–31      | bar (out of condition) |
| Lean        | 3.5 to 4   | 32–38     | ring                   |
| Race fit    | 4 to 5     | 39–50     | filled dot             |
| Fleshy      | 5 to 6.5   | 51–69     | ring                   |
| Overweight  | 6.5 and up | 70–100    | bar (out of condition) |

**Stable composition.** About 70% of horses are drawn around race fitness
(BCS 4.5, spread about 0.9 points) and the rest uniformly across 1–100,
standing in for horses returning from a lay-off, poor doers and heavy horses.
Every band appears in a typical stable.

**Resulting outcomes**, measured over 300 seeded programs:

| Measure                                   | Value                                                                           |
| ----------------------------------------- | ------------------------------------------------------------------------------- |
| Distinct winners in a six-round program   | about 5 on average, never fewer than 3                                          |
| Win rate relative to a fair share         | race fit ~1.7x, lean ~1.2x, fleshy ~0.95x, underweight ~0.3x, overweight rarely |
| First-to-last spread in a ten-horse field | 4.6 s at 1200 m to 9 s at 2200 m                                                |

For comparison, the earlier linear model let one high-condition horse win all
six rounds of a seeded program, with first-to-last spreads of more than 25 seconds.

## Race times

### What the research says

Par times depend on the track, surface, going and class, so there is no
single table. A common handicapping rule of thumb for good flat times is
about **12 seconds per furlong up to a mile and about 14 seconds per furlong
beyond** (1 furlong is about 201 m). [^times] Timing analysis also notes that
pace and conditions move winning times by several seconds. [^timeform]

| Distance | Rule of thumb | Timeboard (race-fit horse) |
| -------- | ------------- | -------------------------- |
| 1000 m   | 59.7 s        | 1:00.0                     |
| 1200 m   | 71.6 s        | 1:12.3                     |
| 1600 m   | 95.5 s        | 1:37.2                     |
| 2000 m   | 123.2 s       | 2:02.6                     |
| 2200 m   | 137.1 s       | 2:15.4                     |

`timeboard.spec.ts` asserts agreement within 3% at every distance.

### What the game does

Watching a two-minute race six times would be tedious, so the simulation runs
in compressed time: a race takes roughly 10 to 25 seconds on screen at 1x.
What spectators read is **timeboard time**:

```
displaySeconds = simulationSeconds × timeboardScale(distance)
```

The scale is derived from the physics constants so that a race-fit horse
finishes in the realistic time for the distance, slowing about 0.35 m/s per
extra kilometre. Because it is one constant per race, it preserves finishing
order, ties and gaps, and the live clock always agrees with the official
times. Results are stored in simulation seconds and only formatted for
display (`m:ss.cc`). See [the three kinds of time](architecture.md#three-kinds-of-time).

## Program standings

The brief asks for results per race. Because a horse can run in several of
the six rounds, the game also keeps standings across the program, scored
the way multi-race jockey challenges usually are:

| Place  | 1st | 2nd | 3rd | 4th | 5th | 6th | 7th | 8th | 9th | 10th |
| ------ | --- | --- | --- | --- | --- | --- | --- | --- | --- | ---- |
| Points | 10  | 8   | 6   | 5   | 4   | 3   | 2   | 1   | 0   | 0    |

Every official round therefore hands out 39 points. Horses level on points
are separated by countback (more wins, then more seconds, and so on down the
placings); horses still level share a rank. Form figures follow the racing
convention (one character per run, oldest first, `0` for 10th). The table is
a pure function of the official results (`src/domain/programStandings.ts`),
so it is fully deterministic. Like a league table, the standings show each
horse's movement caused by the latest official round (`▲2`, `▼1`), but only
for horses ranked both before and after it; a horse's first run has no
movement. Note that a horse drawn into more rounds has more chances to
score; that is inherent to the brief's random draw and is part of the fun,
not a fairness rule.

## Real-world tracks

What a faithful racecourse would involve, and what the simulation shows
instead:

- **Surfaces.** Flat racing runs on turf (most common in Europe), dirt (most
  common in the United States) and synthetic or all-weather surfaces such as
  Polytrack and Tapeta, blends of sand, fibre, rubber and wax. [^surface]
  Dirt tends to produce a faster early pace and turf races often turn into a
  sprint in the straight; turf is the most affected by weather, described as
  the going (firm to heavy). Synthetics were adopted for consistency in all
  weather and for less kickback (material thrown into the faces of trailing
  horses). [^surface] [^cbs]
- **Geometry.** Most racecourses are ovals. Races of a mile (about 1600 m) or
  more usually include at least two turns, and runners drawn wide cover
  extra ground on each turn, so the draw matters. [^turns] Chutes extend a
  straight so that shorter races can start away from a turn. [^chute] Some
  courses run straight sprints: Flemington's 1200 m "straight six" and
  Ascot's straight mile are well-known examples. [^straight]

**How the simulation relates to that:** every round runs on one straight,
neutral course drawn as turf. That is close to reality for the 1200 m and
1400 m rounds (straight sprints exist at these distances) and a deliberate
simplification from about 1600 m, where real races would turn. With no
turns, a lane is only a starting position: it carries no draw advantage and
no runner covers extra ground.

## Deliberate simplifications

These are scope decisions, not oversights:

- **One straight track, one surface** (see [Real-world tracks](#real-world-tracks)).
  No bends, rail position, turf versus dirt versus synthetic, going (firm to
  heavy), weather, kickback or draw bias. The rule-of-thumb times are
  surface-agnostic for the same reason.
- **Compressed playback, realistic clock.** A race plays in roughly 10 to 25
  seconds on screen while the timeboard shows realistic durations (about a
  minute per 1000 m); see [Race times](#race-times).
- **No race tactics or weights.** No front-runners versus closers, no jockey
  skill, no weight carried or handicapping. Pace variation is smooth noise.
- **Condition is fixed per session.** A horse may run several rounds in one
  program with no carry-over fatigue, which real horses would not do on the
  same day; the brief's "10 random horses per round" rule takes precedence.
- **Fields are mixed.** Real races group horses of similar ability, so real
  winning margins are usually smaller than the spreads above.
- **Gaps are shown in metres** (`+3m`), not lengths.
- **Photo finishes** are flagged when the first two are within 0.08
  simulation seconds, about half a second of timeboard time. Real photo
  finishes are decided by hundredths; the wider margin keeps the effect
  visible.
- **Fatigue is linear** over the second half of the race and the slow-motion
  finish is a presentation effect only.

## Sources

[^henneke]: [Henneke horse body condition scoring system (Wikipedia)](https://en.wikipedia.org/wiki/Henneke_horse_body_condition_scoring_system)

[^umaine]: [University of Maine: Body Condition Scoring for Your Horse](https://extension.umaine.edu/publications/1010e/)

[^osu]: [Ohio State University Extension: body condition scoring](https://ohioline.osu.edu/factsheet/as-1024)

[^braz]: [Body composition of Arabian and Thoroughbred racehorses, Braz J Vet Res Anim Sci (2019)](https://revistas.usp.br/bjvras/article/view/158360)

[^trainer]: ["Fit not fat", North American Trainer](https://issuu.com/anderson-co/docs/north_american_trainer_issue_23lr_l/38)

[^alabama]: [Alabama Cooperative Extension: body condition scoring as an equine management tool](https://www.aces.edu/blog/topics/farming/body-condition-scoring-as-equine-management-tool/)

[^times]: [Lady and the Track: Inside racing, got time?](https://ladyandthetrack.com/news/20823/inside-racing-got-time-times.html)

[^timeform]: [Timeform: analysis of overall times](https://www.timeform.com/racing/articles/the-timeform-knowledge-analysis-of-overall-times-2262015)

[^surface]: [Track surface (Wikipedia)](https://en.wikipedia.org/wiki/Track_surface)

[^cbs]: [Synthetic surfaces gaining traction at major horse racing tracks (CBS News)](https://www.cbsnews.com/baltimore/news/synthetic-surfaces-gaining-traction-at-major-horse-racing-tracks)

[^turns]: [Why one or two turns matters (America's Best Racing)](https://www.americasbestracing.net/node/33705)

[^chute]: [Chute (racecourse) (Wikipedia)](https://en.wikipedia.org/wiki/Chute_%28racecourse%29)

[^straight]: [Notable racetracks around the world with straight courses (Victoria Racing Club)](https://vrc.com.au/latest-news/flemingtons-iconic-straight-six)
