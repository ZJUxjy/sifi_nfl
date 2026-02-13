import type { Team, TeamSeason, TeamStats, ScheduleGame } from '../../../common/entities';
import type { Region } from '../../../common/types';
import { shuffle, sample } from '../../../common/random';

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
};

export function generateSchedule(
  teams: Team[],
  season: number,
  numGames: number = 17
): ScheduleGame[] {
  const schedule: ScheduleGame[] = [];
  const teamSchedules = new Map<number, number[]>();
  
  for (const team of teams) {
    teamSchedules.set(team.tid, []);
  }
  
  let gid = 1;
  
  for (const team of teams) {
    const opponents = teamSchedules.get(team.tid)!;
    const neededGames = numGames - opponents.length;
    
    if (neededGames <= 0) continue;
    
    const availableOpponents = teams
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
      
      const game: ScheduleGame = {
        gid: gid++,
        season,
        day: Math.floor(Math.random() * 17) + 1,
        homeTid,
        awayTid,
      };
      
      schedule.push(game);
      
      teamSchedules.get(team.tid)!.push(opponent.tid);
      teamSchedules.get(opponent.tid)!.push(team.tid);
    }
  }
  
  return schedule.sort((a, b) => a.day - b.day);
}

export function updateStandings(
  teams: Team[],
  games: ScheduleGame[]
): StandingsEntry[] {
  const standings = new Map<number, StandingsEntry>();
  
  for (const team of teams) {
    standings.set(team.tid, {
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
    });
  }
  
  for (const game of games) {
    if (!game.won || !game.lost) continue;
    
    const winner = standings.get(game.won.tid)!;
    const loser = standings.get(game.lost.tid)!;
    
    winner.won++;
    winner.pts += game.won.pts;
    winner.oppPts += game.lost.pts;
    winner.streak = winner.streak > 0 ? winner.streak + 1 : 1;
    
    loser.lost++;
    loser.pts += game.lost.pts;
    loser.oppPts += game.won.pts;
    loser.streak = loser.streak < 0 ? loser.streak - 1 : -1;
  }
  
  return Array.from(standings.values()).sort((a, b) => {
    if (a.won !== b.won) return b.won - a.won;
    if (a.lost !== b.lost) return a.lost - b.lost;
    return b.pts - a.pts;
  });
}

export function getStandingsByRegion(
  standings: StandingsEntry[],
  region: Region
): StandingsEntry[] {
  return standings.filter(s => s.region === region);
}

export function getStandingsByDivision(
  standings: StandingsEntry[],
  did: number
): StandingsEntry[] {
  return standings.filter(s => s.did === did);
}

export function generatePlayoffTeams(
  standings: StandingsEntry[],
  numTeams: number = 14
): number[] {
  return standings
    .sort((a, b) => {
      const winPctA = a.won / (a.won + a.lost + a.tied);
      const winPctB = b.won / (b.won + b.lost + b.tied);
      if (winPctA !== winPctB) return winPctB - winPctA;
      return b.pts - a.pts;
    })
    .slice(0, numTeams)
    .map(s => s.tid);
}

export function generatePlayoffBracket(
  playoffTeams: number[],
  standings: StandingsEntry[]
): { round: number; matchups: [number, number][] }[] {
  const bracket: { round: number; matchups: [number, number][] }[] = [];
  
  const sortedTeams = playoffTeams
    .map(tid => standings.find(s => s.tid === tid)!)
    .sort((a, b) => {
      const winPctA = a.won / (a.won + a.lost + a.tied);
      const winPctB = b.won / (b.won + b.lost + b.tied);
      return winPctB - winPctA;
    });
  
  const wildCardTeams = sortedTeams.slice(0, 6);
  const divisionWinners = sortedTeams.slice(6);
  
  const wildCardRound: [number, number][] = [
    [wildCardTeams[2].tid, wildCardTeams[5].tid],
    [wildCardTeams[3].tid, wildCardTeams[4].tid],
  ];
  
  bracket.push({ round: 1, matchups: wildCardRound });
  
  const divisionalRound: [number, number][] = [
    [wildCardTeams[0].tid, wildCardRound[0][Math.random() > 0.5 ? 0 : 1]],
    [wildCardTeams[1].tid, wildCardRound[1][Math.random() > 0.5 ? 0 : 1]],
  ];
  
  bracket.push({ round: 2, matchups: divisionalRound });
  
  const championshipRound: [number, number][] = [
    [divisionalRound[0][0], divisionalRound[1][0]],
  ];
  
  bracket.push({ round: 3, matchups: championshipRound });
  
  return bracket;
}

export class SeasonManager {
  season: number;
  teams: Team[];
  schedule: ScheduleGame[];
  standings: StandingsEntry[];
  completedGames: ScheduleGame[];
  currentWeek: number;
  phase: 'preseason' | 'regular' | 'playoffs' | 'offseason';
  
  constructor(season: number, teams: Team[]) {
    this.season = season;
    this.teams = teams;
    this.schedule = [];
    this.standings = [];
    this.completedGames = [];
    this.currentWeek = 0;
    this.phase = 'preseason';
  }
  
  startPreseason(): void {
    this.phase = 'preseason';
  }
  
  startRegularSeason(): void {
    this.phase = 'regular';
    this.schedule = generateSchedule(this.teams, this.season);
    this.currentWeek = 1;
    this.standings = updateStandings(this.teams, []);
  }
  
  simWeek(): ScheduleGame[] {
    if (this.phase !== 'regular') return [];
    
    const weekGames = this.schedule.filter(g => g.day === this.currentWeek);
    
    for (const game of weekGames) {
      if (!game.won) {
        const homeTeam = this.teams.find(t => t.tid === game.homeTid)!;
        const awayTeam = this.teams.find(t => t.tid === game.awayTid)!;
        
        const homeScore = Math.floor(Math.random() * 35) + 10;
        const awayScore = Math.floor(Math.random() * 35) + 10;
        
        game.won = { tid: homeScore > awayScore ? game.homeTid : game.awayTid, pts: Math.max(homeScore, awayScore) };
        game.lost = { tid: homeScore > awayScore ? game.awayTid : game.homeTid, pts: Math.min(homeScore, awayScore) };
        
        this.completedGames.push(game);
      }
    }
    
    this.standings = updateStandings(this.teams, this.completedGames);
    this.currentWeek++;
    
    const maxWeek = Math.max(...this.schedule.map(g => g.day));
    if (this.currentWeek > maxWeek) {
      this.startPlayoffs();
    }
    
    return weekGames;
  }
  
  startPlayoffs(): void {
    this.phase = 'playoffs';
    const playoffTeams = generatePlayoffTeams(this.standings);
    const bracket = generatePlayoffBracket(playoffTeams, this.standings);
    
    console.log('Playoffs started with teams:', playoffTeams);
    console.log('Playoff bracket:', bracket);
  }
  
  getStandings(): StandingsEntry[] {
    return this.standings;
  }
  
  getTeamRecord(tid: number): StandingsEntry | undefined {
    return this.standings.find(s => s.tid === tid);
  }
}
