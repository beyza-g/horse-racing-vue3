import { onBeforeUnmount, onMounted, type Ref } from 'vue';
import type { HorseId } from '@/domain';
import { createTrackRenderer, type TrackRenderer, type TrackScene } from '@/render';
import { usePreferencesStore } from '@/stores/preferences';
import { useRaceStore } from '@/stores/race';
import { useAnimationFrame } from './useAnimationFrame';

/**
 * The game loop: every animation frame it advances the race store (which
 * drives the director) and redraws the canvas. Also keeps the canvas sized
 * to its container and exposes lane hit testing for clicks.
 */
export function useRaceLoop(canvas: Ref<HTMLCanvasElement | null>): {
  horseAtClientY: (clientY: number) => HorseId | null;
} {
  const race = useRaceStore();
  const preferences = usePreferencesStore();
  let renderer: TrackRenderer | null = null;
  let observer: ResizeObserver | null = null;

  const resize = (): void => {
    const element = canvas.value;
    const host = element?.parentElement;
    if (!element || !host || renderer === null) return;
    const rect = host.getBoundingClientRect();
    renderer.resize(rect.width, rect.height, window.devicePixelRatio);
  };

  const scene = (): TrackScene => ({
    theme: preferences.theme,
    director: race.getDirector(),
    horses: race.horsesById,
    followedHorseId: preferences.followedHorseId,
    nameTags: true,
    finishDrama: true,
  });

  onMounted(() => {
    if (canvas.value === null) return;
    renderer = createTrackRenderer(canvas.value);
    resize();
    if (typeof ResizeObserver !== 'undefined' && canvas.value.parentElement) {
      observer = new ResizeObserver(resize);
      observer.observe(canvas.value.parentElement);
    }
  });

  useAnimationFrame((wallDt) => {
    race.advance(wallDt);
    renderer?.render(scene());
  });

  onBeforeUnmount(() => {
    observer?.disconnect();
    observer = null;
    renderer = null;
  });

  return {
    horseAtClientY(clientY) {
      const element = canvas.value;
      if (element === null || renderer === null) return null;
      return renderer.horseAt(clientY - element.getBoundingClientRect().top, race.getDirector());
    },
  };
}
