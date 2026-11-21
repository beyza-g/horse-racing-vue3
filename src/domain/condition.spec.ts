import { describe, expect, it } from 'vitest';
import {
  BODY_CONDITION,
  conditionBand,
  conditionDeficit,
  conditionExcess,
  conditionForBodyScore,
  conditionSpeedFactor,
  conditionStaminaWeakness,
  CONDITION_MODEL,
  drawCondition,
  hennekeGrade,
  OPTIMAL_CONDITION,
  toBodyConditionScore,
  type ConditionBand,
} from './condition';
import { CONDITION_MAX, CONDITION_MIN } from './constants';
import { createRng } from './random';

const ALL_CONDITIONS = Array.from({ length: 100 }, (_, i) => i + 1);

describe('body condition score mapping', () => {
  it('maps 1-100 linearly onto the 1-9 Henneke scale', () => {
    expect(toBodyConditionScore(CONDITION_MIN)).toBe(1);
    expect(toBodyConditionScore(CONDITION_MAX)).toBe(9);
    expect(toBodyConditionScore(50.5)).toBeCloseTo(5, 10);
    for (let c = 2; c <= 100; c++) {
      expect(toBodyConditionScore(c)).toBeGreaterThan(toBodyConditionScore(c - 1));
    }
  });

  it('round-trips through the inverse', () => {
    for (const c of ALL_CONDITIONS) expect(conditionForBodyScore(toBodyConditionScore(c))).toBe(c);
  });

  it('puts the performance optimum at BCS 4.5 (lean, in training)', () => {
    expect(OPTIMAL_CONDITION).toBe(44);
    expect(toBodyConditionScore(OPTIMAL_CONDITION)).toBeCloseTo(BODY_CONDITION.optimal, 1);
  });

  it.each([0, 101, Number.NaN, -5])('rejects the condition %s', (condition) => {
    expect(() => toBodyConditionScore(condition)).toThrow(
      expect.objectContaining({ code: 'INVALID_ARGUMENT' }),
    );
  });

  it.each([0.9, 9.1, Number.NaN])('rejects the body score %s', (score) => {
    expect(() => conditionForBodyScore(score)).toThrow(
      expect.objectContaining({ code: 'INVALID_ARGUMENT' }),
    );
  });
});

describe('bands and grades', () => {
  it.each<[number, ConditionBand, string]>([
    [1, 'underweight', 'Poor'],
    [25, 'underweight', 'Thin'],
    [32, 'lean', 'Moderately thin'],
    [OPTIMAL_CONDITION, 'race-fit', 'Moderately thin'],
    [50, 'race-fit', 'Moderate'],
    [51, 'fleshy', 'Moderate'],
    [65, 'fleshy', 'Moderately fleshy'],
    [70, 'overweight', 'Fleshy'],
    [75, 'overweight', 'Fleshy'],
    [100, 'overweight', 'Extremely fat'],
  ])('condition %s is %s (%s)', (condition, band, grade) => {
    expect(conditionBand(condition)).toBe(band);
    expect(hennekeGrade(condition)).toBe(grade);
  });

  it('places the race-fit band exactly over BCS 4-5 inclusive', () => {
    for (const c of ALL_CONDITIONS) {
      const bcs = toBodyConditionScore(c);
      const fit = bcs >= BODY_CONDITION.raceFitLow && bcs <= BODY_CONDITION.raceFitHigh;
      expect(conditionBand(c) === 'race-fit').toBe(fit);
    }
  });

  it('orders the bands along the scale without gaps', () => {
    const order: ConditionBand[] = ['underweight', 'lean', 'race-fit', 'fleshy', 'overweight'];
    let index = 0;
    for (const c of ALL_CONDITIONS) {
      const band = order.indexOf(conditionBand(c));
      expect(band).toBeGreaterThanOrEqual(index);
      expect(band - index).toBeLessThanOrEqual(1);
      index = band;
    }
    expect(index).toBe(order.length - 1);
  });
});

