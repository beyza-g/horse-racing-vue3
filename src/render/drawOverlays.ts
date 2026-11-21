import { formatOfficialTime, type Horse, type HorseId, type RaceView } from '@/domain';
import { countdownStep, DIRECTOR_TIMING, type DirectorPhase } from '@/playback';
import type { TrackGeometry } from './geometry';
import { FONT_MONO, FONT_SANS, type TrackPalette } from './palette';

const easeOut = (k: number): number => 1 - Math.pow(1 - Math.min(1, Math.max(0, k)), 3);

export interface CueLayer {
  readonly phase: DirectorPhase;
  readonly race: RaceView;
  readonly roundIndex: number;
  readonly roundCount: number;
  readonly phaseElapsed: number;
  readonly sinceWin: number | null;
  readonly horses: ReadonlyMap<HorseId, Horse>;
}

/** A photo finish: first and second separated by less than this many simulation seconds. */
export const PHOTO_FINISH_MARGIN = 0.08;

/** Centre-stage cues: "press start", the countdown and the winner card. */
export function drawCue(
  ctx: CanvasRenderingContext2D,
  g: TrackGeometry,
  P: TrackPalette,
  cue: CueLayer,
): void {
  const { width: W, height: H } = g;
  const cx = W / 2;
  const cy = g.top + (g.bottom - g.top) / 2;
  const scrim = (alpha: number) => {
    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * 0.55);
    gradient.addColorStop(0, P.scrim);
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = alpha;
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
  };
  const round = cue.roundIndex + 1;
  ctx.textAlign = 'center';

  if (cue.phase === 'ready') {
    // The round title and Start action are a DOM card over the canvas
    // (ReadyCard), so they are focusable and readable; the canvas only dims.
    scrim(0.9);
    return;
  }

  if (cue.phase === 'countdown') {
    const elapsed = cue.phaseElapsed;
    const step = countdownStep(elapsed);
    const intro = easeOut(elapsed / 0.3);
    const big = Math.min(120, H * 0.28);
    scrim(0.85 * (step.isGo ? 1 - step.progress : 1));
    const alpha = step.progress < 0.75 ? 1 : Math.max(0, (1 - step.progress) / 0.25);
    const zoom = 1.25 - 0.25 * easeOut(step.progress * 2.5);
    ctx.save();
    ctx.translate(cx, cy + 4);
    ctx.scale(zoom, zoom);
    ctx.globalAlpha = alpha;
    ctx.font = `800 ${big}px ${FONT_SANS}`;
    ctx.fontStretch = 'condensed';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = step.isGo ? P.accentText : P.text;
    ctx.fillText(step.label, 0, 0);
    ctx.fontStretch = 'normal';
    ctx.restore();
    ctx.textBaseline = 'alphabetic';
    ctx.globalAlpha = intro * (step.isGo ? 1 - step.progress : 1);
    ctx.font = `700 12px ${FONT_MONO}`;
    ctx.fillStyle = P.text;
    ctx.letterSpacing = '2px';
    ctx.fillText(
      `ROUND ${round} · ${cue.race.distance}M`,
      cx,
      cy - big * 0.5 - 8 + (1 - intro) * 8,
    );
    ctx.letterSpacing = '0px';
    ctx.globalAlpha = 1;
    return;
  }

  if (cue.sinceWin !== null && cue.phase !== 'complete') {
    drawWinnerCard(ctx, g, P, cue, cx, cy);
  }
}

function drawWinnerCard(
  ctx: CanvasRenderingContext2D,
  g: TrackGeometry,
  P: TrackPalette,
  cue: CueLayer,
  cx: number,
  cy: number,
): void {
  const winner = cue.race.standings[0];
  const horse = winner === undefined ? undefined : cue.horses.get(winner.horseId);
  if (winner === undefined || horse === undefined || winner.finishTime === null) return;
  const second = cue.race.standings[1];
  const appear = easeOut((cue.sinceWin ?? 0) / 0.4);
  const width = Math.min(320, g.width - 40);
  const height = 88;
  const x0 = g.narrow ? cx - width / 2 : Math.max(16, g.startX + g.run * 0.36 - width / 2);
  const y0 = cy - height / 2 + (1 - appear) * 10;

  ctx.globalAlpha = appear;
  ctx.shadowColor = 'rgba(0,0,0,0.25)';
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 6;
  ctx.beginPath();
  ctx.roundRect(x0, y0, width, height, 12);
  ctx.fillStyle = P.card;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = P.cardLine;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = horse.color;
  ctx.beginPath();
  ctx.roundRect(x0 + 14, y0 + 16, 5, height - 32, 2.5);
  ctx.fill();

  ctx.textAlign = 'left';
  ctx.font = `700 10px ${FONT_MONO}`;
  ctx.fillStyle = P.accentText;
  ctx.letterSpacing = '1.5px';
  const secondTime = second?.finishTime ?? null;
  const photo = secondTime !== null && secondTime - winner.finishTime < PHOTO_FINISH_MARGIN;
  const round = cue.roundIndex + 1;
  ctx.fillText(
    photo ? `PHOTO FINISH · ROUND ${round}` : `WINNER · ROUND ${round}`,
    x0 + 32,
    y0 + 27,
  );
  ctx.letterSpacing = '0px';
  ctx.font = `800 25px ${FONT_SANS}`;
  ctx.fontStretch = 'semi-condensed';
  ctx.fillStyle = P.text;
  ctx.fillText(horse.name, x0 + 32, y0 + 56);
  ctx.fontStretch = 'normal';
  ctx.font = `500 12px ${FONT_MONO}`;
  ctx.fillStyle = P.muted;
  const time = formatOfficialTime(winner.finishTime, cue.race.distance);
  const intermission = cue.phase === 'intermission';
  ctx.fillText(
    intermission && round < cue.roundCount ? `${time} · NEXT: ROUND ${round + 1}` : time,
    x0 + 32,
    y0 + 75,
  );
  if (intermission) {
    const progress = Math.min(1, cue.phaseElapsed / DIRECTOR_TIMING.intermissionSeconds);
    ctx.fillStyle = P.cardLine;
    ctx.fillRect(x0 + 14, y0 + height - 3, width - 28, 2);
    ctx.fillStyle = P.accent;
    ctx.fillRect(x0 + 14, y0 + height - 3, (width - 28) * progress, 2);
  }
  ctx.globalAlpha = 1;
}
