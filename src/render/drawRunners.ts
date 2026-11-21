import type { Horse, HorseId, Race, RunnerView } from '@/domain';
import { formatOrdinal, type RunnerMotion } from '@/playback';
import { drawHorse } from './drawHorse';
import { horseScale, laneTop, noseX, type TrackGeometry } from './geometry';
import type { DustSystem } from './particles';
import { FONT_MONO, FONT_SANS, shadeHex, TRACK_COLORS, type TrackPalette } from './palette';

const TAU = Math.PI * 2;
/** Body length (unscaled) between the nose and the hindquarters. */
const NOSE_OFFSET = 45;

export interface RunnersLayer {
  readonly race: Race;
  readonly horses: ReadonlyMap<HorseId, Horse>;
  readonly followedHorseId: HorseId | null;
  readonly nameTags: boolean;
  readonly motionOf: (laneIndex: number) => RunnerMotion | null;
  /** Presentation seconds since the gates opened, or null while they are shut. */
  readonly sinceGo: number | null;
  /** Presentation seconds since the winner crossed, or null. */
  readonly sinceWin: number | null;
  readonly gateFadeSeconds: number;
  readonly finishDrama: boolean;
  readonly simDt: number;
  readonly time: number;
  readonly dust: DustSystem;
}

const medalFor = (rank: number, P: TrackPalette): string | null =>
  rank === 1
    ? P.accent
    : rank === 2
      ? TRACK_COLORS.silver
      : rank === 3
        ? TRACK_COLORS.bronze
        : null;

/** Live rank (1-based) per lane index, filled into `out` without allocating. */
function liveRanksByLane(race: Race, out: number[]): number[] {
  race.standings.forEach((runner, index) => {
    out[runner.lane - 1] = index + 1;
  });
  return out;
}

const rankScratch: number[] = [];
const coatDarkCache = new Map<string, string>();

function coatDark(coat: string): string {
  let dark = coatDarkCache.get(coat);
  if (dark === undefined) {
    dark = shadeHex(coat, 0.62);
    coatDarkCache.set(coat, dark);
  }
  return dark;
}

function withTagShadow(ctx: CanvasRenderingContext2D, P: TrackPalette, draw: () => void): void {
  if (P.tagShadow !== null) {
    ctx.shadowColor = P.tagShadow;
    ctx.shadowBlur = 3;
  }
  draw();
  ctx.shadowBlur = 0;
  ctx.shadowColor = 'transparent';
}

/** Draws every runner with its name tag, rank badge and dust. */
export function drawRunners(
  ctx: CanvasRenderingContext2D,
  g: TrackGeometry,
  P: TrackPalette,
  layer: RunnersLayer,
): void {
  const { race } = layer;
  const scale = horseScale(g);
  const ranks = liveRanksByLane(race, rankScratch);
  const followed = layer.followedHorseId;
  const following = followed !== null && race.runner(followed) !== undefined;

  race.runners.forEach((runner, laneIndex) => {
    const horse = layer.horses.get(runner.horseId);
    const motion = layer.motionOf(laneIndex);
    if (horse === undefined || motion === null) return;
    const y0 = laneTop(g, laneIndex);
    const groundY = y0 + g.laneHeight * 0.9;
    const centerY = y0 + g.laneHeight / 2;
    const nose = noseX(g, runner.position, race.distance);
    const originX = nose - NOSE_OFFSET * scale;
    const isFollowed = runner.horseId === followed;
    ctx.globalAlpha = following && !isFollowed ? P.dimAlpha : 1;

    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(originX, groundY + 1, 30 * scale, 3.2 * scale, 0, 0, TAU);
    ctx.fill();

    drawHorse(
      ctx,
      originX,
      groundY,
      scale,
      { id: horse.id, coat: horse.coat, coatDark: coatDark(horse.coat), silk: horse.color },
      {
        stridePhase: motion.stridePhase,
        amplitude: motion.amplitude,
        drive: motion.drive,
        racing: runner.place === 0,
        idleTime: layer.time + laneIndex,
      },
    );

    const hoofX = originX - 18 * scale;
    layer.dust.emit(hoofX, groundY, runner.speed, layer.simDt, motion.drive > 0, P.dust);

    if (!g.narrow && layer.nameTags && motion.tagAlpha > 0) {
      const tagX = originX - 46 * scale - 8;
      ctx.textAlign = 'right';
      ctx.font = `${isFollowed ? 800 : 600} 12.5px ${FONT_SANS}`;
      ctx.fontStretch = 'semi-condensed';
      const baseAlpha = ctx.globalAlpha;
      ctx.globalAlpha = baseAlpha * motion.tagAlpha;
      ctx.fillStyle = P.tag;
      withTagShadow(ctx, P, () => {
        ctx.fillText(horse.name, tagX, centerY + 4.5);
      });
      ctx.globalAlpha = baseAlpha;
      ctx.fontStretch = 'normal';
    }

    drawRankBadge(
      ctx,
      P,
      runner,
      ranks[laneIndex] ?? laneIndex + 1,
      nose + 6,
      centerY,
      race.elapsed,
    );
    ctx.globalAlpha = 1;
  });

  if (layer.finishDrama && layer.sinceWin !== null)
    drawWinnerSpotlight(ctx, g, P, race, layer.sinceWin);
  const followedColor = followed === null ? null : (layer.horses.get(followed)?.color ?? null);
  drawLeaderMarkers(ctx, g, P, race, followed, followedColor);
  drawGates(ctx, g, P, layer.sinceGo, layer.gateFadeSeconds);
}

