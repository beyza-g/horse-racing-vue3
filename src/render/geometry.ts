import { RUNNERS_PER_ROUND } from '@/domain';

/** Layout constants for the track canvas, in CSS pixels. */
export const TRACK_LAYOUT = Object.freeze({
  /** Height of the header band above the first lane. */
  top: 46,
  /** Gap below the last lane. */
  bottomPadding: 16,
  /** Below this width the track switches to its compact layout. */
  narrowWidth: 560,
  /** Start line position as a share of width (wide layout) and its minimum. */
  startRatio: 0.19,
  startMin: 200,
  /** Inset of the finish line from the right edge (wide / narrow). */
  finishInset: 112,
  narrowInset: 58,
  /** How far past the finish a runner may be drawn (wide / narrow). */
  overrunPx: 72,
  narrowOverrunPx: 22,
  /** Distance between furlong poles in metres. */
  poleSpacing: 200,
  /** Pole labels thin out to every 400 m when 200 m poles are closer than this. */
  minLabelSpacing: 40,
  /** Minimum gap between the header text (e.g. the PAUSED pill) and a pole label. */
  labelClearance: 18,
  /** Reference lane height at which a horse is drawn at scale 1. */
  horseLaneHeight: 62,
  maxHorseScale: 1.2,
});

export interface TrackGeometry {
  readonly width: number;
  readonly height: number;
  readonly narrow: boolean;
  /** Y of the first lane's top edge. */
  readonly top: number;
  /** Y of the last lane's bottom edge. */
  readonly bottom: number;
  readonly startX: number;
  readonly finishX: number;
  /** Pixels between start and finish. */
  readonly run: number;
  readonly laneHeight: number;
  readonly overrunPx: number;
  readonly laneCount: number;
}

/** Computes the track layout for a canvas of `width` × `height` CSS pixels. */
export function computeGeometry(
  width: number,
  height: number,
  laneCount: number = RUNNERS_PER_ROUND,
): TrackGeometry {
  const L = TRACK_LAYOUT;
  const narrow = width < L.narrowWidth;
  const top = L.top;
  const bottom = Math.max(top + laneCount, height - L.bottomPadding);
  const startX = narrow ? L.narrowInset : Math.max(L.startMin, width * L.startRatio);
  const finishX = Math.max(startX + 1, width - (narrow ? L.narrowInset : L.finishInset));
  return {
    width,
    height,
    narrow,
    top,
    bottom,
    startX,
    finishX,
    run: finishX - startX,
    laneHeight: (bottom - top) / laneCount,
    overrunPx: narrow ? L.narrowOverrunPx : L.overrunPx,
    laneCount,
  };
}

/** Y of the top edge of 0-based lane `laneIndex`. */
export function laneTop(g: TrackGeometry, laneIndex: number): number {
  return g.top + laneIndex * g.laneHeight;
}

/** The 0-based lane under canvas Y `y`, or null outside the lanes. */
export function laneAtY(g: TrackGeometry, y: number): number | null {
  if (!Number.isFinite(y) || y < g.top || y >= g.bottom) return null;
  return Math.min(g.laneCount - 1, Math.floor((y - g.top) / g.laneHeight));
}

/** X of a runner's nose for `position` metres, clamped a little past the finish line. */
export function noseX(g: TrackGeometry, position: number, distance: number): number {
  const progress = distance > 0 ? Math.max(0, position) / distance : 0;
  return Math.min(g.startX + progress * g.run, g.finishX + g.overrunPx);
}

/** Scale factor for drawing a horse in one lane. */
export function horseScale(g: TrackGeometry): number {
  return Math.min(g.laneHeight / TRACK_LAYOUT.horseLaneHeight, TRACK_LAYOUT.maxHorseScale);
}

/** Approximate half-width of a pole label such as "1800" at 10px mono. */
export const POLE_LABEL_HALF_WIDTH = 12;

export interface DistanceMarker {
  /** Metres still to run at this pole. */
  readonly metresToGo: number;
  readonly x: number;
  /** Whether a numeric label is drawn above the pole. */
  readonly labeled: boolean;
}

/** Horizontal band of the header taken by text: [0, left] and [right, width]. */
export interface HeaderReservation {
  /** X where the left-hand header text ends (title, distance, PAUSED pill). */
  readonly left: number;
  /** X where the right-hand race clock starts. */
  readonly right: number;
}

/** Whether a label centred at `x` with half-width `halfWidth` fits between the reserved areas. */
export function labelFits(x: number, halfWidth: number, reserved: HeaderReservation): boolean {
  const gap = TRACK_LAYOUT.labelClearance;
  return x > reserved.left + gap && x + halfWidth < reserved.right - gap / 2;
}

/**
 * Furlong poles, measured back from the finish. Labels are thinned when the
 * poles are close together and suppressed where they would collide with the
 * header text (the PAUSED pill on the left, the race clock on the right).
 */
export function distanceMarkers(
  g: TrackGeometry,
  distance: number,
  reserved: HeaderReservation = { left: 0, right: Number.POSITIVE_INFINITY },
): readonly DistanceMarker[] {
  const L = TRACK_LAYOUT;
  if (!(distance > 0)) return [];
  const labelStep =
    (L.poleSpacing / distance) * g.run < L.minLabelSpacing ? L.poleSpacing * 2 : L.poleSpacing;
  const markers: DistanceMarker[] = [];
  for (let metres = L.poleSpacing; metres < distance; metres += L.poleSpacing) {
    const x = g.finishX - (metres / distance) * g.run;
    markers.push({
      metresToGo: metres,
      x,
      labeled: metres % labelStep === 0 && labelFits(x, POLE_LABEL_HALF_WIDTH, reserved),
    });
  }
  return markers;
}
