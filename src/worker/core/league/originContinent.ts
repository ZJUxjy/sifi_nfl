import type { Team, ScheduleGame } from '../../../common/entities';

export const ORIGIN_LEAGUES = {
  METROPOLIS: 'metropolis',
  IMPERIAL: 'imperial', 
  ROYAL: 'royal',
} as const;

export type OriginLeague = typeof ORIGIN_LEAGUES[keyof typeof ORIGIN_LEAGUES];

export const ORIGIN_LEAGUE_INFO: Record<OriginLeague, { name: string; abbreviation: string }> = {
  metropolis: { name: 'Metropolis League', abbreviation: 'MET' },
  imperial: { name: 'Imperial League', abbreviation: 'IMP' },
  royal: { name: 'Royal League', abbreviation: 'ROY' },
};

export const TEAMS_PER_LEAGUE = 12;
export const CHAMPIONSHIP_QUALIFIERS_PER_LEAGUE = 4;
export const RELEGATION_DIRECT = 1;
export const RELEGATION_PLAYOFF = 1;

export type OriginSeasonPhase = 
  | 'firstStage'
  | 'championshipGroup'
  | 'relegationGroup'
  | 'playoffs'
  | 'relegationPlayoff'
  | 'completed';

export type OriginLeagueStandings = {
  league: OriginLeague;
  teams: {
    tid: number;
    won: number;
    lost: number;
    tied: number;
    pts: number;
    oppPts: number;
    phase1Won?: number;
    phase1Lost?: number;
    phase2Won?: number;
    phase2Lost?: number;
  }[];
};

export type ChampionshipGroupTeam = {
  tid: number;
  league: OriginLeague;
  phase1Record: { won: number; lost: number };
  phase2Record: { won: number; lost: number };
  totalRecord: { won: number; lost: number };
  pts: number;
  oppPts: number;
};

export type RelegationGroupTeam = {
  tid: number;
  league: OriginLeague;
  phase1Record: { won: number; lost: number };
  phase2Record: { won: number; lost: number };
  totalRecord: { won: number; lost: number };
  pts: number;
  oppPts: number;
};

export type DoubleEliminationBracket = {
  winnersBracket: { round: number; matchups: { team1: number; team2: number; winner?: number }[] }[];
  losersBracket: { round: number; matchups: { team1: number; team2: number; winner?: number }[] }[];
  championship: { team1: number; team2: number; winner?: number } | null;
  champion?: number;
};

export type RelegationPlayoff = {
  leagues: {
    league: OriginLeague;
    team: number;
  }[];
  lowerLeagueTeams: number[];
  matches: { homeTid: number; awayTid: number; winner?: number }[];
  winners: number[];
};

export function assignTeamsToLeagues(teams: Team[]): Map<OriginLeague, Team[]> {
  const leagueTeams = new Map<OriginLeague, Team[]>();
  
  const leagues: OriginLeague[] = [ORIGIN_LEAGUES.METROPOLIS, ORIGIN_LEAGUES.IMPERIAL, ORIGIN_LEAGUES.ROYAL];
  const shuffledTeams = [...teams].sort(() => Math.random() - 0.5);
  
  for (let i = 0; i < leagues.length; i++) {
    const start = i * TEAMS_PER_LEAGUE;
    const end = start + TEAMS_PER_LEAGUE;
    leagueTeams.set(leagues[i], shuffledTeams.slice(start, end));
  }
  
  return leagueTeams;
}

export function generateFirstStageSchedule(
  leagueTeams: Map<OriginLeague, Team[]>,
  season: number,
  startGid: number = 1
): { schedule: ScheduleGame[]; nextGid: number } {
  const schedule: ScheduleGame[] = [];
  let gid = startGid;
  
  Array.from(leagueTeams.entries()).forEach(([league, teams]) => {
    for (let i = 0; i < teams.length; i++) {
      for (let j = i + 1; j < teams.length; j++) {
        const isHome = Math.random() < 0.5;
        const homeTid = isHome ? teams[i].tid : teams[j].tid;
        const awayTid = isHome ? teams[j].tid : teams[i].tid;
        
        schedule.push({
          gid: gid++,
          season,
          day: Math.min(i, j) + 1,
          homeTid,
          awayTid,
          phase: 'firstStage',
          league,
        });
      }
    }
  });
  
  return { schedule, nextGid: gid };
}

