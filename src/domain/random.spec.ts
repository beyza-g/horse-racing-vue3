import { describe, expect, it } from 'vitest';
import { DomainError } from './errors';
import { createRng, forkRng, pickOne, randomBetween, randomInt, sample, shuffle } from './random';

const draw = (seed: number, count: number): number[] => {
  const rng = createRng(seed);
  return Array.from({ length: count }, () => rng.next());
};

describe('createRng', () => {
  it('produces the same sequence for the same seed', () => {
    expect(draw(42, 50)).toEqual(draw(42, 50));
  });

  it('produces different sequences for different seeds', () => {
    expect(draw(1, 10)).not.toEqual(draw(2, 10));
  });

  it('returns floats in [0, 1) and unsigned 32-bit integers', () => {
    const rng = createRng(7);
    for (let i = 0; i < 5000; i++) {
      const value = rng.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
      const int = rng.nextUint32();
      expect(Number.isInteger(int)).toBe(true);
      expect(int).toBeGreaterThanOrEqual(0);
      expect(int).toBeLessThan(2 ** 32);
    }
  });

  it('reduces seeds modulo 2^32', () => {
    expect(draw(2 ** 32 + 5, 5)).toEqual(draw(5, 5));
    expect(draw(-1, 5)).toEqual(draw(2 ** 32 - 1, 5));
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'rejects the non-finite seed %s',
    (seed) => {
      expect(() => createRng(seed)).toThrow(DomainError);
      expect(() => createRng(seed)).toThrow(expect.objectContaining({ code: 'INVALID_SEED' }));
    },
  );
});

describe('forkRng', () => {
  it('is deterministic and independent of later parent draws', () => {
    const parentA = createRng(9);
    const parentB = createRng(9);
    const childA = forkRng(parentA);
    const childB = forkRng(parentB);
    parentA.next();
    expect(childA.next()).toBe(childB.next());
  });

  it('yields a stream different from its parent', () => {
    const parent = createRng(9);
    const child = forkRng(parent);
    expect(child.next()).not.toBe(parent.next());
  });
});

describe('randomInt', () => {
  it('covers every value of an inclusive range uniformly', () => {
    const rng = createRng(3);
    const counts = new Map<number, number>();
    const draws = 60_000;
    for (let i = 0; i < draws; i++) {
      const value = randomInt(rng, 1, 6);
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    expect([...counts.keys()].sort()).toEqual([1, 2, 3, 4, 5, 6]);
    for (const count of counts.values()) expect(Math.abs(count - draws / 6)).toBeLessThan(500);
  });

  it('returns the bound when min equals max', () => {
    expect(randomInt(createRng(1), 4, 4)).toBe(4);
  });

  it.each([
    [5, 1],
    [1.5, 3],
    [0, Number.NaN],
  ])('rejects the range [%s, %s]', (min, max) => {
    expect(() => randomInt(createRng(1), min, max)).toThrow(
      expect.objectContaining({ code: 'INVALID_ARGUMENT' }),
    );
  });
});

describe('randomBetween', () => {
  it('stays within [min, max)', () => {
    const rng = createRng(11);
    for (let i = 0; i < 1000; i++) {
      const value = randomBetween(rng, -4, 4);
      expect(value).toBeGreaterThanOrEqual(-4);
      expect(value).toBeLessThan(4);
    }
  });

  it('rejects inverted or non-finite bounds', () => {
    expect(() => randomBetween(createRng(1), 2, 1)).toThrow(DomainError);
    expect(() => randomBetween(createRng(1), 0, Number.POSITIVE_INFINITY)).toThrow(DomainError);
  });
});

describe('shuffle', () => {
  it('returns a permutation without mutating the input', () => {
    const input = Object.freeze([1, 2, 3, 4, 5, 6, 7, 8]);
    const result = shuffle(createRng(5), input);
    expect(result).not.toBe(input);
    expect([...result].sort((a, b) => a - b)).toEqual([...input]);
    expect(input).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('is deterministic for a seed', () => {
    expect(shuffle(createRng(5), [1, 2, 3, 4, 5])).toEqual(shuffle(createRng(5), [1, 2, 3, 4, 5]));
  });

  it('handles empty and single-item lists', () => {
    expect(shuffle(createRng(1), [])).toEqual([]);
    expect(shuffle(createRng(1), ['a'])).toEqual(['a']);
  });
});

describe('sample', () => {
  const items = Object.freeze(Array.from({ length: 20 }, (_, i) => i + 1));

  it('draws the requested number of distinct items from the input', () => {
    const result = sample(createRng(8), items, 10);
    expect(result).toHaveLength(10);
    expect(new Set(result).size).toBe(10);
    for (const value of result) expect(items).toContain(value);
  });

  it('supports drawing none or all items', () => {
    expect(sample(createRng(8), items, 0)).toEqual([]);
    expect([...sample(createRng(8), items, 20)].sort((a, b) => a - b)).toEqual([...items]);
  });

  it.each([-1, 21, 2.5, Number.NaN])('rejects the count %s', (count) => {
    expect(() => sample(createRng(8), items, count)).toThrow(
      expect.objectContaining({ code: 'INVALID_ARGUMENT' }),
    );
  });

  it('gives every item a fair chance of selection', () => {
    const rng = createRng(21);
    const hits = new Array<number>(20).fill(0);
    const rounds = 4000;
    for (let i = 0; i < rounds; i++) {
      for (const value of sample(rng, items, 10)) hits[value - 1] = (hits[value - 1] ?? 0) + 1;
    }
    for (const count of hits) expect(Math.abs(count - rounds / 2)).toBeLessThan(200);
  });
});

describe('pickOne', () => {
  it('returns an element of the list', () => {
    expect(['a', 'b', 'c']).toContain(pickOne(createRng(2), ['a', 'b', 'c']));
  });

  it('rejects an empty list', () => {
    expect(() => pickOne(createRng(2), [])).toThrow(
      expect.objectContaining({ code: 'INVALID_ARGUMENT' }),
    );
  });
});
