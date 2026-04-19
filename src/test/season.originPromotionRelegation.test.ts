import { describe, it, expect } from 'vitest';
import {
  promoteRelegateOriginContinent,
  OffseasonManager,
} from '../worker/core/season/offseason';
import { REGION_LEAGUE_STRUCTURE } from '../common/constants.football';
import type { Team } from '../common/entities';

// FL9 RED -> GREEN: applyPromotionRelegation must move originContinent
// teams across leagueIndex boundaries the same way it moves miningIsland
// teams across tier boundaries. Otherwise the standings on the origin
// continent have no effect on next year's schedule because
// seasonManagerV2 reads team.leagueIndex unchanged.

function mkOriginTeam(
  tid: number,
  leagueIndex: number,
  won: number,
  lost: number
): Team {
  return {
    tid,
    cid: leagueIndex,
    // Match generateRegionTeams: did = leagueIndex * 3 + ...
    did: leagueIndex * 3,
    region: 'originContinent',
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
    leagueIndex,
  } as Team;
}

// 12 teams per league with deterministic records: tid 0..11 in order
// of strength inside each league (tid offset 0 is weakest, 11 strongest).
function mkLeague(leagueIndex: number, n: number): Team[] {
  const arr: Team[] = [];
  for (let i = 0; i < n; i++) {
    arr.push(
      mkOriginTeam(leagueIndex * 100 + i, leagueIndex, i, n - 1 - i)
    );
  }
  return arr;
}

describe('promoteRelegateOriginContinent', () => {
  it('exposes promotion/relegation spots in REGION_LEAGUE_STRUCTURE config', () => {
    // The helper must source K from config, not a magic number.
    const cfg = REGION_LEAGUE_STRUCTURE.originContinent as unknown as {
      levels?: number;
      promotionSpots?: number;
      relegationSpots?: number;
    };
    expect(cfg.levels, 'originContinent.levels').toBe(3);
    expect(cfg.promotionSpots, 'originContinent.promotionSpots').toBeGreaterThanOrEqual(1);
    expect(cfg.relegationSpots, 'originContinent.relegationSpots').toBe(
      cfg.promotionSpots
    );
  });

  it('relegates the worst K of leagueIndex N and promotes the best K of leagueIndex N+1', () => {
    const teams = [
      ...mkLeague(0, 12),
      ...mkLeague(1, 12),
      ...mkLeague(2, 12),
    ];
    const cfg = REGION_LEAGUE_STRUCTURE.originContinent as unknown as {
      promotionSpots: number;
    };
    const k = cfg.promotionSpots;

    // Snapshot expected swaps before mutation.
    const league0Bottom = teams
      .filter(t => t.leagueIndex === 0)
      .sort((a, b) => a.won - b.won)
      .slice(0, k)
      .map(t => t.tid);
    const league1Top = teams
      .filter(t => t.leagueIndex === 1)
      .sort((a, b) => b.won - a.won)
      .slice(0, k)
      .map(t => t.tid);
    const league1Bottom = teams
      .filter(t => t.leagueIndex === 1)
      .sort((a, b) => a.won - b.won)
      .slice(0, k)
      .map(t => t.tid);
    const league2Top = teams
      .filter(t => t.leagueIndex === 2)
      .sort((a, b) => b.won - a.won)
      .slice(0, k)
      .map(t => t.tid);

    const result = promoteRelegateOriginContinent(teams);

    // 0<->1 boundary
    for (const tid of league0Bottom) {
      expect(
        teams.find(t => t.tid === tid)!.leagueIndex,
        `tid ${tid} relegated to leagueIndex 1`
      ).toBe(1);
    }
    for (const tid of league1Top) {
      expect(
        teams.find(t => t.tid === tid)!.leagueIndex,
        `tid ${tid} promoted to leagueIndex 0`
      ).toBe(0);
    }
    // 1<->2 boundary
    for (const tid of league1Bottom) {
      expect(
        teams.find(t => t.tid === tid)!.leagueIndex,
        `tid ${tid} relegated to leagueIndex 2`
      ).toBe(2);
    }
    for (const tid of league2Top) {
      expect(
        teams.find(t => t.tid === tid)!.leagueIndex,
        `tid ${tid} promoted to leagueIndex 1`
      ).toBe(1);
    }

    // Move records reflect both directions.
    expect(result.relegated.length).toBe(k * 2);
    expect(result.promoted.length).toBe(k * 2);
    expect(
      result.relegated.some(m =>
        league0Bottom.includes(m.tid) && m.fromTier === 0 && m.toTier === 1
      )
    ).toBe(true);
    expect(
      result.promoted.some(m =>
        league2Top.includes(m.tid) && m.fromTier === 2 && m.toTier === 1
      )
    ).toBe(true);
  });

  it('keeps each league size constant after swapping', () => {
    const teams = [
      ...mkLeague(0, 12),
      ...mkLeague(1, 12),
      ...mkLeague(2, 12),
    ];
    promoteRelegateOriginContinent(teams);
    for (const idx of [0, 1, 2]) {
      expect(
        teams.filter(t => t.leagueIndex === idx).length,
        `leagueIndex ${idx} size`
      ).toBe(12);
    }
  });

  it('leaves mid-table teams in their original leagueIndex', () => {
    const teams = [
      ...mkLeague(0, 12),
      ...mkLeague(1, 12),
      ...mkLeague(2, 12),
    ];
    const cfg = REGION_LEAGUE_STRUCTURE.originContinent as unknown as {
      promotionSpots: number;
    };
    const k = cfg.promotionSpots;

    // For each league, the teams that are *neither* in the bottom-k
    // (relegation candidates) *nor* in the top-k (promotion candidates)
    // must end up where they started.
    const midByLeague = new Map<number, number[]>();
    for (const idx of [0, 1, 2]) {
      const sorted = teams
        .filter(t => t.leagueIndex === idx)
        .sort((a, b) => b.won - a.won)
        .map(t => t.tid);
      midByLeague.set(idx, sorted.slice(k, sorted.length - k));
    }

    promoteRelegateOriginContinent(teams);

    for (const [idx, tids] of midByLeague) {
      for (const tid of tids) {
        expect(
          teams.find(t => t.tid === tid)!.leagueIndex,
          `mid-table tid ${tid} stays in leagueIndex ${idx}`
        ).toBe(idx);
      }
    }
  });

  it('does nothing when only one leagueIndex is populated', () => {
    const teams = mkLeague(0, 5);
    const result = promoteRelegateOriginContinent(teams);
    expect(result.promoted).toEqual([]);
    expect(result.relegated).toEqual([]);
    for (const t of teams) {
      expect(t.leagueIndex).toBe(0);
    }
  });

  it('does not bridge non-contiguous leagueIndexes (0 + 2 only)', () => {
    const teams = [...mkLeague(0, 5), ...mkLeague(2, 5)];
    const result = promoteRelegateOriginContinent(teams);
    expect(result.promoted).toEqual([]);
    expect(result.relegated).toEqual([]);
  });
});