export function determineGroups(
  leagueTeams: Map<OriginLeague, Team[]>,
  firstStageResults: Map<number, { won: number; lost: number }>
): {
  championshipGroup: Map<OriginLeague, number[]>;
  relegationGroup: Map<OriginLeague, number[]>;
} {
  const championshipGroup = new Map<OriginLeague, number[]>();
  const relegationGroup = new Map<OriginLeague, number[]>();
  
  Array.from(leagueTeams.entries()).forEach(([league, teams]) => {
    const sortedTeams = [...teams].sort((a, b) => {
      const aRecord = firstStageResults.get(a.tid) || { won: 0, lost: 0 };
      const bRecord = firstStageResults.get(b.tid) || { won: 0, lost: 0 };
      if (aRecord.won !== bRecord.won) return bRecord.won - aRecord.won;
      return aRecord.lost - bRecord.lost;
    });
    
    championshipGroup.set(league, sortedTeams.slice(0, CHAMPIONSHIP_QUALIFIERS_PER_LEAGUE).map(t => t.tid));
    relegationGroup.set(league, sortedTeams.slice(CHAMPIONSHIP_QUALIFIERS_PER_LEAGUE).map(t => t.tid));
  });
  
  return { championshipGroup, relegationGroup };
}

export function generateChampionshipGroupSchedule(
  championshipGroup: Map<OriginLeague, number[]>,
  firstStageResults: Map<number, { won: number; lost: number }>,
  season: number,
  startGid: number = 1
): { schedule: ScheduleGame[]; nextGid: number } {
  const schedule: ScheduleGame[] = [];
  let gid = startGid;
  let day = 12;
  
  const allTeams = Array.from(championshipGroup.values()).flat();
  const leagues = Array.from(championshipGroup.keys());
  
  for (const team1 of allTeams) {
    const team1League = leagues.find(l => championshipGroup.get(l)?.includes(team1))!;
    
    for (const team2 of allTeams) {
      if (team1 >= team2) continue;
      
      const team2League = leagues.find(l => championshipGroup.get(l)?.includes(team2))!;
      
      if (team1League === team2League) {
        const team1Record = firstStageResults.get(team1) || { won: 0, lost: 0 };
        const team2Record = firstStageResults.get(team2) || { won: 0, lost: 0 };
        
        if (team1Record.won > team2Record.won || 
            (team1Record.won === team2Record.won && team1Record.lost < team2Record.lost)) {
          continue;
        }
      }
      
      const isHome = Math.random() < 0.5;
      schedule.push({
        gid: gid++,
        season,
        day: day++,
        homeTid: isHome ? team1 : team2,
        awayTid: isHome ? team2 : team1,
        phase: 'championshipGroup',
      });
    }
  }
  
  return { schedule, nextGid: gid };
}

export function generateRelegationGroupSchedule(
  relegationGroup: Map<OriginLeague, number[]>,
  season: number,
  startGid: number = 1
): { schedule: ScheduleGame[]; nextGid: number } {
  const schedule: ScheduleGame[] = [];
  let gid = startGid;
  let day = 12;
  
  const allTeams = Array.from(relegationGroup.values()).flat();
  const leagues = Array.from(relegationGroup.keys());
  
  for (const team1 of allTeams) {
    const team1League = leagues.find(l => relegationGroup.get(l)?.includes(team1))!;
    
    for (const team2 of allTeams) {
      if (team1 >= team2) continue;
      
      const team2League = leagues.find(l => relegationGroup.get(l)?.includes(team2))!;
      
      if (team1League === team2League) continue;
      
      const isHome = Math.random() < 0.5;
      schedule.push({
        gid: gid++,
        season,
        day: day++,
        homeTid: isHome ? team1 : team2,
        awayTid: isHome ? team2 : team1,
        phase: 'relegationGroup',
      });
    }
  }
  
  return { schedule, nextGid: gid };
}

