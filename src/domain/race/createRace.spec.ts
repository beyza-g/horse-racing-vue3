import { describe, expect, it } from 'vitest';
import { LINEUP_1_TO_10, makeRoster, makeRound, uniformProfile } from '../__fixtures__/roster';
import { OPTIMAL_CONDITION } from '../condition';
import { RUNNERS_PER_ROUND } from '../constants';
import { DomainError } from '../errors';
import { generateHorses } from '../horses';
import { generateProgram } from '../program';
import { createRng, forkRng } from '../random';
import { createRace, type Race } from './createRace';
import { PHYSICS, SIM_STEP, type PaceStrategy } from './physics';
import { compareLive } from './standings';

const roster = makeRoster((id) => id * 5);
const constantPace: PaceStrategy = (profile) => profile.baseSpeed;

/** Places by horse ID, for compact assertions. */
const finishOrder = (race: Race) => race.result()?.finishers.map((f) => f.horseId);

describe('createRace setup', () => {
  const race = createRace(makeRound([10, 9, 8, 7, 6, 5, 4, 3, 2, 1]), roster);

  it('puts runners in lane order at the start line', () => {
    expect(race.runners.map((r) => r.horseId)).toEqual([10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
    expect(race.runners.map((r) => r.lane)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    for (const runner of race.runners) {
      expect(runner.position).toBe(0);
      expect(runner.speed).toBe(0);
      expect(runner.place).toBe(0);
      expect(runner.finishTime).toBeNull();
    }
  });

  it('starts with gate order as the live order and nothing finished', () => {
    expect(race.standings.map((r) => r.lane)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(race.standingsVersion).toBe(0);
    expect(race.elapsed).toBe(0);
    expect(race.finishedCount).toBe(0);
    expect(race.isFinished).toBe(false);
    expect(race.winnerTime).toBeNull();
    expect(race.result()).toBeNull();
  });

  it('derives each runner profile from the horse condition', () => {
    for (const runner of race.runners) {
      expect(runner.profile.condition).toBe(roster[runner.horseId - 1]!.condition);
    }
  });

  it('looks runners up by horse ID', () => {
    expect(race.runner(4)?.lane).toBe(7);
    expect(race.runner(15)).toBeUndefined();
  });

  it('exposes runners as read-only views', () => {
    const runner = race.runners[0]!;
    // @ts-expect-error -- views are read-only; only the simulation may move a runner.
    runner.position = 999;
    // @ts-expect-error -- the runner list itself is read-only.
    race.runners.push(runner);
  });

  it.each([
    ['nine runners', LINEUP_1_TO_10.slice(0, 9)],
    ['a duplicate runner', [1, 2, 3, 4, 5, 6, 7, 8, 9, 1]],
    ['an unknown horse', [1, 2, 3, 4, 5, 6, 7, 8, 9, 99]],
  ])('rejects a line-up with %s', (_, lineup) => {
    expect(() => createRace(makeRound(lineup), roster)).toThrow(
      expect.objectContaining({ code: 'INVALID_LINEUP' }),
    );
  });

  it('rejects an invalid race seed', () => {
    expect(() => createRace(makeRound(LINEUP_1_TO_10, Number.NaN), roster)).toThrow(
      expect.objectContaining({ code: 'INVALID_SEED' }),
    );
  });
});

describe('Race.tick', () => {
  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])('rejects the count %s', (count) => {
    const race = createRace(makeRound(LINEUP_1_TO_10), roster);
    expect(() => race.tick(count)).toThrow(expect.objectContaining({ code: 'INVALID_TICK_COUNT' }));
    expect(race.tickCount).toBe(0);
  });

  it('treats tick(0) as a no-op', () => {
    const race = createRace(makeRound(LINEUP_1_TO_10), roster);
    expect(race.tick(0)).toBe(0);
    expect(race.elapsed).toBe(0);
  });

  it('derives elapsed time from the tick count without drift', () => {
    const race = createRace(makeRound(LINEUP_1_TO_10), roster);
    for (let i = 0; i < 1200; i++) race.tick();
    expect(race.tickCount).toBe(1200);
    expect(race.elapsed).toBe(1200 * SIM_STEP);
    expect(race.elapsed).toBeCloseTo(10, 12);
  });

  it('holds every runner at the gates until its start delay has passed', () => {
    const delayed: Parameters<typeof createRace>[2] = {
      profile: (condition) => ({
        condition,
        baseSpeed: 90,
        staminaWeakness: 0,
        startDelay: 0.25,
        noisePhases: [0, 0, 0],
      }),
    };
    const race = createRace(makeRound(LINEUP_1_TO_10), roster, delayed);
    race.tick(Math.floor(0.25 / SIM_STEP));
    for (const runner of race.runners) expect(runner.position).toBe(0);
    race.tick(2);
    for (const runner of race.runners) expect(runner.position).toBeGreaterThan(0);
  });

  it('rejects a pace strategy that returns NaN or a negative speed', () => {
    for (const bad of [Number.NaN, -1, Number.POSITIVE_INFINITY]) {
      const race = createRace(makeRound(LINEUP_1_TO_10), roster, { pace: () => bad });
      expect(() => race.tick()).toThrow(expect.objectContaining({ code: 'INVALID_PACE' }));
    }
  });
});

describe('Race.runToCompletion', () => {
  const race = createRace(makeRound([12, 3, 18, 7, 1, 20, 9, 14, 5, 16], 2024), roster);
  const result = race.runToCompletion();

  it('finishes the full field with places 1..10', () => {
    expect(race.isFinished).toBe(true);
    expect(race.finishedCount).toBe(RUNNERS_PER_ROUND);
    expect(result.finishers).toHaveLength(RUNNERS_PER_ROUND);
    expect(result.finishers.map((f) => f.place)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect([...result.finishers.map((f) => f.horseId)].sort((a, b) => a - b)).toEqual([
      1, 3, 5, 7, 9, 12, 14, 16, 18, 20,
    ]);
  });

  it('reports positive, non-decreasing finish times and the right lanes', () => {
    let previous = 0;
    for (const finisher of result.finishers) {
      expect(finisher.time).toBeGreaterThan(0);
      expect(finisher.time).toBeGreaterThanOrEqual(previous);
      expect(race.runner(finisher.horseId)?.lane).toBe(finisher.lane);
      previous = finisher.time;
    }
    expect(race.winnerTime).toBe(result.finishers[0]!.time);
  });

  it('times every finisher within the step in which it crossed', () => {
    for (const finisher of result.finishers) {
      expect(finisher.time).toBeLessThanOrEqual(race.elapsed);
      expect(finisher.time).toBeGreaterThan(0);
    }
  });

  it('returns the same frozen result from result()', () => {
    expect(race.result()).toBe(result);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.finishers)).toBe(true);
    expect(result.roundIndex).toBe(0);
    expect(result.distance).toBe(1200);
  });

  it('throws SIMULATION_LIMIT when a race cannot finish', () => {
    const stalled = createRace(makeRound(LINEUP_1_TO_10), roster, { pace: () => 0 });
    expect(() => stalled.runToCompletion(5)).toThrow(
      expect.objectContaining({ code: 'SIMULATION_LIMIT' }),
    );
    expect(stalled.tickCount).toBe(Math.ceil(5 / SIM_STEP));
  });

  it.each([0, -1, Number.NaN])('rejects maxSeconds %s', (maxSeconds) => {
    expect(() => createRace(makeRound(LINEUP_1_TO_10), roster).runToCompletion(maxSeconds)).toThrow(
      DomainError,
    );
  });
});

describe('determinism', () => {
  const round = makeRound([2, 4, 6, 8, 10, 12, 14, 16, 18, 20], 777);

  it('produces identical results for the same round and roster', () => {
    const a = createRace(round, roster).runToCompletion();
    const b = createRace(round, roster).runToCompletion();
    expect(a).toEqual(b);
  });

  it('does not depend on how ticks are batched', () => {
    const reference = createRace(round, roster).runToCompletion();
    const chunked = createRace(round, roster);
    const chunks = [1, 7, 0, 13, 2, 50, 3];
    for (let i = 0; !chunked.isFinished; i++) chunked.tick(chunks[i % chunks.length]);
    expect(chunked.result()).toEqual(reference);
  });

  it('changes with the race seed', () => {
    const a = createRace(round, roster).runToCompletion();
    const b = createRace({ ...round, raceSeed: 778 }, roster).runToCompletion();
    expect(a.finishers.map((f) => f.time)).not.toEqual(b.finishers.map((f) => f.time));
  });
});

describe('live standings', () => {
  it('stay sorted, keep placings and only bump the version on change', () => {
    const race = createRace(makeRound([5, 15, 1, 20, 10, 2, 19, 7, 13, 11], 31), roster);
    const placed = new Map<number, number>();
    let lastVersion = race.standingsVersion;
    let lastFinished = 0;
    while (!race.isFinished) {
      const before = race.standings.map((r) => r.horseId).join();
      const finishedNow = race.tick();
      const after = race.standings.map((r) => r.horseId).join();
      const standings = race.standings;
      for (let i = 1; i < standings.length; i++) {
        expect(compareLive(standings[i - 1]!, standings[i]!)).toBeLessThanOrEqual(0);
      }
      expect(race.finishedCount).toBe(lastFinished + finishedNow);
      lastFinished = race.finishedCount;
      for (const runner of race.runners) {
        if (placed.has(runner.horseId)) expect(runner.place).toBe(placed.get(runner.horseId));
        else if (runner.place > 0) placed.set(runner.horseId, runner.place);
      }
      if (before === after && finishedNow === 0) expect(race.standingsVersion).toBe(lastVersion);
      else expect(race.standingsVersion).toBe(lastVersion + 1);
      lastVersion = race.standingsVersion;
    }
    expect(race.standings.map((r) => r.place)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('settle after the finish: horses pull up, the order and result stay fixed', () => {
    const race = createRace(makeRound(LINEUP_1_TO_10, 5), roster);
    const result = race.runToCompletion();
    const version = race.standingsVersion;
    const before = race.runners.map((r) => r.position);
    race.tick(Math.round(5 / SIM_STEP));
    race.runners.forEach((runner, i) => {
      expect(runner.position).toBeGreaterThanOrEqual(before[i]!);
      // Speed eases towards a pull-up target that reaches zero at the pull-up
      // distance, so horses may coast slightly past it, but never far.
      expect(runner.position).toBeLessThan(1200 * (1 + 1.5 * PHYSICS.pullUpDistanceRatio));
      expect(runner.speed).toBeGreaterThanOrEqual(0);
      expect(runner.speed).toBeLessThan(1);
    });
    expect(race.standingsVersion).toBe(version);
    expect(race.result()).toBe(result);
    expect(race.tick(10)).toBe(0);
  });
});

describe('finish-line tie-breaking', () => {
  it('breaks an exact dead heat by horse ID, whatever the lanes', () => {
    const race = createRace(makeRound([10, 9, 8, 7, 6, 5, 4, 3, 2, 1]), roster, {
      pace: constantPace,
      profile: uniformProfile(100),
    });
    race.runToCompletion();
    const times = race.result()!.finishers.map((f) => f.time);
    expect(new Set(times).size).toBe(1);
    expect(finishOrder(race)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('orders runners crossing in the same tick by interpolated time, not by ID', () => {
    // Horse 10 is a hair faster, so it reaches the line a fraction of a tick earlier.
    const race = createRace(makeRound(LINEUP_1_TO_10), roster, {
      pace: constantPace,
      profile: (condition) => ({
        condition,
        baseSpeed: condition === 50 ? 100.001 : 100,
        staminaWeakness: 0,
        startDelay: 0,
        noisePhases: [0, 0, 0],
      }),
    });
    race.runToCompletion();
    const [first, second] = race.result()!.finishers;
    expect(first!.horseId).toBe(10);
    expect(first!.time).toBeLessThan(second!.time);
    expect(finishOrder(race)).toEqual([10, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });
});

describe('condition model in races', () => {
  const at = (distance: 1200 | 2200, seed: number) => ({
    ...makeRound(LINEUP_1_TO_10, seed),
    index: distance === 1200 ? 0 : 5,
    distance,
  });

  it.each([1, OPTIMAL_CONDITION, 100])(
    'a field of condition-%s horses always finishes',
    (condition) => {
      const uniform = makeRoster(() => condition);
      for (let seed = 0; seed < 20; seed++) {
        expect(createRace(at(2200, seed), uniform).runToCompletion().finishers).toHaveLength(10);
      }
    },
  );

  it.each([1, 100])(
    'a race-fit horse beats a condition-%s horse in the vast majority of races',
    (extreme) => {
      const field = makeRoster((id) => (id === 1 ? OPTIMAL_CONDITION : id === 2 ? extreme : 50));
      let wins = 0;
      for (let seed = 0; seed < 100; seed++) {
        const result = createRace(at(2200, seed), field).runToCompletion();
        const place = (id: number) => result.finishers.find((f) => f.horseId === id)!.place;
        if (place(1) < place(2)) wins++;
      }
      expect(wins).toBeGreaterThanOrEqual(90);
    },
  );

  it('the top of the scale is not the best: condition 100 loses to race fitness', () => {
    const field = makeRoster((id) => (id === 1 ? 100 : OPTIMAL_CONDITION));
    let lastOrNearLast = 0;
    for (let seed = 0; seed < 50; seed++) {
      const result = createRace(at(1200, seed), field).runToCompletion();
      if (result.finishers.find((f) => f.horseId === 1)!.place >= 8) lastOrNearLast++;
    }
    expect(lastOrNearLast).toBeGreaterThanOrEqual(40);
  });

  /** Mean finishing-time ratio of horse 1 to the race-fit rest of the field. */
  function relativeTime(condition: number, distance: 1200 | 2200): number {
    const field = makeRoster((id) => (id === 1 ? condition : OPTIMAL_CONDITION));
    let ratio = 0;
    const seeds = 40;
    for (let seed = 0; seed < seeds; seed++) {
      const result = createRace(at(distance, seed), field).runToCompletion();
      const own = result.finishers.find((f) => f.horseId === 1)!.time;
      const rest = result.finishers.filter((f) => f.horseId !== 1);
      ratio += own / (rest.reduce((sum, f) => sum + f.time, 0) / rest.length);
    }
    return ratio / seeds;
  }

  it('thin horses fade over longer trips; heavy horses are slow from the start', () => {
    const thinGap1200 = relativeTime(5, 1200) - 1;
    const thinGap2200 = relativeTime(5, 2200) - 1;
    const heavyGap1200 = relativeTime(100, 1200) - 1;
    const heavyGap2200 = relativeTime(100, 2200) - 1;
    expect(thinGap1200).toBeGreaterThan(0);
    expect(heavyGap1200).toBeGreaterThan(0);
    // Stamina: the thin horse loses relatively more ground as the trip gets longer.
    expect(thinGap2200 / thinGap1200).toBeGreaterThan(heavyGap2200 / heavyGap1200);
    // Speed: over a sprint the heavy horse is the slower of the two.
    expect(heavyGap1200).toBeGreaterThan(thinGap1200);
  });

  it('keeps fields competitive: extremes lose seconds, not minutes', () => {
    expect(relativeTime(1, 2200)).toBeLessThan(1.12);
    expect(relativeTime(100, 2200)).toBeLessThan(1.12);
  });
});

describe('full program', () => {
  it('runs all six generated rounds to completion deterministically', () => {
    const run = (seed: number) => {
      const rng = createRng(seed);
      const horses = generateHorses(forkRng(rng));
      const program = generateProgram(horses, forkRng(rng));
      return program.rounds.map((round) => createRace(round, horses).runToCompletion());
    };
    const results = run(42);
    expect(results.map((r) => r.distance)).toEqual([1200, 1400, 1600, 1800, 2000, 2200]);
    for (const result of results) expect(result.finishers).toHaveLength(10);
    expect(run(42)).toEqual(results);

    const meanTime = (i: number) =>
      results[i]!.finishers.reduce((sum, f) => sum + f.time, 0) / RUNNERS_PER_ROUND;
    for (let i = 1; i < results.length; i++) expect(meanTime(i)).toBeGreaterThan(meanTime(i - 1));
  });
});
