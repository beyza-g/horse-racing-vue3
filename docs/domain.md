# Domain: rules, research and simplifications

> **In short:** condition maps onto the Henneke body condition score, where
> racehorses are kept lean. Performance peaks at **44**, not 100: a horse at
> 95 is overweight and slow. The curve is a documented modelling choice, and a
> different `ProfileStrategy` (passed through `RaceOptions`) can replace it,
> for example with "higher is better", without touching the race engine.

The rules engine lives in `src/domain/`: pure TypeScript with no framework or
browser dependencies (see [architecture](architecture.md)).

## Race rules

Decisions beyond the brief:

- **Lane = draw order.** Each round draws ten distinct horses; the draw order
  is the lane.
- **Placings** follow the interpolated finish-line crossing time; exact dead
  heats go to the lower horse ID, so results are stable.
- **Validated, frozen entities.** `createHorse`, `createRound` and
  `createRace` reject invalid input (a 9-horse line-up, condition 101, a
  non-finite seed) with a typed `DomainError` instead of producing `NaN` or a
  half-valid object.

## Condition model

### Research

- The **Henneke body condition score (BCS)** is the standard scale: 1 (poor)
  to 9 (extremely fat). It measures fat cover, not fitness. [^henneke]
- **Racehorses are lean:** around BCS 4 in heavy training [^osu], measured
  close to 4.5 in racing Thoroughbreds and Arabians [^braz].
- **Both directions hurt, excess more:** underweight-to-ideal horses out-earn
  overweight ones [^trainer]. Controlled evidence is thin, so the curve below
  is a modelling choice, not an established formula. [^henneke]

### Model

The 1–100 score maps linearly onto BCS 1–9 (`toBodyConditionScore`) and
performance peaks at BCS 4.5, condition **44** (`OPTIMAL_CONDITION`). Thin
horses mainly lose stamina, so they fade over longer races; heavy horses
mainly lose speed and are slow from the start (`src/domain/condition.ts`).

| Band        | BCS        | Condition | Marker                 |
| ----------- | ---------- | --------- | ---------------------- |
| Underweight | below 3.5  | 1–31      | bar (out of condition) |
| Lean        | 3.5 to 4   | 32–38     | ring                   |
| Race fit    | 4 to 5     | 39–50     | filled dot             |
| Fleshy      | 5 to 6.5   | 51–69     | ring                   |
| Overweight  | 6.5 and up | 70–100    | bar (out of condition) |

About 70% of a stable is drawn around race fitness and the rest uniformly
across 1–100, so every band appears.

Outcomes over 300 seeded programs (reproduce with `npm run measure:outcomes`):
about 5 distinct winners per six-round program, race-fit horses winning about
1.7 times a fair share, and overweight horses rarely winning.

## Race times

Watching six two-minute races would be tedious, so a race plays in 10 to 25
seconds on screen while the clock shows realistic durations:

```
displaySeconds = simulationSeconds × timeboardScale(distance)
```

One constant per race keeps order, ties and gaps intact, and the live clock
always matches the official times. The scale is calibrated so a race-fit horse
matches the handicapping rule of thumb of about 12 s per furlong up to a mile
and 14 s beyond [^times]; `timeboard.spec.ts` asserts agreement within 3%.

| Distance | Rule of thumb | Timeboard (race-fit horse) |
| -------- | ------------- | -------------------------- |
| 1000 m   | 59.7 s        | 1:00.0                     |
| 1200 m   | 71.6 s        | 1:12.3                     |
| 1600 m   | 95.5 s        | 1:37.2                     |
| 2000 m   | 123.2 s       | 2:02.6                     |
| 2200 m   | 137.1 s       | 2:15.4                     |

## Program standings

A horse can run several rounds, so the game also keeps standings across the
program, scored like a multi-race jockey challenge:

| Place  | 1st | 2nd | 3rd | 4th | 5th | 6th | 7th | 8th | 9th | 10th |
| ------ | --- | --- | --- | --- | --- | --- | --- | --- | --- | ---- |
| Points | 10  | 8   | 6   | 5   | 4   | 3   | 2   | 1   | 0   | 0    |

Ties on points go to countback: more wins, then more seconds, and so on.
Horses still level share a rank. The table is derived from official results
(`src/domain/programStandings.ts`), never stored.

## Deliberate simplifications

- **One straight track:** realistic for 1200 to 1400 m sprints [^straight] and
  a deliberate simplification beyond, so lanes carry no draw advantage.
- **One surface:** no turf, dirt or going.
- **No tactics or weights:** pace variation is smooth noise.
- **Condition is fixed per session:** no carry-over fatigue between rounds.
- **Mixed fields:** margins are wider than in graded real races.
- **Gaps in metres** (`+3m`), not lengths.
- **Photo finishes** are flagged within 0.08 simulation seconds, wider than
  real hundredths so the effect stays visible.

## Sources

[^henneke]: [Henneke horse body condition scoring system (Wikipedia)](https://en.wikipedia.org/wiki/Henneke_horse_body_condition_scoring_system)

[^osu]: [Ohio State University Extension: body condition scoring](https://ohioline.osu.edu/factsheet/as-1024)

[^braz]: [Body composition of Arabian and Thoroughbred racehorses, Braz J Vet Res Anim Sci (2019)](https://revistas.usp.br/bjvras/article/view/158360)

[^trainer]: ["Fit not fat", North American Trainer](https://issuu.com/anderson-co/docs/north_american_trainer_issue_23lr_l/38)

[^times]: [Lady and the Track: Inside racing, got time?](https://ladyandthetrack.com/news/20823/inside-racing-got-time-times.html)

[^straight]: [Notable racetracks around the world with straight courses (Victoria Racing Club)](https://vrc.com.au/latest-news/flemingtons-iconic-straight-six)
