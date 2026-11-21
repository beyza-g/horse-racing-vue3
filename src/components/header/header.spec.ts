import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { describe, expect, it } from 'vitest';
import { usePreferencesStore } from '@/stores/preferences';
import { useRaceStore } from '@/stores/race';
import AppHeader from './AppHeader.vue';
import PlaybackButton from './PlaybackButton.vue';
import RoundProgress from './RoundProgress.vue';
import SpeedSelector from './SpeedSelector.vue';
import StatusIndicator from './StatusIndicator.vue';
import ThemeToggle from './ThemeToggle.vue';

describe('PlaybackButton', () => {
  it('shows the label and icon, and emits toggle', async () => {
    const wrapper = mount(PlaybackButton, {
      props: { control: { visible: true, enabled: true, label: 'Pause', icon: 'pause' } },
    });
    expect(wrapper.text()).toBe('Pause');
    await wrapper.trigger('click');
    expect(wrapper.emitted('toggle')).toHaveLength(1);
  });

  it('is disabled when playback cannot be toggled', () => {
    const wrapper = mount(PlaybackButton, {
      props: { control: { visible: true, enabled: false, label: 'Start', icon: 'play' } },
    });
    expect(wrapper.attributes('disabled')).toBeDefined();
  });
});

describe('SpeedSelector', () => {
  it('marks the active speed and emits a new one', async () => {
    const wrapper = mount(SpeedSelector, { props: { modelValue: 2 } });
    const buttons = wrapper.findAll('button');
    expect(buttons.map((b) => b.text())).toEqual(['1x', '2x', '4x']);
    expect(buttons.map((b) => b.attributes('aria-pressed'))).toEqual(['false', 'true', 'false']);
    await buttons[2]!.trigger('click');
    expect(wrapper.emitted('update:modelValue')).toEqual([[4]]);
  });
});

describe('ThemeToggle', () => {
  it('is a switch that describes the next theme', async () => {
    const wrapper = mount(ThemeToggle, { props: { theme: 'dark' } });
    expect(wrapper.attributes('role')).toBe('switch');
    expect(wrapper.attributes('aria-label')).toBe('Switch to light theme (T)');
    await wrapper.setProps({ theme: 'light' });
    expect(wrapper.attributes('aria-label')).toBe('Switch to dark theme (T)');
    await wrapper.trigger('click');
    expect(wrapper.emitted('toggle')).toHaveLength(1);
  });
});

describe('StatusIndicator', () => {
  it('announces the status politely and shows the pill', () => {
    const wrapper = mount(StatusIndicator, {
      props: {
        status: { label: 'Round 2 · 1400m', pill: { label: 'Live', tone: 'live' }, dot: 'active' },
      },
    });
    expect(wrapper.attributes('aria-live')).toBe('polite');
    expect(wrapper.text()).toContain('Round 2 · 1400m');
    expect(wrapper.find('.status-pill--live').text()).toBe('Live');
  });
});

describe('RoundProgress', () => {
  it('renders one segment per round with its state', () => {
    const wrapper = mount(RoundProgress, {
      props: {
        segments: [
          { title: 'Round 1', state: 'done' },
          { title: 'Round 2', state: 'current' },
          { title: 'Round 3', state: 'pending' },
        ],
      },
    });
    expect(
      wrapper.findAll('li').map((li) => li.classes().find((c) => c.startsWith('is-'))),
    ).toEqual(['is-done', 'is-current', 'is-pending']);
  });
});

describe('AppHeader', () => {
  it('never renders the follow badge, so following cannot move the header', async () => {
    setActivePinia(createPinia());
    useRaceStore().initialize(42);
    const wrapper = mount(AppHeader);
    usePreferencesStore().toggleFollow(3);
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.follow-chip').exists()).toBe(false);
    expect(wrapper.text()).not.toContain('Following');
  });
});
