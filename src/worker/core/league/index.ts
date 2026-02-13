import type { Team, ScheduleGame } from '../../../common/entities';
import type { Region } from '../../../common/types';
import { 
  OriginContinentSeason, 
  ORIGIN_LEAGUES, 
  type OriginLeague,
  type OriginSeasonPhase,
} from './originContinent';
import { 
  MiningIslandSeason, 
  MINING_LEAGUES, 
  type MiningLeague,
} from './miningIsland';

export type LeagueType = 'closed' | 'pyramid' | 'origin';

export type RegionLeagueInfo = {
  region: Region;
  type: LeagueType;
  leagues?: string[];
  teamsPerLeague?: number;
  levels?: number;
};

export const REGION_LEAGUE_CONFIG: Record<Region, RegionLeagueInfo> = {
  firstContinent: {
    region: 'firstContinent',
    type: 'closed',
    leagues: ['First Continent League'],
    teamsPerLeague: 36,
  },
  secondContinent: {
    region: 'secondContinent',
    type: 'closed',
    leagues: ['Second Continent League'],
    teamsPerLeague: 40,
  },
  originContinent: {
    region: 'originContinent',
    type: 'origin',
    leagues: [ORIGIN_LEAGUES.METROPOLIS, ORIGIN_LEAGUES.IMPERIAL, ORIGIN_LEAGUES.ROYAL],
    teamsPerLeague: 12,
  },
  miningIsland: {
    region: 'miningIsland',
    type: 'pyramid',
    leagues: [MINING_LEAGUES.SUPER_LEAGUE, MINING_LEAGUES.CHAMPIONSHIP, MINING_LEAGUES.A_LEAGUE, MINING_LEAGUES.B_LEAGUE],
    levels: 4,
  },
};

export type UnifiedSeasonPhase = 
  | 'preseason'
  | 'regularSeason'
  | 'originFirstStage'
  | 'originPhase2'
  | 'originPlayoffs'
  | 'miningSeason'
  | 'playoffs'
  | 'imperialCup'
  | 'offseason';

export type StandingsEntry = {
  tid: number;
  region: Region;
  cid: number;
  did: number;
  won: number;
  lost: number;
  tied: number;
  pts: number;
  oppPts: number;
  streak: number;
  league?: string;
  phase?: string;
};

export type RegionSeasonState = {
  region: Region;
  phase: UnifiedSeasonPhase;
  schedule: ScheduleGame[];
  completedGames: ScheduleGame[];
  currentWeek: number;
  originSeason?: OriginContinentSeason;
  miningSeason?: MiningIslandSeason;
  standings: StandingsEntry[];
};

export class UnifiedSeasonManager {
  season: number;
  teams: Team[];
  regionStates: Map<Region, RegionSeasonState>;
  phase: UnifiedSeasonPhase;
  currentWeek: number;
  
  constructor(season: number, teams: Team[]) {
    this.season = season;
    this.teams = teams;
    this.regionStates = new Map();
    this.phase = 'preseason';
    this.currentWeek = 1;
    
    this.initializeRegions();
  }
  
  private initializeRegions(): void {
    const regions: Region[] = ['firstContinent', 'secondContinent', 'originContinent', 'miningIsland'];
    
    for (const region of regions) {
      const regionTeams = this.teams.filter(t => t.region === region);
      const config = REGION_LEAGUE_CONFIG[region];
      
      const state: RegionSeasonState = {
        region,
        phase: 'preseason',
        schedule: [],
        completedGames: [],
        currentWeek: 1,
        standings: [],
      };
      
      if (config.type === 'origin') {
        state.originSeason = new OriginContinentSeason(this.season, regionTeams);
        state.phase = 'originFirstStage';
        state.standings = this.buildOriginStandings(state.originSeason);
      } else if (config.type === 'pyramid') {
        state.miningSeason = new MiningIslandSeason(this.season, regionTeams);
        state.phase = 'miningSeason';
        state.standings = this.buildMiningStandings(state.miningSeason);
      } else {
        state.phase = 'regularSeason';
        state.standings = this.buildClosedLeagueStandings(regionTeams);
      }
      
      this.regionStates.set(region, state);
    }
  }
  
