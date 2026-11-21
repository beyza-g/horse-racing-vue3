import { createRng, ROUND_COUNT, type Horse, type HorseId, type Rng } from '@/domain';
import { DIRECTOR_TIMING, observeFinish, type RaceDirector } from '@/playback';
import { drawCue } from './drawOverlays';
import { drawDust, drawRunners } from './drawRunners';
import {
  drawDistancePoles,
  drawHeader,
  drawStartAndFinish,
  drawTrackBase,
  drawVignette,
} from './drawTrack';
import { computeGeometry, laneAtY, type TrackGeometry } from './geometry';
import { createDustSystem } from './particles';
import { PALETTES, type Theme } from './palette';

/** Everything the track needs to draw one frame. */
export interface TrackScene {
  readonly theme: Theme;
  readonly director: RaceDirector;
  readonly horses: ReadonlyMap<HorseId, Horse>;
  readonly followedHorseId: HorseId | null;
  readonly nameTags: boolean;
  readonly finishDrama: boolean;
}

export interface TrackRenderer {
  /** Sets the canvas size in CSS pixels and the device pixel ratio. */
  resize(width: number, height: number, devicePixelRatio: number): void;
  render(scene: TrackScene): void;
  /** Horse ID in the lane at CSS-pixel Y, or null (no race or outside the lanes). */
  horseAt(y: number, director: RaceDirector): HorseId | null;
}

const MAX_PIXEL_RATIO = 2;
const GRAIN_SIZE = 160;
const GRAIN_STROKES = 900;
/** Fixed seed: the turf texture and dust are cosmetic and need not vary between sessions. */
const COSMETIC_SEED = 0x5eed;

function createGrain(ctx: CanvasRenderingContext2D, theme: Theme, rng: Rng): CanvasPattern | null {
  const tile = document.createElement('canvas');
  tile.width = GRAIN_SIZE;
  tile.height = GRAIN_SIZE;
  const t = tile.getContext('2d');
  if (t === null) return null;
  const [lightStroke, darkStroke] = PALETTES[theme].turfGrain;
  t.lineWidth = 1;
  for (let i = 0; i < GRAIN_STROKES; i++) {
    const x = rng.next() * GRAIN_SIZE;
    const y = rng.next() * GRAIN_SIZE;
    const length = 2 + rng.next() * 3;
    t.strokeStyle = rng.next() < 0.5 ? lightStroke : darkStroke;
    t.beginPath();
    t.moveTo(x, y);
    t.lineTo(x + (rng.next() - 0.5) * 1.5, y - length);
    t.stroke();
  }
  return ctx.createPattern(tile, 'repeat');
}

/**
 * Draws the race onto a canvas. Reads the director's state each frame and
 * never mutates it; all motion values come from the playback layer.
 */
export function createTrackRenderer(canvas: HTMLCanvasElement): TrackRenderer {
  const ctx = canvas.getContext('2d');
  const rng = createRng(COSMETIC_SEED);
  const dust = createDustSystem(rng);
  const grains = new Map<Theme, CanvasPattern | null>();
  let size = { width: 0, height: 0, dpr: 1 };
  let geometry: TrackGeometry = computeGeometry(0, 0);
  let lastRace: unknown = null;

  const grainFor = (theme: Theme): CanvasPattern | null => {
    if (ctx === null) return null;
    if (!grains.has(theme)) grains.set(theme, createGrain(ctx, theme, rng));
    return grains.get(theme) ?? null;
  };

  return {
    resize(width, height, devicePixelRatio) {
      const dpr = Math.min(MAX_PIXEL_RATIO, Math.max(1, devicePixelRatio || 1));
      size = { width, height, dpr };
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      geometry = computeGeometry(width, height);
    },

    horseAt(y, director) {
      const race = director.race;
      if (race === null) return null;
      const lane = laneAtY(geometry, y);
      return lane === null ? null : (race.runners[lane]?.horseId ?? null);
    },

    render(scene) {
      if (ctx === null || size.width <= 0 || size.height <= 0) return;
      const { director } = scene;
      const g = geometry;
      const P = PALETTES[scene.theme];
      const light = scene.theme === 'light';
      const race = director.race;
      const frame = director.lastFrame;
      if (race !== lastRace) {
        dust.clear();
        lastRace = race;
      }
      dust.update(frame.presentationDt);

      ctx.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
      const followed = scene.followedHorseId;
      const followedRunner = race !== null && followed !== null ? race.runner(followed) : undefined;
      drawTrackBase(
        ctx,
        g,
        P,
        grainFor(scene.theme),
        followedRunner ? followedRunner.lane - 1 : null,
      );

      const observation = race === null ? null : observeFinish(race);
      const running = director.phase === 'running' || director.phase === 'settling';
      const reservedUntil = drawHeader(
        ctx,
        g,
        P,
        {
          title: race === null ? 'TRACK' : `ROUND ${director.roundIndex + 1}`,
          subtitle: race === null ? '10 LANES' : `${race.distance}M`,
          paused: race !== null && director.paused,
          finalStretch:
            race !== null &&
            running &&
            !director.paused &&
            race.winnerTime === null &&
            race.elapsed > 0 &&
            (observation?.leaderProgress ?? 0) * race.distance > race.distance - 200,
          clockSeconds:
            race === null
              ? null
              : race.isFinished
                ? (race.standings[race.standings.length - 1]?.finishTime ?? race.elapsed)
                : race.elapsed,
          time: director.presentationTime,
        },
        light,
      );
      drawDistancePoles(ctx, g, P, race?.distance ?? 1200, reservedUntil);
      const sinceWin = director.sinceWin;
      drawStartAndFinish(
        ctx,
        g,
        P,
        race !== null && race.elapsed > 0 ? (observation?.leaderProgress ?? 0) : null,
        sinceWin === null ? 0 : Math.max(0, 1 - sinceWin * 1.2),
      );

      if (race !== null) {
        const gatesOpen = director.phase !== 'ready' && director.phase !== 'countdown';
        drawRunners(ctx, g, P, {
          race,
          horses: scene.horses,
          followedHorseId: followed,
          nameTags: scene.nameTags,
          motionOf: (lane) => director.runnerMotion(lane),
          sinceGo: gatesOpen
            ? director.phase === 'running'
              ? director.phaseElapsed
              : DIRECTOR_TIMING.gateFadeSeconds
            : null,
          sinceWin,
          gateFadeSeconds: DIRECTOR_TIMING.gateFadeSeconds,
          finishDrama: scene.finishDrama,
          simDt: frame.simDt,
          time: director.presentationTime,
          dust,
        });
      }
      drawDust(ctx, dust);
      drawVignette(ctx, g, P);
      if (race !== null) {
        drawCue(ctx, g, P, {
          phase: director.phase,
          race,
          roundIndex: director.roundIndex,
          roundCount: ROUND_COUNT,
          phaseElapsed: director.phaseElapsed,
          sinceWin,
          horses: scene.horses,
        });
      }
    },
  };
}
