import { CONDITION_MAX, CONDITION_MIN, HORSE_COUNT } from './constants';
import { COAT_COLORS, HORSE_NAME_POOL } from './data/horseNames';
import { assertIntegerInRange, invariant } from './errors';
import { drawCondition } from './condition';
import { pickOne, sample, type Rng } from './random';
import type { Horse, HorseId } from './types';

/** Number of evenly spaced hues used for silk colours. */
const HUE_SLOTS = 20;
/** Step between consecutive horses' hue slots. Coprime with HUE_SLOTS, so every slot is used once. */
const HUE_STRIDE = 7;
const HUE_SPACING = 360 / HUE_SLOTS;
const HUE_OFFSET = 6;

/**
 * Silk colour for the horse at roster position `index` (0-based).
 * Neighbouring IDs land far apart on the colour wheel and alternate in
 * saturation/lightness, so the 20 colours are distinct and easy to tell apart.
 */
export function silkColor(index: number): string {
  assertIntegerInRange(index, 0, HUE_SLOTS - 1, 'INVALID_ARGUMENT', 'Silk colour index');
  const hue = ((index * HUE_STRIDE) % HUE_SLOTS) * HUE_SPACING + HUE_OFFSET;
  const odd = index % 2 === 1;
  return `hsl(${hue}, ${odd ? 70 : 78}%, ${odd ? 62 : 56}%)`;
}

/** Validates and freezes a horse. The only way horses are constructed. */
export function createHorse(input: Horse): Horse {
  assertIntegerInRange(input.id, 1, Number.MAX_SAFE_INTEGER, 'INVALID_HORSE', 'Horse id');
  invariant(
    input.name.trim().length > 0,
    'INVALID_HORSE',
    `Horse ${input.id} must have a non-empty name.`,
  );
  invariant(
    input.color.trim().length > 0,
    'INVALID_HORSE',
    `Horse ${input.id} must have a colour.`,
  );
  invariant(input.coat.trim().length > 0, 'INVALID_HORSE', `Horse ${input.id} must have a coat.`);
  assertIntegerInRange(
    input.condition,
    CONDITION_MIN,
    CONDITION_MAX,
    'INVALID_HORSE',
    `Horse ${input.id} condition`,
  );
  return Object.freeze({
    id: input.id,
    name: input.name,
    color: input.color,
    coat: input.coat,
    condition: input.condition,
  });
}

/**
 * Asserts the roster invariants: exactly HORSE_COUNT horses, IDs exactly
 * 1..HORSE_COUNT in order, and unique names and colours.
 */
export function assertValidRoster(horses: readonly Horse[]): void {
  invariant(
    horses.length === HORSE_COUNT,
    'INVALID_ROSTER',
    `A roster must contain exactly ${HORSE_COUNT} horses, received ${horses.length}.`,
  );
  const names = new Set<string>();
  const colors = new Set<string>();
  horses.forEach((horse, index) => {
    invariant(
      horse.id === index + 1,
      'INVALID_ROSTER',
      `Roster position ${index} must hold horse ${index + 1}, found ${horse.id}.`,
    );
    invariant(!names.has(horse.name), 'INVALID_ROSTER', `Duplicate horse name "${horse.name}".`);
    invariant(
      !colors.has(horse.color),
      'INVALID_ROSTER',
      `Duplicate horse colour "${horse.color}".`,
    );
    names.add(horse.name);
    colors.add(horse.color);
  });
}

/** Generates the fixed roster of HORSE_COUNT horses with IDs 1..HORSE_COUNT. */
export function generateHorses(rng: Rng): readonly Horse[] {
  const names = sample(rng, HORSE_NAME_POOL, HORSE_COUNT);
  const horses = names.map((name, index) =>
    createHorse({
      id: index + 1,
      name,
      color: silkColor(index),
      coat: pickOne(rng, COAT_COLORS),
      condition: drawCondition(rng),
    }),
  );
  assertValidRoster(horses);
  return Object.freeze(horses);
}

/** Builds an ID lookup for a validated roster. */
export function indexRoster(horses: readonly Horse[]): ReadonlyMap<HorseId, Horse> {
  return new Map(horses.map((horse) => [horse.id, horse]));
}
