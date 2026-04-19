import type { Contract } from '../../../common/types';
import type { Player, Team } from '../../../common/entities';
import { REGION_LEAGUE_STRUCTURE } from '../../../common/constants.football';
import { truncGauss, bound } from '../../../common/random';

export interface ContractOffer {
  years: number;
  amount: number;
  signingBonus: number;
  guaranteed: number;
  playerOption?: boolean;
  teamOption?: boolean;
  noTrade?: boolean;
}

export function generateInitialContractDemand(
  player: Player,
  marketMultiplier: number = 1.0
): ContractOffer {
  const baseSalary = calculateBaseSalary(player);
  const adjustedSalary = Math.round(baseSalary * marketMultiplier);
  
  const years = calculateDesiredYears(player);
  const signingBonus = Math.round(adjustedSalary * 0.1 * years);
  const guaranteed = Math.round(adjustedSalary * years * 0.4);
  
  return {
    years,
    amount: adjustedSalary,
    signingBonus,
    guaranteed,
  };
}

export function calculateBaseSalary(player: Player): number {
  const ovrMultiplier = Math.pow(player.ovr / 70, 2);
  const ageFactor = player.age < 28 ? 1.2 : player.age < 32 ? 1.0 : 0.8;
  const potFactor = 1 + (player.pot - player.ovr) / 200;
  
  const positionMultiplier: Record<string, number> = {
    QB: 1.5,
    RB: 0.9,
    WR: 1.1,
    TE: 0.8,
    OL: 0.9,
    DL: 1.0,
    LB: 0.9,
    CB: 1.0,
    S: 0.8,
    K: 0.4,
    P: 0.3,
    KR: 0.3,
    PR: 0.3,
  };
  
  const baseSalary = 500 * ovrMultiplier * ageFactor * potFactor * (positionMultiplier[player.pos] || 1.0);
  return Math.round(bound(baseSalary, 500, 30000));
}

export function calculateDesiredYears(player: Player): number {
  if (player.age < 24) return truncGauss(4, 1, 2, 5);
  if (player.age < 28) return truncGauss(3, 1, 2, 5);
  if (player.age < 32) return truncGauss(2, 1, 1, 4);
  return truncGauss(1, 0, 1, 2);
}

export function negotiateContract(
  player: Player,
  teamOffer: ContractOffer,
  playerDemand: ContractOffer
): { accepted: boolean; counterOffer?: ContractOffer } {
  const teamTotal = teamOffer.amount * teamOffer.years + teamOffer.signingBonus;
  const playerTotal = playerDemand.amount * playerDemand.years + playerDemand.signingBonus;
  
  if (teamTotal >= playerTotal * 0.95) {
    return { accepted: true };
  }
  
  if (teamTotal < playerTotal * 0.7) {
    return { accepted: false };
  }
  
  const ratio = teamTotal / playerTotal;
  const counterYears = playerDemand.years;
  const counterAmount = Math.round(playerDemand.amount * (0.85 + ratio * 0.15));
  const counterBonus = Math.round(playerDemand.signingBonus * (0.8 + ratio * 0.2));
  
  return {
    accepted: false,
    counterOffer: {
      years: counterYears,
      amount: counterAmount,
      signingBonus: counterBonus,
      guaranteed: Math.round(counterAmount * counterYears * 0.35),
    },
  };
}

export function finalizeContract(
  player: Player,
  team: Team,
  offer: ContractOffer,
  season: number
): Contract {
  const contract: Contract = {
    amount: offer.amount,
    exp: season + offer.years,
    years: offer.years,
    incentives: 0,
    signingBonus: offer.signingBonus,
    guaranteed: offer.guaranteed,
    noTrade: offer.noTrade || false,
  };
  
  player.contract = contract;
  player.tid = team.tid;
  
  return contract;
}

export function releasePlayer(player: Player, team: Team): void {
  if (player.contract) {
    const deadCap = Math.round(player.contract.guaranteed * 0.5);
    team.cash -= deadCap;
  }
  
  player.tid = undefined;
  player.contract = undefined;
}

export function canAffordContract(team: Team, players: Player[], newContract: Contract): boolean {
  const currentSalary = calculateTotalSalary(players, team.tid);
  const projectedSalary = currentSalary + newContract.amount;
  
  return projectedSalary <= team.budget;
}

export function calculateTotalSalary(players: Player[], teamTid: number): number {
  return players
    .filter(p => p.tid === teamTid && p.contract)
    .reduce((total, p) => total + (p.contract?.amount || 0), 0);
}

export function checkSalaryCapCompliance(
  team: Team,
  players: Player[]
): { compliant: boolean; overage: number } {
  const region = team.region;
  const structure = REGION_LEAGUE_STRUCTURE[region];
  
  if (!structure.salaryCap) {
    return { compliant: true, overage: 0 };
  }
  
  const totalSalary = calculateTotalSalary(players, team.tid);
  const overage = Math.max(0, totalSalary - structure.salaryCap);
  
  return {
    compliant: overage === 0,
    overage,
  };
}

export function checkMinPayroll(
  team: Team,
  players: Player[]
): { compliant: boolean; shortfall: number } {
  const region = team.region;
  const structure = REGION_LEAGUE_STRUCTURE[region];
  
  if (!structure.minPayroll) {
    return { compliant: true, shortfall: 0 };
  }
  
  const totalSalary = calculateTotalSalary(players, team.tid);
  const shortfall = Math.max(0, structure.minPayroll - totalSalary);
  
  return {
    compliant: shortfall === 0,
    shortfall,
  };
}

export function calculateLuxuryTax(team: Team, players: Player[]): number {
  const region = team.region;
  const structure = REGION_LEAGUE_STRUCTURE[region];
  
  if (!structure.luxuryPayroll) {
    return 0;
  }
  
  const totalSalary = calculateTotalSalary(players, team.tid);
  
  if (totalSalary <= structure.luxuryPayroll) {
    return 0;
  }
  
  const overage = totalSalary - structure.luxuryPayroll;
  return Math.round(overage * 0.5);
}
