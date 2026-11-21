import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';
import { usePreferencesStore } from '@/stores/preferences';
import { useRaceStore } from '@/stores/race';
import FollowBadge from './FollowBadge.vue';
import FollowChip from './FollowChip.vue';

describe('FollowChip', () => {
  it('names the horse and emits clear from a labelled button', async () => {
    const wrapper = mount(FollowChip, { props: { name: 'Iron Halo', color: 'red' } });
    expect(wrapper.text()).toContain('Following');
    expect(wrapper.text()).toContain('Iron Halo');
    expect(wrapper.attributes('title')).toBe('Following Iron Halo');
    await wrapper.get('button[aria-label="Stop following"]').trigger('click');
    expect(wrapper.emitted('clear')).toHaveLength(1);
  });
});

describe('FollowBadge', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    useRaceStore().initialize(42);
  });

  it('keeps an empty live region while idle and shows the chip only while following', async () => {
    const wrapper = mount(FollowBadge);
    const region = wrapper.get('.follow-badge');
    expect(region.attributes('aria-live')).toBe('polite');
    expect(region.attributes('data-keep-selection')).toBeDefined();
    expect(region.text()).toBe('');

    const preferences = usePreferencesStore();
    preferences.toggleFollow(3);
    await wrapper.vm.$nextTick();
    const horse = useRaceStore().horsesById.get(3)!;
    expect(wrapper.get('.follow-chip').text()).toContain(horse.name);
  });

  it('stops following from the clear button', async () => {
    const preferences = usePreferencesStore();
    preferences.toggleFollow(5);
    const wrapper = mount(FollowBadge);
    await wrapper.get('button[aria-label="Stop following"]').trigger('click');
    expect(preferences.followedHorseId).toBeNull();
  });

  it('switches to the newly followed horse', async () => {
    const preferences = usePreferencesStore();
    preferences.toggleFollow(5);
    const wrapper = mount(FollowBadge);
    preferences.toggleFollow(9);
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain(useRaceStore().horsesById.get(9)!.name);
  });
});
