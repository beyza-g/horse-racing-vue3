import { distanceMarkers, laneTop, type TrackGeometry } from './geometry';
import { FONT_MONO, FONT_SANS, TRACK_COLORS, type TrackPalette } from './palette';

const TAU = Math.PI * 2;
const STRIPE_WIDTH = 44;
const FINISH_SQUARE = 4;

/** Turf, lighting, lanes, the followed-lane highlight and the rails. */
export function drawTrackBase(
  ctx: CanvasRenderingContext2D,
  g: TrackGeometry,
  P: TrackPalette,
  grain: CanvasPattern | null,
  followedLane: number | null,
): void {
  const { width: W, height: H } = g;
  ctx.fillStyle = P.turf;
  ctx.fillRect(0, 0, W, H);
  for (let x = 0, k = 0; x < W; x += STRIPE_WIDTH, k++) {
    if (k % 2 === 1) {
      ctx.fillStyle = P.stripe;
      ctx.fillRect(x, g.top, STRIPE_WIDTH, g.bottom - g.top);
    }
  }
  let gradient = ctx.createLinearGradient(0, 0, 0, H);
  gradient.addColorStop(0, P.topShade);
  gradient.addColorStop(0.45, 'rgba(0,0,0,0)');
  gradient.addColorStop(1, P.bottomShade);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, W, H);
  for (const fx of [0.28, 0.72]) {
    gradient = ctx.createRadialGradient(W * fx, -H * 0.15, 0, W * fx, -H * 0.15, H * 1.15);
    gradient.addColorStop(0, P.flood);
    gradient.addColorStop(1, 'rgba(255,246,220,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);
  }
  if (grain !== null) {
    ctx.fillStyle = grain;
    ctx.fillRect(0, g.top, W, g.bottom - g.top);
  }
  ctx.fillStyle = P.band;
  ctx.fillRect(0, 0, W, g.top - 6);
  ctx.fillStyle = P.apron;
  ctx.fillRect(0, g.bottom + 3, W, H - g.bottom - 3);

  for (let lane = 0; lane < g.laneCount; lane++) {
    const y = laneTop(g, lane);
    if (lane % 2 === 1) {
      ctx.fillStyle = P.laneAlt;
      ctx.fillRect(0, y, W, g.laneHeight);
    }
    if (lane > 0) {
      ctx.fillStyle = P.laneLine;
      ctx.fillRect(0, y, W, 1);
    }
  }
  if (followedLane !== null) {
    const y = laneTop(g, followedLane);
    ctx.fillStyle = P.followLane;
    ctx.fillRect(0, y, W, g.laneHeight);
    ctx.fillStyle = P.accent;
    ctx.fillRect(0, y, W, 1.5);
    ctx.fillRect(0, y + g.laneHeight - 1.5, W, 1.5);
  }
  for (const y of [g.top - 3, g.bottom + 1]) {
    ctx.fillStyle = P.rail;
    ctx.fillRect(0, y, W, 2);
    ctx.fillStyle = P.railPost;
    for (let x = 8; x < W; x += 26) ctx.fillRect(x, y + (y < g.top ? -4 : 2), 1.5, 4);
  }
}

export interface TrackHeader {
  readonly title: string;
  readonly subtitle: string;
  readonly paused: boolean;
  /** Pulse "FINAL 200M" while the leader is in the last 200 m. */
  readonly finalStretch: boolean;
  /** Race clock in seconds, or null to hide it. */
  readonly clockSeconds: number | null;
  /** Presentation time for the pulse animation. */
  readonly time: number;
}

/** Formats a race clock as m:ss.cc. */
export function formatClock(seconds: number): string {
  const safe = Math.max(0, seconds);
  return `${Math.floor(safe / 60)}:${(safe % 60).toFixed(2).padStart(5, '0')}`;
}

/**
 * Draws the header band text and returns the X where it ends, so distance
 * labels can keep clear of it (the PAUSED pill never overlaps a label).
 */
export function drawHeader(
  ctx: CanvasRenderingContext2D,
  g: TrackGeometry,
  P: TrackPalette,
  header: TrackHeader,
  light: boolean,
): number {
  const baseline = 26;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.letterSpacing = '1.5px';
  ctx.font = `800 14px ${FONT_SANS}`;
  ctx.fillStyle = P.text;
  ctx.fillText(header.title, 16, baseline);
  let x = 16 + ctx.measureText(header.title).width + 10;
  ctx.font = `500 11px ${FONT_MONO}`;
  ctx.fillStyle = P.muted;
  ctx.fillText(header.subtitle, x, baseline);
  x += ctx.measureText(header.subtitle).width;
  let reservedUntil = x;

  if (header.paused) {
    x += 14;
    ctx.font = `700 11px ${FONT_SANS}`;
    const pillWidth = ctx.measureText('PAUSED').width + 18;
    ctx.beginPath();
    ctx.roundRect(x, 13, pillWidth, 18, 9);
    ctx.fillStyle = P.text;
    ctx.fill();
    ctx.fillStyle = light ? '#FFFFFF' : P.pausedText;
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', x + pillWidth / 2, baseline);
    ctx.textAlign = 'left';
    reservedUntil = x + pillWidth;
  } else if (header.finalStretch) {
    x += 14;
    ctx.font = `700 11px ${FONT_MONO}`;
    ctx.fillStyle = P.accentText;
    ctx.globalAlpha = 0.65 + 0.35 * Math.sin(header.time * 6);
    ctx.fillText('FINAL 200M', x, baseline);
    ctx.globalAlpha = 1;
    reservedUntil = x + ctx.measureText('FINAL 200M').width;
  }
  ctx.letterSpacing = '0px';

  if (header.clockSeconds !== null) {
    ctx.textAlign = 'right';
    ctx.font = `500 13px ${FONT_MONO}`;
    ctx.fillStyle = P.text;
    ctx.fillText(formatClock(header.clockSeconds), g.width - 16, baseline);
    ctx.textAlign = 'left';
  }
  return reservedUntil;
}

