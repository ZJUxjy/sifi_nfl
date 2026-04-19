import { describe, it, expect } from 'vitest';
import { promoteRelegateMiningIsland } from '../worker/core/season/offseason';
import type { Team } from '../common/entities';

function mkTeam(tid: number, tier: number, won: number, lost: number): Team {
  return {
    tid,
    cid: 0,
    did: 0,
    region: 'miningIsland',
    name: `T${tid}`,
    abbrev: 'TST',
    colors: ['#000', '#000', '#000'],
    pop: 'Medium',
    srID: `s${tid}`,
    budget: 0,
    cash: 0,
    salaryPaid: 0,
    season: 2026,
    won,
    lost,
    playoffsRoundsWon: -1,
    streak: 0,
    lastTen: '',
    tier,
  } as Team;
}

// 20 teams per tier with deterministic records: tid 0..19 in order of
// strength (tid 0 worst, tid 19 best inside each tier).
function mkTier(tier: number, n: number): Team[] {
  const arr: Team[] = [];
  for (let i = 0; i < n; i++) {
    arr.push(mkTeam(tier * 100 + i, tier, i, n - 1 - i));
  }
  return arr;
}

describe('promoteRelegateMiningIsland', () => {
  it('relegates bottom 3 of each tier and promotes top 3 of the tier below', () => {
    const teams = [
      ...mkTier(1, 20),
      ...mkTier(2, 20),
      ...mkTier(3, 20),
      ...mkTier(4, 20),
    ];

    // Snapshot expected swaps before mutation. The bottom 3 of tier i
    // are the lowest `won`; the top 3 of tier i+1 are the highest `won`.
    const tier1Bottom3 = teams
      .filter(t => t.tier === 1)
      .sort((a, b) => a.won - b.won)
      .slice(0, 3)
      .map(t => t.tid);
    const tier2Top3 = teams
      .filter(t => t.tier === 2)
      .sort((a, b) => b.won - a.won)
      .slice(0, 3)
      .map(t => t.tid);

    const result = promoteRelegateMiningIsland(teams);

    expect(result.relegated).toEqual(
      expect.arrayContaining(
        tier1Bottom3.map(tid => expect.objectContaining({ tid, fromTier: 1, toTier: 2 }))
      )
    );
    expect(result.promoted).toEqual(
      expect.arrayContaining(
        tier2Top3.map(tid => expect.objectContaining({ tid, fromTier: 2, toTier: 1 }))
      )
    );

    for (const tid of tier1Bottom3) {
      expect(teams.find(t => t.tid === tid)!.tier).toBe(2);
    }
    for (const tid of tier2Top3) {
      expect(teams.find(t => t.tid === tid)!.tier).toBe(1);
    }
  });

  it('keeps tier sizes constant after swapping', () => {
    const teams = [
      ...mkTier(1, 20),
      ...mkTier(2, 20),
      ...mkTier(3, 20),
      ...mkTier(4, 20),
    ];
    promoteRelegateMiningIsland(teams);
    for (const tier of [1, 2, 3, 4]) {
      expect(
        teams.filter(t => t.tier === tier).length,
        `tier ${tier} size`
      ).toBe(20);
    }
  });

  it('does nothing when there are fewer than 2 tiers populated', () => {
    const teams = mkTier(1, 5);
    const result = promoteRelegateMiningIsland(teams);
    expect(result.promoted).toEqual([]);
    expect(result.relegated).toEqual([]);
    for (const t of teams) {
      expect(t.tier).toBe(1);
    }
  });

  it('handles non-contiguous tiers (e.g. tier 1 + tier 3 only) without swapping across the gap', () => {
    const teams = [...mkTier(1, 5), ...mkTier(3, 5)];
    const result = promoteRelegateMiningIsland(teams);
    // No adjacent pair exists, so nothing should move.
    expect(result.promoted).toEqual([]);
    expect(result.relegated).toEqual([]);
  });
});
