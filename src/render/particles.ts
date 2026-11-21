import type { Rng } from '@/domain';

/** Tuning for the dust kicked up by galloping horses. */
export const DUST = Object.freeze({
  maxParticles: 260,
  /** Emission chance per metre covered (scaled by speed and sim dt). */
  ratePerMetre: 0.09,
  /** Extra emission in the final stretch. */
  sprintBoost: 1.7,
  /** Runners slower than this kick up no dust. */
  minSpeed: 40,
  gravity: 260,
  minLife: 0.45,
  lifeSpread: 0.3,
  maxLife: 0.75,
});

export interface DustParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  size: number;
  color: string;
}

/** A fixed-capacity, allocation-light particle pool. */
export interface DustSystem {
  readonly count: number;
  /** Possibly spawns a particle behind a runner. */
  emit(
    x: number,
    y: number,
    speed: number,
    simDt: number,
    sprinting: boolean,
    colors: readonly [string, string],
  ): void;
  /** Advances every particle by presentation time; dead particles are recycled. */
  update(dt: number): void;
  forEach(visit: (particle: Readonly<DustParticle>, alpha: number) => void): void;
  clear(): void;
}

export function createDustSystem(rng: Rng): DustSystem {
  const live: DustParticle[] = [];
  const spare: DustParticle[] = [];

  return {
    get count() {
      return live.length;
    },
    emit(x, y, speed, simDt, sprinting, colors) {
      if (speed <= DUST.minSpeed || simDt <= 0 || live.length >= DUST.maxParticles) return;
      const chance = speed * simDt * DUST.ratePerMetre * (sprinting ? DUST.sprintBoost : 1);
      if (rng.next() >= chance) return;
      const particle = spare.pop() ?? { x: 0, y: 0, vx: 0, vy: 0, life: 0, size: 1, color: '' };
      particle.x = x;
      particle.y = y;
      particle.vx = -(30 + rng.next() * 70);
      particle.vy = -(40 + rng.next() * 60);
      particle.life = DUST.minLife + rng.next() * DUST.lifeSpread;
      particle.size = 1 + rng.next() * 1.6;
      particle.color = rng.next() < 0.6 ? colors[0] : colors[1];
      live.push(particle);
    },
    update(dt) {
      if (!(dt > 0)) return;
      for (let i = live.length - 1; i >= 0; i--) {
        const p = live[i];
        if (p === undefined) continue;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += DUST.gravity * dt;
        p.life -= dt;
        if (p.life <= 0) {
          const last = live.pop();
          if (last !== undefined && last !== p) live[i] = last;
          spare.push(p);
        }
      }
    },
    forEach(visit) {
      for (const p of live) visit(p, Math.max(0, p.life / DUST.maxLife));
    },
    clear() {
      spare.push(...live);
      live.length = 0;
    },
  };
}
