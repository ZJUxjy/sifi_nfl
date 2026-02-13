import type { TeamNum, PlayerGameSim } from './types';

export type PenaltyType =
  | 'offsides'
  | 'falseStart'
  | 'holding'
  | 'defensiveHolding'
  | 'passInterference'
  | 'defensivePassInterference'
  | 'illegalBlock'
  | 'illegalContact'
  | 'roughingPasser'
  | 'roughingKicker'
  | 'facemask'
  | 'unnecessaryRoughness'
  | 'unsportsmanlikeConduct'
  | 'delayOfGame'
  | 'illegalFormation'
  | 'illegalMotion'
  | 'encroachment'
  | 'neutralZoneInfraction'
  | 'illegalUseOfHands'
  | 'clipping'
  | 'tripping'
  | 'taunting';

export type PenaltyInfo = {
  name: string;
  yards: number;
  automaticFirstDown: boolean;
  isDeadBall: boolean;
  isSpotFoul: boolean;
  isOffensive: boolean;
};

export const PENALTIES: Record<PenaltyType, PenaltyInfo> = {
  offsides: {
    name: 'Offsides',
    yards: 5,
    automaticFirstDown: false,
    isDeadBall: false,
    isSpotFoul: false,
    isOffensive: false,
  },
  falseStart: {
    name: 'False Start',
    yards: 5,
    automaticFirstDown: false,
    isDeadBall: true,
    isSpotFoul: false,
    isOffensive: true,
  },
  holding: {
    name: 'Offensive Holding',
    yards: 10,
    automaticFirstDown: false,
    isDeadBall: false,
    isSpotFoul: true,
    isOffensive: true,
  },
  defensiveHolding: {
    name: 'Defensive Holding',
    yards: 5,
    automaticFirstDown: true,
    isDeadBall: false,
    isSpotFoul: false,
    isOffensive: false,
  },
  passInterference: {
    name: 'Offensive Pass Interference',
    yards: 10,
    automaticFirstDown: false,
    isDeadBall: false,
    isSpotFoul: true,
    isOffensive: true,
  },
  defensivePassInterference: {
    name: 'Defensive Pass Interference',
    yards: 0,
    automaticFirstDown: true,
    isDeadBall: false,
    isSpotFoul: true,
    isOffensive: false,
  },
  illegalBlock: {
    name: 'Illegal Block',
    yards: 10,
    automaticFirstDown: false,
    isDeadBall: false,
    isSpotFoul: true,
    isOffensive: true,
  },
  illegalContact: {
    name: 'Illegal Contact',
    yards: 5,
    automaticFirstDown: true,
    isDeadBall: false,
    isSpotFoul: false,
    isOffensive: false,
  },
  roughingPasser: {
    name: 'Roughing the Passer',
    yards: 15,
    automaticFirstDown: true,
    isDeadBall: false,
    isSpotFoul: false,
    isOffensive: false,
  },
  roughingKicker: {
    name: 'Roughing the Kicker',
    yards: 15,
    automaticFirstDown: true,
    isDeadBall: false,
    isSpotFoul: false,
    isOffensive: false,
  },
  facemask: {
    name: 'Facemask',
    yards: 15,
    automaticFirstDown: true,
    isDeadBall: false,
    isSpotFoul: false,
    isOffensive: false,
  },
  unnecessaryRoughness: {
    name: 'Unnecessary Roughness',
    yards: 15,
    automaticFirstDown: true,
    isDeadBall: false,
    isSpotFoul: false,
    isOffensive: false,
  },
  unsportsmanlikeConduct: {
    name: 'Unsportsmanlike Conduct',
    yards: 15,
    automaticFirstDown: true,
    isDeadBall: true,
    isSpotFoul: false,
    isOffensive: false,
  },
  delayOfGame: {
    name: 'Delay of Game',
    yards: 5,
    automaticFirstDown: false,
    isDeadBall: true,
    isSpotFoul: false,
    isOffensive: true,
  },
  illegalFormation: {
    name: 'Illegal Formation',
    yards: 5,
    automaticFirstDown: false,
    isDeadBall: true,
    isSpotFoul: false,
    isOffensive: true,
  },
  illegalMotion: {
    name: 'Illegal Motion',
    yards: 5,
    automaticFirstDown: false,
    isDeadBall: true,
    isSpotFoul: false,
    isOffensive: true,
  },
  encroachment: {
    name: 'Encroachment',
    yards: 5,
    automaticFirstDown: false,
    isDeadBall: true,
    isSpotFoul: false,
    isOffensive: false,
  },
  neutralZoneInfraction: {
    name: 'Neutral Zone Infraction',
    yards: 5,
    automaticFirstDown: false,
    isDeadBall: true,
    isSpotFoul: false,
    isOffensive: false,
  },
  illegalUseOfHands: {
    name: 'Illegal Use of Hands',
    yards: 10,
    automaticFirstDown: true,
    isDeadBall: false,
    isSpotFoul: false,
    isOffensive: false,
  },
  clipping: {
    name: 'Clipping',
    yards: 15,
    automaticFirstDown: false,
    isDeadBall: false,
    isSpotFoul: true,
    isOffensive: true,
  },
  tripping: {
    name: 'Tripping',
    yards: 10,
    automaticFirstDown: true,
    isDeadBall: false,
    isSpotFoul: false,
    isOffensive: false,
  },
  taunting: {
    name: 'Taunting',
    yards: 15,
    automaticFirstDown: true,
    isDeadBall: true,
    isSpotFoul: false,
    isOffensive: false,
  },
};

