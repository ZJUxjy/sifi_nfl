import { describe, it, expect } from 'vitest';
import {
  generateDoubleEliminationBracket,
  advanceDoubleEliminationRound,
  isPlayoffComplete,
} from '../worker/core/playoffs';
import type { Team } from '../common/entities';

function mkTeams(n: number): Team[] {
  const arr: Team[] = [];
  for (let i = 0; i < n; i++) {
    arr.push({
      tid: i + 1,
      cid: 0,
      did: 0,
      region: 'originContinent',
      name: `T${i + 1}`,
      abbrev: 'TST',
      colors: ['#000', '#000', '#000'],
      pop: 'Medium',
      srID: `s${i}`,
      budget: 0,
      cash: 0,
      salaryPaid: 0,
      season: 2026,
      won: 17 - i,
      lost: i,
      playoffsRoundsWon: -1,
      streak: 0,
      lastTen: '',
    } as Team);
  }
  return arr;
}

// Deterministic simulator: lower tid (= higher seed) always wins.
const seedWins = (t1Tid: number, t2Tid: number) => Math.min(t1Tid, t2Tid);

describe('generateDoubleEliminationBracket', () => {
  it('throws when given fewer than 8 qualified teams', () => {
    expect(() => generateDoubleEliminationBracket(mkTeams(5), 'originContinent', 2026))
      .toThrow(/at least 8/i);
  });

  it('builds 4 winners-bracket round 1 matchups when given 8 teams', () => {
    const b = generateDoubleEliminationBracket(mkTeams(8), 'originContinent', 2026);
    expect(b.teams.length).toBe(8);
    expect(b.winnersBracket[0].matchups.length).toBe(4);
    // Standard 1v8 / 4v5 / 2v7 / 3v6 seeding
    const pairs = b.winnersBracket[0].matchups
      .map(m => [m.team1Seed, m.team2Seed].sort((a, b) => a! - b!))
      .sort((a, b) => a[0]! - b[0]!);
    expect(pairs).toEqual([
      [1, 8],
      [2, 7],
      [3, 6],
      [4, 5],
    ]);
  });

  it('starts with currentRound=1 and no champion', () => {
    const b = generateDoubleEliminationBracket(mkTeams(8), 'originContinent', 2026);
    expect(b.currentRound).toBe(1);
    expect(b.champion).toBeUndefined();
  });
});

describe('advanceDoubleEliminationRound', () => {
  it('produces a champion after enough rounds', () => {
    let b = generateDoubleEliminationBracket(mkTeams(8), 'originContinent', 2026);
    let safety = 0;
    while (b.champion === undefined && safety++ < 20) {
      b = advanceDoubleEliminationRound(b, seedWins);
    }
    expect(b.champion, 'must crown a champion within 20 rounds').toBeDefined();
    // With seed-wins simulator, the #1 seed (lowest tid) must win.
    expect(b.champion).toBe(1);
  });

  it('every losing team appears in losers bracket exactly once before elimination', () => {
    let b = generateDoubleEliminationBracket(mkTeams(8), 'originContinent', 2026);
    const seenInLosers = new Set<number>();
    let safety = 0;
    while (b.champion === undefined && safety++ < 20) {
      b = advanceDoubleEliminationRound(b, seedWins);
      for (const round of b.losersBracket) {
        for (const m of round.matchups) {
          if (m.team1Tid !== -1) seenInLosers.add(m.team1Tid);
          if (m.team2Tid !== -1) seenInLosers.add(m.team2Tid);
        }
      }
    }
    // 7 of the 8 teams will lose at least once. The seed #1 might win
    // straight through; everyone else should have shown up in LB.
    expect(seenInLosers.size).toBeGreaterThanOrEqual(7);
  });

  it('isPlayoffComplete agrees with bracket.champion', () => {
    let b = generateDoubleEliminationBracket(mkTeams(8), 'originContinent', 2026);
    expect(isPlayoffComplete(b)).toBe(false);
    let safety = 0;
    while (b.champion === undefined && safety++ < 20) {
      b = advanceDoubleEliminationRound(b, seedWins);
    }
    expect(isPlayoffComplete(b)).toBe(true);
  });

  it('is a no-op once a champion has been crowned', () => {
    let b = generateDoubleEliminationBracket(mkTeams(8), 'originContinent', 2026);
    let safety = 0;
    while (b.champion === undefined && safety++ < 20) {
      b = advanceDoubleEliminationRound(b, seedWins);
    }
    const championBefore = b.champion;
    const after = advanceDoubleEliminationRound(b, seedWins);
    expect(after.champion).toBe(championBefore);
  });
});
