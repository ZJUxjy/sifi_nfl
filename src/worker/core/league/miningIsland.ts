import type { Team } from '../../../common/entities';

export const MINING_LEAGUES = {
  SUPER_LEAGUE: 'superLeague',
  CHAMPIONSHIP: 'championship',
  A_LEAGUE: 'aLeague',
  B_LEAGUE: 'bLeague',
} as const;

export type MiningLeague = typeof MINING_LEAGUES[keyof typeof MINING_LEAGUES];

export const MINING_LEAGUE_INFO: Record<MiningLeague, { name: string; level: number; teams: number }> = {
  superLeague: { name: 'Mining Super League', level: 1, teams: 20 },
  championship: { name: 'Mining Championship', level: 2, teams: 20 },
  aLeague: { name: 'Mining A League', level: 3, teams: 20 },
  bLeague: { name: 'Mining B League', level: 4, teams: 20 },
};

export const PROMOTION_RELEGATION_SPOTS = 3;

export type MiningLeagueStructure = {
  superLeague: Team[];
  championship: Team[];
  aLeague: Team[];
  bLeague: Team[];
};

export type MiningStandings = {
  league: MiningLeague;
  teams: {
    tid: number;
    won: number;
    lost: number;
    tied: number;
    pts: number;
    oppPts: number;
    goalDiff: number;
  }[];
};

export type PromotionRelegationResult = {
  promoted: { from: MiningLeague; to: MiningLeague; teams: number[] }[];
  relegated: { from: MiningLeague; to: MiningLeague; teams: number[] }[];
  playoffWinners: number[];
};

export function assignTeamsToMiningLeagues(teams: Team[]): MiningLeagueStructure {
  const sortedTeams = [...teams].sort((a, b) => {
    const strengthOrder = { elite: 4, strong: 3, average: 2, weak: 1 };
    const aStrength = strengthOrder[a.strength || 'average'] || 2;
    const bStrength = strengthOrder[b.strength || 'average'] || 2;
    return bStrength - aStrength;
  });
  
  const superLeagueCount = MINING_LEAGUE_INFO.superLeague.teams;
  const championshipCount = MINING_LEAGUE_INFO.championship.teams;
  const aLeagueCount = MINING_LEAGUE_INFO.aLeague.teams;
  
  return {
    superLeague: sortedTeams.slice(0, superLeagueCount),
    championship: sortedTeams.slice(superLeagueCount, superLeagueCount + championshipCount),
    aLeague: sortedTeams.slice(superLeagueCount + championshipCount, superLeagueCount + championshipCount + aLeagueCount),
    bLeague: sortedTeams.slice(superLeagueCount + championshipCount + aLeagueCount),
  };
}

export function getTeamLeague(structure: MiningLeagueStructure, tid: number): MiningLeague | null {
  for (const [league, teams] of Object.entries(structure)) {
    if (teams.some(t => t.tid === tid)) {
      return league as MiningLeague;
    }
  }
  return null;
}

export function getLeagueTeams(structure: MiningLeagueStructure, league: MiningLeague): Team[] {
  return structure[league] || [];
}

export function calculatePromotionRelegation(
  standings: Map<MiningLeague, MiningStandings['teams']>
): PromotionRelegationResult {
  const result: PromotionRelegationResult = {
    promoted: [],
    relegated: [],
    playoffWinners: [],
  };
  
  const superLeagueTeams = standings.get(MINING_LEAGUES.SUPER_LEAGUE) || [];
  const championshipTeams = standings.get(MINING_LEAGUES.CHAMPIONSHIP) || [];
  const aLeagueTeams = standings.get(MINING_LEAGUES.A_LEAGUE) || [];
  const bLeagueTeams = standings.get(MINING_LEAGUES.B_LEAGUE) || [];
  
  const sortedSuperLeague = [...superLeagueTeams].sort((a, b) => {
    if (a.won !== b.won) return b.won - a.won;
    return b.goalDiff - a.goalDiff;
  });
  
  const sortedChampionship = [...championshipTeams].sort((a, b) => {
    if (a.won !== b.won) return b.won - a.won;
    return b.goalDiff - a.goalDiff;
  });
  
  const sortedALeague = [...aLeagueTeams].sort((a, b) => {
    if (a.won !== b.won) return b.won - a.won;
    return b.goalDiff - a.goalDiff;
  });
  
  const sortedBLeague = [...bLeagueTeams].sort((a, b) => {
    if (a.won !== b.won) return b.won - a.won;
    return b.goalDiff - a.goalDiff;
  });
  
  result.relegated.push({
    from: MINING_LEAGUES.SUPER_LEAGUE,
    to: MINING_LEAGUES.CHAMPIONSHIP,
    teams: sortedSuperLeague.slice(-PROMOTION_RELEGATION_SPOTS).map(t => t.tid),
  });
  
  result.promoted.push({
    from: MINING_LEAGUES.CHAMPIONSHIP,
    to: MINING_LEAGUES.SUPER_LEAGUE,
    teams: sortedChampionship.slice(0, PROMOTION_RELEGATION_SPOTS).map(t => t.tid),
  });
  
  result.relegated.push({
    from: MINING_LEAGUES.CHAMPIONSHIP,
    to: MINING_LEAGUES.A_LEAGUE,
    teams: sortedChampionship.slice(-PROMOTION_RELEGATION_SPOTS).map(t => t.tid),
  });
  
  result.promoted.push({
    from: MINING_LEAGUES.A_LEAGUE,
    to: MINING_LEAGUES.CHAMPIONSHIP,
    teams: sortedALeague.slice(0, PROMOTION_RELEGATION_SPOTS).map(t => t.tid),
  });
  
  result.relegated.push({
    from: MINING_LEAGUES.A_LEAGUE,
    to: MINING_LEAGUES.B_LEAGUE,
    teams: sortedALeague.slice(-PROMOTION_RELEGATION_SPOTS).map(t => t.tid),
  });
  
  result.promoted.push({
    from: MINING_LEAGUES.B_LEAGUE,
    to: MINING_LEAGUES.A_LEAGUE,
    teams: sortedBLeague.slice(0, PROMOTION_RELEGATION_SPOTS).map(t => t.tid),
  });
  
  return result;
}

