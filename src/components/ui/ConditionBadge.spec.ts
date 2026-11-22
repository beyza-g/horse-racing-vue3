import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { buildCondition } from '@/viewModels';
import ConditionBadge from './ConditionBadge.vue';

describe('ConditionBadge', () => {
  it.each([
    [44, 'is-fit', 'Race fit'],
    [35, 'is-near', 'Lean'],
    [60, 'is-near', 'Fleshy'],
    [1, 'is-off', 'Underweight'],
    [100, 'is-off', 'Overweight'],
  ])('condition %s renders tone %s (%s)', (value, tone, band) => {
    const wrapper = mount(ConditionBadge, { props: { condition: buildCondition(value) } });
    expect(wrapper.text()).toBe(String(value));
    expect(wrapper.classes()).toContain(tone);
    expect(wrapper.attributes('role')).toBe('img');
    expect(wrapper.attributes('aria-label')).toContain(band);
    expect(wrapper.attributes('aria-label')).toContain(`Condition ${value} of 100`);
  });

  it('can be muted for horses sitting out the round', () => {
    const wrapper = mount(ConditionBadge, {
      props: { condition: buildCondition(44), muted: true },
    });
    expect(wrapper.classes()).toContain('is-muted');
  });
});

describe('HorseBadge', () => {
  it('uses the silk colour when active and the shared inactive chip when muted', async () => {
    const { default: HorseBadge } = await import('./HorseBadge.vue');
    const active = mount(HorseBadge, { props: { number: '05', color: 'rgb(1, 2, 3)' } });
    expect(active.attributes('style')).toContain('background: rgb(1, 2, 3)');
    const muted = mount(HorseBadge, {
      props: { number: '05', color: 'rgb(1, 2, 3)', muted: true },
    });
    expect(muted.attributes('style')).toBeUndefined();
    expect(muted.classes()).toContain('is-muted');
  });
});
