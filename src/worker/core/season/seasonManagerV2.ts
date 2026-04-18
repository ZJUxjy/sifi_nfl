/**
 * Season Manager V2
 * Supports different league structures per region according to project.md
 *
 * League Structures:
 * - First Continent: 36 teams, closed league, 17 games (NFL-style)
 * - Second Continent: 40 teams, closed league, 17 games (NFL-style)
 * - Mining Island: 4-tier pyramid (20 teams each), 38 games (double round-robin)
 * - Origin Continent: 3 parallel leagues × 12 teams
 *   - Phase 1: 11 games (single round-robin within league)
 *   - Phase 2: Dynamically generated after Phase 1 based on standings
 *     - Championship group (top 4 from each league) plays 8 cross-league games
 *     - Relegation group (bottom 8 from each league) plays cross-league games
 */

import type { Team } from '@common/entities';
import type { Region } from '@common/types';
import type { ScheduleGame, StandingEntry } from '../../api/types';

// Phase constants
export const PHASE = {
  PRESEASON: 1,
  REGULAR_SEASON: 2,
  PLAYOFFS: 3,
  OFFSEASON: 4,
} as const;

// Origin Continent specific phases
export const ORIGIN_PHASE = {
  PHASE1: 'phase1',      // League round-robin
  PHASE2: 'phase2',      // Championship/Relegation groups
  PLAYOFFS: 'playoffs',  // Top 8 double-elimination
} as const;

// Region-specific schedule configuration
const SCHEDULE_CONFIG = {
  firstContinent: {
    type: 'closed',
    games: 17,
  },
  secondContinent: {
    type: 'closed',
    games: 17,
  },
  miningIsland: {
    type: 'pyramid',
    teamsPerLevel: 20,
    games: 38, // Double round-robin: (20-1) * 2 = 38
  },
  originContinent: {
    type: 'parallel',
    leagues: 3,
    teamsPerLeague: 12,
    phase1Games: 11, // Single round-robin within league
    phase2ChampionshipGames: 8, // Cross-league games for championship group
  },
} as const;

// Track Origin Continent league state
interface OriginLeagueState {
  phase: 'phase1' | 'phase2' | 'playoffs';
  leagues: Team[][];  // 3 leagues, each with 12 teams
  championshipGroup: Team[];  // Top 4 from each league (12 teams)
  relegationGroup: Team[];    // Bottom 8 from each league (24 teams)
  phase1Complete: boolean;
}

export class SeasonManager {
  season: number;
  teams: Team[];
  schedule: ScheduleGame[];
  currentWeek: number;
  phase: number;
  private results: Map<number, { won: number; lost: number; tied: number; pts: number; oppPts: number }>;
  private regionMaxWeeks: Map<Region, number>;
  private originContinentState: OriginLeagueState | null;

  constructor(season: number, teams: Team[]) {
    this.season = season;
    this.teams = teams;
    this.schedule = [];
    this.currentWeek = 1;
    this.phase = PHASE.PRESEASON;
    this.results = new Map();
    this.regionMaxWeeks = new Map();
    this.originContinentState = null;
  }

  startRegularSeason(): void {
    this.phase = PHASE.REGULAR_SEASON;
    this.currentWeek = 1;
    this.initializeResults();
    this.generatePhase1Schedules();
  }

