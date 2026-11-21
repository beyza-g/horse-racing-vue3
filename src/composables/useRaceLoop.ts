import { onBeforeUnmount, onMounted, shallowRef, type Ref } from 'vue';
import type { HorseId } from '@/domain';
import { createTrackRenderer, type TrackRenderer, type TrackScene } from '@/render';
import { usePreferencesStore } from '@/stores/preferences';
import { useRaceStore } from '@/stores/race';
import { useAnimationFrame } from './useAnimationFrame';

/** Pointer details needed for lane hover (a subset of `PointerEvent`). */
export interface LanePointer {
  readonly clientY: number;
  readonly pointerType: string;
}

/**
 * The game loop: every animation frame it advances the race store (which
 * drives the director) and redraws the canvas. Also keeps the canvas sized
 * to its container, exposes lane hit testing for clicks, and tracks which
 * lane the mouse is over (local UI state, not game state: it lives here, not
 * in a store, and changes only when the hovered lane changes).
 */
export function useRaceLoop(canvas: Ref<HTMLCanvasElement | null>): {
  horseAtClientY: (clientY: number) => HorseId | null;
  hoveredLane: Readonly<Ref<number | null>>;
  pointerMove: (pointer: LanePointer) => void;
  pointerLeave: () => void;
} {
  const hoveredLane = shallowRef<number | null>(null);
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
    hoveredLane: hoveredLane.value,
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
    // A round can end or a program can be cleared under a still pointer.
    if (hoveredLane.value !== null && race.getDirector().race === null) hoveredLane.value = null;
    renderer?.render(scene());
  });

  const localY = (clientY: number): number | null => {
    const element = canvas.value;
    return element === null ? null : clientY - element.getBoundingClientRect().top;
  };

  onBeforeUnmount(() => {
    observer?.disconnect();
    observer = null;
    renderer = null;
  });

  return {
    horseAtClientY(clientY) {
      const y = localY(clientY);
      if (y === null || renderer === null) return null;
      return renderer.horseAt(y, race.getDirector());
    },
    hoveredLane,
    pointerMove(pointer) {
      // Touch has no hover; a tap would otherwise leave a stale highlight.
      if (pointer.pointerType === 'touch') {
        hoveredLane.value = null;
        return;
      }
      const y = localY(pointer.clientY);
      const lane = y === null || renderer === null ? null : renderer.laneAt(y, race.getDirector());
      if (lane !== hoveredLane.value) hoveredLane.value = lane;
    },
    pointerLeave() {
      hoveredLane.value = null;
    },
  };
}