describe('performance curve', () => {
  it('peaks at the optimum and falls off towards both ends', () => {
    expect(conditionSpeedFactor(OPTIMAL_CONDITION)).toBeCloseTo(1, 3);
    for (const c of ALL_CONDITIONS) {
      const factor = conditionSpeedFactor(c);
      expect(factor).toBeLessThanOrEqual(1);
      expect(factor).toBeGreaterThan(0.9);
    }
    for (let c = 2; c <= OPTIMAL_CONDITION; c++) {
      expect(conditionSpeedFactor(c)).toBeGreaterThanOrEqual(conditionSpeedFactor(c - 1));
    }
    for (let c = OPTIMAL_CONDITION + 1; c <= 100; c++) {
      expect(conditionSpeedFactor(c)).toBeLessThanOrEqual(conditionSpeedFactor(c - 1));
    }
  });

  it('penalises excess condition more than an equal deficit for speed', () => {
    for (const points of [0.5, 1.5, 3]) {
      const under = conditionForBodyScore(BODY_CONDITION.optimal - points);
      const over = conditionForBodyScore(BODY_CONDITION.optimal + points);
      expect(conditionSpeedFactor(over)).toBeLessThan(conditionSpeedFactor(under));
    }
  });

  it('documents the speed loss at the ends of the scale', () => {
    expect(1 - conditionSpeedFactor(1)).toBeCloseTo(0.003 * 3.5 ** 2, 10);
    expect(1 - conditionSpeedFactor(100)).toBeCloseTo(0.0037 * 4.5 ** 2, 10);
  });

  it('gives thin horses the weakest stamina and keeps a floor for fit horses', () => {
    expect(conditionStaminaWeakness(1)).toBe(1);
    // The integer optimum (44) sits at BCS 4.47, a hair below 4.5.
    expect(conditionStaminaWeakness(OPTIMAL_CONDITION)).toBeCloseTo(
      CONDITION_MODEL.baseStaminaWeakness,
      1,
    );
    expect(conditionStaminaWeakness(100)).toBeLessThan(conditionStaminaWeakness(1));
    expect(conditionStaminaWeakness(100)).toBeGreaterThan(
      conditionStaminaWeakness(OPTIMAL_CONDITION),
    );
    for (const c of ALL_CONDITIONS) {
      const weakness = conditionStaminaWeakness(c);
      expect(weakness).toBeGreaterThanOrEqual(CONDITION_MODEL.baseStaminaWeakness);
      expect(weakness).toBeLessThanOrEqual(1);
    }
  });

  it('normalises deficit and excess to [0, 1], never both at once', () => {
    expect(conditionDeficit(1)).toBe(1);
    expect(conditionExcess(100)).toBe(1);
    for (const c of ALL_CONDITIONS) {
      expect(conditionDeficit(c) === 0 || conditionExcess(c) === 0).toBe(true);
    }
  });
});

describe('drawCondition', () => {
  const draws = (seed: number, count: number) => {
    const rng = createRng(seed);
    return Array.from({ length: count }, () => drawCondition(rng));
  };

  it('always returns an integer within 1-100', () => {
    for (const c of draws(1, 20_000)) {
      expect(Number.isInteger(c)).toBe(true);
      expect(c).toBeGreaterThanOrEqual(CONDITION_MIN);
      expect(c).toBeLessThanOrEqual(CONDITION_MAX);
    }
  });

  it('is deterministic per seed', () => {
    expect(draws(7, 200)).toEqual(draws(7, 200));
    expect(draws(7, 200)).not.toEqual(draws(8, 200));
  });

  it('concentrates the stable around race fitness while covering every band and both bounds', () => {
    const sample = draws(3, 20_000);
    const counts = new Map<ConditionBand, number>();
    for (const c of sample) counts.set(conditionBand(c), (counts.get(conditionBand(c)) ?? 0) + 1);
    const share = (band: ConditionBand) => (counts.get(band) ?? 0) / sample.length;
    expect(share('race-fit')).toBeGreaterThan(0.25);
    expect(share('race-fit')).toBeGreaterThan(share('underweight'));
    expect(share('race-fit')).toBeGreaterThan(share('overweight'));
    for (const band of ['underweight', 'lean', 'fleshy', 'overweight'] as const) {
      expect(share(band)).toBeGreaterThan(0.03);
    }
    expect(Math.min(...sample)).toBe(CONDITION_MIN);
    expect(Math.max(...sample)).toBe(CONDITION_MAX);
    const median = [...sample].sort((a, b) => a - b)[sample.length / 2]!;
    expect(Math.abs(median - OPTIMAL_CONDITION)).toBeLessThan(10);
  });
});
