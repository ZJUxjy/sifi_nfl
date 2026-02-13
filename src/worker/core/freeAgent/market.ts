import type { Player, Team } from '../../../common/entities';
import { truncGauss, bound } from '../../../common/random';

export interface FreeAgentDemand {
  minSalary: number;
  minYears: number;
  preferredRegion?: string;
  willingToAccept: boolean;
}

export function getFreeAgents(players: Player[]): Player[] {
  return players.filter(p => p.tid === undefined || p.tid === -1);
}

export function generateContractDemand(player: Player): FreeAgentDemand {
  const baseOvr = player.ovr;
  const age = player.age;
  const pot = player.pot;

  let salaryMultiplier = 1.0;
  let yearsMultiplier = 1.0;

  if (baseOvr >= 80) {
    salaryMultiplier = 1.5;
    yearsMultiplier = 1.2;
  } else if (baseOvr >= 70) {
    salaryMultiplier = 1.2;
    yearsMultiplier = 1.0;
  } else if (baseOvr >= 60) {
    salaryMultiplier = 1.0;
    yearsMultiplier = 0.9;
  } else {
    salaryMultiplier = 0.8;
    yearsMultiplier = 0.8;
  }

  if (age > 32) {
    salaryMultiplier *= 0.9;
    yearsMultiplier *= 0.7;
  } else if (age > 28) {
    salaryMultiplier *= 0.95;
    yearsMultiplier *= 0.85;
  } else if (age < 25) {
    yearsMultiplier *= 1.2;
  }

  if (pot > baseOvr + 10) {
    salaryMultiplier *= 1.1;
  }

  const baseSalary = 500 + baseOvr * 30;
  const minSalary = Math.round(baseSalary * salaryMultiplier);
  
  const baseYears = Math.max(1, Math.min(5, 4 - Math.floor(age / 10)));
  const minYears = Math.round(bound(baseYears * yearsMultiplier, 1, 5));

  return {
    minSalary,
    minYears,
    willingToAccept: true,
  };
}

export function evaluateOffer(
  player: Player,
  demand: FreeAgentDemand,
  offer: { salary: number; years: number; team: Team }
): { accepted: boolean; reason: string } {
  if (offer.salary < demand.minSalary * 0.7) {
    return { 
      accepted: false, 
      reason: `Salary too low (demands at least ${demand.minSalary}k)` 
    };
  }

  if (offer.years < demand.minYears) {
    return { 
      accepted: false, 
      reason: `Contract too short (wants at least ${demand.minYears} years)` 
    };
  }

  const teamPayroll = 0;
  if (offer.team.budget && teamPayroll + offer.salary > offer.team.budget) {
    return { 
      accepted: false, 
      reason: 'Team would exceed salary cap' 
    };
  }

  let acceptChance = 0.5;

  if (offer.salary >= demand.minSalary * 1.3) {
    acceptChance += 0.3;
  } else if (offer.salary >= demand.minSalary * 1.1) {
    acceptChance += 0.2;
  } else if (offer.salary >= demand.minSalary) {
    acceptChance += 0.1;
  }

  if (offer.years >= demand.minYears + 2) {
    acceptChance += 0.1;
  }

  if (offer.team.market === 'huge') {
    acceptChance += 0.15;
  } else if (offer.team.market === 'large') {
    acceptChance += 0.08;
  }

  if (offer.team.strength === 'elite') {
    acceptChance += 0.1;
  } else if (offer.team.strength === 'strong') {
    acceptChance += 0.05;
  }

  const age = player.age;
  if (age > 32) {
    acceptChance -= 0.1;
  }

  const roll = Math.random();
  
  if (roll < acceptChance) {
    return { accepted: true, reason: 'Player accepted your offer!' };
  } else {
    return { accepted: false, reason: 'Player declined your offer. Try improving the terms.' };
  }
}

export function signFreeAgent(
  player: Player,
  team: Team,
  salary: number,
  years: number,
  season: number
): void {
  player.tid = team.tid;
  player.contract = {
    amount: salary,
    exp: season + years,
    years: years,
    incentives: 0,
    signingBonus: Math.round(salary * 0.2),
    guaranteed: Math.round(salary * years * 0.5),
    options: [],
    noTrade: false,
  };
}

export function releasePlayer(player: Player): void {
  player.tid = undefined;
  player.contract = undefined;
}

export function generateFreeAgentPool(
  players: Player[],
  count: number,
  season: number
): Player[] {
  const freeAgents: Player[] = [];
  
  for (let i = 0; i < count; i++) {
    const age = Math.floor(Math.random() * 15) + 24;
    const positions = ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'CB', 'S', 'K', 'P'] as const;
    const pos = positions[Math.floor(Math.random() * positions.length)];
    
    const ovr = truncGauss(55, 15, 40, 85);
    const pot = truncGauss(ovr + 5, 10, ovr, 90);
    
    const player = {
      pid: 10000 + i,
      tid: undefined,
      name: `FA Player ${i + 1}`,
      age,
      bornYear: season - age,
      bornLoc: 'Unknown',
      pos,
      ovr,
      pot,
      ovrs: {},
      pots: {},
      ratingsIndex: 0,
      statsIndex: 0,
      draft: {
        year: season - 5,
        round: Math.floor(Math.random() * 7) + 1,
        pick: Math.floor(Math.random() * 32) + 1,
        tid: -1,
        originalTid: -1,
        pot,
        ovr,
        skills: [],
      },
      numBrothers: 0,
      numSons: 0,
      hallOfFame: false,
      hgt: 70,
      stre: truncGauss(50, 15, 20, 90),
      spd: truncGauss(50, 15, 20, 90),
      endu: truncGauss(50, 15, 20, 90),
      thv: truncGauss(50, 15, 20, 90),
      thp: truncGauss(50, 15, 20, 90),
      tha: truncGauss(50, 15, 20, 90),
      bsc: truncGauss(50, 15, 20, 90),
      elu: truncGauss(50, 15, 20, 90),
      rtr: truncGauss(50, 15, 20, 90),
      hnd: truncGauss(50, 15, 20, 90),
      rbk: truncGauss(50, 15, 20, 90),
      pbk: truncGauss(50, 15, 20, 90),
      pcv: truncGauss(50, 15, 20, 90),
      tck: truncGauss(50, 15, 20, 90),
      prs: truncGauss(50, 15, 20, 90),
      rns: truncGauss(50, 15, 20, 90),
      kpw: truncGauss(50, 15, 20, 90),
      kac: truncGauss(50, 15, 20, 90),
      ppw: truncGauss(50, 15, 20, 90),
      pac: truncGauss(50, 15, 20, 90),
      fuzz: 0,
    } as unknown as Player;

    freeAgents.push(player);
  }

  return freeAgents.sort((a, b) => b.ovr - a.ovr);
}