export type GamePenalty = {
  type: PenaltyType;
  info: PenaltyInfo;
  player: PlayerGameSim;
  team: TeamNum;
  accepted: boolean;
  spotYards?: number;
};

const OFFENSIVE_PENALTY_TYPES: PenaltyType[] = [
  'falseStart',
  'holding',
  'passInterference',
  'illegalBlock',
  'delayOfGame',
  'illegalFormation',
  'illegalMotion',
  'clipping',
];

const DEFENSIVE_PENALTY_TYPES: PenaltyType[] = [
  'offsides',
  'defensiveHolding',
  'defensivePassInterference',
  'illegalContact',
  'roughingPasser',
  'roughingKicker',
  'facemask',
  'unnecessaryRoughness',
  'unsportsmanlikeConduct',
  'encroachment',
  'neutralZoneInfraction',
  'illegalUseOfHands',
  'tripping',
  'taunting',
];

export function generateRandomPenalty(
  isOffense: boolean,
  player: PlayerGameSim,
  team: TeamNum
): GamePenalty | null {
  const basePenaltyProb = 0.08;
  
  if (Math.random() > basePenaltyProb) {
    return null;
  }

  const penaltyTypes = isOffense ? OFFENSIVE_PENALTY_TYPES : DEFENSIVE_PENALTY_TYPES;
  const type = penaltyTypes[Math.floor(Math.random() * penaltyTypes.length)]!;
  
  return {
    type,
    info: PENALTIES[type],
    player,
    team,
    accepted: true,
  };
}

export function shouldAcceptPenalty(
  penalty: GamePenalty,
  scrimmage: number,
  down: number,
  toGo: number,
  resultYards: number,
  isScoringPlay: boolean
): boolean {
  if (isScoringPlay && penalty.info.isOffensive) {
    return false;
  }
  
  if (isScoringPlay && !penalty.info.isOffensive) {
    return true;
  }
  
  const netYardsAfterPenalty = penalty.info.isOffensive
    ? resultYards - penalty.info.yards
    : resultYards + penalty.info.yards;
  
  if (netYardsAfterPenalty >= toGo) {
    return !penalty.info.isOffensive;
  }
  
  if (down === 4) {
    return penalty.info.isOffensive ? resultYards >= 0 : resultYards < toGo;
  }
  
  if (penalty.info.automaticFirstDown && !penalty.info.isOffensive) {
    return true;
  }
  
  return Math.random() < 0.7;
}

export function applyPenalty(
  penalty: GamePenalty,
  scrimmage: number,
  toGo: number
): { newScrimmage: number; newToGo: number; firstDown: boolean } {
  const yards = penalty.info.yards;
  let newScrimmage = scrimmage;
  let newToGo = toGo;
  let firstDown = penalty.info.automaticFirstDown;
  
  if (penalty.info.isOffensive) {
    newScrimmage = Math.max(1, scrimmage - yards);
    if (yards >= toGo) {
      newToGo = 10;
    } else {
      newToGo = toGo + yards;
    }
  } else {
    if (penalty.info.isSpotFoul && penalty.spotYards !== undefined) {
      newScrimmage = Math.min(99, scrimmage + penalty.spotYards);
    } else {
      newScrimmage = Math.min(99, scrimmage + yards);
    }
    firstDown = true;
  }
  
  if (penalty.info.type === 'defensivePassInterference') {
    if (penalty.spotYards !== undefined) {
      newScrimmage = Math.min(99, scrimmage + penalty.spotYards);
    }
    firstDown = true;
  }
  
  return { newScrimmage, newToGo, firstDown };
}