  private buildOriginStandings(originSeason: OriginContinentSeason): StandingsEntry[] {
    const standings: StandingsEntry[] = [];
    const results = originSeason.getResults();
    
    Array.from(originSeason.leagueTeams.entries()).forEach(([league, teams]) => {
      for (const team of teams) {
        const result = results.get(team.tid) || { won: 0, lost: 0, pts: 0, oppPts: 0 };
        standings.push({
          tid: team.tid,
          region: 'originContinent',
          cid: team.cid,
          did: team.did,
          won: result.won,
          lost: result.lost,
          tied: 0,
          pts: result.pts,
          oppPts: result.oppPts,
          streak: 0,
          league,
          phase: originSeason.phase,
        });
      }
    });
    
    return standings.sort((a, b) => {
      if (a.won !== b.won) return b.won - a.won;
      return b.pts - a.pts;
    });
  }
  
  private buildMiningStandings(miningSeason: MiningIslandSeason): StandingsEntry[] {
    const standings: StandingsEntry[] = [];
    
    for (const league of Object.values(MINING_LEAGUES)) {
      const leagueStandings = miningSeason.getLeagueStandings(league);
      const teams = miningSeason.structure[league as keyof typeof miningSeason.structure];
      
      for (const standing of leagueStandings) {
        const team = teams.find((t: Team) => t.tid === standing.tid);
        if (team) {
          standings.push({
            tid: standing.tid,
            region: 'miningIsland',
            cid: team.cid,
            did: team.did,
            won: standing.won,
            lost: standing.lost,
            tied: standing.tied,
            pts: standing.pts,
            oppPts: standing.oppPts,
            streak: 0,
            league,
          });
        }
      }
    }
    
    return standings;
  }
  
  private buildClosedLeagueStandings(teams: Team[]): StandingsEntry[] {
    return teams.map(team => ({
      tid: team.tid,
      region: team.region,
      cid: team.cid,
      did: team.did,
      won: 0,
      lost: 0,
      tied: 0,
      pts: 0,
      oppPts: 0,
      streak: 0,
    }));
  }
  
  startSeason(): void {
    this.phase = 'regularSeason';
    
    Array.from(this.regionStates.entries()).forEach(([region, state]) => {
      const regionTeams = this.teams.filter(t => t.region === region);
      const config = REGION_LEAGUE_CONFIG[region];
      
      if (config.type === 'closed') {
        state.schedule = this.generateClosedLeagueSchedule(regionTeams);
        state.phase = 'regularSeason';
      } else if (config.type === 'origin') {
        const originSeason = state.originSeason;
        if (originSeason) {
          state.schedule = originSeason.firstStageSchedule;
          state.phase = 'originFirstStage';
        }
      } else if (config.type === 'pyramid') {
        state.schedule = this.generateMiningSchedule(state.miningSeason!);
        state.phase = 'miningSeason';
      }
    });
  }
  
  private generateClosedLeagueSchedule(regionTeams: Team[]): ScheduleGame[] {
    const schedule: ScheduleGame[] = [];
    const numGames = 17;
    let gid = 1;
    
    const teamSchedules = new Map<number, number[]>();
    for (const team of regionTeams) {
      teamSchedules.set(team.tid, []);
    }
    
    for (const team of regionTeams) {
      const opponents = teamSchedules.get(team.tid)!;
      const neededGames = numGames - opponents.length;
      
      if (neededGames <= 0) continue;
      
      const availableOpponents = regionTeams
        .filter(t => t.tid !== team.tid)
        .filter(t => {
          const theirSchedule = teamSchedules.get(t.tid)!;
          return theirSchedule.length < numGames;
        });
      
      for (let i = 0; i < neededGames && i < availableOpponents.length; i++) {
        const opponent = availableOpponents[i];
        
        const isHome = Math.random() < 0.5;
        const homeTid = isHome ? team.tid : opponent.tid;
        const awayTid = isHome ? opponent.tid : team.tid;
        
        schedule.push({
          gid: gid++,
          season: this.season,
          day: Math.floor(Math.random() * 17) + 1,
          homeTid,
          awayTid,
        });
        
        teamSchedules.get(team.tid)!.push(opponent.tid);
        teamSchedules.get(opponent.tid)!.push(team.tid);
      }
    }
    
    return schedule.sort((a, b) => a.day - b.day);
  }
  
