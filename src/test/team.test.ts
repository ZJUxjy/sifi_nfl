import { describe, it, expect } from 'vitest';
import { 
  generateTeam, 
  generateRegionTeams, 
  generateAllTeams,
  SCI_FI_COLORS 
} from '../worker/core/team/generate';
import { 
  populateDepthChart, 
  getStarters, 
  calculateTeamSalary,
  isRosterFull 
} from '../worker/core/team/roster';
import type { Region } from '../common/types';
import type { Player } from '../common/entities';

describe('Team Generation', () => {
  describe('generateTeam', () => {
    it('should generate a valid team', () => {
      const team = generateTeam(1, 'firstContinent', 0, 0, 'Test Team', 2025);
      
      expect(team.tid).toBe(1);
      expect(team.region).toBe('firstContinent');
      expect(team.name).toBe('Test Team');
      expect(team.abbrev).toBe('TT');
      expect(team.colors).toHaveLength(3);
      expect(SCI_FI_COLORS).toContainEqual(team.colors);
      expect(team.pop).toMatch(/Small|Medium|Large|Huge/);
      expect(team.budget).toBeGreaterThanOrEqual(50_000_000);
      expect(team.cash).toBeGreaterThanOrEqual(1_000_000);
    });

    it('should generate unique abbreviations', () => {
      const team1 = generateTeam(1, 'firstContinent', 0, 0, 'Alpha Beta', 2025);
      const team2 = generateTeam(2, 'firstContinent', 0, 0, 'Gamma Delta', 2025);
      
      expect(team1.abbrev).toBe('AB');
      expect(team2.abbrev).toBe('GD');
    });
  });

  describe('generateRegionTeams', () => {
    it('should generate correct number of teams for First Continent', () => {
      const { teams, players } = generateRegionTeams('firstContinent', 0, 2025);
      expect(teams).toHaveLength(36);
      expect(players.length).toBeGreaterThan(36 * 40);
    });

    it('should generate correct number of teams for Second Continent', () => {
      const { teams, players } = generateRegionTeams('secondContinent', 36, 2025);
      expect(teams).toHaveLength(40);
      expect(players.length).toBeGreaterThan(40 * 40);
    });

    it('should generate correct number of teams for Origin Continent', () => {
      const { teams, players } = generateRegionTeams('originContinent', 76, 2025);
      expect(teams).toHaveLength(36);
    });

    it('should generate correct number of teams for Mining Island', () => {
      const { teams, players } = generateRegionTeams('miningIsland', 112, 2025);
      expect(teams).toHaveLength(58);
    });
  });

  describe('generateAllTeams', () => {
    it('should generate all teams for all regions', () => {
      const { teams, players } = generateAllTeams(2025);

      expect(teams).toHaveLength(170);
      expect(players.length).toBeGreaterThan(170 * 40);
      
      const firstContinentTeams = teams.filter(t => t.region === 'firstContinent');
      const secondContinentTeams = teams.filter(t => t.region === 'secondContinent');
      const originContinentTeams = teams.filter(t => t.region === 'originContinent');
      const miningIslandTeams = teams.filter(t => t.region === 'miningIsland');
      
      expect(firstContinentTeams).toHaveLength(36);
      expect(secondContinentTeams).toHaveLength(40);
      expect(originContinentTeams).toHaveLength(36);
      expect(miningIslandTeams).toHaveLength(58);
    });

    it('should assign unique tids', () => {
      const { teams } = generateAllTeams(2025);
      const tids = teams.map(t => t.tid);
      const uniqueTids = new Set(tids);
      expect(uniqueTids.size).toBe(teams.length);
    });
  });
});

describe('Roster Management', () => {
  describe('populateDepthChart', () => {
    it('should create depth chart for all positions', () => {
      const { teams, players } = generateRegionTeams('firstContinent', 0, 2025);
      const team = teams[0];
      const depth = populateDepthChart(team, players);
      
      expect(depth.QB).toBeDefined();
      expect(depth.RB).toBeDefined();
      expect(depth.WR).toBeDefined();
      expect(depth.TE).toBeDefined();
      expect(depth.OL).toBeDefined();
      expect(depth.DL).toBeDefined();
      expect(depth.LB).toBeDefined();
      expect(depth.CB).toBeDefined();
      expect(depth.S).toBeDefined();
      expect(depth.K).toBeDefined();
    });

    it('should sort players by ovr', () => {
      const { teams, players } = generateRegionTeams('firstContinent', 0, 2025);
      const team = teams[0];
      const depth = populateDepthChart(team, players);
      
      if (depth.QB && depth.QB.length > 1) {
        expect(depth.QB[0].ovr).toBeGreaterThanOrEqual(depth.QB[1].ovr);
      }
    });
  });

  describe('getStarters', () => {
    it('should return starters for all positions', () => {
      const { teams, players } = generateRegionTeams('firstContinent', 0, 2025);
      const team = teams[0];
      const depth = populateDepthChart(team, players);
      const starters = getStarters(depth);
      
      // Should have at least 20 starters (may not have K/P in test data)
      expect(starters.length).toBeGreaterThanOrEqual(20);
      // All starters should have valid OVR
      starters.forEach(s => {
        expect(s.ovr).toBeGreaterThanOrEqual(0);
        expect(s.ovr).toBeLessThanOrEqual(100);
      });
    });

    // Regression guard: rosterSize is randomized, and previously a small rosterSize
    // (40-42) left CB/S/K/P depth empty so getStarters returned 18-19 ~17% of runs.
    it('should always return >=20 starters across many randomized generations', () => {
      for (let run = 0; run < 30; run++) {
        const { teams, players } = generateRegionTeams('firstContinent', 0, 2025);
        for (const team of teams) {
          const depth = populateDepthChart(team, players);
          const starters = getStarters(depth);
          expect(starters.length, `run ${run} tid ${team.tid}`).toBeGreaterThanOrEqual(20);
        }
      }
    });
  });

  describe('calculateTeamSalary', () => {
    it('should calculate total salary correctly', () => {
      const players: Player[] = [
        { tid: 1, contract: { amount: 1000 } } as Player,
        { tid: 1, contract: { amount: 2000 } } as Player,
        { tid: 2, contract: { amount: 3000 } } as Player,
      ];
      
      const salary = calculateTeamSalary(players, 1);
      expect(salary).toBe(3000);
    });

    it('should handle players without contracts', () => {
      const players: Player[] = [
        { tid: 1, contract: { amount: 1000 } } as Player,
        { tid: 1 } as Player,
      ];
      
      const salary = calculateTeamSalary(players, 1);
      expect(salary).toBe(1000);
    });
  });
});
