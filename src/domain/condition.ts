import { CONDITION_MAX, CONDITION_MIN } from './constants';
import { invariant } from './errors';
import { randomInt, type Rng } from './random';

/**
 * Condition model.
 *
 * The game keeps its 1-100 condition score, mapped linearly onto the Henneke
 * body condition score (BCS), the 1-9 scale used for horses in practice:
 * 1 poor, 5 moderate, 9 extremely fat. Thoroughbreds in heavy race training
 * are typically lean, around BCS 4-5 (about 4.5 measured in racing horses),
 * so performance peaks there rather than at the top of the scale:
 *
 * - Under-conditioned (thin) horses lack energy reserves and muscle: they
 *   fade, especially over longer trips (a stamina penalty).
 * - Over-conditioned (fleshy, fat) horses carry extra weight for the same
 *   power: they are slower throughout and tire too (a speed penalty plus a
 *   smaller stamina penalty). Excess is penalised more than deficit for
 *   speed, matching reports that underweight-to-ideal horses out-earn
 *   overweight ones.
 *
 * Evidence on BCS versus racing performance is limited, so the curve is a
 * documented modelling choice; its constants live in {@link CONDITION_MODEL}.
 */
export const BODY_CONDITION = Object.freeze({
  scaleMin: 1,
  scaleMax: 9,
  /** Peak racing performance (lean, in heavy training). */
  optimal: 4.5,
  /** Inclusive "race fit" band. */
  raceFitLow: 4,
  raceFitHigh: 5,
});

/** Henneke grade names, indexed by whole score 1-9. */
export const HENNEKE_GRADES: readonly string[] = Object.freeze([
  'Poor',
  'Very thin',
  'Thin',
  'Moderately thin',
  'Moderate',
  'Moderately fleshy',
  'Fleshy',
  'Fat',
  'Extremely fat',
]);

/** Performance curve and stable distribution. */
export const CONDITION_MODEL = Object.freeze({
  /**
   * Cruising-speed loss per squared BCS point away from the optimum. Excess
   * costs more than an equal deficit (power-to-weight): at the ends of the
   * scale that is about 3.7% for BCS 1 and 7.5% for BCS 9.
   */
  speedLossUnderPerPoint2: 0.003,
  speedLossOverPerPoint2: 0.0037,
  /** Stamina weakness (0-1) of a perfectly conditioned horse; fatigue never vanishes. */
  baseStaminaWeakness: 0.12,
  /** Weight of excess condition on stamina relative to a deficit of the same size. */
  overStaminaWeight: 0.6,
  /** Share of the stable drawn around race fitness; the rest is spread over the whole scale. */
  raceFitShare: 0.7,
  /** Spread of race-fit horses in BCS points (one standard deviation). */
  raceFitSpread: 0.9,
});

export type ConditionBand = 'underweight' | 'lean' | 'race-fit' | 'fleshy' | 'overweight';

/** Below this BCS a horse is underweight (Henneke "thin" or worse). */
const UNDERWEIGHT_BELOW = 3.5;
/** From this BCS a horse is overweight (Henneke "fleshy" or worse). */
const OVERWEIGHT_FROM = 6.5;

const SCALE_SPAN = BODY_CONDITION.scaleMax - BODY_CONDITION.scaleMin;
const SCORE_SPAN = CONDITION_MAX - CONDITION_MIN;

const assertCondition = (condition: number): void => {
  invariant(
    Number.isFinite(condition) && condition >= CONDITION_MIN && condition <= CONDITION_MAX,
    'INVALID_ARGUMENT',
    `Condition must be within [${CONDITION_MIN}, ${CONDITION_MAX}], received ${String(condition)}.`,
  );
};

/** Henneke body condition score (1-9, continuous) for a 1-100 condition score. */
export function toBodyConditionScore(condition: number): number {
  assertCondition(condition);
  return BODY_CONDITION.scaleMin + ((condition - CONDITION_MIN) / SCORE_SPAN) * SCALE_SPAN;
}