  /**
   * Generate Phase 1 schedules for all regions
   * For Origin Continent, only generate the 11-game league schedule
   */
  private generatePhase1Schedules(): void {
    this.schedule = [];

    // Group teams by region
    const regionTeams = new Map<Region, Team[]>();
    for (const team of this.teams) {
      const region = team.region;
      if (!regionTeams.has(region)) {
        regionTeams.set(region, []);
      }
      regionTeams.get(region)!.push(team);
    }

    let gid = 1;

    for (const [region, teams] of regionTeams.entries()) {
      let regionSchedule: { games: ScheduleGame[]; nextGid: number };

      switch (region) {
        case 'firstContinent':
        case 'secondContinent':
          regionSchedule = this.generateClosedLeagueSchedule(teams, region, gid);
          break;
        case 'miningIsland':
          regionSchedule = this.generatePyramidSchedule(teams, region, gid);
          break;
        case 'originContinent':
          regionSchedule = this.generateOriginPhase1Schedule(teams, gid);
          break;
        default:
          regionSchedule = this.generateClosedLeagueSchedule(teams, region as Region, gid);
      }

      this.schedule.push(...regionSchedule.games);
      gid = regionSchedule.nextGid;
    }
  }

  /**
   * Generate schedule for closed leagues (First/Second Continent)
   * NFL-style: 17 games per team
   */
  private generateClosedLeagueSchedule(
    teams: Team[],
    region: Region,
    startGid: number
  ): { games: ScheduleGame[]; nextGid: number } {
    const games: ScheduleGame[] = [];
    let gid = startGid;
    const numWeeks = SCHEDULE_CONFIG.firstContinent.games;

    const matchups = this.generateRoundRobinMatchups(teams);

    for (let week = 1; week <= numWeeks; week++) {
      const weekMatchups = matchups[week - 1] || [];

      for (const [home, away] of weekMatchups) {
        games.push({
          gid: gid++,
          season: this.season,
          day: week,
          homeTid: home.tid,
          awayTid: away.tid,
          phase: 'regular',
        });
      }
    }

    this.regionMaxWeeks.set(region, numWeeks);
    return { games, nextGid: gid };
  }

  /**
   * Generate schedule for pyramid leagues (Mining Island)
   * Double round-robin: 38 games (play each team home and away)
   */
  private generatePyramidSchedule(
    teams: Team[],
    region: Region,
    startGid: number
  ): { games: ScheduleGame[]; nextGid: number } {
    const games: ScheduleGame[] = [];
    let gid = startGid;
    const teamsPerLevel = SCHEDULE_CONFIG.miningIsland.teamsPerLevel;

    // Group teams by their explicit `tier` field. The previous
    // `Math.floor(idx / teamsPerLevel)` tiering depended on the input
    // array being already sorted by level, which silently broke as
    // soon as anything (tests, save/load, sort) reshuffled the list.
    const tierMap = new Map<number, Team[]>();
    for (const t of teams) {
      const tier = t.tier ?? Math.floor((teams.indexOf(t)) / teamsPerLevel) + 1;
      const arr = tierMap.get(tier) ?? [];
      arr.push(t);
      tierMap.set(tier, arr);
    }
    const levels: Team[][] = [...tierMap.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([, teamsAtTier]) => teamsAtTier);

    if (levels.length === 0) {
      levels.push(teams);
    }

    let week = 1;

    for (const levelTeams of levels) {
      // First half of season
      const firstHalfMatchups = this.generateRoundRobinMatchups(levelTeams);
      for (const weekMatchups of firstHalfMatchups) {
        for (const [home, away] of weekMatchups) {
          games.push({
            gid: gid++,
            season: this.season,
            day: week,
            homeTid: home.tid,
            awayTid: away.tid,
            phase: 'regular',
            league: `level${levels.indexOf(levelTeams) + 1}`,
          });
        }
        week++;
      }

      // Second half (reverse fixtures)
      const secondHalfMatchups = this.generateRoundRobinMatchups(levelTeams);
      for (const weekMatchups of secondHalfMatchups) {
        for (const [home, away] of weekMatchups) {
          games.push({
            gid: gid++,
            season: this.season,
            day: week,
            homeTid: away.tid,
            awayTid: home.tid,
            phase: 'regular',
            league: `level${levels.indexOf(levelTeams) + 1}`,
          });
        }
        week++;
      }
    }

    this.regionMaxWeeks.set(region, week - 1);
    return { games, nextGid: gid };
  }

