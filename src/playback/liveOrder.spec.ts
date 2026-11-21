import { describe, expect, it } from 'vitest';
import { createRace, SIM_STEP } from '../domain';
import { LINEUP_1_TO_10, makeRoster, makeRound } from '../domain/__fixtures__/roster';
import { buildLiveOrder, createPublishGate, formatRaceTime } from './liveOrder';

const roster = makeRoster((id) => id * 5);

describe('formatRaceTime', () => {
  it('uses two decimals and a seconds suffix', () => {
    expect(formatRaceTime(10.745)).toBe('10.74s');
    expect(formatRaceTime(9)).toBe('9.00s');
  });
});

describe('buildLiveOrder', () => {
  it('lists gate order with blank labels before the start', () => {
    const order = buildLiveOrder(createRace(makeRound(LINEUP_1_TO_10), roster));
    expect(order.map((e) => e.horseId)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(order.map((e) => e.rank)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(order.every((e) => !e.finished)).toBe(true);
  });

  it('labels the leader blank and the rest with whole metres behind (at least 1)', () => {
    const race = createRace(makeRound(LINEUP_1_TO_10), roster);
    race.tick(Math.round(4 / SIM_STEP));
    const [leader, ...rest] = buildLiveOrder(race);
    expect(leader!.label).toBe('');
    for (const entry of rest) expect(entry.label).toMatch(/^\+\d+m$/);
    for (const entry of rest) expect(Number(entry.label.slice(1, -1))).toBeGreaterThanOrEqual(1);
  });

  it('shows official times once runners finish', () => {
    const race = createRace(makeRound(LINEUP_1_TO_10), roster);
    const result = race.runToCompletion();
    const order = buildLiveOrder(race);
    expect(order.map((e) => e.horseId)).toEqual(result.finishers.map((f) => f.horseId));
    expect(order.map((e) => e.label)).toEqual(result.finishers.map((f) => formatRaceTime(f.time)));
    expect(order.every((e) => e.finished)).toBe(true);
  });
});

describe('createPublishGate', () => {
  it('publishes the first change immediately, then at most once per interval', () => {
    const gate = createPublishGate(0.25);
    expect(gate.update(0.016, true, false)).toBe(true);
    expect(gate.update(0.1, true, false)).toBe(false);
    expect(gate.update(0.1, false, false)).toBe(false);
    expect(gate.update(0.06, false, false)).toBe(true);
  });

  it('never publishes when nothing changed', () => {
    const gate = createPublishGate(0.25);
    for (let i = 0; i < 100; i++) expect(gate.update(0.1, false, false)).toBe(false);
  });

  it('publishes immediately when forced', () => {
    const gate = createPublishGate(0.25);
    gate.update(0.01, true, false);
    expect(gate.update(0.01, false, true)).toBe(true);
  });

  it('ignores invalid deltas and resets', () => {
    const gate = createPublishGate(0.25);
    gate.update(0, true, false);
    expect(gate.update(Number.NaN, true, false)).toBe(false);
    expect(gate.update(-5, true, false)).toBe(false);
    gate.reset();
    expect(gate.update(0, true, false)).toBe(true);
  });

  it.each([-1, Number.NaN])('rejects the interval %s', (interval) => {
    expect(() => createPublishGate(interval)).toThrow(
      expect.objectContaining({ code: 'INVALID_ARGUMENT' }),
    );
  });
});
