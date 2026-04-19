import { describe, it, expect } from 'vitest';
import {
  generateSingleEliminationBracket,
  advanceSingleEliminationRound,
  isPlayoffComplete,
  type SingleElimSimulator,
} from '../worker/core/playoffs';
import type { Team } from '../common/entities';

function mkTeams(n: number): Team[] {
  const arr: Team[] = [];
  for (let i = 0; i < n; i++) {
    arr.push({
      tid: i + 1,
      cid: 0,
      did: 0,
      region: 'firstContinent',
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

// Higher seed (= lower tid in our setup) always wins.
const seedWins: SingleElimSimulator = (t1, t2) => ({
  winner: Math.min(t1, t2),
});

// Lower seed (= higher tid) always wins — total chaos, useful for
// asserting the deterministic placement of wildcard winners.
const seedLoses: SingleElimSimulator = (t1, t2) => ({
  winner: Math.max(t1, t2),
});

describe('generateSingleEliminationBracket - 12-team layout', () => {
  it('produces 4 wildcard matchups for seeds 5-12 (5v12, 6v11, 7v10, 8v9)', () => {
    const b = generateSingleEliminationBracket(mkTeams(12), 'firstContinent', 2026);
    const wc = b.matchups.filter(m => m.round === 1);
    expect(wc.length).toBe(4);

    const pairs = wc
      .map(m => [m.team1Seed, m.team2Seed].sort((a, b) => (a ?? 0) - (b ?? 0)))
      .sort((a, b) => (a[0] ?? 0) - (b[0] ?? 0));
    expect(pairs).toEqual([
      [5, 12],
      [6, 11],
      [7, 10],
      [8, 9],
    ]);
  });

  it('pre-places seeds 1-4 into the divisional round (each div matchup has one bye seed already filled)', () => {
    const b = generateSingleEliminationBracket(mkTeams(12), 'firstContinent', 2026);
    const div = b.matchups.filter(m => m.round === 2);
    expect(div.length).toBe(4);

    // The four divisional matchups must between them include seeds 1, 2,
    // 3, and 4 already placed (the other slot will be filled by the
    // wildcard winner once round 1 plays out).
    const placedSeeds = div
      .flatMap(m => [m.team1Seed, m.team2Seed])
      .filter((s): s is number => s !== undefined)
      .sort((a, b) => a - b);
    expect(placedSeeds).toEqual([1, 2, 3, 4]);

    // Each divisional matchup should have exactly one slot filled by a
    // top-4 seed and exactly one slot still TBD (= -1).
    for (const m of div) {
      const filledTids = [m.team1Tid, m.team2Tid].filter(tid => tid !== -1);
      expect(filledTids.length).toBe(1);
    }
  });

  it('lays out 2 conference championship slots and 1 final slot', () => {
    const b = generateSingleEliminationBracket(mkTeams(12), 'firstContinent', 2026);
    expect(b.matchups.filter(m => m.round === 3).length).toBe(2);
    expect(b.matchups.filter(m => m.round === 4).length).toBe(1);
  });

  it('starts with currentRound=1 and no champion', () => {
    const b = generateSingleEliminationBracket(mkTeams(12), 'firstContinent', 2026);
    expect(b.currentRound).toBe(1);
    expect(b.champion).toBeUndefined();
  });
});

describe('advanceSingleEliminationRound - round 1 → round 2 placement', () => {
  it('drops each wildcard winner into its correct divisional slot (5v12 → seed 4, 6v11 → seed 3, 7v10 → seed 2, 8v9 → seed 1)', () => {
    const b = generateSingleEliminationBracket(mkTeams(12), 'firstContinent', 2026);
    // Force every wildcard upset so winners are 12, 11, 10, 9 respectively.
    advanceSingleEliminationRound(b, seedLoses);

    const div = b.matchups.filter(m => m.round === 2);

    const otherTidFor = (seed: number) => {
      const game = div.find(m => m.team1Seed === seed || m.team2Seed === seed);
      expect(game, `missing divisional matchup for seed ${seed}`).toBeDefined();
      return game!.team1Seed === seed ? game!.team2Tid : game!.team1Tid;
    };

    expect(otherTidFor(4)).toBe(12); // 5v12 winner = 12 (upset) plays seed 4
    expect(otherTidFor(3)).toBe(11); // 6v11 winner = 11 plays seed 3
    expect(otherTidFor(2)).toBe(10); // 7v10 winner = 10 plays seed 2
    expect(otherTidFor(1)).toBe(9);  // 8v9 winner  = 9 plays seed 1
  });

  it('marks every wildcard matchup as played and advances currentRound', () => {
    const b = generateSingleEliminationBracket(mkTeams(12), 'firstContinent', 2026);
    advanceSingleEliminationRound(b, seedWins);

    const wc = b.matchups.filter(m => m.round === 1);
    expect(wc.every(m => m.played)).toBe(true);
    expect(b.currentRound).toBe(2);
  });
});

describe('advanceSingleEliminationRound - full bracket', () => {
  it('crowns a single champion (seed #1 wins everything with seedWins)', () => {
    const b = generateSingleEliminationBracket(mkTeams(12), 'firstContinent', 2026);
    let safety = 0;
    while (!isPlayoffComplete(b) && safety++ < 10) {
      advanceSingleEliminationRound(b, seedWins);
    }
    expect(isPlayoffComplete(b)).toBe(true);
    expect(b.champion).toBe(1);
  });

  it('plays exactly 11 games across 4 rounds (4 + 4 + 2 + 1)', () => {
    const b = generateSingleEliminationBracket(mkTeams(12), 'firstContinent', 2026);
    let safety = 0;
    while (!isPlayoffComplete(b) && safety++ < 10) {
      advanceSingleEliminationRound(b, seedWins);
    }
    const playedCount = b.matchups.filter(m => m.played).length;
    expect(playedCount).toBe(4 + 4 + 2 + 1);
  });

  it('no team plays itself across the bracket', () => {
    const b = generateSingleEliminationBracket(mkTeams(12), 'firstContinent', 2026);
    let safety = 0;
    while (!isPlayoffComplete(b) && safety++ < 10) {
      advanceSingleEliminationRound(b, seedWins);
    }
    for (const m of b.matchups.filter(m => m.played)) {
      expect(m.team1Tid).not.toBe(m.team2Tid);
    }
  });

  it('seeds 1 and 2 only meet in the final (top half / bottom half topology)', () => {
    const b = generateSingleEliminationBracket(mkTeams(12), 'firstContinent', 2026);
    let safety = 0;
    while (!isPlayoffComplete(b) && safety++ < 10) {
      advanceSingleEliminationRound(b, seedWins);
    }
    const finalMatchup = b.matchups.find(m => m.round === 4)!;
    const finalists = [finalMatchup.team1Tid, finalMatchup.team2Tid].sort((a, b) => a - b);
    expect(finalists).toEqual([1, 2]);
  });

  it('is a no-op once a champion has been crowned', () => {
    const b = generateSingleEliminationBracket(mkTeams(12), 'firstContinent', 2026);
    let safety = 0;
    while (!isPlayoffComplete(b) && safety++ < 10) {
      advanceSingleEliminationRound(b, seedWins);
    }
    const championBefore = b.champion;
    const playedBefore = b.matchups.filter(m => m.played).length;
    advanceSingleEliminationRound(b, seedWins);
    expect(b.champion).toBe(championBefore);
    expect(b.matchups.filter(m => m.played).length).toBe(playedBefore);
  });
});

describe('generateSingleEliminationBracket - boundary sizes', () => {
  it('does not crash when given fewer than 12 teams (degraded but safe)', () => {
    expect(() => generateSingleEliminationBracket(mkTeams(8), 'firstContinent', 2026))
      .not.toThrow();
  });

  it('truncates to top 12 teams when given more', () => {
    const b = generateSingleEliminationBracket(mkTeams(16), 'firstContinent', 2026);
    expect(b.teams.length).toBe(12);
    // Layout invariant: 4 + 4 + 2 + 1 = 11 matchups regardless.
    expect(b.matchups.length).toBe(11);
  });
});