  private generateMiningSchedule(miningSeason: MiningIslandSeason): ScheduleGame[] {
    const schedule: ScheduleGame[] = [];
    let gid = 1;
    let day = 1;
    
    for (const league of Object.values(MINING_LEAGUES)) {
      const teams = miningSeason.structure[league as keyof typeof miningSeason.structure] as Team[];
      const numTeams = teams.length;
      
      if (numTeams < 2) continue;
      
      const gamesPerTeam = Math.min(numTeams - 1, 17);
      
      for (let i = 0; i < numTeams; i++) {
        for (let j = i + 1; j < numTeams && j <= i + gamesPerTeam / 2; j++) {
          const isHome = Math.random() < 0.5;
          schedule.push({
            gid: gid++,
            season: this.season,
            day: ((day - 1) % 17) + 1,
            homeTid: isHome ? teams[i].tid : teams[j].tid,
            awayTid: isHome ? teams[j].tid : teams[i].tid,
            league,
          });
          day++;
        }
      }
    }
    
    return schedule.sort((a, b) => a.day - b.day);
  }
  
  simWeek(region?: Region): ScheduleGame[] {
    const completedGames: ScheduleGame[] = [];
    
    if (region) {
      const state = this.regionStates.get(region);
      if (!state) return [];
      return this.simRegionWeek(region, state);
    }
    
    Array.from(this.regionStates.entries()).forEach(([reg, state]) => {
      const games = this.simRegionWeek(reg, state);
      completedGames.push(...games);
    });
    
    this.currentWeek++;
    return completedGames;
  }
  
  private simRegionWeek(region: Region, state: RegionSeasonState): ScheduleGame[] {
    const weekGames: ScheduleGame[] = [];
    const config = REGION_LEAGUE_CONFIG[region];
    
    if (config.type === 'origin') {
      return this.simOriginWeek(state);
    } else if (config.type === 'pyramid') {
      return this.simMiningWeek(state);
    }
    
    if (state.phase === 'regularSeason') {
      const regionWeekGames = state.schedule.filter(g => g.day === state.currentWeek);
      
      for (const game of regionWeekGames) {
        if (!game.won) {
          const homeScore = Math.floor(Math.random() * 35) + 7;
          const awayScore = Math.floor(Math.random() * 35) + 7;
          
          game.won = { tid: homeScore > awayScore ? game.homeTid : game.awayTid, pts: Math.max(homeScore, awayScore) };
          game.lost = { tid: homeScore > awayScore ? game.awayTid : game.homeTid, pts: Math.min(homeScore, awayScore) };
          
          state.completedGames.push(game);
          weekGames.push(game);
          
          this.updateClosedLeagueStandings(state, game);
        }
      }
      
      state.currentWeek++;
      
      const maxWeek = Math.max(...state.schedule.map(g => g.day), 17);
      if (state.currentWeek > maxWeek) {
        state.phase = 'playoffs';
      }
    }
    
    return weekGames;
  }
  
