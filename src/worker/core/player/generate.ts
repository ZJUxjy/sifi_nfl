import type { Position, Contract, Region } from '../../../common/types';
import type { Player } from '../../../common/entities';
import { POSITIONS } from '../../../common/constants';
import { truncGauss, randInt, choice, bound } from '../../../common/random';
import { randomName } from '../../../common/names';
import { calculateOvr, calculateAllOvrs } from './ovr';
import { REGION_LEAGUE_STRUCTURE } from '../../../common/constants.football';

// Generate contract based on player OVR, age, potential, and region
function generateContract(
  ovr: number,
  age: number,
  pot: number,
  currentSeason: number,
  region?: Region
): Contract {
  // Get region-specific contract limits
  const regionConfig = region ? REGION_LEAGUE_STRUCTURE[region as keyof typeof REGION_LEAGUE_STRUCTURE] : null;
  const minContract = regionConfig?.minContract ?? 500000;  // Default $500K
  const maxContract = regionConfig?.maxContract ?? 50000000; // Default $50M

  // Base salary calculation
  // Higher OVR = exponentially higher salary (star players cost much more)
  const ovrFactor = Math.pow(ovr / 50, 2);  // Exponential scaling
  const ageFactor = 30 - Math.abs(age - 27); // Peak at age 27
  const potFactor = (pot - 50) * 0.1;

  // Base amount in millions, then convert to actual dollars
  const baseM = ovrFactor * 3 + ageFactor * 0.1 + potFactor * 0.2;
  const baseAmount = baseM * 1000000; // Convert to dollars

  // Add randomness (+/- 20%)
  const randomFactor = 0.8 + Math.random() * 0.4;
  let amount = Math.round(baseAmount * randomFactor);

  // Clamp to region limits
  amount = Math.max(minContract, Math.min(maxContract, amount));

  // Contract length: younger players get longer contracts
  let years: number;
  if (age < 25) {
    years = randInt(3, 5);
  } else if (age < 30) {
    years = randInt(2, 4);
  } else {
    years = randInt(1, 2);
  }

  return {
    amount,
    exp: currentSeason + years,
    years,
    incentives: Math.round(amount * 0.1),
    signingBonus: Math.round(amount * 0.15),
    guaranteed: Math.round(amount * years * 0.5),
    noTrade: ovr >= 85, // Elite players get no-trade clause
  };
}

