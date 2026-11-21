import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRng, forkRng, generateHorses, generateProgram, indexRoster } from '@/domain';
import { createRaceDirector, type DirectorPhase, type RaceDirector } from '@/playback';
import { createFakeContext, type FakeContext } from '@/test/fakeCanvas';
import { createTrackRenderer, type TrackScene } from './renderer';

const rng = createRng(3);
const roster = generateHorses(forkRng(rng));
const program = generateProgram(roster, forkRng(rng));
const horses = indexRoster(roster);

let fake: FakeContext;
let canvas: HTMLCanvasElement;

beforeEach(() => {
  fake = createFakeContext();
  canvas = document.createElement('canvas');
  vi.spyOn(canvas, 'getContext').mockReturnValue(fake.context);
});

const scene = (director: RaceDirector, patch: Partial<TrackScene> = {}): TrackScene => ({
  theme: 'dark',
  director,
  horses,
  followedHorseId: null,
  nameTags: true,
  finishDrama: true,
  ...patch,
});

function advanceTo(director: RaceDirector, phase: DirectorPhase): void {
  for (let i = 0; i < 100_000 && director.phase !== phase; i++) director.frame(1 / 60);
  expect(director.phase).toBe(phase);
}

describe('createTrackRenderer', () => {
  it('draws nothing before it has a size', () => {
    const renderer = createTrackRenderer(canvas);
    renderer.render(scene(createRaceDirector()));
    expect(fake.calls).not.toContain('fillRect');
  });

  it('sizes the backing store by the device pixel ratio, capped at 2', () => {
    const renderer = createTrackRenderer(canvas);
    renderer.resize(800, 400, 3);
    expect(canvas.width).toBe(1600);
    expect(canvas.height).toBe(800);
    renderer.resize(800, 400, 0);
    expect(canvas.width).toBe(800);
  });

  it('draws an empty track before a program exists', () => {
    const renderer = createTrackRenderer(canvas);
    renderer.resize(1000, 500, 1);
    renderer.render(scene(createRaceDirector()));
    expect(fake.texts).toContain('TRACK');
    expect(fake.texts).toContain('FINISH');
  });

  it.each(['dark', 'light'] as const)('draws every phase in the %s theme', (theme) => {
    const renderer = createTrackRenderer(canvas);
    renderer.resize(1000, 500, 1);
    const director = createRaceDirector({ speed: 4 });
    director.load(roster, program);
    renderer.render(scene(director, { theme }));
    expect(fake.texts.some((t) => t.includes('PRESS START'))).toBe(true);
    director.togglePlayback();
    for (const phase of ['countdown', 'running', 'settling', 'intermission'] as const) {
      advanceTo(director, phase);
      director.frame(1 / 60);
      renderer.render(scene(director, { theme, followedHorseId: program.rounds[0]!.lineup[3]! }));
    }
    expect(fake.texts.some((t) => t.startsWith('WINNER') || t.startsWith('PHOTO'))).toBe(true);
    advanceTo(director, 'complete');
    renderer.render(scene(director, { theme }));
  });

  it('draws the PAUSED pill while paused', () => {
    const renderer = createTrackRenderer(canvas);
    renderer.resize(1000, 500, 1);
    const director = createRaceDirector();
    director.load(roster, program);
    director.togglePlayback();
    advanceTo(director, 'running');
    director.pause();
    renderer.render(scene(director));
    expect(fake.texts).toContain('PAUSED');
  });

  it('hit-tests lanes to horse IDs only when a race exists', () => {
    const renderer = createTrackRenderer(canvas);
    renderer.resize(1000, 516, 1);
    const director = createRaceDirector();
    expect(renderer.horseAt(100, director)).toBeNull();
    director.load(roster, program);
    const lineup = program.rounds[0]!.lineup;
    expect(renderer.horseAt(46 + 1, director)).toBe(lineup[0]);
    expect(renderer.horseAt(499, director)).toBe(lineup[9]);
    expect(renderer.horseAt(10, director)).toBeNull();
  });

  it('survives a canvas without a 2D context', () => {
    vi.spyOn(canvas, 'getContext').mockReturnValue(null);
    const renderer = createTrackRenderer(canvas);
    renderer.resize(400, 300, 1);
    expect(() => {
      renderer.render(scene(createRaceDirector()));
    }).not.toThrow();
  });
});