describe('OffseasonManager.applyPromotionRelegation - originContinent integration', () => {
  it('mutates team.leagueIndex when running the offseason for originContinent teams', () => {
    // Minimal offseason: just origin teams, no players. We're checking
    // that applyPromotionRelegation actually wires the helper into
    // OffseasonManager.runOffseason() (not just exports it).
    const teams: Team[] = [
      ...mkLeague(0, 12),
      ...mkLeague(1, 12),
      ...mkLeague(2, 12),
    ];

    const league0WorstBefore = teams
      .filter(t => t.leagueIndex === 0)
      .sort((a, b) => a.won - b.won)[0].tid;
    const league1BestBefore = teams
      .filter(t => t.leagueIndex === 1)
      .sort((a, b) => b.won - a.won)[0].tid;

    const om = new OffseasonManager([], teams, 2026);
    const result = om.runOffseason();

    // The promoted/relegated event lists should mention the swapped
    // origin teams, not just miningIsland teams.
    const allMovedTids = new Set(
      [...result.promotedTeams, ...result.relegatedTeams].map(m => m.tid)
    );
    expect(allMovedTids.has(league0WorstBefore)).toBe(true);
    expect(allMovedTids.has(league1BestBefore)).toBe(true);

    // And the team objects themselves must have updated leagueIndex.
    expect(teams.find(t => t.tid === league0WorstBefore)!.leagueIndex).toBe(1);
    expect(teams.find(t => t.tid === league1BestBefore)!.leagueIndex).toBe(0);

    // Sanity: total teams per league preserved.
    for (const idx of [0, 1, 2]) {
      expect(teams.filter(t => t.leagueIndex === idx).length).toBe(12);
    }
  });
});
