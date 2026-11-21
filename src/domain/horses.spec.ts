import { describe, expect, it } from 'vitest';
import { CONDITION_MAX, CONDITION_MIN, HORSE_COUNT } from './constants';
import { COAT_COLORS, HORSE_NAME_POOL } from './data/horseNames';
import { assertValidRoster, createHorse, generateHorses, indexRoster, silkColor } from './horses';
import { createRng } from './random';
import type { Horse } from './types';

const validHorse: Horse = {
  id: 1,
  name: 'Iron Halo',
  color: 'hsl(6, 78%, 56%)',
  coat: '#3b2418',
  condition: 50,
};

describe('name pool', () => {
  it('holds at least HORSE_COUNT unique, non-empty names', () => {
    expect(HORSE_NAME_POOL.length).toBeGreaterThanOrEqual(HORSE_COUNT);
    expect(new Set(HORSE_NAME_POOL).size).toBe(HORSE_NAME_POOL.length);
    for (const name of HORSE_NAME_POOL) expect(name.trim()).not.toBe('');
  });
});

describe('silkColor', () => {
  it('gives every roster position a distinct hue', () => {
    const colors = Array.from({ length: HORSE_COUNT }, (_, index) => silkColor(index));
    const hues = colors.map((color) => Number(/hsl\((\d+)/.exec(color)?.[1]));
    expect(new Set(colors).size).toBe(HORSE_COUNT);
    expect(new Set(hues).size).toBe(HORSE_COUNT);
    for (const hue of hues) {
      expect(hue).toBeGreaterThanOrEqual(0);
      expect(hue).toBeLessThan(360);
    }
  });

  it('separates neighbouring IDs on the colour wheel', () => {
    const hue = (index: number) => Number(/hsl\((\d+)/.exec(silkColor(index))?.[1]);
    for (let index = 1; index < HORSE_COUNT; index++) {
      const delta = Math.abs(hue(index) - hue(index - 1));
      expect(Math.min(delta, 360 - delta)).toBeGreaterThanOrEqual(90);
    }
  });

  it.each([-1, HORSE_COUNT, 1.5])('rejects the index %s', (index) => {
    expect(() => silkColor(index)).toThrow(expect.objectContaining({ code: 'INVALID_ARGUMENT' }));
  });
});

describe('createHorse', () => {
  it.each([CONDITION_MIN, CONDITION_MAX])('accepts the boundary condition %s', (condition) => {
    expect(createHorse({ ...validHorse, condition }).condition).toBe(condition);
  });

  it('returns a frozen copy', () => {
    const horse = createHorse(validHorse);
    expect(Object.isFrozen(horse)).toBe(true);
    expect(horse).toEqual(validHorse);
  });

  it.each([
    ['condition 0', { condition: 0 }],
    ['condition 101', { condition: 101 }],
    ['fractional condition', { condition: 50.5 }],
    ['NaN condition', { condition: Number.NaN }],
    ['id 0', { id: 0 }],
    ['fractional id', { id: 1.5 }],
    ['blank name', { name: '  ' }],
    ['blank colour', { color: '' }],
    ['blank coat', { coat: '' }],
  ])('rejects %s', (_, patch) => {
    expect(() => createHorse({ ...validHorse, ...patch })).toThrow(
      expect.objectContaining({ code: 'INVALID_HORSE' }),
    );
  });
});

describe('generateHorses', () => {
  const horses = generateHorses(createRng(123));

  it('generates exactly HORSE_COUNT horses with IDs 1..HORSE_COUNT in order', () => {
    expect(horses).toHaveLength(HORSE_COUNT);
    expect(horses.map((horse) => horse.id)).toEqual(
      Array.from({ length: HORSE_COUNT }, (_, i) => i + 1),
    );
  });

  it('uses unique names from the pool and unique colours', () => {
    expect(new Set(horses.map((horse) => horse.name)).size).toBe(HORSE_COUNT);
    expect(new Set(horses.map((horse) => horse.color)).size).toBe(HORSE_COUNT);
    for (const horse of horses) {
      expect(HORSE_NAME_POOL).toContain(horse.name);
      expect(COAT_COLORS).toContain(horse.coat);
    }
  });

  it('assigns integer conditions within [1, 100]', () => {
    for (const horse of horses) {
      expect(Number.isInteger(horse.condition)).toBe(true);
      expect(horse.condition).toBeGreaterThanOrEqual(CONDITION_MIN);
      expect(horse.condition).toBeLessThanOrEqual(CONDITION_MAX);
    }
  });

  it('reaches both condition bounds across seeds', () => {
    const conditions = Array.from({ length: 300 }, (_, seed) =>
      generateHorses(createRng(seed)).map((horse) => horse.condition),
    ).flat();
    expect(Math.min(...conditions)).toBe(CONDITION_MIN);
    expect(Math.max(...conditions)).toBe(CONDITION_MAX);
  });

  it('returns a frozen roster of frozen horses', () => {
    expect(Object.isFrozen(horses)).toBe(true);
    for (const horse of horses) expect(Object.isFrozen(horse)).toBe(true);
  });

  it('is deterministic per seed and varies across seeds', () => {
    expect(generateHorses(createRng(123))).toEqual(horses);
    expect(generateHorses(createRng(124))).not.toEqual(horses);
  });
});

describe('assertValidRoster', () => {
  const roster = generateHorses(createRng(5));

  it('accepts a generated roster', () => {
    expect(() => {
      assertValidRoster(roster);
    }).not.toThrow();
  });

  it.each([
    ['too few horses', () => roster.slice(0, HORSE_COUNT - 1)],
    ['too many horses', () => [...roster, { ...validHorse, id: 21 }]],
    ['an empty roster', () => []],
    ['IDs out of order', () => [roster[1]!, roster[0]!, ...roster.slice(2)]],
    [
      'a duplicate name',
      () => roster.map((h, i) => (i === 1 ? { ...h, name: roster[0]!.name } : h)),
    ],
    [
      'a duplicate colour',
      () => roster.map((h, i) => (i === 1 ? { ...h, color: roster[0]!.color } : h)),
    ],
  ])('rejects %s', (_, build) => {
    expect(() => {
      assertValidRoster(build());
    }).toThrow(expect.objectContaining({ code: 'INVALID_ROSTER' }));
  });
});

describe('indexRoster', () => {
  it('looks horses up by ID', () => {
    const roster = generateHorses(createRng(5));
    const byId = indexRoster(roster);
    expect(byId.size).toBe(HORSE_COUNT);
    expect(byId.get(7)).toBe(roster[6]);
    expect(byId.get(21)).toBeUndefined();
  });
});
