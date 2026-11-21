import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import StatusPill from './StatusPill.vue';

describe('StatusPill', () => {
  it('adds a decorative pulsing dot to live pills only', () => {
    const live = mount(StatusPill, { props: { label: 'Live', tone: 'live' } });
    const dot = live.find('.status-pill__pulse');
    expect(dot.exists()).toBe(true);
    expect(dot.attributes('aria-hidden')).toBe('true');
    expect(live.text()).toBe('Live');
    for (const tone of ['paused', 'gates', 'official'] as const) {
      const pill = mount(StatusPill, { props: { label: 'x', tone } });
      expect(pill.find('.status-pill__pulse').exists()).toBe(false);
    }
  });
});
