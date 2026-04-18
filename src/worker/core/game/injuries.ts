import type { PlayerGameSim } from './types';
import type { PlayerInjury } from '../../../common/types';

export type { PlayerInjury };

export type InjuryType =
  | 'bruise'
  | 'strain'
  | 'sprain'
  | 'fracture'
  | 'concussion'
  | 'tornLigament'
  | 'muscleTear';

export type InjuryInfo = {
  name: string;
  minGames: number;
  maxGames: number;
  ovrPenalty: number;
  severity: 'minor' | 'moderate' | 'severe' | 'seasonEnding';
};

export const INJURIES: Record<InjuryType, InjuryInfo> = {
  bruise: {
    name: 'Bruise',
    minGames: 0,
    maxGames: 1,
    ovrPenalty: 5,
    severity: 'minor',
  },
  strain: {
    name: 'Muscle Strain',
    minGames: 1,
    maxGames: 2,
    ovrPenalty: 10,
    severity: 'minor',
  },
  sprain: {
    name: 'Ligament Sprain',
    minGames: 2,
    maxGames: 4,
    ovrPenalty: 15,
    severity: 'moderate',
  },
  fracture: {
    name: 'Fracture',
    minGames: 4,
    maxGames: 8,
    ovrPenalty: 20,
    severity: 'severe',
  },
  concussion: {
    name: 'Concussion',
    minGames: 1,
    maxGames: 3,
    ovrPenalty: 0,
    severity: 'moderate',
  },
  tornLigament: {
    name: 'Torn Ligament (ACL/MCL)',
    minGames: 12,
    maxGames: 17,
    ovrPenalty: 25,
    severity: 'seasonEnding',
  },
  muscleTear: {
    name: 'Muscle Tear',
    minGames: 6,
    maxGames: 10,
    ovrPenalty: 20,
    severity: 'severe',
  },
};

const INJURY_WEIGHTS: { type: InjuryType; weight: number }[] = [
  { type: 'bruise', weight: 40 },
  { type: 'strain', weight: 25 },
  { type: 'sprain', weight: 18 },
  { type: 'fracture', weight: 6 },
  { type: 'concussion', weight: 6 },
  { type: 'tornLigament', weight: 3 },
  { type: 'muscleTear', weight: 2 },
];

export function generateInjury(player: PlayerGameSim): PlayerInjury | null {
  const baseInjuryProb = 0.015;
  const injuryProb = baseInjuryProb * (1 + (1 - player.energy) * 0.5);
  
  if (Math.random() > injuryProb) {
    return null;
  }
  
  const totalWeight = INJURY_WEIGHTS.reduce((sum, w) => sum + w.weight, 0);
  let random = Math.random() * totalWeight;
  
  let selectedType: InjuryType = 'bruise';
  for (const { type, weight } of INJURY_WEIGHTS) {
    random -= weight;
    if (random <= 0) {
      selectedType = type;
      break;
    }
  }
  
  const info = INJURIES[selectedType];
  const gamesRemaining = Math.floor(
    Math.random() * (info.maxGames - info.minGames + 1) + info.minGames
  );
  
  return {
    type: info.name,
    gamesRemaining,
    ovr: info.ovrPenalty,
  };
}

export function applyInjuryToPlayer(
  player: PlayerGameSim,
  injury: PlayerInjury
): void {
  player.injury = injury;
}

export function processInjuryRecovery(player: PlayerGameSim): boolean {
  if (!player.injury) return false;
  
  player.injury.gamesRemaining--;
  
  if (player.injury.gamesRemaining <= 0) {
    player.injury = undefined;
    return true;
  }
  
  return false;
}

export function isPlayerAvailable(player: PlayerGameSim): boolean {
  return !player.injury || player.injury.gamesRemaining <= 0;
}

export function getPlayerInjuredOvr(player: PlayerGameSim): number {
  if (!player.injury) return player.ovr;
  return Math.max(1, player.ovr - player.injury.ovr);
}

export function getWeeklyInjuryUpdate(players: PlayerGameSim[]): {
  recovered: PlayerGameSim[];
  stillInjured: PlayerGameSim[];
} {
  const recovered: PlayerGameSim[] = [];
  const stillInjured: PlayerGameSim[] = [];
  
  for (const player of players) {
    if (player.injury) {
      const isRecovered = processInjuryRecovery(player);
      if (isRecovered) {
        recovered.push(player);
      } else {
        stillInjured.push(player);
      }
    }
  }
  
  return { recovered, stillInjured };
}