  /**
   * Generate Phase 1 schedule for Origin Continent
   * Only 11 games - single round-robin within each of 3 leagues
   */
  private generateOriginPhase1Schedule(
    teams: Team[],
    startGid: number
  ): { games: ScheduleGame[]; nextGid: number } {
    const games: ScheduleGame[] = [];
    let gid = startGid;
    const config = SCHEDULE_CONFIG.originContinent;

    // Initialize Origin Continent state
    const leagues: Team[][] = [[], [], []];

    // Group by team.leagueIndex (Metropolis=0, Imperial=1, Royal=2).
    // The previous `did % 3` formula was wrong: generateRegionTeams
    // sets `did = leagueIndex * 3 + ...`, so Metropolis teams have
    // dids {0,1,2}, Imperial teams have dids {3,4,5}, etc. - all
    // three buckets ended up mixing teams from every league.
    for (const team of teams) {
      const idx = team.leagueIndex ?? team.did % 3;
      if (idx >= 0 && idx < leagues.length) {
        leagues[idx].push(team);
      }
    }

    // Fallback if leagues are empty (e.g. legacy saves with no
    // leagueIndex on the teams) - distribute by team order.
    for (let i = 0; i < leagues.length; i++) {
      if (leagues[i].length === 0) {
        leagues[i] = teams.filter((_, idx) => idx % 3 === i);
      }
    }

    this.originContinentState = {
      phase: ORIGIN_PHASE.PHASE1,
      leagues,
      championshipGroup: [],
      relegationGroup: [],
      phase1Complete: false,
    };

    // Generate Phase 1 matchups (11 games per team)
    let week = 1;
    const phase1Matchups: Map<number, [Team, Team][]> = new Map();

    for (let leagueIdx = 0; leagueIdx < leagues.length; leagueIdx++) {
      const leagueTeams = leagues[leagueIdx];
      if (leagueTeams.length === 0) continue;

      const leagueMatchups = this.generateRoundRobinMatchups(leagueTeams);

      for (let w = 0; w < leagueMatchups.length; w++) {
        if (!phase1Matchups.has(w + 1)) {
          phase1Matchups.set(w + 1, []);
        }
        for (const [home, away] of leagueMatchups[w]) {
          phase1Matchups.get(w + 1)!.push([home, away]);
        }
      }
    }

    // Schedule Phase 1 games
    const phase1Weeks = config.phase1Games;
    for (let w = 1; w <= phase1Weeks; w++) {
      const weekMatchups = phase1Matchups.get(w) || [];
      for (const [home, away] of weekMatchups) {
        games.push({
          gid: gid++,
          season: this.season,
          day: week,
          homeTid: home.tid,
          awayTid: away.tid,
          phase: 'phase1',
        });
      }
      week++;
    }

    this.regionMaxWeeks.set('originContinent', phase1Weeks);
    return { games, nextGid: gid };
  }

