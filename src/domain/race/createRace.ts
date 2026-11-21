import { RUNNERS_PER_ROUND } from '../constants';
import { assertIntegerInRange, DomainError, invariant } from '../errors';
import { indexRoster } from '../horses';
import { createRng } from '../random';
import type { FinishRecord, Horse, HorseId, Round, RoundResult } from '../types';
import {
  approachSpeed,
  conditionPace,
  defaultProfile,
  interpolateCrossingTime,
  MAX_RACE_SECONDS,
  PHYSICS,
  pullUpTargetSpeed,
  SIM_STEP,
  type PaceStrategy,
  type ProfileStrategy,
  type RunnerProfile,
} from './physics';
import {
  compareCrossings,
  compareLive,
  insertionSortInPlace,
  type StandingEntry,
} from './standings';

/** Read-only view of a runner. The simulation owns and mutates the backing state. */
export interface RunnerView extends StandingEntry {
  readonly profile: RunnerProfile;
  /** Current speed in m/s. */
  readonly speed: number;
}

/** Mutable runner state; never exposed with write access. */
interface RunnerState {
  readonly horseId: HorseId;
  readonly lane: number;
  readonly profile: RunnerProfile;
  position: number;
  speed: number;
  place: number;
  finishTime: number | null;
}

/** Overrides for the default physics strategies (used by tests and tuning). */
export interface RaceOptions {
  readonly pace?: PaceStrategy;
  readonly profile?: ProfileStrategy;
}

/** A deterministic, fixed-step race for one round. */
export interface Race {
  readonly round: Round;
  readonly distance: number;
  /** Simulation seconds since the gates opened (ticks * SIM_STEP). */
  readonly elapsed: number;
  readonly tickCount: number;
  /** Runners in lane order. */
  readonly runners: readonly RunnerView[];
  /** Runners in live order (see `compareLive`). */
  readonly standings: readonly RunnerView[];
  /** Increments whenever the live order or a placing changes. */
  readonly standingsVersion: number;
  readonly finishedCount: number;
  readonly isFinished: boolean;
  /** Crossing time of the winner, or null before anyone finishes. */
  readonly winnerTime: number | null;
  /** Advances by `count` whole ticks. Returns how many runners finished during them. */
  tick(count?: number): number;
  /** Ticks until every runner has finished. Throws SIMULATION_LIMIT if it never does. */
  runToCompletion(maxSeconds?: number): RoundResult;
  /** The official result once every runner has finished, otherwise null. */
  result(): RoundResult | null;
  runner(horseId: HorseId): RunnerView | undefined;
}

class RaceSimulation implements Race {
  readonly round: Round;
  readonly distance: number;
  readonly #pace: PaceStrategy;
  readonly #runners: RunnerState[];
  readonly #order: RunnerState[];
  /** Scratch buffer reused for runners crossing in the same tick. */
  readonly #crossing: RunnerState[] = [];
  #ticks = 0;
  #finished = 0;
  #version = 0;
  #winnerTime: number | null = null;
  #result: RoundResult | null = null;

  constructor(round: Round, runners: RunnerState[], pace: PaceStrategy) {
    this.round = round;
    this.distance = round.distance;
    this.#pace = pace;
    this.#runners = runners;
    this.#order = runners.slice();
  }

  get elapsed(): number {
    // Derived from the integer tick count, so no floating-point drift accumulates.
    return this.#ticks * SIM_STEP;
  }

  get tickCount(): number {
    return this.#ticks;
  }

  get runners(): readonly RunnerView[] {
    return this.#runners;
  }

  get standings(): readonly RunnerView[] {
    return this.#order;
  }

  get standingsVersion(): number {
    return this.#version;
  }

  get finishedCount(): number {
    return this.#finished;
  }

  get isFinished(): boolean {
    return this.#finished === this.#runners.length;
  }

  get winnerTime(): number | null {
    return this.#winnerTime;
  }

  runner(horseId: HorseId): RunnerView | undefined {
    return this.#runners.find((runner) => runner.horseId === horseId);
  }

  result(): RoundResult | null {
    return this.#result;
  }

  tick(count = 1): number {
    assertIntegerInRange(count, 0, Number.MAX_SAFE_INTEGER, 'INVALID_TICK_COUNT', 'Tick count');
    let finishedNow = 0;
    for (let i = 0; i < count; i++) finishedNow += this.#step();
    return finishedNow;
  }

  runToCompletion(maxSeconds = MAX_RACE_SECONDS): RoundResult {
    invariant(
      Number.isFinite(maxSeconds) && maxSeconds > 0,
      'INVALID_ARGUMENT',
      `maxSeconds must be a positive finite number, received ${String(maxSeconds)}.`,
    );
    const maxTicks = Math.ceil(maxSeconds / SIM_STEP);
    while (this.#result === null) {
      if (this.#ticks >= maxTicks) {
        throw new DomainError(
          'SIMULATION_LIMIT',
          `Round ${this.round.index + 1} did not finish within ${maxSeconds}s.`,
        );
      }
      this.#step();
    }
    return this.#result;
  }

