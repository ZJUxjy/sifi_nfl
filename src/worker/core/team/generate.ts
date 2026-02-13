import type { Team, Player, Position, Region } from '../../../common/types';
import type { MarketSize, TeamStrength } from '../../../common/entities';
import { generate } from '../player/generate';
import { shuffle, truncGauss, sample } from '../../../common/random';
import { TEAM_CONFIGS } from '../../../common/teamConfig';

export const SCI_FI_COLORS: [string, string, string][] = [
  ['#1a237e', '#3949ab', '#5c6bc0'],
  ['#b71c1c', '#d32f2f', '#e57373'],
  ['#1b5e20', '#388e3c', '#66bb6a'],
  ['#e65100', '#f57c00', '#ffb74d'],
  ['#4a148c', '#7b1fa2', '#ba68c8'],
  ['#006064', '#0097a7', '#4dd0e1'],
  ['#827717', '#afb42b', '#dce775'],
  ['#3e2723', '#5d4037', '#8d6e63'],
  ['#212121', '#424242', '#757575'],
  ['#0d47a1', '#1976d2', '#64b5f6'],
  ['#bf360c', '#e64a19', '#ff8a65'],
  ['#1b5e20', '#2e7d32', '#81c784'],
];

export const MARKET_CONFIG: Record<MarketSize, { budgetMult: number; cashMult: number; popLabel: string }> = {
  huge: { budgetMult: 1.5, cashMult: 2.0, popLabel: 'Huge' },
  large: { budgetMult: 1.2, cashMult: 1.5, popLabel: 'Large' },
  medium: { budgetMult: 1.0, cashMult: 1.0, popLabel: 'Medium' },
  small: { budgetMult: 0.7, cashMult: 0.6, popLabel: 'Small' },
};

export const STRENGTH_CONFIG: Record<TeamStrength, { ovrBonus: number; label: string }> = {
  elite: { ovrBonus: 12, label: '⭐⭐⭐' },
  strong: { ovrBonus: 6, label: '⭐⭐' },
  average: { ovrBonus: 0, label: '⭐' },
  weak: { ovrBonus: -8, label: '' },
};

export function generateTeam(
  tid: number,
  region: Region,
  cid: number,
  did: number,
  name: string,
  season: number,
  market: MarketSize = 'medium',
  strength: TeamStrength = 'average'
): Team {
  const abbrev = name
    .split(' ')
    .map(word => word[0])
    .join('')
    .substring(0, 3)
    .toUpperCase();

  const colors = shuffle([...SCI_FI_COLORS])[0];
  const marketConfig = MARKET_CONFIG[market];

  const baseBudget = 200000;
  const baseCash = 100000;

  return {
    tid,
    region,
    cid,
    did,
    name,
    abbrev,
    colors,
    pop: marketConfig.popLabel,
    srID: `${region}_${tid}`,
    budget: Math.round(baseBudget * marketConfig.budgetMult),
    cash: Math.round(baseCash * marketConfig.cashMult),
    salaryPaid: 0,
    season,
    won: 0,
    lost: 0,
    playoffsRoundsWon: -1,
    streak: 0,
    lastTen: '',
    market,
    strength,
  };
}

export function generateRegionTeams(
  region: Region,
  startTid: number,
  season: number
): { teams: Team[]; players: Player[] } {
  const teams: Team[] = [];
  const players: Player[] = [];
  
  const teamConfigs = TEAM_CONFIGS[region] || [];
  const shuffledConfigs = shuffle([...teamConfigs]);

  shuffledConfigs.forEach((config, i) => {
    let cid = 0;
    let did = 0;

    if (region === 'firstContinent') {
      cid = Math.floor(i / 12);
      did = Math.floor(i / 6);
    } else if (region === 'secondContinent') {
      cid = Math.floor(i / 13);
      did = Math.floor(i / 7);
    } else if (region === 'originContinent') {
      const league = Math.floor(i / 12);
      cid = league;
      did = league * 3 + Math.floor((i % 12) / 4);
    } else if (region === 'miningIsland') {
      cid = 0;
      did = 0;
    }

    const team = generateTeam(
      startTid + i,
      region,
      cid,
      did,
      config.name,
      season,
      config.market,
      config.strength
    );
    
    const minRoster = region === 'miningIsland' ? 25 : 40;
    const maxRoster = region === 'miningIsland' ? 40 : 55;
    const teamPlayers = generateTeamPlayers(team, season, minRoster, maxRoster, config.strength);
    
    teams.push(team);
    players.push(...teamPlayers);
  });

  return { teams, players };
}

export function generateTeamPlayers(
  team: Team,
  season: number,
  minRoster: number = 40,
  maxRoster: number = 55,
  strength: TeamStrength = 'average'
): Player[] {
  const players: Player[] = [];
  const rosterSize = Math.floor(Math.random() * (maxRoster - minRoster + 1)) + minRoster;
  const ovrBonus = STRENGTH_CONFIG[strength].ovrBonus;

  const positionCounts: Record<Position, number> = {
    QB: 3,
    RB: 4,
    WR: 6,
    TE: 3,
    OL: 9,
    DL: 9,
    LB: 7,
    CB: 6,
    S: 5,
    K: 1,
    P: 1,
    KR: 2,
    PR: 2,
  };

  let pid = 0;
  for (const [pos, count] of Object.entries(positionCounts)) {
    for (let i = 0; i < count; i++) {
      if (players.length >= rosterSize) break;

      const age = Math.floor(Math.random() * 15) + 21;
      const player = generate(team.tid, age, season - (age - 21), pos as Position);
      player.pid = pid++;
      
      applyStrengthBonus(player, ovrBonus);
      
      players.push(player);
    }
  }

  while (players.length < rosterSize) {
    const positions: Position[] = ['RB', 'WR', 'TE', 'DL', 'LB', 'CB', 'S'];
    const pos = sample(positions, 1)[0];
    const age = Math.floor(Math.random() * 15) + 21;
    const player = generate(team.tid, age, season - (age - 21), pos);
    player.pid = pid++;
    
    applyStrengthBonus(player, ovrBonus);
    
    players.push(player);
  }

  return players;
}

function applyStrengthBonus(player: Player, bonus: number): void {
  const attributes: (keyof Player)[] = [
    'hgt', 'stre', 'spd', 'endu', 'thv', 'thp', 'tha', 'bsc', 'elu',
    'rtr', 'hnd', 'rbk', 'pbk', 'pcv', 'tck', 'prs', 'rns', 'kpw', 'kac', 'ppw', 'pac'
  ];

  for (const attr of attributes) {
    if (typeof player[attr] === 'number') {
      const current = player[attr] as number;
      const variation = truncGauss(0, 3, -10, 10);
      (player as any)[attr] = Math.max(0, Math.min(100, current + bonus + variation));
    }
  }

  player.ovr = Math.max(0, Math.min(100, player.ovr + Math.round(bonus * 0.8)));
}

export function generateAllTeams(season: number): { teams: Team[]; players: Player[] } {
  const allTeams: Team[] = [];
  const allPlayers: Player[] = [];
  let currentTid = 0;

  const regions: Region[] = ['firstContinent', 'secondContinent', 'originContinent', 'miningIsland'];

  for (const region of regions) {
    const { teams, players } = generateRegionTeams(region, currentTid, season);

    for (const player of players) {
      player.pid += currentTid * 100;
    }

    allTeams.push(...teams);
    allPlayers.push(...players);
    currentTid += teams.length;
  }

  return { teams: allTeams, players: allPlayers };
}