  /**
   * Generate Phase 2 schedule for Origin Continent after Phase 1 completes
   * Championship group: Top 4 from each league play 8 cross-league games
   * Relegation group: Bottom 8 from each league play cross-league games
   */
  private generateOriginPhase2Schedule(startGid: number): { games: ScheduleGame[]; nextGid: number } {
    const games: ScheduleGame[] = [];
    let gid = startGid;
    const config = SCHEDULE_CONFIG.originContinent;

    if (!this.originContinentState) {
      return { games, nextGid: gid };
    }

    const { leagues } = this.originContinentState;

    // Get standings for each league to determine groups
    const championshipGroup: Team[] = [];
    const relegationGroup: Team[] = [];

    for (const leagueTeams of leagues) {
      // Sort by win percentage
      const leagueStandings = this.getTeamsSortedByRecord(leagueTeams);

      // Top 4 go to championship group
      for (let i = 0; i < Math.min(4, leagueStandings.length); i++) {
        championshipGroup.push(leagueStandings[i]);
      }

      // Bottom 8 go to relegation group
      for (let i = 4; i < leagueStandings.length; i++) {
        relegationGroup.push(leagueStandings[i]);
      }
    }

    this.originContinentState.championshipGroup = championshipGroup;
    this.originContinentState.relegationGroup = relegationGroup;
    this.originContinentState.phase = ORIGIN_PHASE.PHASE2;

    // Get current max week to continue from
    const currentMaxWeek = this.regionMaxWeeks.get('originContinent') || 11;
    let week = currentMaxWeek + 1;

    // Generate championship group cross-league games
    const championshipMatchups = this.generateCrossLeagueMatchupsForTeams(
      championshipGroup,
      config.phase2ChampionshipGames
    );

    for (let w = 0; w < championshipMatchups.length; w++) {
      const weekMatchups = championshipMatchups[w];
      for (const [home, away] of weekMatchups) {
        games.push({
          gid: gid++,
          season: this.season,
          day: week,
          homeTid: home.tid,
          awayTid: away.tid,
          phase: 'phase2-championship',
        });
      }
      week++;
    }

    // Generate relegation group cross-league games
    const relegationMatchups = this.generateCrossLeagueMatchupsForTeams(
      relegationGroup,
      config.phase2ChampionshipGames
    );

    for (let w = 0; w < relegationMatchups.length; w++) {
      const weekMatchups = relegationMatchups[w];
      for (const [home, away] of weekMatchups) {
        games.push({
          gid: gid++,
          season: this.season,
          day: week,
          homeTid: home.tid,
          awayTid: away.tid,
          phase: 'phase2-relegation',
        });
      }
      week++;
    }

    this.regionMaxWeeks.set('originContinent', week - 1);
    return { games, nextGid: gid };
  }

  /**
   * Sort teams by their win record
   */
  private getTeamsSortedByRecord(teams: Team[]): Team[] {
    return [...teams].sort((a, b) => {
      const recordA = this.results.get(a.tid);
      const recordB = this.results.get(b.tid);

      if (!recordA || !recordB) return 0;

      const winPctA = recordA.won / (recordA.won + recordA.lost || 1);
      const winPctB = recordB.won / (recordB.won + recordB.lost || 1);

      if (winPctA !== winPctB) {
        return winPctB - winPctA;
      }

      // Tiebreaker: points scored
      return recordB.pts - recordA.pts;
    });
  }

  /**
   * Generate cross-league matchups for a set of teams
   */
  private generateCrossLeagueMatchupsForTeams(
    teams: Team[],
    numWeeks: number
  ): [Team, Team][][] {
    const matchups: [Team, Team][][] = [];

    // Group teams by their original league (using did % 3)
    const teamsByLeague: Map<number, Team[]> = new Map();
    for (const team of teams) {
      const leagueIdx = team.did % 3;
      if (!teamsByLeague.has(leagueIdx)) {
        teamsByLeague.set(leagueIdx, []);
      }
      teamsByLeague.get(leagueIdx)!.push(team);
    }

    // Collect cross-league pairings (teams from different leagues)
    const allPairings: [Team, Team][] = [];
    const leagueIndices = Array.from(teamsByLeague.keys());

    for (let i = 0; i < leagueIndices.length; i++) {
      for (let j = i + 1; j < leagueIndices.length; j++) {
        const league1Teams = teamsByLeague.get(leagueIndices[i]) || [];
        const league2Teams = teamsByLeague.get(leagueIndices[j]) || [];

        for (const teamA of league1Teams) {
          for (const teamB of league2Teams) {
            allPairings.push([teamA, teamB]);
            allPairings.push([teamB, teamA]);
          }
        }
      }
    }

    // Shuffle pairings
    const shuffled = allPairings.sort(() => Math.random() - 0.5);

    // Distribute across weeks
    const gamesPerWeek = Math.ceil(shuffled.length / numWeeks);
    for (let week = 0; week < numWeeks; week++) {
      matchups.push([]);
      const start = week * gamesPerWeek;
      const end = Math.min(start + gamesPerWeek, shuffled.length);

      for (let i = start; i < end; i++) {
        if (shuffled[i]) {
          matchups[week].push(shuffled[i]);
        }
      }
    }

    return matchups;
  }

