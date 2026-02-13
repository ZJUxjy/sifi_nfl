import type { Player, Position, PlayerRatings } from '../../../common/types';
import { POSITIONS } from '../../../common/constants';

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
