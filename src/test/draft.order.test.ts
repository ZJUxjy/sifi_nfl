import { describe, it, expect } from 'vitest';
import { generateDraftPicks } from '../worker/core/draft/pool';

describe('generateDraftPicks', () => {
  it('orders the first round by ascending win pct (worst team picks first)', () => {
    const teams = [
      { tid: 1, region: 'firstContinent' as const, won: 14, lost: 3 },
      { tid: 2, region: 'firstContinent' as const, won: 3, lost: 14 },
      { tid: 3, region: 'firstContinent' as const, won: 8, lost: 9 },
    ];

    const picks = generateDraftPicks(teams, 2026, 7);
    const round1 = picks
      .filter(p => p.round === 1)
      .sort((a, b) => a.pick - b.pick);

    expect(round1.map(p => p.tid)).toEqual([2, 3, 1]);
    expect(round1.map(p => p.pick)).toEqual([1, 2, 3]);
  });

  it('mirrors the same draft order across all rounds', () => {
    const teams = [
      { tid: 10, region: 'firstContinent' as const, won: 12, lost: 5 },
      { tid: 20, region: 'firstContinent' as const, won: 4, lost: 13 },
    ];

    const picks = generateDraftPicks(teams, 2026, 3);
    for (const round of [1, 2, 3]) {
      const order = picks
        .filter(p => p.round === round)
        .sort((a, b) => a.pick - b.pick)
        .map(p => p.tid);
      expect(order, `round ${round} order`).toEqual([20, 10]);
    }
  });

  it('produces dpids that do not collide across seasons', () => {
    const teams = [
      { tid: 1, region: 'firstContinent' as const, won: 8, lost: 9 },
      { tid: 2, region: 'firstContinent' as const, won: 9, lost: 8 },
    ];
    const picks2025 = generateDraftPicks(teams, 2025, 1);
    const picks2026 = generateDraftPicks(teams, 2026, 1);
    const ids = new Set([...picks2025, ...picks2026].map(p => p.dpid));
    expect(ids.size).toBe(picks2025.length + picks2026.length);
  });
});