/** Furlong poles with their labels, skipping labels inside the reserved header area. */
export function drawDistancePoles(
  ctx: CanvasRenderingContext2D,
  g: TrackGeometry,
  P: TrackPalette,
  distance: number,
  reservedUntilX: number,
): void {
  ctx.font = `500 10px ${FONT_MONO}`;
  ctx.textAlign = 'center';
  for (const marker of distanceMarkers(g, distance, reservedUntilX)) {
    const x = marker.x;
    ctx.fillStyle = P.pole;
    ctx.fillRect(x, g.top, 1, g.bottom - g.top);
    ctx.fillStyle = P.rail;
    ctx.fillRect(x - 1, g.top - 9, 2, 7);
    ctx.fillRect(x - 1, g.bottom + 1, 2, 6);
    ctx.fillStyle = marker.metresToGo % 400 === 0 ? TRACK_COLORS.finishRed : P.rail;
    ctx.fillRect(x - 2.5, g.top - 11, 5, 3);
    if (marker.labeled) {
      ctx.fillStyle = P.poleText;
      ctx.fillText(String(marker.metresToGo), x, g.top - 14);
    }
  }
}

/**
 * Start line, leader progress bar, finish flash and the chequered finish line.
 *
 * @param leaderProgress Leader's share of the distance, or null before the start.
 * @param flash Finish-line glow strength in [0, 1].
 */
export function drawStartAndFinish(
  ctx: CanvasRenderingContext2D,
  g: TrackGeometry,
  P: TrackPalette,
  leaderProgress: number | null,
  flash: number,
): void {
  ctx.fillStyle = P.startLine;
  ctx.fillRect(g.startX, g.top, 1.5, g.bottom - g.top);
  if (leaderProgress !== null && leaderProgress > 0) {
    ctx.fillStyle = P.accent;
    ctx.fillRect(g.startX, g.top - 3, Math.min(1, leaderProgress) * g.run, 2);
  }
  if (flash > 0) {
    const gradient = ctx.createLinearGradient(g.finishX - 60, 0, g.finishX + 60, 0);
    gradient.addColorStop(0, `rgba(${TRACK_COLORS.glowRgb},0)`);
    gradient.addColorStop(0.5, `rgba(${TRACK_COLORS.glowRgb},${0.45 * flash})`);
    gradient.addColorStop(1, `rgba(${TRACK_COLORS.glowRgb},0)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(g.finishX - 60, g.top, 120, g.bottom - g.top);
  }
  for (let y = g.top, k = 0; y < g.bottom; y += FINISH_SQUARE, k++) {
    for (let j = 0; j < 2; j++) {
      ctx.fillStyle = (k + j) % 2 === 1 ? TRACK_COLORS.finishDark : TRACK_COLORS.finishLight;
      ctx.fillRect(
        g.finishX - FINISH_SQUARE + j * FINISH_SQUARE,
        y,
        FINISH_SQUARE,
        Math.min(FINISH_SQUARE, g.bottom - y),
      );
    }
  }
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.fillRect(g.finishX + 4, g.top, 2, g.bottom - g.top);
  ctx.fillStyle = TRACK_COLORS.finishRed;
  ctx.beginPath();
  ctx.arc(g.finishX, g.top - 9, 4, 0, TAU);
  ctx.fill();
  ctx.fillStyle = TRACK_COLORS.flagCenter;
  ctx.beginPath();
  ctx.arc(g.finishX, g.top - 9, 1.6, 0, TAU);
  ctx.fill();
  ctx.font = `700 10px ${FONT_MONO}`;
  ctx.textAlign = 'center';
  ctx.fillStyle = P.poleText;
  ctx.fillText('FINISH', g.finishX, g.top - 18);
}

/** Darkens the corners. */
export function drawVignette(
  ctx: CanvasRenderingContext2D,
  g: TrackGeometry,
  P: TrackPalette,
): void {
  const { width: W, height: H } = g;
  const gradient = ctx.createRadialGradient(
    W / 2,
    H / 2,
    Math.min(W, H) * 0.4,
    W / 2,
    H / 2,
    Math.max(W, H) * 0.75,
  );
  gradient.addColorStop(0, 'rgba(0,0,0,0)');
  gradient.addColorStop(1, P.vignette);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, W, H);
}