  private simOriginWeek(state: RegionSeasonState): ScheduleGame[] {
    const weekGames: ScheduleGame[] = [];
    const originSeason = state.originSeason;
    if (!originSeason) return [];
    
    if (originSeason.phase === 'firstStage') {
      const firstStageGames = originSeason.firstStageSchedule.filter(g => g.day === state.currentWeek && !g.won);
      
      for (const game of firstStageGames) {
        const homeScore = Math.floor(Math.random() * 35) + 7;
        const awayScore = Math.floor(Math.random() * 35) + 7;
        
        game.won = { tid: homeScore > awayScore ? game.homeTid : game.awayTid, pts: Math.max(homeScore, awayScore) };
        game.lost = { tid: homeScore > awayScore ? game.awayTid : game.homeTid, pts: Math.min(homeScore, awayScore) };
        
        originSeason.recordFirstStageResult(game, homeScore, awayScore);
        state.completedGames.push(game);
        weekGames.push(game);
      }
      
      state.currentWeek++;
      state.standings = this.buildOriginStandings(originSeason);
      
      const allFirstStageComplete = originSeason.firstStageSchedule.every(g => g.won);
      if (allFirstStageComplete && originSeason.phase === 'firstStage') {
        originSeason.advanceToPhase2();
        state.schedule = [...originSeason.firstStageSchedule, ...originSeason.championshipGroupSchedule, ...originSeason.relegationGroupSchedule];
        state.phase = 'originPhase2';
        state.currentWeek = 1;
      }
    } else if (originSeason.phase === 'championshipGroup' || originSeason.phase === 'relegationGroup') {
      const phase2Games = [...originSeason.championshipGroupSchedule, ...originSeason.relegationGroupSchedule]
        .filter(g => g.day === state.currentWeek && !g.won);
      
      for (const game of phase2Games) {
        const homeScore = Math.floor(Math.random() * 35) + 7;
        const awayScore = Math.floor(Math.random() * 35) + 7;
        
        game.won = { tid: homeScore > awayScore ? game.homeTid : game.awayTid, pts: Math.max(homeScore, awayScore) };
        game.lost = { tid: homeScore > awayScore ? game.awayTid : game.homeTid, pts: Math.min(homeScore, awayScore) };
        
        originSeason.recordChampionshipResult(game, homeScore, awayScore);
        state.completedGames.push(game);
        weekGames.push(game);
      }
      
      state.currentWeek++;
      state.standings = this.buildOriginStandings(originSeason);
      
      const allPhase2Complete = [...originSeason.championshipGroupSchedule, ...originSeason.relegationGroupSchedule].every(g => g.won);
      if (allPhase2Complete) {
        originSeason.advanceToPlayoffs();
        state.phase = 'originPlayoffs';
      }
    }
    
    return weekGames;
  }
  
  private simMiningWeek(state: RegionSeasonState): ScheduleGame[] {
    const weekGames: ScheduleGame[] = [];
    const miningSeason = state.miningSeason;
    if (!miningSeason) return [];
    
    const weekGamesList = state.schedule.filter(g => g.day === state.currentWeek && !g.won);
    
    for (const game of weekGamesList) {
      const homeScore = Math.floor(Math.random() * 35) + 7;
      const awayScore = Math.floor(Math.random() * 35) + 7;
      
      game.won = { tid: homeScore > awayScore ? game.homeTid : game.awayTid, pts: Math.max(homeScore, awayScore) };
      game.lost = { tid: homeScore > awayScore ? game.awayTid : game.homeTid, pts: Math.min(homeScore, awayScore) };
      
      const league = game.league as MiningLeague;
      if (league) {
        const homeWon = homeScore > awayScore;
        miningSeason.recordResult(league, game.homeTid, homeWon, homeScore, awayScore);
        miningSeason.recordResult(league, game.awayTid, !homeWon, awayScore, homeScore);
      }
      
      state.completedGames.push(game);
      weekGames.push(game);
    }
    
    state.currentWeek++;
    state.standings = this.buildMiningStandings(miningSeason);
    
    return weekGames;
  }
  