export function calculateChampionshipStandings(
  championshipGroup: Map<OriginLeague, number[]>,
  firstStageResults: Map<number, { won: number; lost: number; pts?: number; oppPts?: number }>,
  championshipResults: Map<number, { won: number; lost: number; pts?: number; oppPts?: number }>
): ChampionshipGroupTeam[] {
  const standings: ChampionshipGroupTeam[] = [];
  
  Array.from(championshipGroup.entries()).forEach(([league, tids]) => {
    for (const tid of tids) {
      const phase1 = firstStageResults.get(tid) || { won: 0, lost: 0, pts: 0, oppPts: 0 };
      const phase2 = championshipResults.get(tid) || { won: 0, lost: 0, pts: 0, oppPts: 0 };
      
      standings.push({
        tid,
        league,
        phase1Record: { won: phase1.won, lost: phase1.lost },
        phase2Record: { won: phase2.won, lost: phase2.lost },
        totalRecord: {
          won: phase1.won + phase2.won,
          lost: phase1.lost + phase2.lost,
        },
        pts: (phase1.pts || 0) + (phase2.pts || 0),
        oppPts: (phase1.oppPts || 0) + (phase2.oppPts || 0),
      });
    }
  });
  
  return standings.sort((a, b) => {
    const winPctA = a.totalRecord.won / (a.totalRecord.won + a.totalRecord.lost || 1);
    const winPctB = b.totalRecord.won / (b.totalRecord.won + b.totalRecord.lost || 1);
    if (winPctA !== winPctB) return winPctB - winPctA;
    return b.pts - a.pts;
  });
}

export function generateDoubleEliminationBracket(teamIds: number[]): DoubleEliminationBracket {
  if (teamIds.length !== 8) {
    teamIds = teamIds.slice(0, 8);
  }
  
  const winnersBracket: { round: number; matchups: { team1: number; team2: number; winner?: number }[] }[] = [];
  const losersBracket: { round: number; matchups: { team1: number; team2: number; winner?: number }[] }[] = [];
  
  winnersBracket.push({
    round: 1,
    matchups: [
      { team1: teamIds[0]!, team2: teamIds[7]! },
      { team1: teamIds[1]!, team2: teamIds[6]! },
      { team1: teamIds[2]!, team2: teamIds[5]! },
      { team1: teamIds[3]!, team2: teamIds[4]! },
    ],
  });
  
  losersBracket.push({
    round: 1,
    matchups: [],
  });
  
  winnersBracket.push({
    round: 2,
    matchups: [],
  });
  
  losersBracket.push({
    round: 2,
    matchups: [],
  });
  
  winnersBracket.push({
    round: 3,
    matchups: [],
  });
  
  losersBracket.push({
    round: 3,
    matchups: [],
  });
  
  losersBracket.push({
    round: 4,
    matchups: [],
  });
  
  return {
    winnersBracket,
    losersBracket,
    championship: null,
    champion: undefined,
  };
}

export function determineRelegationCandidates(
  relegationGroup: Map<OriginLeague, number[]>,
  relegationResults: Map<number, { won: number; lost: number }>
): {
  directRelegation: Map<OriginLeague, number>;
  playoffCandidates: Map<OriginLeague, number>;
} {
  const directRelegation = new Map<OriginLeague, number>();
  const playoffCandidates = new Map<OriginLeague, number>();
  
  Array.from(relegationGroup.entries()).forEach(([league, tids]) => {
    const sortedTids = [...tids].sort((a, b) => {
      const aRecord = relegationResults.get(a) || { won: 0, lost: 0 };
      const bRecord = relegationResults.get(b) || { won: 0, lost: 0 };
      if (aRecord.won !== bRecord.won) return aRecord.won - bRecord.won;
      return bRecord.lost - aRecord.lost;
    });
    
    directRelegation.set(league, sortedTids[0]!);
    playoffCandidates.set(league, sortedTids[1]!);
  });
  
  return { directRelegation, playoffCandidates };
}