/** Nearest 1-100 condition score for a body condition score (inverse of {@link toBodyConditionScore}). */
export function conditionForBodyScore(bodyScore: number): number {
  invariant(
    Number.isFinite(bodyScore) &&
      bodyScore >= BODY_CONDITION.scaleMin &&
      bodyScore <= BODY_CONDITION.scaleMax,
    'INVALID_ARGUMENT',
    `Body condition score must be within [1, 9], received ${String(bodyScore)}.`,
  );
  return Math.round(
    CONDITION_MIN + ((bodyScore - BODY_CONDITION.scaleMin) / SCALE_SPAN) * SCORE_SPAN,
  );
}

/** Condition score at peak performance. */
export const OPTIMAL_CONDITION = conditionForBodyScore(BODY_CONDITION.optimal);

/** Performance band for a condition score. The race-fit band is inclusive at both ends. */
export function conditionBand(condition: number): ConditionBand {
  const bcs = toBodyConditionScore(condition);
  if (bcs < UNDERWEIGHT_BELOW) return 'underweight';
  if (bcs < BODY_CONDITION.raceFitLow) return 'lean';
  if (bcs <= BODY_CONDITION.raceFitHigh) return 'race-fit';
  if (bcs < OVERWEIGHT_FROM) return 'fleshy';
  return 'overweight';
}

/** Henneke grade name for a condition score, e.g. "Moderately thin". */
export function hennekeGrade(condition: number): string {
  const grade = Math.round(toBodyConditionScore(condition));
  return HENNEKE_GRADES[grade - 1] ?? 'Moderate';
}

/** How far below optimal the horse is, normalised to [0, 1] (0 at or above optimal). */
export function conditionDeficit(condition: number): number {
  const bcs = toBodyConditionScore(condition);
  return (
    Math.max(0, BODY_CONDITION.optimal - bcs) / (BODY_CONDITION.optimal - BODY_CONDITION.scaleMin)
  );
}

/** How far above optimal the horse is, normalised to [0, 1] (0 at or below optimal). */
export function conditionExcess(condition: number): number {
  const bcs = toBodyConditionScore(condition);
  return (
    Math.max(0, bcs - BODY_CONDITION.optimal) / (BODY_CONDITION.scaleMax - BODY_CONDITION.optimal)
  );
}

/**
 * Cruising-speed multiplier in (0, 1]: 1 at the optimum, falling smoothly
 * (quadratically in BCS points) towards both ends, faster for excess condition.
 */
export function conditionSpeedFactor(condition: number): number {
  const offset = toBodyConditionScore(condition) - BODY_CONDITION.optimal;
  const perPoint2 =
    offset < 0 ? CONDITION_MODEL.speedLossUnderPerPoint2 : CONDITION_MODEL.speedLossOverPerPoint2;
  return 1 - perPoint2 * offset * offset;
}

/**
 * Stamina weakness in [base, 1]: how strongly the horse fades late in a race.
 * Deficit (no reserves) hurts stamina most; excess hurts it less.
 */
export function conditionStaminaWeakness(condition: number): number {
  const off =
    conditionDeficit(condition) + CONDITION_MODEL.overStaminaWeight * conditionExcess(condition);
  const base = CONDITION_MODEL.baseStaminaWeakness;
  return Math.min(1, base + (1 - base) * off);
}

/** Approximately normal draw (Irwin-Hall, four uniforms): arithmetic only, so seeds replay identically everywhere. */
function standardNormalish(rng: Rng): number {
  const sum = rng.next() + rng.next() + rng.next() + rng.next();
  return (sum - 2) / Math.sqrt(4 / 12);
}

/**
 * Draws a horse's 1-100 condition. Most of a racing stable is in training
 * and near race fitness; the rest (lay-offs, poor doers, heavy horses) is
 * spread uniformly across the whole scale, so every band appears and races
 * vary. Deterministic for a given generator state.
 */
export function drawCondition(rng: Rng): number {
  if (rng.next() >= CONDITION_MODEL.raceFitShare)
    return randomInt(rng, CONDITION_MIN, CONDITION_MAX);
  const bcs = BODY_CONDITION.optimal + standardNormalish(rng) * CONDITION_MODEL.raceFitSpread;
  const clamped = Math.min(BODY_CONDITION.scaleMax, Math.max(BODY_CONDITION.scaleMin, bcs));
  return conditionForBodyScore(clamped);
}
