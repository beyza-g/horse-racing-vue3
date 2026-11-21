import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import type { BoardView, CompletedRoundsView } from '@/stores/raceView';
import CompletedRounds from './CompletedRounds.vue';
import ResultsLeaderboard from './ResultsLeaderboard.vue';

const board: BoardView = {
  roundIndex: 1,
  title: 'Round 2',
  distance: '1400m',
  pill: { label: 'Official', tone: 'official' },
  showBackToLive: true,
  rows: [
    {
      horseId: 7,
      name: 'Iron Halo',
      color: 'red',
      top: 26,
      position: '2nd',
      podium: true,
      time: '1:15.21',
      finished: true,
      emphasized: false,
      followed: false,
    },
    {
      horseId: 3,
      name: 'Saltmarsh',
      color: 'blue',
      top: 0,
      position: '1st',
      podium: true,
      time: '1:14.80',
      finished: true,
      emphasized: true,
      followed: true,
    },
  ],
};

describe('ResultsLeaderboard', () => {
  it('positions rows by rank with transforms (no layout shift) and keeps DOM order stable', () => {
    const wrapper = mount(ResultsLeaderboard, { props: { board } });
    const rows = wrapper.findAll('.leaderboard__row');
    expect(rows.map((r) => r.attributes('style'))).toEqual([
      'transform: translateY(26px);',
      'transform: translateY(0px);',
    ]);
    expect(rows[1]!.find('button').attributes('aria-pressed')).toBe('true');
  });

  it('emits follow and back-to-live', async () => {
    const wrapper = mount(ResultsLeaderboard, { props: { board } });
    await wrapper.findAll('.leaderboard__button')[0]!.trigger('click');
    await wrapper.get('.leaderboard__back').trigger('click');
    expect(wrapper.emitted('follow')).toEqual([[7]]);
    expect(wrapper.emitted('backToLive')).toHaveLength(1);
  });

  it('shows a hint without rows', () => {
    const wrapper = mount(ResultsLeaderboard, {
      props: { board: { ...board, rows: [], pill: null, showBackToLive: false } },
    });
    expect(wrapper.text()).toContain('Rankings and finish times appear here');
    expect(wrapper.find('.leaderboard__back').exists()).toBe(false);
  });
});

describe('CompletedRounds', () => {
  const view: CompletedRoundsView = {
    count: '1 / 6',
    showHint: false,
    rows: [
      {
        roundIndex: 0,
        label: 'R1',
        distance: '1200m',
        winnerId: 4,
        winnerName: 'Redwing',
        winnerColor: 'red',
        time: '1:01.62',
        selected: true,
        followed: false,
      },
    ],
    liveRow: {
      label: 'R2',
      distance: '1400m',
      text: 'Running now',
      pill: { label: 'Live', tone: 'live' },
    },
  };

  it('lists winners and the live round, emitting inspect and back-to-live', async () => {
    const wrapper = mount(CompletedRounds, { props: { view } });
    expect(wrapper.text()).toContain('1 / 6');
    const buttons = wrapper.findAll('button');
    expect(buttons).toHaveLength(2);
    expect(buttons[0]!.attributes('aria-pressed')).toBe('true');
    await buttons[0]!.trigger('click');
    await buttons[1]!.trigger('click');
    expect(wrapper.emitted('inspect')).toEqual([[0]]);
    expect(wrapper.emitted('backToLive')).toHaveLength(1);
  });

  it('shows the hint when nothing has happened yet', () => {
    const wrapper = mount(CompletedRounds, {
      props: { view: { ...view, rows: [], liveRow: null, showHint: true } },
    });
    expect(wrapper.text()).toContain('Winners collect here');
  });
});
