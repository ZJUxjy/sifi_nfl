import type { Player } from '@common/entities';
import type { Region, DraftPick } from '@common/types';
import { generate, generatePotential } from '../player/generate';
import { calculateBaseSalary } from '../contract/negotiation';
import { REGION_LEAGUE_STRUCTURE, ORIGIN_DRAFT_ELIGIBILITY } from '@common/constants.football';
import { truncGauss } from '@common/random';

export interface DraftProspect extends Player {
  projectedRound: number;
  combineResults: {
    fortyTime: number;
    benchPress: number;
    verticalJump: number;
    broadJump: number;
  };
}

export function generateDraftPool(season: number, numPlayers: number = 224): DraftProspect[] {
  const prospects: DraftProspect[] = [];

  // Use season-based offset to create unique PIDs (e.g., season 2025 -> PIDs start at 2025000)
  let pid = season * 10000;

  for (let i = 0; i < numPlayers; i++) {
    const age = Math.random() < 0.7 ? 21 : 22;
    const prospect = generate(undefined, age, season, undefined, 0) as DraftProspect;
    prospect.pid = pid++;
    
    prospect.draft.year = season;
    prospect.draft.round = 0;
    prospect.draft.pick = 0;
    
    const talentScore = prospect.ovr + (prospect.pot - prospect.ovr) * 0.5;
    if (talentScore >= 75) {
      prospect.projectedRound = 1;
    } else if (talentScore >= 68) {
      prospect.projectedRound = truncGauss(2, 0.5, 1, 3);
    } else if (talentScore >= 62) {
      prospect.projectedRound = truncGauss(4, 1, 2, 6);
    } else if (talentScore >= 55) {
      prospect.projectedRound = truncGauss(6, 1, 4, 7);
    } else {
      prospect.projectedRound = 7;
    }
    
    prospect.combineResults = {
      fortyTime: 4.3 + Math.random() * 0.6,
      benchPress: Math.floor(15 + Math.random() * 20),
      verticalJump: 30 + Math.random() * 12,
      broadJump: 100 + Math.random() * 40,
    };
    
    prospects.push(prospect);
  }
  
  return prospects.sort((a, b) => (b.ovr + b.pot) - (a.ovr + a.pot));
}

export function calculateDraftOrder(
  teams: { tid: number; won: number; lost: number; region: Region }[],
  season: number
): number[] {
  const sorted = [...teams].sort((a, b) => {
    const winPctA = a.won / (a.won + a.lost || 1);
    const winPctB = b.won / (b.won + b.lost || 1);
    return winPctA - winPctB;
  });
  
  return sorted.map(t => t.tid);
}

export function generateDraftPicks(
  teams: { tid: number; region: Region; won: number; lost: number }[],
  season: number,
  numRounds: number = 7
): DraftPick[] {
  const picks: DraftPick[] = [];
  const order = calculateDraftOrder(teams, season);

  // Old code used `let dpid = 1`, which collided across seasons (every
  // season's pick #1 had dpid 1). Namespacing by season keeps dpids
  // globally unique up to 999 picks per season.
  let dpid = season * 1000 + 1;
  for (let round = 1; round <= numRounds; round++) {
    for (let i = 0; i < order.length; i++) {
      picks.push({
        dpid: dpid++,
        tid: order[i],
        originalTid: order[i],
        round,
        pick: i + 1,
        season,
      });
    }
  }

  return picks;
}

export function selectPlayer(
  teamTid: number,
  prospect: DraftProspect,
  pick: DraftPick,
  season: number
): Player {
  prospect.tid = teamTid;
  prospect.draft.round = pick.round;
  prospect.draft.pick = pick.pick;
  prospect.draft.tid = teamTid;
  
  const rookieContractYears = pick.round <= 2 ? 4 : 3;
  const rookieSalary = calculateBaseSalary(prospect) * (pick.round === 1 ? 0.8 : 0.6);
  
  prospect.contract = {
    amount: Math.round(rookieSalary),
    exp: season + rookieContractYears,
    years: rookieContractYears,
    incentives: 0,
    signingBonus: Math.round(rookieSalary * 0.5),
    guaranteed: Math.round(rookieSalary * rookieContractYears * 0.8),
    options: [],
    noTrade: false,
  };
  
  return prospect;
}

export function getEligiblePlayersForOriginDraft(
  players: Player[],
  season: number
): Player[] {
  return players.filter(player => {
    if (player.tid === undefined) return false;
    if (player.region === 'originContinent') return false;
    
    const eligibility = ORIGIN_DRAFT_ELIGIBILITY[player.region];
    if (!eligibility) return false;
    
    if (eligibility.minAge && player.age < eligibility.minAge) {
      return false;
    }
    
    const seasonsPlayed = season - player.draft.year;
    if (eligibility.minSeasons && seasonsPlayed < eligibility.minSeasons) {
      return false;
    }
    
    return true;
  });
}

export function runOriginDraft(
  originTeams: { tid: number }[],
  eligiblePlayers: Player[],
  season: number
): { player: Player; teamTid: number; bid: number }[] {
  const results: { player: Player; teamTid: number; bid: number }[] = [];
  const shuffledPlayers = [...eligiblePlayers].sort(() => Math.random() - 0.5);
  
  for (const player of shuffledPlayers.slice(0, 20)) {
    const bids = originTeams.map(team => ({
      teamTid: team.tid,
      bid: Math.round(calculateBaseSalary(player) * (1.5 + Math.random())),
    }));
    
    bids.sort((a, b) => b.bid - a.bid);
    const winningBid = bids[0];
    
    player.tid = winningBid.teamTid;
    player.contract = {
      amount: Math.round(winningBid.bid * 2),
      exp: season + 3,
      years: 3,
      incentives: 0,
      signingBonus: Math.round(winningBid.bid * 0.3),
      guaranteed: Math.round(winningBid.bid * 2),
      options: [],
      noTrade: false,
    };
    
    results.push({
      player,
      teamTid: winningBid.teamTid,
      bid: winningBid.bid,
    });
  }
  
  return results;
}
