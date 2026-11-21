import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, ref } from 'vue';
import { computeGeometry, laneTop } from '@/render';
import { useRaceStore } from '@/stores/race';
import { useRaceLoop } from './useRaceLoop';

const W = 1000;
const H = 516;
const g = computeGeometry(W, H);
const laneMiddle = (lane: number) => laneTop(g, lane) + g.laneHeight / 2;

/** Manual animation frames and a ResizeObserver the test can trigger. */
function fakeBrowser() {
  let queue: FrameRequestCallback[] = [];
  let time = 0;
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => queue.push(cb));
  vi.stubGlobal('cancelAnimationFrame', () => {
    queue = [];
  });
  const observers: { callback: () => void; observed: Element[]; disconnected: boolean }[] = [];
  vi.stubGlobal(
    'ResizeObserver',
    class {
      readonly record: (typeof observers)[number];
      constructor(callback: () => void) {
        this.record = { callback, observed: [], disconnected: false };
        observers.push(this.record);
      }
      observe(element: Element) {
        this.record.observed.push(element);
      }
      disconnect() {
        this.record.disconnected = true;
      }
    },
  );
  return {
    observers,
    frame(ms = 16) {
      time += ms;
      const due = queue;
      queue = [];
      for (const cb of due) cb(time);
    },
  };
}

function mountLoop() {
  let loop!: ReturnType<typeof useRaceLoop>;
  const wrapper = mount(
    defineComponent({
      setup() {
        const canvas = ref<HTMLCanvasElement | null>(null);
        loop = useRaceLoop(canvas);
        return () => h('div', { class: 'host' }, [h('canvas', { ref: canvas })]);
      },
    }),
    { attachTo: document.body },
  );
  return { wrapper, loop };
}

describe('useRaceLoop', () => {
  let browser: ReturnType<typeof fakeBrowser>;

  beforeEach(() => {
    browser = fakeBrowser();
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: W,
      bottom: H,
      width: W,
      height: H,
      toJSON: () => ({}),
    });
    setActivePinia(createPinia());
    useRaceStore().initialize(42);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('advances the race store once per frame with the wall delta', () => {
    const race = useRaceStore();
    const advance = vi.spyOn(race, 'advance');
    const { wrapper } = mountLoop();
    browser.frame(16);
    browser.frame(20);
    expect(advance).toHaveBeenCalledTimes(2);
    expect(advance.mock.calls[0]?.[0]).toBe(0);
    expect(advance.mock.calls[1]?.[0]).toBeCloseTo(0.02, 10);
    wrapper.unmount();
  });

  it('observes the canvas host for resizes and disconnects on unmount', () => {
    const { wrapper } = mountLoop();
    const observer = browser.observers[0];
    expect(observer?.observed).toEqual([wrapper.get('.host').element]);
    expect(() => {
      observer?.callback();
    }).not.toThrow();
    wrapper.unmount();
    expect(observer?.disconnected).toBe(true);
  });

  it('clears a hovered lane when the race goes away under a still pointer', () => {
    const race = useRaceStore();
    race.generateProgram();
    const { wrapper, loop } = mountLoop();
    loop.pointerMove({ clientY: laneMiddle(3), pointerType: 'mouse' });
    expect(loop.hoveredLane.value).toBe(3);
    browser.frame();
    expect(loop.hoveredLane.value).toBe(3);

    race.initialize(42); // no program: the director has no race any more
    browser.frame();
    expect(loop.hoveredLane.value).toBeNull();
    wrapper.unmount();
  });

  it('maps a click height to the horse in that lane, and to nothing outside the lanes', () => {
    const race = useRaceStore();
    race.generateProgram();
    const { wrapper, loop } = mountLoop();
    expect(loop.horseAtClientY(laneMiddle(0))).toBe(race.program!.rounds[0]!.lineup[0]);
    expect(loop.horseAtClientY(5)).toBeNull();
    wrapper.unmount();
  });
});
