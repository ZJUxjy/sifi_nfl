import type { Position } from '../../../common/types';
import type { Player, PlayerRatings } from '../../../common/entities';
import { POSITIONS } from '../../../common/constants';

// Canonical list of the 21 player rating keys. Single source of truth for
// per-position rating tables; both ovr.ts (this file) and generate.ts depend on it
// so a new rating cannot be added without updating both call sites.
export const RATINGS_KEYS = [
  'hgt', 'stre', 'spd', 'endu',
  'thv', 'thp', 'tha', 'bsc', 'elu',
  'rtr', 'hnd', 'rbk', 'pbk',
  'pcv', 'tck', 'prs', 'rns',
  'kpw', 'kac', 'ppw', 'pac',
] as const;

export type RatingsKey = (typeof RATINGS_KEYS)[number];

// Per-position rating-generation weights used by generate.ts to bias rating
// distributions during player creation. Lives here next to calculateOvr() so the
// two stay aligned: positions whose OVR formula leans on a rating should also
// generate that rating with a higher weight here.
//
// Note: this is a different *view* than the inline OVR formulas in
// calculateOvr() below — formulas only reference the 4-6 ratings that define a
// position's overall, while this table covers all 21 ratings (with 0.1 baseline
// for non-relevant ones). Drift between the two is caught by the regression
// test in src/test/player.weights.consistency.test.ts.
export const POSITION_RATING_WEIGHTS: Record<Position, Record<RatingsKey, number>> = {
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

export function calculateOvr(ratings: PlayerRatings, pos: Position): number {
  let ovr = 50;

  switch (pos) {
    case 'QB':
      ovr = (ratings.thv * 2 + ratings.thp + ratings.tha + ratings.spd + ratings.bsc + ratings.elu) / 6;
      break;
    case 'RB':
      ovr = (ratings.bsc * 2 + ratings.elu + ratings.rtr + ratings.hnd + ratings.spd + ratings.stre) / 6;
      break;
    case 'WR':
      ovr = (ratings.elu * 2 + ratings.rtr + ratings.hnd + ratings.spd + ratings.bsc) / 5;
      break;
    case 'TE':
      ovr = (ratings.hnd * 2 + ratings.elu + ratings.rtr + ratings.bsc + ratings.stre) / 5;
      break;
    case 'OL':
      ovr = (ratings.stre * 2 + ratings.rbk + ratings.pbk) / 4;
      break;
    case 'DL':
      ovr = (ratings.stre * 2 + ratings.prs + ratings.tck + ratings.spd) / 5;
      break;
    case 'LB':
      ovr = (ratings.tck * 2 + ratings.prs + ratings.rns + ratings.spd) / 5;
      break;
    case 'CB':
      ovr = (ratings.pcv * 2 + ratings.elu + ratings.spd) / 4;
      break;
    case 'S':
      ovr = (ratings.pcv * 2 + ratings.tck + ratings.elu + ratings.spd) / 5;
      break;
    case 'K':
      ovr = (ratings.kpw + ratings.kac) / 2;
      break;
    case 'P':
      ovr = (ratings.ppw + ratings.pac) / 2;
      break;
    case 'KR':
      ovr = (ratings.spd * 2 + ratings.elu + ratings.bsc) / 4;
      break;
    case 'PR':
      ovr = (ratings.elu * 2 + ratings.spd + ratings.bsc) / 4;
      break;
  }

  return Math.round(ovr);
}

export function calculateAllOvrs(ratings: PlayerRatings): Record<Position, number> {
  const ovrs: Partial<Record<Position, number>> = {};

  for (const pos of POSITIONS) {
    ovrs[pos] = calculateOvr(ratings, pos);
  }

  return ovrs as Record<Position, number>;
}

export function calculateCompositeRatings(ratings: PlayerRatings): {
  passingAccuracy: number;
  passingDeep: number;
  passingVision: number;
  athleticism: number;
  rushing: number;
  catching: number;
  gettingOpen: number;
  passBlocking: number;
  runBlocking: number;
  passRushing: number;
  runStopping: number;
  passCoverage: number;
  tackling: number;
  avoidingSacks: number;
  ballSecurity: number;
  endurance: number;
  kpw: number;
  kac: number;
  ppw: number;
  pac: number;
} {
  return {
    passingAccuracy: (ratings.thv + ratings.tha) / 2,
    passingDeep: (ratings.thv + ratings.thp) / 2,
    passingVision: ratings.thv,
    athleticism: (ratings.spd + ratings.bsc + ratings.elu) / 3,
    rushing: (ratings.bsc + ratings.elu + ratings.rtr + ratings.spd) / 4,
    catching: (ratings.hnd + ratings.elu + ratings.spd) / 3,
    gettingOpen: (ratings.elu + ratings.spd) / 2,
    passBlocking: (ratings.rbk + ratings.pbk + ratings.stre) / 3,
    runBlocking: (ratings.rbk + ratings.pbk + ratings.stre) / 3,
    passRushing: (ratings.prs + ratings.stre + ratings.spd) / 3,
    runStopping: (ratings.tck + ratings.rns + ratings.stre) / 3,
    passCoverage: (ratings.pcv + ratings.elu + ratings.spd) / 3,
    tackling: (ratings.tck + ratings.stre + ratings.spd) / 3,
    avoidingSacks: (ratings.elu + ratings.spd) / 2,
    ballSecurity: (ratings.hnd + ratings.bsc) / 2,
    endurance: ratings.endu,
    kpw: ratings.kpw || 50,
    kac: ratings.kac || 50,
    ppw: ratings.ppw || 50,
    pac: ratings.pac || 50,
  };
}

export function updateOvr(player: Player): void {
  player.ovr = calculateOvr(player, player.pos);
  player.ovrs = calculateAllOvrs(player);
}

export function updateAllOvrs(players: Player[]): void {
  for (const player of players) {
    updateOvr(player);
  }
}
