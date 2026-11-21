import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import type { StandingRow, StandingsView } from '@/stores/raceView';
import StandingsList from './StandingsList.vue';

const row = (patch: Partial<StandingRow>): StandingRow => ({
  horseId: 1,
  rank: '1',
  number: '01',
  name: 'Iron Halo',
  color: 'red',
  points: 18,
  starts: 2,
  wins: 1,
  form: '12',
  cells: [],
  followed: false,
  movement: null,
  description: 'Iron Halo: rank 1, 18 points from 2 runs (1st in round 1, 2nd in round 2)',
  ...patch,
});

const view: StandingsView = {
  rows: [
    row({}),
    row({ horseId: 2, rank: '–', name: 'Redwing', points: 0, starts: 0, form: '', followed: true }),
  ],
  officialRounds: 2,
  hasResults: true,
  rounds: [],
};

describe('StandingsList', () => {
  it('shows rank, name and points with a full description per row', () => {
    const wrapper = mount(StandingsList, { props: { standings: view } });
    const rows = wrapper.findAll('.standings-list__row');
    expect(rows).toHaveLength(2);
    expect(rows[0]!.text()).toBe('1Iron Halo18');
    expect(rows[0]!.attributes('aria-label')).toContain('18 points from 2 runs');
    expect(rows[0]!.attributes('title')).toContain('form 12');
    expect(rows[1]!.classes()).toContain('is-unraced');
    expect(rows[1]!.attributes('aria-pressed')).toBe('true');
  });

  it('shows the movement since the last round in a fixed slot', () => {
    const moved: StandingsView = {
      ...view,
      rows: [
        row({ movement: { direction: 'up', places: 2, spoken: 'up 2 places since round 1' } }),
      ],
    };
    const wrapper = mount(StandingsList, { props: { standings: moved } });
    const badge = wrapper.get('.movement');
    expect(badge.classes()).toContain('is-up');
    expect(badge.text()).toBe('2');
    expect(badge.attributes('aria-hidden')).toBe('true');
    const still = mount(StandingsList, { props: { standings: view } });
    expect(still.findAll('.movement')).toHaveLength(2);
    expect(still.get('.movement').text()).toBe('');
  });

  it('emits follow', async () => {
    const wrapper = mount(StandingsList, { props: { standings: view } });
    await wrapper.findAll('.standings-list__row')[1]!.trigger('click');
    expect(wrapper.emitted('follow')).toEqual([[2]]);
  });
});
