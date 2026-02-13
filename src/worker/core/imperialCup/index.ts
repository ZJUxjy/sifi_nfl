import type { Team } from '../../../common/entities';

export type ImperialCupRound = 'roundOf16' | 'quarterfinals' | 'semifinals' | 'final';

export type ImperialCupMatch = {
  round: ImperialCupRound;
  homeTid: number;
  awayTid: number;
  homeScore?: number;
  awayScore?: number;
  winnerTid?: number;
  played: boolean;
};

export type ImperialCupSeason = {
  season: number;
  qualifiedTeams: number[];
  matches: ImperialCupMatch[];
  champion?: number;
  completed: boolean;
};

export const IMPERIAL_CUP_QUALIFYING = {
  originContinent: 6,
  firstContinent: 4,
  secondContinent: 4,
  miningIsland: 2,
};

export const IMPERIAL_CUP_INTERVAL = 4;

export const IMPERIAL_CUP_START_SEASON = 2025;

export function isImperialCupYear(season: number): boolean {
  return (season - IMPERIAL_CUP_START_SEASON) % IMPERIAL_CUP_INTERVAL === 0;
}

export function getNextImperialCupYear(currentSeason: number): number {
  const yearsSinceStart = currentSeason - IMPERIAL_CUP_START_SEASON;
  const yearsUntilNext = IMPERIAL_CUP_INTERVAL - (yearsSinceStart % IMPERIAL_CUP_INTERVAL);
  return currentSeason + (yearsUntilNext === IMPERIAL_CUP_INTERVAL ? 0 : yearsUntilNext);
}

export function qualifyForImperialCup(
  teams: Team[],
  standings: { tid: number; won: number; region: string }[]
): number[] {
  const qualified: number[] = [];
  
  const originStandings = standings
    .filter(s => s.region === 'originContinent')
    .sort((a, b) => b.won - a.won)
    .slice(0, IMPERIAL_CUP_QUALIFYING.originContinent);
  qualified.push(...originStandings.map(s => s.tid));
  
  const firstStandings = standings
    .filter(s => s.region === 'firstContinent')
    .sort((a, b) => b.won - a.won)
    .slice(0, IMPERIAL_CUP_QUALIFYING.firstContinent);
  qualified.push(...firstStandings.map(s => s.tid));
  
  const secondStandings = standings
    .filter(s => s.region === 'secondContinent')
    .sort((a, b) => b.won - a.won)
    .slice(0, IMPERIAL_CUP_QUALIFYING.secondContinent);
  qualified.push(...secondStandings.map(s => s.tid));
  
  const miningStandings = standings
    .filter(s => s.region === 'miningIsland')
    .sort((a, b) => b.won - a.won)
    .slice(0, IMPERIAL_CUP_QUALIFYING.miningIsland);
  qualified.push(...miningStandings.map(s => s.tid));
  
  return qualified;
}

export function generateImperialCupBracket(qualifiedTeams: number[]): ImperialCupMatch[] {
  const shuffled = [...qualifiedTeams].sort(() => Math.random() - 0.5);
  
  const matches: ImperialCupMatch[] = [];
  
  for (let i = 0; i < 8; i++) {
    matches.push({
      round: 'roundOf16',
      homeTid: shuffled[i * 2]!,
      awayTid: shuffled[i * 2 + 1]!,
      played: false,
    });
  }
  
  return matches;
}

export function getRoundName(round: ImperialCupRound): string {
  switch (round) {
    case 'roundOf16':
      return 'Round of 16';
    case 'quarterfinals':
      return 'Quarterfinals';
    case 'semifinals':
      return 'Semifinals';
    case 'final':
      return 'Imperial Cup Final';
  }
}

export function advanceRound(matches: ImperialCupMatch[]): ImperialCupMatch[] | null {
  const currentRound = matches[0]?.round;
  if (!currentRound) return null;
  
  const winners: number[] = matches
    .filter(m => m.played && m.winnerTid !== undefined)
    .map(m => m.winnerTid!);
  
  if (winners.length === 1) {
    return null;
  }
  
  let nextRound: ImperialCupRound;
  switch (currentRound) {
    case 'roundOf16':
      nextRound = 'quarterfinals';
      break;
    case 'quarterfinals':
      nextRound = 'semifinals';
      break;
    case 'semifinals':
      nextRound = 'final';
      break;
    case 'final':
      return null;
  }
  
  const newMatches: ImperialCupMatch[] = [];
  for (let i = 0; i < winners.length; i += 2) {
    if (winners[i + 1] !== undefined) {
      newMatches.push({
        round: nextRound,
        homeTid: winners[i]!,
        awayTid: winners[i + 1]!,
        played: false,
      });
    }
  }
  
  return newMatches;
}

export type ImperialCupHistory = {
  season: number;
  champion: string;
  runnerUp: string;
  score: string;
};

export const IMPERIAL_CUP_HISTORY: ImperialCupHistory[] = [
  { season: 2021, champion: 'Nova United', runnerUp: 'Iron City Steelers', score: '28-24' },
  { season: 2017, champion: 'Metropolis Prime', runnerUp: 'Nova United', score: '31-27' },
  { season: 2013, champion: 'Stellar Wanderers', runnerUp: 'Crystal Bay Sharks', score: '24-21' },
  { season: 2009, champion: 'Nova United', runnerUp: 'Thunder Ridge Raiders', score: '35-28' },
  { season: 2005, champion: 'Metropolis Prime', runnerUp: 'Solar Flares', score: '20-17' },
];

export function getRegionChampionCount(region: string): number {
  const regionTeams: Record<string, string[]> = {
    originContinent: ['Nova United', 'Metropolis Prime', 'Stellar Wanderers'],
    firstContinent: ['Iron City Steelers'],
    secondContinent: ['Solar Flares'],
    miningIsland: ['Thunder Ridge Raiders', 'Crystal Bay Sharks'],
  };
  
  const teams = regionTeams[region] || [];
  return IMPERIAL_CUP_HISTORY.filter(h => teams.includes(h.champion)).length;
}
