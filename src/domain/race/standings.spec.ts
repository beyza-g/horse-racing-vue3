import { describe, expect, it } from 'vitest';
import {
  compareCrossings,
  compareLive,
  gapToLeader,
  insertionSortInPlace,
  type StandingEntry,
} from './standings';

const entry = (patch: Partial<StandingEntry> & Pick<StandingEntry, 'horseId'>): StandingEntry => ({
  lane: patch.horseId,
  position: 0,
  place: 0,
  finishTime: null,
  ...patch,
});

describe('compareCrossings', () => {
  it('orders by crossing time first', () => {
    const fast = { horseId: 9, finishTime: 10.1 };
    const slow = { horseId: 1, finishTime: 10.2 };
    expect(compareCrossings(fast, slow)).toBeLessThan(0);
    expect(compareCrossings(slow, fast)).toBeGreaterThan(0);
  });

  it('breaks exact ties by horse ID', () => {
    const low = { horseId: 2, finishTime: 10 };
    const high = { horseId: 7, finishTime: 10 };
    expect(compareCrossings(low, high)).toBeLessThan(0);
    expect([high, low].sort(compareCrossings)).toEqual([low, high]);
  });

  it('places runners without a time last', () => {
    expect(compareCrossings({ horseId: 1, finishTime: null }, { horseId: 2, finishTime: 99 })).toBe(
      1,
    );
  });
});

describe('compareLive', () => {
  it('ranks placed runners first, by place', () => {
    const second = entry({ horseId: 1, place: 2, position: 1300 });
    const first = entry({ horseId: 2, place: 1, position: 1250 });
    const racing = entry({ horseId: 3, position: 1199 });
    expect([racing, second, first].sort(compareLive)).toEqual([first, second, racing]);
  });

  it('ranks runners still racing by distance covered', () => {
    const ahead = entry({ horseId: 5, position: 600 });
    const behind = entry({ horseId: 1, position: 590 });
    expect([behind, ahead].sort(compareLive)).toEqual([ahead, behind]);
  });

  it('keeps gate order for runners level on distance', () => {
    const lane1 = entry({ horseId: 9, lane: 1 });
    const lane2 = entry({ horseId: 3, lane: 2 });
    expect([lane2, lane1].sort(compareLive)).toEqual([lane1, lane2]);
  });
});

describe('insertionSortInPlace', () => {
  const byNumber = (a: number, b: number) => a - b;

  it('sorts in place and reports movement', () => {
    const items = [3, 1, 2];
    expect(insertionSortInPlace(items, byNumber)).toBe(true);
    expect(items).toEqual([1, 2, 3]);
  });

  it('reports no movement for sorted input', () => {
    const items = [1, 2, 3, 4];
    expect(insertionSortInPlace(items, byNumber)).toBe(false);
    expect(items).toEqual([1, 2, 3, 4]);
  });

  it('is stable', () => {
    const items = [
      { key: 1, tag: 'a' },
      { key: 0, tag: 'b' },
      { key: 1, tag: 'c' },
      { key: 0, tag: 'd' },
    ];
    insertionSortInPlace(items, (a, b) => a.key - b.key);
    expect(items.map((item) => item.tag)).toEqual(['b', 'd', 'a', 'c']);
  });

  it('handles empty and single-item arrays', () => {
    expect(insertionSortInPlace([], byNumber)).toBe(false);
    expect(insertionSortInPlace([1], byNumber)).toBe(false);
  });
});

describe('gapToLeader', () => {
  const leader = entry({ horseId: 1, position: 800 });

  it('measures metres behind the leader', () => {
    expect(gapToLeader(leader, entry({ horseId: 2, position: 790.5 }), 1200)).toBeCloseTo(9.5);
  });

  it('is 0 for the leader and for finished runners', () => {
    expect(gapToLeader(leader, leader, 1200)).toBe(0);
    expect(gapToLeader(leader, entry({ horseId: 3, position: 1210, place: 2 }), 1200)).toBe(0);
  });

  it('measures only up to the finish line once the leader is past it', () => {
    const winner = entry({ horseId: 1, position: 1260, place: 1 });
    expect(gapToLeader(winner, entry({ horseId: 2, position: 1190 }), 1200)).toBeCloseTo(10);
  });
});