export function generateRelegationPlayoffSchedule(
  playoffCandidates: Map<OriginLeague, number>,
  lowerLeagueTeams: number[],
  season: number,
  startGid: number = 1
): { schedule: ScheduleGame[]; playoff: RelegationPlayoff; nextGid: number } {
  const schedule: ScheduleGame[] = [];
  let gid = startGid;
  
  const leagues = Array.from(playoffCandidates.keys());
  const topLeagueTeams = Array.from(playoffCandidates.values());
  
  const matches: RelegationPlayoff['matches'] = [];
  
  for (let i = 0; i < Math.min(topLeagueTeams.length, lowerLeagueTeams.length); i++) {
    const topTeam = topLeagueTeams[i];
    const lowerTeam = lowerLeagueTeams[i];
    
    if (topTeam !== undefined && lowerTeam !== undefined) {
      const isHome = Math.random() < 0.5;
      matches.push({
        homeTid: isHome ? topTeam : lowerTeam,
        awayTid: isHome ? lowerTeam : topTeam,
      });
      
      schedule.push({
        gid: gid++,
        season,
        day: 1,
        homeTid: isHome ? topTeam : lowerTeam,
        awayTid: isHome ? lowerTeam : topTeam,
        phase: 'relegationPlayoff',
      });
    }
  }
  
  const playoff: RelegationPlayoff = {
    leagues: leagues.map(league => ({
      league,
      team: playoffCandidates.get(league)!,
    })),
    lowerLeagueTeams,
    matches,
    winners: [],
  };
  
  return { schedule, playoff, nextGid: gid };
}

export class OriginContinentSeason {
  season: number;
  phase: OriginSeasonPhase;
  leagueTeams: Map<OriginLeague, Team[]>;
  firstStageSchedule: ScheduleGame[];
  championshipGroupSchedule: ScheduleGame[];
  relegationGroupSchedule: ScheduleGame[];
  playoffBracket: DoubleEliminationBracket | null;
  championshipStandings: ChampionshipGroupTeam[];
  relegationStandings: RelegationGroupTeam[];
  directRelegation: Map<OriginLeague, number>;
  playoffCandidates: Map<OriginLeague, number>;
  champion: number | null;
  
  private results: Map<number, { won: number; lost: number; pts: number; oppPts: number }>;
  private firstStageResults: Map<number, { won: number; lost: number; pts: number; oppPts: number }>;
  private currentGid: number;
  
  constructor(season: number, teams: Team[]) {
    this.season = season;
    this.phase = 'firstStage';
    this.leagueTeams = assignTeamsToLeagues(teams);
    this.firstStageSchedule = [];
    this.championshipGroupSchedule = [];
    this.relegationGroupSchedule = [];
    this.playoffBracket = null;
    this.championshipStandings = [];
    this.relegationStandings = [];
    this.directRelegation = new Map();
    this.playoffCandidates = new Map();
    this.champion = null;
    
    this.results = new Map();
    this.firstStageResults = new Map();
    this.currentGid = 1;
    
    this.initializeFirstStage();
  }
  
  private initializeFirstStage(): void {
    const { schedule, nextGid } = generateFirstStageSchedule(
      this.leagueTeams,
      this.season,
      this.currentGid
    );
    this.firstStageSchedule = schedule;
    this.currentGid = nextGid;
    
    Array.from(this.leagueTeams.entries()).forEach(([league, teams]) => {
      for (const team of teams) {
        this.results.set(team.tid, { won: 0, lost: 0, pts: 0, oppPts: 0 });
        this.firstStageResults.set(team.tid, { won: 0, lost: 0, pts: 0, oppPts: 0 });
      }
    });
  }
  