export function applyPromotionRelegation(
  structure: MiningLeagueStructure,
  result: PromotionRelegationResult
): MiningLeagueStructure {
  const newStructure: MiningLeagueStructure = {
    superLeague: [...structure.superLeague],
    championship: [...structure.championship],
    aLeague: [...structure.aLeague],
    bLeague: [...structure.bLeague],
  };
  
  for (const rel of result.relegated) {
    const fromLeague = rel.from as keyof MiningLeagueStructure;
    const toLeague = rel.to as keyof MiningLeagueStructure;
    
    for (const tid of rel.teams) {
      const teamIndex = newStructure[fromLeague].findIndex(t => t.tid === tid);
      if (teamIndex !== -1) {
        const team = newStructure[fromLeague].splice(teamIndex, 1)[0];
        if (team) {
          newStructure[toLeague].push(team);
        }
      }
    }
  }
  
  for (const prom of result.promoted) {
    const fromLeague = prom.from as keyof MiningLeagueStructure;
    const toLeague = prom.to as keyof MiningLeagueStructure;
    
    for (const tid of prom.teams) {
      const alreadyMoved = result.relegated.some(
        r => r.from === fromLeague && r.teams.includes(tid)
      );
      
      if (!alreadyMoved) {
        const teamIndex = newStructure[fromLeague].findIndex(t => t.tid === tid);
        if (teamIndex !== -1) {
          const team = newStructure[fromLeague].splice(teamIndex, 1)[0];
          if (team) {
            newStructure[toLeague].push(team);
          }
        }
      }
    }
  }
  
  return newStructure;
}

export class MiningIslandSeason {
  season: number;
  structure: MiningLeagueStructure;
  standings: Map<MiningLeague, MiningStandings['teams']>;
  
  constructor(season: number, teams: Team[]) {
    this.season = season;
    this.structure = assignTeamsToMiningLeagues(teams);
    this.standings = new Map();
    
    this.initializeStandings();
  }
  
  private initializeStandings(): void {
    for (const league of Object.values(MINING_LEAGUES)) {
      const teams = this.structure[league as keyof MiningLeagueStructure];
      this.standings.set(league, teams.map(t => ({
        tid: t.tid,
        won: 0,
        lost: 0,
        tied: 0,
        pts: 0,
        oppPts: 0,
        goalDiff: 0,
      })));
    }
  }
  
  recordResult(league: MiningLeague, tid: number, won: boolean, pts: number, oppPts: number): void {
    const leagueStandings = this.standings.get(league);
    if (!leagueStandings) return;
    
    const teamStanding = leagueStandings.find(s => s.tid === tid);
    if (!teamStanding) return;
    
    if (won) {
      teamStanding.won++;
    } else {
      teamStanding.lost++;
    }
    teamStanding.pts += pts;
    teamStanding.oppPts += oppPts;
    teamStanding.goalDiff = teamStanding.pts - teamStanding.oppPts;
  }
  
  recordTie(league: MiningLeague, tid: number, pts: number, oppPts: number): void {
    const leagueStandings = this.standings.get(league);
    if (!leagueStandings) return;
    
    const teamStanding = leagueStandings.find(s => s.tid === tid);
    if (!teamStanding) return;
    
    teamStanding.tied++;
    teamStanding.pts += pts;
    teamStanding.oppPts += oppPts;
    teamStanding.goalDiff = teamStanding.pts - teamStanding.oppPts;
  }
  
  getLeagueStandings(league: MiningLeague): MiningStandings['teams'] {
    const standings = this.standings.get(league) || [];
    return [...standings].sort((a, b) => {
      const aPoints = a.won * 3 + a.tied;
      const bPoints = b.won * 3 + b.tied;
      if (aPoints !== bPoints) return bPoints - aPoints;
      return b.goalDiff - a.goalDiff;
    });
  }
  
  endSeason(): PromotionRelegationResult {
    const result = calculatePromotionRelegation(this.standings);
    this.structure = applyPromotionRelegation(this.structure, result);
    this.initializeStandings();
    return result;
  }
  
  getTeamLeague(tid: number): MiningLeague | null {
    return getTeamLeague(this.structure, tid);
  }
}
