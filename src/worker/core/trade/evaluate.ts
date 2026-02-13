import type { DraftPick } from '../../../common/types';
import type { Player } from '../../../common/entities';

export interface TradeAsset {
  type: 'player' | 'pick' | 'cash';
  value: number;
  data: Player | DraftPick | number;
}

export interface TradeProposal {
  fromTeam: number;
  toTeam: number;
  fromAssets: TradeAsset[];
  toAssets: TradeAsset[];
  status: 'pending' | 'accepted' | 'rejected';
}

export function calculatePlayerValue(player: Player): number {
  const ovrWeight = player.ovr * 10;
  const ageWeight = Math.max(0, (30 - player.age) * 5);
  const potWeight = (player.pot - player.ovr) * 3;
  
  let contractValue = 0;
  if (player.contract) {
    const yearsRemaining = player.contract.exp - new Date().getFullYear();
    contractValue = yearsRemaining * 100;
    if (player.contract.amount < 2000) {
      contractValue += 500;
    }
  }
  
  return ovrWeight + ageWeight + potWeight + contractValue;
}

export function calculatePickValue(pick: DraftPick): number {
  const roundMultiplier: Record<number, number> = {
    1: 1000,
    2: 700,
    3: 500,
    4: 350,
    5: 250,
    6: 150,
    7: 100,
  };
  
  const baseValue = roundMultiplier[pick.round] || 50;
  const pickAdjustment = (33 - pick.pick) * 5;
  
  return baseValue + pickAdjustment;
}

export function evaluateTrade(proposal: TradeProposal): { fair: boolean; fromValue: number; toValue: number } {
  const fromValue = proposal.fromAssets.reduce((sum, asset) => sum + asset.value, 0);
  const toValue = proposal.toAssets.reduce((sum, asset) => sum + asset.value, 0);
  
  const ratio = Math.min(fromValue, toValue) / Math.max(fromValue, toValue);
  const fair = ratio >= 0.85;
  
  return { fair, fromValue, toValue };
}

export function createTradeAsset(type: 'player' | 'pick' | 'cash', data: Player | DraftPick | number): TradeAsset {
  let value: number;
  
  switch (type) {
    case 'player':
      value = calculatePlayerValue(data as Player);
      break;
    case 'pick':
      value = calculatePickValue(data as DraftPick);
      break;
    case 'cash':
      value = (data as number) / 10;
      break;
    default:
      value = 0;
  }
  
  return {
    type,
    value,
    data,
  };
}

export function proposeTrade(
  fromTeam: number,
  toTeam: number,
  fromAssets: TradeAsset[],
  toAssets: TradeAsset[]
): TradeProposal {
  return {
    fromTeam,
    toTeam,
    fromAssets,
    toAssets,
    status: 'pending',
  };
}

export function shouldAcceptTrade(proposal: TradeProposal, isAITeam: boolean): boolean {
  const evaluation = evaluateTrade(proposal);
  
  const aiReceivesValue = evaluation.fromValue;
  const aiGivesValue = evaluation.toValue;
  
  if (!evaluation.fair) {
    const valueRatio = aiReceivesValue / aiGivesValue;
    
    if (valueRatio < 0.7) {
      return Math.random() < 0.05;
    }
    
    if (valueRatio < 0.85) {
      return Math.random() < 0.15;
    }
    
    return Math.random() < 0.9;
  }
  
  return Math.random() < 0.7;
}

export function executeTrade(proposal: TradeProposal, players: Player[], picks: DraftPick[]): boolean {
  if (proposal.status !== 'accepted') {
    return false;
  }
  
  for (const asset of proposal.fromAssets) {
    if (asset.type === 'player') {
      const player = asset.data as Player;
      player.tid = proposal.toTeam;
    } else if (asset.type === 'pick') {
      const pick = asset.data as DraftPick;
      pick.tid = proposal.toTeam;
      pick.originalTid = proposal.fromTeam;
    }
  }
  
  for (const asset of proposal.toAssets) {
    if (asset.type === 'player') {
      const player = asset.data as Player;
      player.tid = proposal.fromTeam;
    } else if (asset.type === 'pick') {
      const pick = asset.data as DraftPick;
      pick.tid = proposal.fromTeam;
      pick.originalTid = proposal.toTeam;
    }
  }
  
  return true;
}

export function isPlayerTradable(player: Player): boolean {
  if (player.gamesUntilTradable && player.gamesUntilTradable > 0) {
    return false;
  }
  
  if (player.contract?.noTrade) {
    return false;
  }
  
  return true;
}
