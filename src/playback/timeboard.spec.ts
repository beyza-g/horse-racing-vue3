import { describe, expect, it } from 'vitest';
import {
  createRace,
  createRng,
  forkRng,
  formatOfficialTime,
  generateHorses,
  generateProgram,
  SIM_STEP,
  timeboardReading,
  timeboardScale,
} from '../domain';
import { buildLiveOrder } from './liveOrder';
import { createRaceDirector, type RaceDirector } from './raceDirector';

/**
 * The timeboard is presentation only: it must freeze with the playback clock,
 * resume exactly where it stopped, and never change official results or how
 * long a race takes on screen.
 */
const FRAME = 1 / 60;
const rng = createRng(42);
const roster = generateHorses(forkRng(rng));
const program = generateProgram(roster, forkRng(rng));

function startedDirector(speed: 1 | 2 | 4 = 1): RaceDirector {
  const director = createRaceDirector({ speed });
  director.load(roster, program);
  director.togglePlayback();
  return director;
}

function frameUntil(director: RaceDirector, done: () => boolean, dt: () => number = () => FRAME) {
  for (let i = 0; i < 200_000 && !done(); i++) director.frame(dt());
  expect(done()).toBe(true);
}

const reading = (director: RaceDirector): number => timeboardReading(director.race!);

describe('timeboard across pause and resume', () => {
  it('freezes while paused, even across a long tab switch, and resumes from the same value', () => {
    const director = startedDirector();
    frameUntil(director, () => director.phase === 'running' && director.race!.elapsed > 4);
    director.pause();
    const frozen = reading(director);
    for (let i = 0; i < 600; i++) {
      director.frame(FRAME);
      expect(reading(director)).toBe(frozen);
    }
    director.frame(30);
    expect(reading(director)).toBe(frozen);
    director.resume();
    director.frame(FRAME);
    const resumed = reading(director);
    expect(resumed).toBeGreaterThan(frozen);
    expect(resumed - frozen).toBeLessThanOrEqual(
      (FRAME * director.speed + SIM_STEP) * timeboardScale(director.race!.distance),
    );
  });

  it('freezes on the official time while paused during the finish slow motion', () => {
    const director = startedDirector();
    frameUntil(director, () => director.sinceWin !== null && director.sinceWin > 0.1);
    director.pause();
    const frozen = reading(director);
    for (let i = 0; i < 300; i++) director.frame(FRAME);
    director.frame(12);
    expect(reading(director)).toBe(frozen);
    director.resume();
    frameUntil(director, () => director.phase === 'settling');
    expect(reading(director)).toBeGreaterThanOrEqual(frozen);
  });

  it('never runs backwards and never jumps more than one clamped frame', () => {
    const director = startedDirector(4);
    frameUntil(director, () => director.phase === 'running');
    const maxStep = (0.05 * 4 + SIM_STEP) * timeboardScale(director.race!.distance);
    let previous = reading(director);
    for (let frame = 1; director.phase === 'running'; frame++) {
      if (frame % 53 === 0) director.togglePlayback();
      const paused = director.paused;
      director.frame(frame % 7 === 0 ? 30 : FRAME);
      const value = reading(director);
      if (paused) expect(value).toBe(previous);
      expect(value).toBeGreaterThanOrEqual(previous);
      expect(value - previous).toBeLessThanOrEqual(maxStep);
      previous = value;
    }
  });

  it('shows identical official times with or without pauses and speed changes', () => {
    const plain = startedDirector(2);
    frameUntil(plain, () => plain.phase === 'complete');

    const interrupted = startedDirector(1);
    let frame = 0;
    frameUntil(
      interrupted,
      () => interrupted.phase === 'complete',
      () => {
        frame++;
        if (frame % 89 === 0) interrupted.togglePlayback();
        if (frame % 151 === 0) interrupted.setSpeed(([1, 2, 4] as const)[frame % 3]!);
        return frame % 313 === 0 ? 20 : FRAME;
      },
    );

    const display = (director: RaceDirector) =>
      director.results.map((result) =>
        result.finishers.map((f) => formatOfficialTime(f.time, result.distance)),
      );
    expect(display(interrupted)).toEqual(display(plain));
    expect(interrupted.results).toEqual(
      program.rounds.map((round) => createRace(round, roster).runToCompletion()),
    );
  });

  it('live labels show the same official time as the final result', () => {
    const director = startedDirector(4);
    frameUntil(director, () => director.phase === 'settling');
    const race = director.race!;
    const labels = buildLiveOrder(race).map((entry) => entry.label);
    const official = race.result()!.finishers.map((f) => formatOfficialTime(f.time, race.distance));
    expect(labels).toEqual(official);
    expect(labels[0]).toMatch(/^1:\d{2}\.\d{2}$/);
  });

  it('does not change how long a round takes on screen', () => {
    const director = startedDirector(1);
    frameUntil(director, () => director.phase === 'running');
    let frames = 0;
    frameUntil(director, () => {
      frames++;
      return director.phase === 'settling';
    });
    const onScreenSeconds = frames * FRAME;
    expect(onScreenSeconds).toBeGreaterThan(8);
    expect(onScreenSeconds).toBeLessThan(25);
    expect(reading(director)).toBeGreaterThan(60);
  });
});