  /** Advances exactly one SIM_STEP. Returns the number of runners that finished. */
  #step(): number {
    const stepStart = this.elapsed;
    this.#ticks++;
    const now = this.elapsed;
    const distance = this.distance;
    const crossing = this.#crossing;

    for (const runner of this.#runners) {
      if (runner.place > 0 || runner.finishTime !== null) {
        this.#pullUp(runner);
        continue;
      }
      if (now <= runner.profile.startDelay) continue;
      const target = this.#pace(runner.profile, runner.position / distance, now, distance);
      invariant(
        Number.isFinite(target) && target >= 0,
        'INVALID_PACE',
        `Pace strategy returned ${String(target)} for horse ${runner.horseId}.`,
      );
      runner.speed = approachSpeed(
        runner.speed,
        target,
        SIM_STEP,
        PHYSICS.accelerationRate,
        PHYSICS.decelerationRate,
      );
      const from = runner.position;
      runner.position = from + runner.speed * SIM_STEP;
      if (runner.position >= distance) {
        runner.finishTime = interpolateCrossingTime(
          stepStart,
          SIM_STEP,
          from,
          runner.position,
          distance,
        );
        crossing.push(runner);
      }
    }

    const finishedNow = crossing.length;
    if (finishedNow > 0) this.#awardPlaces();
    if (this.#finished < this.#runners.length || finishedNow > 0) {
      const moved = insertionSortInPlace(this.#order, compareLive);
      if (moved || finishedNow > 0) this.#version++;
    }
    return finishedNow;
  }

  #pullUp(runner: RunnerState): void {
    const overrun = runner.position - this.distance;
    const target = pullUpTargetSpeed(runner.profile.baseSpeed, overrun, this.distance);
    runner.speed = approachSpeed(
      runner.speed,
      target,
      SIM_STEP,
      PHYSICS.pullUpRate,
      PHYSICS.pullUpRate,
    );
    runner.position += Math.max(0, runner.speed) * SIM_STEP;
  }

  #awardPlaces(): void {
    const crossing = this.#crossing;
    // Only runners crossing in the same tick can tie; earlier ticks always have earlier times.
    if (crossing.length > 1) crossing.sort(compareCrossings);
    for (const runner of crossing) {
      this.#finished++;
      runner.place = this.#finished;
      if (this.#finished === 1) this.#winnerTime = runner.finishTime;
    }
    crossing.length = 0;
    if (this.isFinished) this.#result = this.#buildResult();
  }

  #buildResult(): RoundResult {
    const finishers: FinishRecord[] = this.#runners
      .map((runner) => {
        invariant(
          runner.finishTime !== null && runner.place > 0,
          'INVALID_ARGUMENT',
          `Horse ${runner.horseId} has no official finish.`,
        );
        return Object.freeze({
          horseId: runner.horseId,
          lane: runner.lane,
          place: runner.place,
          time: runner.finishTime,
        });
      })
      .sort((a, b) => a.place - b.place);
    return Object.freeze({
      roundIndex: this.round.index,
      distance: this.round.distance,
      finishers: Object.freeze(finishers),
    });
  }
}

/**
 * Creates the race for a round. The round's `raceSeed` fully determines the
 * outcome: the same round and roster always produce the same result.
 */
export function createRace(
  round: Round,
  roster: readonly Horse[],
  options: RaceOptions = {},
): Race {
  invariant(
    round.lineup.length === RUNNERS_PER_ROUND,
    'INVALID_LINEUP',
    `Round ${round.index + 1} needs exactly ${RUNNERS_PER_ROUND} runners, received ${round.lineup.length}.`,
  );
  const byId = indexRoster(roster);
  const rng = createRng(round.raceSeed);
  const profileFor = options.profile ?? defaultProfile;
  const seen = new Set<HorseId>();
  const runners = round.lineup.map((horseId, index): RunnerState => {
    const horse = byId.get(horseId);
    invariant(horse, 'INVALID_LINEUP', `Horse ${horseId} is not in the roster.`);
    invariant(!seen.has(horseId), 'INVALID_LINEUP', `Horse ${horseId} appears twice.`);
    seen.add(horseId);
    return {
      horseId,
      lane: index + 1,
      profile: profileFor(horse.condition, rng),
      position: 0,
      speed: 0,
      place: 0,
      finishTime: null,
    };
  });
  return new RaceSimulation(round, runners, options.pace ?? conditionPace);
}
