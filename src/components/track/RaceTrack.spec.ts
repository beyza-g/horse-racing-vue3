import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { computeGeometry, laneTop } from '@/render';
import { usePreferencesStore } from '@/stores/preferences';
import { useRaceStore } from '@/stores/race';
import RaceTrack from './RaceTrack.vue';

const W = 1000;
const H = 516;
const g = computeGeometry(W, H);
const laneMiddle = (lane: number) => laneTop(g, lane) + g.laneHeight / 2;

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', () => 0);
  vi.stubGlobal('cancelAnimationFrame', () => undefined);
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
});

const move = (wrapper: ReturnType<typeof mount>, clientY: number, pointerType = 'mouse') =>
  wrapper.get('canvas').trigger('pointermove', { clientY, pointerType });

describe('RaceTrack lane hover', () => {
  it('ignores the pointer before a program exists', async () => {
    const wrapper = mount(RaceTrack);
    await move(wrapper, laneMiddle(2));
    expect(wrapper.get('canvas').attributes('data-hovered-lane')).toBeUndefined();
    expect(wrapper.get('canvas').classes()).not.toContain('is-clickable');
  });

  it('tracks the lane under the mouse and shows a pointer cursor only over lanes', async () => {
    useRaceStore().generateProgram();
    const wrapper = mount(RaceTrack);
    await move(wrapper, laneMiddle(4));
    expect(wrapper.get('canvas').attributes('data-hovered-lane')).toBe('4');
    expect(wrapper.get('canvas').classes()).toContain('is-clickable');
    await move(wrapper, laneMiddle(9));
    expect(wrapper.get('canvas').attributes('data-hovered-lane')).toBe('9');
    await move(wrapper, 10);
    expect(wrapper.get('canvas').attributes('data-hovered-lane')).toBeUndefined();
    expect(wrapper.get('canvas').classes()).not.toContain('is-clickable');
  });

  it('clears on leave and never hovers for touch', async () => {
    useRaceStore().generateProgram();
    const wrapper = mount(RaceTrack);
    await move(wrapper, laneMiddle(1));
    await wrapper.get('canvas').trigger('pointerleave');
    expect(wrapper.get('canvas').attributes('data-hovered-lane')).toBeUndefined();
    await move(wrapper, laneMiddle(1), 'touch');
    expect(wrapper.get('canvas').attributes('data-hovered-lane')).toBeUndefined();
  });

  it('hover is visual only: clicking the hovered lane still follows its horse', async () => {
    const race = useRaceStore();
    race.generateProgram();
    const wrapper = mount(RaceTrack);
    await move(wrapper, laneMiddle(2));
    await wrapper.get('canvas').trigger('click', { clientY: laneMiddle(2) });
    await nextTick();
    expect(usePreferencesStore().followedHorseId).toBe(race.program!.rounds[0]!.lineup[2]);
    expect(race.phase).toBe('ready');
  });
});