  /**
   * Generate round-robin matchups for a set of teams
   */
  private generateRoundRobinMatchups(teams: Team[]): [Team, Team][][] {
    if (teams.length < 2) return [];

    const n = teams.length;
    const weeks: [Team, Team][][] = [];

    const teamsArray = [...teams];
    const hasBye = n % 2 !== 0;
    if (hasBye) {
      teamsArray.push({ tid: -1 } as Team);
    }

    const numTeams = teamsArray.length;
    const numWeeks = numTeams - 1;
    const matchesPerWeek = numTeams / 2;

    const circleTeams = [...teamsArray];
    const fixed = circleTeams[0];
    const rotating = circleTeams.slice(1);

    for (let week = 0; week < numWeeks; week++) {
      weeks.push([]);

      const opponent = rotating[(numWeeks - week) % rotating.length];
      if (fixed && opponent && fixed.tid !== -1 && opponent.tid !== -1) {
        const isHome = week % 2 === 0;
        weeks[week].push(isHome ? [fixed, opponent] : [opponent, fixed]);
      }

      for (let i = 1; i < matchesPerWeek; i++) {
        const idx1 = (week + i) % rotating.length;
        const idx2 = (week + numWeeks - i) % rotating.length;
        const team1 = rotating[idx1];
        const team2 = rotating[idx2];

        if (team1 && team2 && team1.tid !== -1 && team2.tid !== -1) {
          const isHome = (week + i) % 2 === 0;
          weeks[week].push(isHome ? [team1, team2] : [team2, team1]);
        }
      }
    }

    return weeks;
  }

  private initializeResults(): void {
    this.results.clear();
    for (const team of this.teams) {
      this.results.set(team.tid, { won: 0, lost: 0, tied: 0, pts: 0, oppPts: 0 });
    }
  }

  /**
   * Check if Origin Continent Phase 1 is complete
   */
  private isOriginPhase1Complete(): boolean {
    if (!this.originContinentState || this.originContinentState.phase1Complete) {
      return false;
    }

    const phase1Games = this.schedule.filter(g => g.phase === 'phase1');
    return phase1Games.every(g => g.played);
  }

  /**
   * Simulate one week of games
   */
  simWeek(): ScheduleGame[] {
    // Check if Origin Continent Phase 1 just completed
    if (this.isOriginPhase1Complete() && this.originContinentState) {
      // Generate Phase 2 schedule
      this.originContinentState.phase1Complete = true;
      const phase2Schedule = this.generateOriginPhase2Schedule(
        Math.max(...this.schedule.map(g => g.gid), 0) + 1
      );
      this.schedule.push(...phase2Schedule.games);
    }

    const maxWeeks = Math.max(...Array.from(this.regionMaxWeeks.values()).filter(w => w > 0), 17);

    if (this.currentWeek > maxWeeks) return [];

    const weekGames = this.schedule.filter(g => g.day === this.currentWeek && !g.played);

    for (const game of weekGames) {
      const homeTeam = this.teams.find(t => t.tid === game.homeTid);
      const awayTeam = this.teams.find(t => t.tid === game.awayTid);

      if (!homeTeam || !awayTeam) continue;

      const homeStrength = this.getTeamStrength(homeTeam);
      const awayStrength = this.getTeamStrength(awayTeam);

      const homeRoll = Math.random() * homeStrength;
      const awayRoll = Math.random() * awayStrength;

      const homeScore = Math.floor(10 + homeRoll + Math.random() * 20);
      const awayScore = Math.floor(10 + awayRoll + Math.random() * 20);

      const winner = homeScore > awayScore ? game.homeTid : game.awayTid;
      const loser = homeScore > awayScore ? game.awayTid : game.homeTid;

      const winnerResult = this.results.get(winner);
      const loserResult = this.results.get(loser);

      if (winnerResult && loserResult) {
        winnerResult.won++;
        winnerResult.pts += Math.max(homeScore, awayScore);
        winnerResult.oppPts += Math.min(homeScore, awayScore);

        loserResult.lost++;
        loserResult.pts += Math.min(homeScore, awayScore);
        loserResult.oppPts += Math.max(homeScore, awayScore);
      }

      game.won = { tid: winner, pts: Math.max(homeScore, awayScore) };
      game.lost = { tid: loser, pts: Math.min(homeScore, awayScore) };
      game.played = true;
    }

    this.currentWeek++;
    if (this.currentWeek > maxWeeks) {
      this.phase = PHASE.PLAYOFFS;
    }

    return weekGames;
  }