  recordFirstStageResult(game: ScheduleGame, homeScore: number, awayScore: number): void {
    const winner = homeScore > awayScore ? game.homeTid : game.awayTid;
    const loser = homeScore > awayScore ? game.awayTid : game.homeTid;
    
    const winnerResult = this.firstStageResults.get(winner)!;
    const loserResult = this.firstStageResults.get(loser)!;
    
    winnerResult.won++;
    winnerResult.pts += Math.max(homeScore, awayScore);
    winnerResult.oppPts += Math.min(homeScore, awayScore);
    
    loserResult.lost++;
    loserResult.pts += Math.min(homeScore, awayScore);
    loserResult.oppPts += Math.max(homeScore, awayScore);
    
    this.results.set(winner, { ...winnerResult });
    this.results.set(loser, { ...loserResult });
  }
  
  advanceToPhase2(): void {
    const { championshipGroup, relegationGroup } = determineGroups(
      this.leagueTeams,
      this.firstStageResults
    );
    
    const { schedule: champSchedule, nextGid } = generateChampionshipGroupSchedule(
      championshipGroup,
      this.firstStageResults,
      this.season,
      this.currentGid
    );
    this.championshipGroupSchedule = champSchedule;
    this.currentGid = nextGid;
    
    const { schedule: relSchedule, nextGid: nextGid2 } = generateRelegationGroupSchedule(
      relegationGroup,
      this.season,
      this.currentGid
    );
    this.relegationGroupSchedule = relSchedule;
    this.currentGid = nextGid2;
    
    this.phase = 'championshipGroup';
  }
  
  recordChampionshipResult(game: ScheduleGame, homeScore: number, awayScore: number): void {
    const winner = homeScore > awayScore ? game.homeTid : game.awayTid;
    const loser = homeScore > awayScore ? game.awayTid : game.homeTid;
    
    const winnerResult = this.results.get(winner)!;
    const loserResult = this.results.get(loser)!;
    
    winnerResult.won++;
    winnerResult.pts += Math.max(homeScore, awayScore);
    winnerResult.oppPts += Math.min(homeScore, awayScore);
    
    loserResult.lost++;
    loserResult.pts += Math.min(homeScore, awayScore);
    loserResult.oppPts += Math.max(homeScore, awayScore);
  }
  
  advanceToPlayoffs(): void {
    const { championshipGroup } = determineGroups(this.leagueTeams, this.firstStageResults);
    this.championshipStandings = calculateChampionshipStandings(
      championshipGroup,
      this.firstStageResults,
      this.results
    );
    
    const playoffTeams = this.championshipStandings.slice(0, 8).map(t => t.tid);
    this.playoffBracket = generateDoubleEliminationBracket(playoffTeams);
    this.phase = 'playoffs';
  }
  
  recordPlayoffResult(
    bracketType: 'winners' | 'losers',
    round: number,
    matchupIndex: number,
    winner: number
  ): void {
    if (!this.playoffBracket) return;
    
    if (bracketType === 'winners') {
      const roundData = this.playoffBracket.winnersBracket[round - 1];
      if (roundData && roundData.matchups[matchupIndex]) {
        roundData.matchups[matchupIndex].winner = winner;
      }
    } else {
      const roundData = this.playoffBracket.losersBracket[round - 1];
      if (roundData && roundData.matchups[matchupIndex]) {
        roundData.matchups[matchupIndex].winner = winner;
      }
    }
  }
  
  setChampion(champion: number): void {
    this.champion = champion;
    this.phase = 'completed';
  }
  
  determineRelegation(): void {
    const { relegationGroup } = determineGroups(this.leagueTeams, this.firstStageResults);
    const { directRelegation, playoffCandidates } = determineRelegationCandidates(
      relegationGroup,
      this.results
    );
    
    this.directRelegation = directRelegation;
    this.playoffCandidates = playoffCandidates;
  }
  
  getLeagueTeams(league: OriginLeague): Team[] {
    return this.leagueTeams.get(league) || [];
  }
  
  getAllTeams(): Team[] {
    return Array.from(this.leagueTeams.values()).flat();
  }
  
  getTeamLeague(tid: number): OriginLeague | null {
    for (const [league, teams] of Array.from(this.leagueTeams.entries())) {
      if (teams.some(t => t.tid === tid)) {
        return league;
      }
    }
    return null;
  }
  
  getResults(): Map<number, { won: number; lost: number; pts: number; oppPts: number }> {
    return this.results;
  }
}
