import { describe, expect, it } from 'vitest';
import {
  createPlaybackClock,
  isPlaybackSpeed,
  MAX_FRAME_DT,
  PLAYBACK_SPEEDS,
  sanitizeFrameDt,
} from './clock';

describe('sanitizeFrameDt', () => {
  it('passes normal frame deltas through', () => {
    expect(sanitizeFrameDt(1 / 60)).toBe(1 / 60);
    expect(sanitizeFrameDt(MAX_FRAME_DT)).toBe(MAX_FRAME_DT);
  });

  it('clamps long frames such as a tab switch', () => {
    expect(sanitizeFrameDt(0.051)).toBe(MAX_FRAME_DT);
    expect(sanitizeFrameDt(30)).toBe(MAX_FRAME_DT);
  });

  it.each([0, -0.016, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'treats %s as 0',
    (dt) => {
      expect(sanitizeFrameDt(dt)).toBe(0);
    },
  );
});

describe('isPlaybackSpeed', () => {
  it('accepts exactly 1, 2 and 4', () => {
    expect(PLAYBACK_SPEEDS.filter(isPlaybackSpeed)).toEqual([1, 2, 4]);
    for (const value of [0, 3, 1.5, -1, Number.NaN]) expect(isPlaybackSpeed(value)).toBe(false);
  });
});

describe('createPlaybackClock', () => {
  it('starts unpaused at 1x with no presentation time', () => {
    const clock = createPlaybackClock();
    expect(clock.paused).toBe(false);
    expect(clock.speed).toBe(1);
    expect(clock.presentationTime).toBe(0);
  });

  it('reports sanitized presentation time and the current speed', () => {
    const clock = createPlaybackClock({ speed: 2 });
    expect(clock.advance(0.02)).toEqual({ presentationDt: 0.02, speed: 2, paused: false });
    expect(clock.advance(5).presentationDt).toBe(MAX_FRAME_DT);
    expect(clock.presentationTime).toBeCloseTo(0.02 + MAX_FRAME_DT, 12);
  });

  it('freezes presentation time while paused, whatever the wall delta', () => {
    const clock = createPlaybackClock();
    clock.advance(0.016);
    clock.pause();
    for (let i = 0; i < 100; i++) expect(clock.advance(0.016).presentationDt).toBe(0);
    expect(clock.advance(60)).toEqual({ presentationDt: 0, speed: 1, paused: true });
    expect(clock.presentationTime).toBe(0.016);
    clock.resume();
    expect(clock.advance(0.016).presentationDt).toBe(0.016);
  });

  it('toggles pause and reports the new state', () => {
    const clock = createPlaybackClock();
    expect(clock.togglePause()).toBe(true);
    expect(clock.togglePause()).toBe(false);
  });

  it('accumulates exactly the unpaused, clamped time across rapid toggles', () => {
    const clock = createPlaybackClock();
    const deltas = [0.016, 0.2, -1, 0.033, Number.NaN, 0.016, 0.05, 0.001];
    let expected = 0;
    deltas.forEach((dt, i) => {
      if (i % 3 === 1) clock.togglePause();
      if (i % 2 === 0) clock.setSpeed(PLAYBACK_SPEEDS[i % 3]!);
      if (!clock.paused) expected += sanitizeFrameDt(dt);
      clock.advance(dt);
    });
    expect(clock.presentationTime).toBeCloseTo(expected, 12);
  });

  it.each([0, 3, -1, Number.NaN])('rejects the speed %s', (speed) => {
    expect(() => createPlaybackClock({ speed })).toThrow(
      expect.objectContaining({ code: 'INVALID_ARGUMENT' }),
    );
    const clock = createPlaybackClock({ speed: 4 });
    expect(() => {
      clock.setSpeed(speed);
    }).toThrow(expect.objectContaining({ code: 'INVALID_ARGUMENT' }));
    expect(clock.speed).toBe(4);
  });

  it('reset unpauses and clears time but keeps the speed preference', () => {
    const clock = createPlaybackClock({ speed: 4, paused: true });
    clock.resume();
    clock.advance(0.02);
    clock.pause();
    clock.reset();
    expect(clock.paused).toBe(false);
    expect(clock.presentationTime).toBe(0);
    expect(clock.speed).toBe(4);
  });
});