  private updateClosedLeagueStandings(state: RegionSeasonState, game: ScheduleGame): void {
    if (!game.won || !game.lost) return;
    
    const winnerStanding = state.standings.find(s => s.tid === game.won!.tid);
    const loserStanding = state.standings.find(s => s.tid === game.lost!.tid);
    
    if (winnerStanding) {
      winnerStanding.won++;
      winnerStanding.pts += game.won.pts;
      winnerStanding.oppPts += game.lost.pts;
      winnerStanding.streak = winnerStanding.streak > 0 ? winnerStanding.streak + 1 : 1;
    }
    
    if (loserStanding) {
      loserStanding.lost++;
      loserStanding.pts += game.lost.pts;
      loserStanding.oppPts += game.won.pts;
      loserStanding.streak = loserStanding.streak < 0 ? loserStanding.streak - 1 : -1;
    }
  }
  
  getRegionSchedule(region: Region): ScheduleGame[] {
    const state = this.regionStates.get(region);
    return state?.schedule || [];
  }
  
  getRegionCompletedGames(region: Region): ScheduleGame[] {
    const state = this.regionStates.get(region);
    return state?.completedGames || [];
  }
  
  getRegionCurrentWeek(region: Region): number {
    const state = this.regionStates.get(region);
    return state?.currentWeek || 1;
  }
  
  getOriginSeason(region: Region): OriginContinentSeason | undefined {
    const state = this.regionStates.get(region);
    return state?.originSeason;
  }
  
  getMiningSeason(region: Region): MiningIslandSeason | undefined {
    const state = this.regionStates.get(region);
    return state?.miningSeason;
  }
  
  getRegionPhase(region: Region): UnifiedSeasonPhase {
    const state = this.regionStates.get(region);
    return state?.phase || 'preseason';
  }
  
  getLeagueInfo(region: Region): RegionLeagueInfo {
    return REGION_LEAGUE_CONFIG[region];
  }
  
  isRegionInSeason(region: Region): boolean {
    const state = this.regionStates.get(region);
    if (!state) return false;
    
    return ['regularSeason', 'originFirstStage', 'originPhase2', 'originPlayoffs', 'miningSeason'].includes(state.phase);
  }
  
  getRegionStandings(region: Region): StandingsEntry[] {
    const state = this.regionStates.get(region);
    if (!state) return [];
    
    return [...state.standings].sort((a, b) => {
      if (a.won !== b.won) return b.won - a.won;
      if (a.lost !== b.lost) return a.lost - b.lost;
      return b.pts - a.pts;
    });
  }
  
  getAllStandings(): StandingsEntry[] {
    const allStandings: StandingsEntry[] = [];
    Array.from(this.regionStates.values()).forEach(state => {
      allStandings.push(...state.standings);
    });
    return allStandings.sort((a, b) => {
      if (a.won !== b.won) return b.won - a.won;
      if (a.lost !== b.lost) return a.lost - b.lost;
      return b.pts - a.pts;
    });
  }
  
  getTeamRecord(tid: number): StandingsEntry | undefined {
    const states = Array.from(this.regionStates.values());
    for (const state of states) {
      const record = state.standings.find(s => s.tid === tid);
      if (record) return record;
    }
    return undefined;
  }
}

export function formatLeagueName(region: Region, league: string): string {
  if (region === 'originContinent') {
    const info = {
      [ORIGIN_LEAGUES.METROPOLIS]: 'Metropolis League',
      [ORIGIN_LEAGUES.IMPERIAL]: 'Imperial League',
      [ORIGIN_LEAGUES.ROYAL]: 'Royal League',
    };
    return info[league as OriginLeague] || league;
  }
  
  if (region === 'miningIsland') {
    const info = {
      [MINING_LEAGUES.SUPER_LEAGUE]: 'Super League',
      [MINING_LEAGUES.CHAMPIONSHIP]: 'Championship',
      [MINING_LEAGUES.A_LEAGUE]: 'A League',
      [MINING_LEAGUES.B_LEAGUE]: 'B League',
    };
    return info[league as MiningLeague] || league;
  }
  
  return league;
}
