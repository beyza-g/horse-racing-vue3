import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { buildCondition, type RoundCardView } from '@/viewModels';
import RoundCard from './RoundCard.vue';

const card: RoundCardView = {
  index: 2,
  title: 'Round 3',
  distance: '1600m',
  pill: { label: 'Live', tone: 'live' },
  current: true,
  official: false,
  expanded: true,
  available: true,
  lineup: Array.from({ length: 10 }, (_, i) => ({
    lane: i + 1,
    horseId: i + 1,
    number: String(i + 1).padStart(2, '0'),
    name: `Horse ${i + 1}`,
    color: 'red',
    condition: buildCondition(44 + i),
    followed: i === 0,
  })),
};

describe('RoundCard', () => {
  it('exposes expansion to assistive technology and lists the line-up', () => {
    const wrapper = mount(RoundCard, { props: { card } });
    const head = wrapper.get('.round-card__head');
    expect(head.attributes('aria-expanded')).toBe('true');
    expect(head.attributes('aria-controls')).toBe('round-3-lineup');
    expect(wrapper.findAll('.round-card__row')).toHaveLength(10);
  });

  it("shows each runner's condition with its band in the tooltip", () => {
    const wrapper = mount(RoundCard, { props: { card } });
    const badge = wrapper.findAll('.condition-badge')[0]!;
    expect(badge.text()).toBe('44');
    expect(badge.classes()).toContain('is-fit');
    expect(badge.attributes('aria-label')).toContain('Race fit');
  });

  it('emits toggle and follow', async () => {
    const wrapper = mount(RoundCard, { props: { card } });
    await wrapper.get('.round-card__head').trigger('click');
    await wrapper.findAll('.round-card__row')[4]!.trigger('click');
    expect(wrapper.emitted('toggle')).toEqual([[2]]);
    expect(wrapper.emitted('follow')).toEqual([[5]]);
  });

  it('is disabled and collapsed before a program exists', () => {
    const wrapper = mount(RoundCard, {
      props: { card: { ...card, available: false, expanded: false, pill: null, lineup: [] } },
    });
    expect(wrapper.get('.round-card__head').attributes('disabled')).toBeDefined();
    expect(wrapper.find('.round-card__lineup').exists()).toBe(false);
  });
});
