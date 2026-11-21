import { assertIntegerInRange, invariant } from './errors';

/**
 * Seeded pseudo-random number generator. The only source of randomness in
 * the domain, which keeps every outcome reproducible from a seed.
 */
export interface Rng {
  /** Uniform float in `[0, 1)`. */
  next(): number;
  /** Uniform unsigned 32-bit integer in `[0, 2^32)`. */
  nextUint32(): number;
}

const UINT32_RANGE = 0x1_0000_0000;

/** Creates a mulberry32 generator. Any finite seed is reduced modulo 2^32. */
export function createRng(seed: number): Rng {
  invariant(
    Number.isFinite(seed),
    'INVALID_SEED',
    `Seed must be a finite number, received ${String(seed)}.`,
  );
  let state = seed >>> 0;

  const nextUint32 = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  };

  return { next: () => nextUint32() / UINT32_RANGE, nextUint32 };
}

/**
 * Derives an independent generator. Using one fork per concern (horses,
 * program, each race) means changing how one concern consumes randomness
 * never shifts the outcomes of another.
 */
export function forkRng(rng: Rng): Rng {
  return createRng(rng.nextUint32());
}

/** Uniform integer in `[min, max]` (both inclusive). */
export function randomInt(rng: Rng, min: number, max: number): number {
  invariant(
    Number.isSafeInteger(min) && Number.isSafeInteger(max) && min <= max,
    'INVALID_ARGUMENT',
    `randomInt expects integers with min <= max, received [${String(min)}, ${String(max)}].`,
  );
  return min + Math.floor(rng.next() * (max - min + 1));
}

/** Uniform float in `[min, max)`. */
export function randomBetween(rng: Rng, min: number, max: number): number {
  invariant(
    Number.isFinite(min) && Number.isFinite(max) && min <= max,
    'INVALID_ARGUMENT',
    `randomBetween expects finite bounds with min <= max, received [${String(min)}, ${String(max)}].`,
  );
  return min + rng.next() * (max - min);
}

/** Swaps two in-range indices of an array in place. */
function swap(items: unknown[], i: number, j: number): void {
  const a = items[i];
  items[i] = items[j];
  items[j] = a;
}

/** Returns a shuffled copy (Fisher-Yates). The input is never mutated. */
export function shuffle<T>(rng: Rng, items: readonly T[]): T[] {
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i--) swap(copy, i, randomInt(rng, 0, i));
  return copy;
}

/**
 * Draws `count` distinct elements without replacement (partial Fisher-Yates),
 * in draw order. The input is never mutated.
 */
export function sample<T>(rng: Rng, items: readonly T[], count: number): T[] {
  assertIntegerInRange(count, 0, items.length, 'INVALID_ARGUMENT', 'Sample count');
  const copy = items.slice();
  for (let i = 0; i < count; i++) swap(copy, i, randomInt(rng, i, copy.length - 1));
  copy.length = count;
  return copy;
}

/** Picks one element uniformly. Throws on an empty list. */
export function pickOne<T>(rng: Rng, items: readonly T[]): T {
  invariant(items.length > 0, 'INVALID_ARGUMENT', 'Cannot pick from an empty list.');
  return items[randomInt(rng, 0, items.length - 1)] as T;
}
