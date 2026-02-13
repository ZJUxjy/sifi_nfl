import type { Team, ScheduleGame } from '../../../common/entities';
import type { Region } from '../../../common/types';
import { OriginContinentSeason, ORIGIN_LEAGUES, type OriginLeague } from './originContinent';
import { MiningIslandSeason, MINING_LEAGUES, type MiningLeague } from './miningIsland';

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

export type RegionSeasonState = {
  region: Region;
  phase: UnifiedSeasonPhase;
  schedule: ScheduleGame[];
  completedGames: ScheduleGame[];
  currentWeek: number;
  originSeason?: OriginContinentSeason;
  miningSeason?: MiningIslandSeason;
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
      };
      
      if (config.type === 'origin') {
        state.originSeason = new OriginContinentSeason(this.season, regionTeams);
        state.phase = 'originFirstStage';
      } else if (config.type === 'pyramid') {
        state.miningSeason = new MiningIslandSeason(this.season, regionTeams);
        state.phase = 'miningSeason';
      } else {
        state.phase = 'regularSeason';
      }
      
      this.regionStates.set(region, state);
    }
  }
  
  startSeason(): void {
    this.phase = 'regularSeason';
    
    Array.from(this.regionStates.entries()).forEach(([region, state]) => {
      const regionTeams = this.teams.filter(t => t.region === region);
      const config = REGION_LEAGUE_CONFIG[region];
      
      if (config.type === 'closed') {
        state.schedule = this.generateClosedLeagueSchedule(regionTeams);
        state.phase = 'regularSeason';
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
        }
      }
      
      state.currentWeek++;
    }
    
    return weekGames;
  }
  
  getRegionSchedule(region: Region): ScheduleGame[] {
    const state = this.regionStates.get(region);
    return state?.schedule || [];
  }
  
  getRegionCompletedGames(region: Region): ScheduleGame[] {
    const state = this.regionStates.get(region);
    return state?.completedGames || [];
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