  private getTeamStrength(team: Team): number {
    const budgetFactor = team.budget / 300000;
    const baseStrength = 50;
    return baseStrength + budgetFactor * 50;
  }

  getStandings(): StandingEntry[] {
    const standings: StandingEntry[] = [];

    for (const team of this.teams) {
      const result = this.results.get(team.tid);
      if (result) {
        const totalGames = result.won + result.lost + result.tied;
        standings.push({
          tid: team.tid,
          region: team.region,
          cid: team.cid,
          did: team.did,
          won: result.won,
          lost: result.lost,
          tied: result.tied,
          pts: result.pts,
          oppPts: result.oppPts,
          winPct: totalGames > 0 ? (result.won + 0.5 * result.tied) / totalGames : 0,
        });
      }
    }

    standings.sort((a, b) => {
      if (a.winPct !== b.winPct) return b.winPct - a.winPct;
      return b.pts - a.pts;
    });

    return standings;
  }

  getRegionSchedule(region: string): ScheduleGame[] {
    const regionTeams = this.teams.filter(t => t.region === region);
    const regionTids = new Set(regionTeams.map(t => t.tid));

    return this.schedule.filter(g =>
      regionTids.has(g.homeTid) || regionTids.has(g.awayTid)
    );
  }

  getRegionStandings(region: string): StandingEntry[] {
    return this.getStandings().filter(s => s.region === region);
  }

  getTeamRecord(tid: number): StandingEntry | undefined {
    return this.getStandings().find(s => s.tid === tid);
  }

  isRegionInSeason(region: string): boolean {
    return this.phase === PHASE.REGULAR_SEASON;
  }

  /**
   * Get the current phase for Origin Continent
   */
  getOriginContinentPhase(): string {
    return this.originContinentState?.phase || 'phase1';
  }

  /**
   * Get Origin Continent championship group (after Phase 1)
   */
  getOriginChampionshipGroup(): Team[] {
    return this.originContinentState?.championshipGroup || [];
  }

  /**
   * Get Origin Continent relegation group (after Phase 1)
   */
  getOriginRelegationGroup(): Team[] {
    return this.originContinentState?.relegationGroup || [];
  }

  /**
   * Get the maximum weeks for a region
   */
  getMaxWeeksForRegion(region: Region): number {
    return this.regionMaxWeeks.get(region) || 17;
  }

  /**
   * Get schedule configuration for a region
   */
  getScheduleConfig(region: Region): typeof SCHEDULE_CONFIG[keyof typeof SCHEDULE_CONFIG] | undefined {
    switch (region) {
      case 'firstContinent':
        return SCHEDULE_CONFIG.firstContinent;
      case 'secondContinent':
        return SCHEDULE_CONFIG.secondContinent;
      case 'miningIsland':
        return SCHEDULE_CONFIG.miningIsland;
      case 'originContinent':
        return SCHEDULE_CONFIG.originContinent;
      default:
        return undefined;
    }
  }
}
