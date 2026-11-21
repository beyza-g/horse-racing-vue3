import { describe, expect, it } from 'vitest';
import { createRng } from '@/domain';
import { createDustSystem, DUST } from './particles';

const colors = ['#111111', '#222222'] as const;

describe('createDustSystem', () => {
  it('emits nothing for slow runners or paused frames', () => {
    const dust = createDustSystem(createRng(1));
    for (let i = 0; i < 1000; i++) {
      dust.emit(0, 0, DUST.minSpeed, 1, false, colors);
      dust.emit(0, 0, 100, 0, false, colors);
    }
    expect(dust.count).toBe(0);
  });

  it('emits roughly in proportion to distance covered and never exceeds capacity', () => {
    const dust = createDustSystem(createRng(2));
    for (let i = 0; i < 100_000; i++) dust.emit(0, 0, 100, 1 / 60, true, colors);
    expect(dust.count).toBe(DUST.maxParticles);
  });

  it('ages particles on presentation time and recycles them', () => {
    const dust = createDustSystem(createRng(3));
    for (let i = 0; i < 2000; i++) dust.emit(0, 0, 100, 1, false, colors);
    const emitted = dust.count;
    expect(emitted).toBeGreaterThan(0);
    dust.update(0);
    expect(dust.count).toBe(emitted);
    dust.update(DUST.maxLife + 0.01);
    expect(dust.count).toBe(0);
  });

  it('reports alpha in [0, 1] and moves particles up and back, then down', () => {
    const dust = createDustSystem(createRng(4));
    while (dust.count === 0) dust.emit(100, 100, 100, 1, false, colors);
    dust.update(0.05);
    dust.forEach((p, alpha) => {
      expect(p.x).toBeLessThan(100);
      expect(p.y).toBeLessThan(100);
      expect(alpha).toBeGreaterThan(0);
      expect(alpha).toBeLessThanOrEqual(1);
      expect(colors).toContain(p.color);
    });
  });

  it('clear() empties the pool', () => {
    const dust = createDustSystem(createRng(5));
    for (let i = 0; i < 2000; i++) dust.emit(0, 0, 100, 1, false, colors);
    dust.clear();
    expect(dust.count).toBe(0);
  });
});
