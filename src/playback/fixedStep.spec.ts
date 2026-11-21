import { describe, expect, it } from 'vitest';
import { SIM_STEP } from '../domain';
import { MAX_FRAME_DT } from './clock';
import { createFixedStepAccumulator } from './fixedStep';

describe('createFixedStepAccumulator', () => {
  it('converts a full frame into whole ticks without flooring errors', () => {
    const acc = createFixedStepAccumulator();
    expect(acc.push(MAX_FRAME_DT)).toBe(6);
    expect(acc.push(MAX_FRAME_DT * 4)).toBe(24);
    expect(acc.remainder).toBeLessThan(1e-9);
  });

  it('carries the remainder so small frames add up', () => {
    const acc = createFixedStepAccumulator();
    expect(acc.push(SIM_STEP * 0.4)).toBe(0);
    expect(acc.push(SIM_STEP * 0.4)).toBe(0);
    expect(acc.push(SIM_STEP * 0.4)).toBe(1);
    expect(acc.remainder).toBeCloseTo(SIM_STEP * 0.2, 12);
  });

  it('never drifts: total ticks match total time across many uneven frames', () => {
    const acc = createFixedStepAccumulator();
    const deltas = [1 / 60, 1 / 144, 0.033, 0.05 * 4, 0.007, 0.0001, 0.05 * 0.42];
    let total = 0;
    let ticks = 0;
    for (let i = 0; i < 10_000; i++) {
      const dt = deltas[i % deltas.length]!;
      total += dt;
      ticks += acc.push(dt);
    }
    expect(Math.abs(ticks - total / SIM_STEP)).toBeLessThan(1);
    expect(acc.remainder).toBeGreaterThanOrEqual(0);
    expect(acc.remainder).toBeLessThan(SIM_STEP);
  });

  it('returns 0 ticks for a zero delta (paused frame)', () => {
    const acc = createFixedStepAccumulator();
    acc.push(SIM_STEP / 2);
    expect(acc.push(0)).toBe(0);
    expect(acc.remainder).toBeCloseTo(SIM_STEP / 2, 12);
  });

  it('reset discards the remainder', () => {
    const acc = createFixedStepAccumulator();
    acc.push(SIM_STEP * 0.9);
    acc.reset();
    expect(acc.remainder).toBe(0);
    expect(acc.push(SIM_STEP * 0.5)).toBe(0);
  });

  it.each([-0.01, Number.NaN, Number.POSITIVE_INFINITY])('rejects the delta %s', (dt) => {
    expect(() => createFixedStepAccumulator().push(dt)).toThrow(
      expect.objectContaining({ code: 'INVALID_ARGUMENT' }),
    );
  });

  it.each([0, -1, Number.NaN])('rejects the step %s', (step) => {
    expect(() => createFixedStepAccumulator(step)).toThrow(
      expect.objectContaining({ code: 'INVALID_ARGUMENT' }),
    );
  });
});