const POSITION_WEIGHTS: Record<Position, Record<keyof PlayerRatings, number>> = {
  QB: {
    hgt: 0.5, stre: 0.3, spd: 0.7, endu: 0.8,
    thv: 2.0, thp: 1.5, tha: 1.8, bsc: 0.5, elu: 0.4,
    rtr: 0.3, hnd: 0.2, rbk: 0.1, pbk: 0.1,
    pcv: 0.1, tck: 0.1, prs: 0.1, rns: 0.1,
    kpw: 0.1, kac: 0.1, ppw: 0.1, pac: 0.1,
  },
  RB: {
    hgt: 0.3, stre: 0.8, spd: 1.5, endu: 1.0,
    thv: 0.1, thp: 0.1, tha: 0.2, bsc: 1.8, elu: 1.5,
    rtr: 1.2, hnd: 0.8, rbk: 0.3, pbk: 0.2,
    pcv: 0.1, tck: 0.2, prs: 0.1, rns: 0.1,
    kpw: 0.1, kac: 0.1, ppw: 0.1, pac: 0.1,
  },
  WR: {
    hgt: 0.5, stre: 0.4, spd: 1.8, endu: 0.9,
    thv: 0.1, thp: 0.1, tha: 0.2, bsc: 0.8, elu: 1.8,
    rtr: 1.5, hnd: 1.5, rbk: 0.1, pbk: 0.1,
    pcv: 0.2, tck: 0.1, prs: 0.1, rns: 0.1,
    kpw: 0.1, kac: 0.1, ppw: 0.1, pac: 0.1,
  },
  TE: {
    hgt: 0.8, stre: 1.0, spd: 0.8, endu: 0.9,
    thv: 0.1, thp: 0.1, tha: 0.3, bsc: 0.6, elu: 1.0,
    rtr: 1.0, hnd: 1.5, rbk: 0.6, pbk: 0.4,
    pcv: 0.2, tck: 0.2, prs: 0.1, rns: 0.1,
    kpw: 0.1, kac: 0.1, ppw: 0.1, pac: 0.1,
  },
  OL: {
    hgt: 1.0, stre: 2.0, spd: 0.3, endu: 0.8,
    thv: 0.1, thp: 0.1, tha: 0.1, bsc: 0.2, elu: 0.2,
    rtr: 0.1, hnd: 0.1, rbk: 1.8, pbk: 1.8,
    pcv: 0.1, tck: 0.2, prs: 0.2, rns: 0.2,
    kpw: 0.1, kac: 0.1, ppw: 0.1, pac: 0.1,
  },
  DL: {
    hgt: 0.8, stre: 1.8, spd: 0.7, endu: 0.9,
    thv: 0.1, thp: 0.1, tha: 0.1, bsc: 0.3, elu: 0.3,
    rtr: 0.1, hnd: 0.1, rbk: 0.1, pbk: 0.1,
    pcv: 0.2, tck: 1.0, prs: 1.8, rns: 1.0,
    kpw: 0.1, kac: 0.1, ppw: 0.1, pac: 0.1,
  },
  LB: {
    hgt: 0.6, stre: 1.2, spd: 1.0, endu: 1.0,
    thv: 0.1, thp: 0.1, tha: 0.2, bsc: 0.5, elu: 0.6,
    rtr: 0.2, hnd: 0.3, rbk: 0.2, pbk: 0.2,
    pcv: 0.8, tck: 1.8, prs: 1.2, rns: 1.2,
    kpw: 0.1, kac: 0.1, ppw: 0.1, pac: 0.1,
  },
  CB: {
    hgt: 0.4, stre: 0.5, spd: 1.8, endu: 0.9,
    thv: 0.1, thp: 0.1, tha: 0.2, bsc: 0.6, elu: 1.5,
    rtr: 0.8, hnd: 0.6, rbk: 0.1, pbk: 0.1,
    pcv: 2.0, tck: 0.8, prs: 0.3, rns: 0.5,
    kpw: 0.1, kac: 0.1, ppw: 0.1, pac: 0.1,
  },
  S: {
    hgt: 0.5, stre: 0.8, spd: 1.5, endu: 1.0,
    thv: 0.1, thp: 0.1, tha: 0.3, bsc: 0.6, elu: 1.0,
    rtr: 0.6, hnd: 0.5, rbk: 0.1, pbk: 0.1,
    pcv: 1.5, tck: 1.5, prs: 0.5, rns: 0.8,
    kpw: 0.1, kac: 0.1, ppw: 0.1, pac: 0.1,
  },
  K: {
    hgt: 0.3, stre: 0.4, spd: 0.3, endu: 0.6,
    thv: 0.1, thp: 0.1, tha: 0.1, bsc: 0.1, elu: 0.1,
    rtr: 0.1, hnd: 0.2, rbk: 0.1, pbk: 0.1,
    pcv: 0.1, tck: 0.1, prs: 0.1, rns: 0.1,
    kpw: 2.0, kac: 2.0, ppw: 0.5, pac: 0.5,
  },
  P: {
    hgt: 0.3, stre: 0.4, spd: 0.3, endu: 0.6,
    thv: 0.1, thp: 0.1, tha: 0.1, bsc: 0.1, elu: 0.1,
    rtr: 0.1, hnd: 0.2, rbk: 0.1, pbk: 0.1,
    pcv: 0.1, tck: 0.1, prs: 0.1, rns: 0.1,
    kpw: 0.5, kac: 0.5, ppw: 2.0, pac: 2.0,
  },
  KR: {
    hgt: 0.3, stre: 0.5, spd: 2.0, endu: 0.8,
    thv: 0.1, thp: 0.1, tha: 0.1, bsc: 1.5, elu: 1.5,
    rtr: 1.0, hnd: 0.5, rbk: 0.1, pbk: 0.1,
    pcv: 0.1, tck: 0.1, prs: 0.1, rns: 0.1,
    kpw: 0.1, kac: 0.1, ppw: 0.1, pac: 0.1,
  },
  PR: {
    hgt: 0.3, stre: 0.4, spd: 1.8, endu: 0.8,
    thv: 0.1, thp: 0.1, tha: 0.1, bsc: 1.5, elu: 1.8,
    rtr: 1.0, hnd: 0.6, rbk: 0.1, pbk: 0.1,
    pcv: 0.1, tck: 0.1, prs: 0.1, rns: 0.1,
    kpw: 0.1, kac: 0.1, ppw: 0.1, pac: 0.1,
  },
};