function drawRankBadge(
  ctx: CanvasRenderingContext2D,
  P: TrackPalette,
  runner: RunnerView,
  liveRank: number,
  x: number,
  centerY: number,
  elapsed: number,
): void {
  const rank = runner.place || liveRank;
  const medal = medalFor(rank, P);
  if (runner.place > 0 && medal === null) {
    ctx.font = `600 10px ${FONT_MONO}`;
    ctx.textAlign = 'left';
    ctx.fillStyle = P.tag;
    withTagShadow(ctx, P, () => {
      ctx.fillText(formatOrdinal(runner.place).toUpperCase(), x + 2, centerY + 3.5);
    });
    return;
  }
  if (runner.place === 0 && (medal === null || elapsed < 0.6)) return;
  const label = runner.place > 0 ? formatOrdinal(runner.place).toUpperCase() : String(liveRank);
  ctx.font = `700 10px ${FONT_MONO}`;
  const width = Math.max(16, ctx.measureText(label).width + (runner.place > 0 ? 10 : 8));
  const height = 16;
  ctx.beginPath();
  ctx.roundRect(x, centerY - height / 2, width, height, height / 2);
  ctx.fillStyle = medal ?? P.chip;
  ctx.fill();
  ctx.textAlign = 'center';
  ctx.fillStyle = medal === null ? P.chipText : TRACK_COLORS.medalInk;
  ctx.fillText(label, x + width / 2, centerY + 3.4);
}

/** Dims the other lanes and sweeps a glow along the winner's lane. */
function drawWinnerSpotlight(
  ctx: CanvasRenderingContext2D,
  g: TrackGeometry,
  P: TrackPalette,
  race: Race,
  sinceWin: number,
): void {
  const winner = race.standings[0];
  if (winner === undefined || winner.place !== 1 || sinceWin >= 1.8) return;
  const envelope = Math.sin(Math.min(1, sinceWin / 1.8) * Math.PI);
  const y0 = laneTop(g, winner.lane - 1);
  ctx.fillStyle = `rgba(0,0,0,${P.spotlight * envelope})`;
  ctx.fillRect(0, g.top, g.width, y0 - g.top);
  ctx.fillRect(0, y0 + g.laneHeight, g.width, g.bottom - y0 - g.laneHeight);
  const sweepX = Math.min(1, sinceWin / 1.1) * (g.width + 160);
  const sweep = ctx.createLinearGradient(sweepX - 160, 0, sweepX, 0);
  sweep.addColorStop(0, `rgba(${TRACK_COLORS.glowRgb},0)`);
  sweep.addColorStop(1, `rgba(${TRACK_COLORS.glowRgb},${0.28 * envelope})`);
  ctx.fillStyle = sweep;
  ctx.fillRect(sweepX - 160, y0, 160, g.laneHeight);
}

/** Triangle above the leader and a dashed guide for the followed horse. */
function drawLeaderMarkers(
  ctx: CanvasRenderingContext2D,
  g: TrackGeometry,
  P: TrackPalette,
  race: Race,
  followed: HorseId | null,
  followedColor: string | null,
): void {
  if (race.elapsed <= 0) return;
  const triangle = (x: number, color: string) => {
    ctx.beginPath();
    ctx.moveTo(x, g.top - 3);
    ctx.lineTo(x - 5, g.top - 11);
    ctx.lineTo(x + 5, g.top - 11);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  };
  const leader = race.standings[0];
  if (leader === undefined) return;
  triangle(noseX(g, leader.position, race.distance), P.accent);
  const target = followed === null ? undefined : race.runner(followed);
  if (target === undefined) return;
  const x = noseX(g, target.position, race.distance);
  ctx.save();
  ctx.setLineDash([3, 4]);
  ctx.strokeStyle = P.followGuide;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, g.top);
  ctx.lineTo(x, g.bottom);
  ctx.stroke();
  ctx.restore();
  if (target !== leader) {
    triangle(x, followedColor ?? P.text);
    ctx.strokeStyle = P.text;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

/** Starting gates: solid until the start, then fading over `fadeSeconds`. */
function drawGates(
  ctx: CanvasRenderingContext2D,
  g: TrackGeometry,
  P: TrackPalette,
  sinceGo: number | null,
  fadeSeconds: number,
): void {
  const alpha = sinceGo === null ? 1 : Math.max(0, 1 - sinceGo / fadeSeconds);
  if (alpha <= 0) return;
  ctx.globalAlpha = alpha;
  const offset = (1 - alpha) * 10;
  for (let lane = 0; lane < g.laneCount; lane++) {
    const y0 = laneTop(g, lane);
    ctx.fillStyle = P.gate;
    ctx.fillRect(g.startX + 2 + offset, y0 + 2, 7, g.laneHeight - 4);
    ctx.fillStyle = P.gateLine;
    ctx.fillRect(g.startX + 2 + offset, y0 + 2, 7, 1);
  }
  ctx.globalAlpha = 1;
}

/** Dust particles. */
export function drawDust(ctx: CanvasRenderingContext2D, dust: DustSystem): void {
  dust.forEach((particle, alpha) => {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = particle.color;
    ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
  });
  ctx.globalAlpha = 1;
}
