import { describe, expect, it } from 'vitest';
import {
  computeGeometry,
  distanceMarkers,
  horseScale,
  laneAtY,
  laneTop,
  noseX,
  TRACK_LAYOUT,
} from './geometry';

const wide = computeGeometry(1000, 516);
const narrow = computeGeometry(360, 380);

describe('computeGeometry', () => {
  it('lays out ten equal lanes between the header band and the bottom padding', () => {
    expect(wide.narrow).toBe(false);
    expect(wide.top).toBe(TRACK_LAYOUT.top);
    expect(wide.bottom).toBe(500);
    expect(wide.laneHeight).toBeCloseTo((500 - 46) / 10);
    expect(wide.run).toBe(wide.finishX - wide.startX);
  });

  it('places start and finish for wide and narrow tracks', () => {
    expect(wide.startX).toBe(200);
    expect(computeGeometry(2000, 500).startX).toBeCloseTo(380);
    expect(wide.finishX).toBe(1000 - TRACK_LAYOUT.finishInset);
    expect(narrow.narrow).toBe(true);
    expect(narrow.startX).toBe(TRACK_LAYOUT.narrowInset);
    expect(narrow.finishX).toBe(360 - TRACK_LAYOUT.narrowInset);
  });

  it('never produces a negative run or lane height on tiny canvases', () => {
    const tiny = computeGeometry(10, 10);
    expect(tiny.run).toBeGreaterThan(0);
    expect(tiny.laneHeight).toBeGreaterThan(0);
  });
});

describe('lanes', () => {
  it('maps lane indices to Y and back', () => {
    for (let lane = 0; lane < 10; lane++) {
      const y = laneTop(wide, lane) + wide.laneHeight / 2;
      expect(laneAtY(wide, y)).toBe(lane);
    }
  });

  it('returns null above, below or for invalid Y', () => {
    expect(laneAtY(wide, wide.top - 1)).toBeNull();
    expect(laneAtY(wide, wide.bottom)).toBeNull();
    expect(laneAtY(wide, Number.NaN)).toBeNull();
    expect(laneAtY(wide, wide.top)).toBe(0);
  });
});

describe('noseX', () => {
  it('maps the start, midpoint and finish linearly', () => {
    expect(noseX(wide, 0, 1200)).toBe(wide.startX);
    expect(noseX(wide, 600, 1200)).toBeCloseTo(wide.startX + wide.run / 2);
    expect(noseX(wide, 1200, 1200)).toBeCloseTo(wide.finishX);
  });

  it('clamps runners past the line and before the start', () => {
    expect(noseX(wide, 5000, 1200)).toBe(wide.finishX + wide.overrunPx);
    expect(noseX(narrow, 5000, 1200)).toBe(narrow.finishX + narrow.overrunPx);
    expect(noseX(wide, -10, 1200)).toBe(wide.startX);
    expect(noseX(wide, 10, 0)).toBe(wide.startX);
  });
});

describe('horseScale', () => {
  it('grows with lane height up to a cap', () => {
    expect(horseScale(computeGeometry(1000, 46 + 31 * 10 + 16))).toBeCloseTo(0.5);
    expect(horseScale(computeGeometry(1000, 5000))).toBe(TRACK_LAYOUT.maxHorseScale);
  });
});

describe('distanceMarkers', () => {
  it('places a pole every 200 m measured back from the finish', () => {
    const markers = distanceMarkers(wide, 1200);
    expect(markers.map((m) => m.metresToGo)).toEqual([200, 400, 600, 800, 1000]);
    expect(markers[0]!.x).toBeCloseTo(wide.finishX - wide.run / 6);
    for (let i = 1; i < markers.length; i++) expect(markers[i]!.x).toBeLessThan(markers[i - 1]!.x);
  });

  it('labels every pole when there is room and every 400 m when cramped', () => {
    expect(distanceMarkers(wide, 1200).every((m) => m.labeled)).toBe(true);
    const cramped = distanceMarkers(narrow, 2200);
    expect(cramped.filter((m) => m.labeled).every((m) => m.metresToGo % 400 === 0)).toBe(true);
  });

  it('hides labels that would overlap the reserved header area (PAUSED pill)', () => {
    const reserved = wide.startX + wide.run / 2;
    for (const marker of distanceMarkers(wide, 1200, reserved)) {
      if (marker.x <= reserved + TRACK_LAYOUT.labelClearance) expect(marker.labeled).toBe(false);
      else expect(marker.labeled).toBe(true);
    }
  });

  it('returns nothing for a non-positive distance', () => {
    expect(distanceMarkers(wide, 0)).toEqual([]);
  });
});