export type PlayerRatings = {
  hgt: number;
  stre: number;
  spd: number;
  endu: number;
  thv: number;
  thp: number;
  tha: number;
  bsc: number;
  elu: number;
  rtr: number;
  hnd: number;
  rbk: number;
  pbk: number;
  pcv: number;
  tck: number;
  prs: number;
  rns: number;
  kpw: number;
  kac: number;
  ppw: number;
  pac: number;
};

export function generateRatings(pos: Position, scoutingLevel: number = 0): PlayerRatings {
  const weights = POSITION_WEIGHTS[pos];
  const baseMean = 50 + scoutingLevel * 2;
  const baseSD = 15;

  const ratings: any = {};

  for (const [attr, weight] of Object.entries(weights)) {
    const adjustedMean = baseMean + (weight - 1) * 5;
    const adjustedSD = baseSD * (0.8 + weight * 0.2);
    ratings[attr] = bound(truncGauss(adjustedMean, adjustedSD, 0, 100), 0, 100);
  }

  return ratings as PlayerRatings;
}

export function generatePotential(isAmateur: boolean = false): number {
  if (isAmateur) {
    // Amateur players have lower potential ceiling
    return randInt(50, 70);
  }
  return truncGauss(50, 15, 0, 100);
}

export function generate(
  tid: number | undefined,
  age: number,
  draftYear: number,
  pos?: Position,
  scoutingLevel: number = 0,
  isAmateur: boolean = false,
  region?: Region
): Player {
  const position = pos ?? choice(POSITIONS);
  const ratings = generateRatings(position, scoutingLevel);
  const pot = generatePotential(isAmateur);
  const ovr = calculateOvr(ratings as any, position);

  const player: Player = {
    pid: 0,
    tid,
    name: randomName(),
    age,
    bornYear: draftYear - age,
    bornLoc: 'Metropolis',
    pos: position,
    ...ratings,
    fuzz: randInt(0, 10),
    ovr,
    pot,
    ovrs: {} as any,
    pots: {} as any,
    ratingsIndex: 0,
    statsIndex: 0,
    draft: {
      year: draftYear,
      round: 0,
      pick: 0,
      tid: -1,
      originalTid: -1,
      pot,
      ovr,
      skills: [],
    },
    numBrothers: 0,
    numSons: 0,
    hallOfFame: false,
  };

  // Generate contract for players assigned to a team
  if (tid !== undefined) {
    player.contract = generateContract(ovr, age, pot, draftYear, region);
  }

  player.ovrs = calculateAllOvrs(player);
  for (const p of POSITIONS) {
    player.pots[p] = pot;
  }

  return player;
}

export function develop(player: Player, years: number): void {
  const age = player.age + years;

  for (let i = 0; i < years; i++) {
    const currentAge = player.age + i;

    let growthRate: number;
    if (currentAge < 23) {
      growthRate = 2.5;
    } else if (currentAge < 28) {
      growthRate = 1.5;
    } else if (currentAge < 32) {
      growthRate = 0.5;
    } else if (currentAge < 36) {
      growthRate = -1.0;
    } else {
      growthRate = -3.0;
    }

    const attributes: (keyof PlayerRatings)[] = [
      'hgt', 'stre', 'spd', 'endu', 'thv', 'thp', 'tha', 'bsc', 'elu',
      'rtr', 'hnd', 'rbk', 'pbk', 'pcv', 'tck', 'prs', 'rns', 'kpw', 'kac', 'ppw', 'pac'
    ];

    for (const attr of attributes) {
      const currentVal = (player as any)[attr];
      const potential = player.pots[player.pos];
      const distanceToPotential = potential - currentVal;

      let change = growthRate;
      if (distanceToPotential > 0) {
        change += distanceToPotential * 0.05;
      } else {
        change += distanceToPotential * 0.02;
      }

      change += truncGauss(0, 2, -5, 5);

      (player as any)[attr] = bound(Math.round(currentVal + change), 0, 100);
    }
  }

  player.age = age;
  player.ovr = calculateOvr(player, player.pos);
  player.ovrs = calculateAllOvrs(player);
}

export function updateValues(player: Player): void {
  player.ovr = calculateOvr(player, player.pos);
  player.ovrs = calculateAllOvrs(player);
}
