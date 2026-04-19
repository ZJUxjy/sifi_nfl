/**
 * Offseason Manager
 * Handles all season transition logic including:
 * - Player aging and development
 * - Player retirement
 * - Contract expirations
 * - Free agency
 * - Draft
 * - Promotion/relegation
 * - AI roster management
 * - New season preparation
 */

import type { Player } from '@common/entities';
import type { Team } from '@common/entities';
import type { Region, Contract } from '@common/types';
import { develop } from '../player/generate';
import {
  processRetirements,
  getRetirementReason,
  calculateHallOfFameChance,
} from '../player/retirement';
import { generateDraftPool } from '../draft';
import { generateFreeAgentPool } from '../freeAgent';
import type { TeamFinances } from '../../api/types';

// Helper to create a proper contract
function createContract(amount: number, years: number, season: number): Contract {
  return {
    amount,
    exp: season + years,
    years,
    incentives: 0,
    signingBonus: 0,
    guaranteed: Math.round(amount * years * 0.3),
    noTrade: false,
  };
}

// Roster limits
const MIN_ROSTER_SIZE = 25;
const MAX_ROSTER_SIZE = 53;
const PRACTICE_SQUAD_SIZE = 16;

// Mining Island has 4 stacked divisions; design says the bottom 3 of
// each tier swap with the top 3 of the tier directly below.
const PROMOTION_COUNT = 3;

export type TierMove = {
  tid: number;
  fromTier: number;
  toTier: number;
};

export type PromotionRelegationResult = {
  promoted: TierMove[];
  relegated: TierMove[];
};

/**
 * Apply Mining Island promotion / relegation in place.
 *
 * For every adjacent pair of populated tiers (1<->2, 2<->3, ...), the
 * bottom {@link PROMOTION_COUNT} teams of the upper tier (sorted by
 * `won` ascending) trade `tier` fields with the top
 * {@link PROMOTION_COUNT} teams of the lower tier (sorted by `won`
 * descending). Non-contiguous tier numbers (e.g. only tier 1 and 3
 * exist) are NOT bridged; teams stay where they are.
 *
 * Mutates `teams` and returns lists describing every swap.
 */
export function promoteRelegateMiningIsland(teams: Team[]): PromotionRelegationResult {
  const promoted: TierMove[] = [];
  const relegated: TierMove[] = [];

  const populatedTiers = [...new Set(teams.map(t => t.tier).filter((x): x is number => typeof x === 'number'))]
    .sort((a, b) => a - b);

  // Snapshot the tier assignments first so that a team that is just
  // promoted out of, say, tier 2 isn't immediately re-considered as
  // a "tier 2 team" when we process the 2<->3 boundary.
  const originalTier = new Map<number, number>();
  for (const t of teams) {
    if (typeof t.tier === 'number') {
      originalTier.set(t.tid, t.tier);
    }
  }

  for (let i = 0; i < populatedTiers.length - 1; i++) {
    const upperTier = populatedTiers[i];
    const lowerTier = populatedTiers[i + 1];
    if (lowerTier !== upperTier + 1) {
      continue;
    }

    const upper = teams
      .filter(t => originalTier.get(t.tid) === upperTier)
      .sort((a, b) => a.won - b.won);
    const lower = teams
      .filter(t => originalTier.get(t.tid) === lowerTier)
      .sort((a, b) => b.won - a.won);
    const swaps = Math.min(PROMOTION_COUNT, upper.length, lower.length);

    for (let k = 0; k < swaps; k++) {
      const demoted = upper[k];
      const elevated = lower[k];
      demoted.tier = lowerTier;
      elevated.tier = upperTier;
      relegated.push({ tid: demoted.tid, fromTier: upperTier, toTier: lowerTier });
      promoted.push({ tid: elevated.tid, fromTier: lowerTier, toTier: upperTier });
    }
  }

  return { promoted, relegated };
}

export type OffseasonEvent = {
  type: 'retirement' | 'contractExpired' | 'signed' | 'released' | 'drafted' | 'promoted' | 'relegated';
  playerPid?: number;
  playerName?: string;
  teamTid?: number;
  teamName?: string;
  details?: string;
  season: number;
};

export type OffseasonResult = {
  season: number;
  newSeason: number;
  events: OffseasonEvent[];
  retiredPlayers: Player[];
  newFreeAgents: Player[];
  draftedPlayers: Player[];
  promotedTeams: { tid: number; from: string; to: string }[];
  relegatedTeams: { tid: number; from: string; to: string }[];
  hallOfFameInductees: Player[];
};

export class OffseasonManager {
  private players: Player[];
  private teams: Team[];
  private season: number;
  private events: OffseasonEvent[] = [];

  constructor(players: Player[], teams: Team[], season: number) {
    this.players = players;
    this.teams = teams;
    this.season = season;
  }

  /**
   * Run complete offseason
   */
  runOffseason(): OffseasonResult {
    console.log(`Starting offseason for season ${this.season} -> ${this.season + 1}`);

    // 1. Process player aging and development
    this.processAging();

    // 2. Process retirements
    const retiredPlayers = this.processRetirements();

    // 3. Process contract expirations
    const newFreeAgents = this.processContractExpirations();

    // 4. AI teams make roster moves
    this.aiRosterMoves();

    // 5. Run draft
    const draftedPlayers = this.runDraft();

    // 6. Apply promotion/relegation
    const { promotedTeams, relegatedTeams } = this.applyPromotionRelegation();

    // 7. Trim rosters to limits
    this.trimRosters();

    // 8. Fill roster minimums with free agents
    this.fillRosterMinimums();

    // 9. Process Hall of Fame
    const hallOfFameInductees = this.processHallOfFame(retiredPlayers);

    // 10. Reset season stats and prepare new season
    this.prepareNewSeason();

    return {
      season: this.season,
      newSeason: this.season + 1,
      events: this.events,
      retiredPlayers,
      newFreeAgents,
      draftedPlayers,
      promotedTeams,
      relegatedTeams,
      hallOfFameInductees,
    };
  }

  /**
   * Age all players and develop their skills
   */
  private processAging(): void {
    console.log('Processing player aging...');

    for (const player of this.players) {
      // Age the player
      player.age += 1;
      player.bornYear -= 1; // Adjust born year

      // Develop skills based on age and potential
      develop(player, 1);

      // Process injury recovery
      if (player.injury) {
        player.injury.gamesRemaining -= 17; // Full season passed
        if (player.injury.gamesRemaining <= 0) {
          player.injury = undefined;
        }
      }
    }
  }

  /**
   * Process player retirements
   */
  private processRetirements(): Player[] {
    console.log('Processing retirements...');

    const { retired, active } = processRetirements(this.players, this.season);
    this.players = active;

    for (const player of retired) {
      const team = this.teams.find(t => t.tid === player.tid);
      this.events.push({
        type: 'retirement',
        playerPid: player.pid,
        playerName: player.name,
        teamTid: team?.tid,
        teamName: team?.name,
        details: getRetirementReason(player),
        season: this.season,
      });
    }

    console.log(`Retired ${retired.length} players`);
    return retired;
  }

  /**
   * Process contract expirations
   */
  private processContractExpirations(): Player[] {
    console.log('Processing contract expirations...');

    const newFreeAgents: Player[] = [];

    for (const player of this.players) {
      if (!player.contract) continue;

      // Check if contract expired
      if (player.contract.years <= 0) {
        const team = this.teams.find(t => t.tid === player.tid);

        // High-value players may re-sign
        const ovr = player.ovr || 50;
        const shouldResign = ovr >= 75 && Math.random() < 0.6;

        if (shouldResign && team) {
          // Re-sign with team
          const oldAmount = player.contract?.amount || 1000000;
          const newYears = Math.min(4, Math.max(1, 3 - Math.floor((player.age - 28) / 3)));
          const newAmount = Math.round(oldAmount * (0.9 + Math.random() * 0.3));
          player.contract = createContract(newAmount, newYears, this.season);
          this.events.push({
            type: 'signed',
            playerPid: player.pid,
            playerName: player.name,
            teamTid: team.tid,
            teamName: team.name,
            details: `Re-signed for ${player.contract.years} years, $${(player.contract.amount / 1000).toFixed(0)}K`,
            season: this.season,
          });
        } else {
          // Become free agent
          player.tid = undefined;
          newFreeAgents.push(player);

          this.events.push({
            type: 'contractExpired',
            playerPid: player.pid,
            playerName: player.name,
            teamTid: team?.tid,
            teamName: team?.name,
            details: 'Contract expired, became free agent',
            season: this.season,
          });
        }
      } else {
        // Reduce contract years
        player.contract.years -= 1;
      }
    }

    console.log(`${newFreeAgents.length} players became free agents`);
    return newFreeAgents;
  }

  /**
   * AI teams make roster moves
   */
  private aiRosterMoves(): void {
    console.log('AI teams making roster moves...');

    for (const team of this.teams) {
      // Skip user team (will be handled separately)
      // Get team players
      const teamPlayers = this.players.filter(p => p.tid === team.tid);

      // Check roster needs by position
      const positionCounts = this.getPositionCounts(teamPlayers);

      // Release underperforming veterans
      this.releaseUnderperformingPlayers(team, teamPlayers);

      // Sign free agents to fill needs
      this.aiSignFreeAgents(team, positionCounts);
    }
  }

  /**
   * Get position counts for a team
   */
  private getPositionCounts(players: Player[]): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const player of players) {
      counts[player.pos] = (counts[player.pos] || 0) + 1;
    }
    return counts;
  }

  /**
   * Release underperforming players
   */
  private releaseUnderperformingPlayers(team: Team, teamPlayers: Player[]): void {
    // Find players to release (low OVR, high salary, old)
    const toRelease = teamPlayers.filter(p => {
      const ovr = p.ovr || 50;
      const salary = p.contract?.amount || 0;
      const age = p.age;

      // Release if: old (32+), low OVR (<60), high salary (>5M)
      if (age >= 32 && ovr < 60 && salary > 5000000) {
        return true;
      }

      // Release if: very low OVR (<50) regardless of age
      if (ovr < 50) {
        return true;
      }

      return false;
    });

    for (const player of toRelease) {
      player.tid = undefined;
      this.events.push({
        type: 'released',
        playerPid: player.pid,
        playerName: player.name,
        teamTid: team.tid,
        teamName: team.name,
        details: 'Released due to performance',
        season: this.season,
      });
    }
  }

  /**
   * AI signs free agents to fill roster needs
   */
  private aiSignFreeAgents(team: Team, positionCounts: Record<string, number>): void {
    const freeAgents = this.players.filter(p => p.tid === undefined || p.tid < 0);
    const teamPlayers = this.players.filter(p => p.tid === team.tid);

    // Minimum requirements by position
    const minRequirements: Record<string, number> = {
      QB: 2, RB: 3, WR: 5, TE: 2, OL: 6,
      DL: 6, LB: 5, CB: 4, S: 3, K: 1, P: 1,
    };

    // Find positions that need filling
    for (const [pos, min] of Object.entries(minRequirements)) {
      const current = positionCounts[pos] || 0;
      const needed = min - current;

      if (needed > 0 && teamPlayers.length < MAX_ROSTER_SIZE) {
        // Find best available free agent for this position
        const posFreeAgents = freeAgents
          .filter(p => p.pos === pos)
          .sort((a, b) => (b.ovr || 0) - (a.ovr || 0));

        for (let i = 0; i < Math.min(needed, posFreeAgents.length); i++) {
          const player = posFreeAgents[i];
          if (player && teamPlayers.length < MAX_ROSTER_SIZE) {
            // Sign the player
            player.tid = team.tid;
            const contractAmount = Math.round(500000 + (player.ovr || 50) * 10000);
            player.contract = createContract(contractAmount, 1, this.season);

            positionCounts[pos] = (positionCounts[pos] || 0) + 1;
            teamPlayers.push(player);

            this.events.push({
              type: 'signed',
              playerPid: player.pid,
              playerName: player.name,
              teamTid: team.tid,
              teamName: team.name,
              details: 'Signed as free agent',
              season: this.season,
            });
          }
        }
      }
    }
  }

  /**
   * Run the draft
   */
  private runDraft(): Player[] {
    console.log('Running draft...');

    // Only First/Second Continent teams participate
    const draftTeams = this.teams.filter(
      t => t.region === 'firstContinent' || t.region === 'secondContinent'
    );

    if (draftTeams.length === 0) {
      return [];
    }

    // Generate draft pool
    const draftPool = generateDraftPool(this.season + 1, 224);

    // Get draft order based on standings (worst first)
    const draftOrder = [...draftTeams].sort((a, b) => {
      const aWins = a.won || 0;
      const bWins = b.won || 0;
      return aWins - bWins; // Worst record picks first
    });

    const draftedPlayers: Player[] = [];

    // Simulate 7 rounds
    for (let round = 1; round <= 7; round++) {
      for (const team of draftOrder) {
        // Get best available player
        const bestAvailable = draftPool
          .filter(p => !p.tid)
          .sort((a, b) => (b.ovr || 0) - (a.ovr || 0))[0];

        if (bestAvailable) {
          bestAvailable.tid = team.tid;
          const contractAmount = Math.round(800000 + (8 - round) * 100000);
          bestAvailable.contract = createContract(contractAmount, 4, this.season);
          bestAvailable.draft = {
            ...bestAvailable.draft,
            tid: team.tid,
            round,
            pick: (round - 1) * draftOrder.length + draftOrder.indexOf(team) + 1,
          };

          draftedPlayers.push(bestAvailable);

          this.events.push({
            type: 'drafted',
            playerPid: bestAvailable.pid,
            playerName: bestAvailable.name,
            teamTid: team.tid,
            teamName: team.name,
            details: `Round ${round}, Pick ${draftOrder.indexOf(team) + 1}`,
            season: this.season,
          });
        }
      }
    }

    // Add drafted players to main player list
    this.players.push(...draftedPlayers.filter(p => !this.players.includes(p)));

    console.log(`Drafted ${draftedPlayers.length} players`);
    return draftedPlayers;
  }

  /**
   * Apply promotion and relegation
   */
  private applyPromotionRelegation(): {
    promotedTeams: { tid: number; from: string; to: string }[];
    relegatedTeams: { tid: number; from: string; to: string }[];
  } {
    console.log('Applying promotion/relegation...');

    const promotedTeams: { tid: number; from: string; to: string }[] = [];
    const relegatedTeams: { tid: number; from: string; to: string }[] = [];

    // Mining Island promotion/relegation - run on the canonical
    // tier ladder via the pure helper, then translate the result
    // into the public {tid, from, to} shape and push events.
    const miningTeams = this.teams.filter(t => t.region === 'miningIsland');
    if (miningTeams.length > 0) {
      const { promoted, relegated } = promoteRelegateMiningIsland(miningTeams);

      for (const move of promoted) {
        const team = miningTeams.find(t => t.tid === move.tid)!;
        promotedTeams.push({
          tid: move.tid,
          from: `tier ${move.fromTier}`,
          to: `tier ${move.toTier}`,
        });
        this.events.push({
          type: 'promoted',
          teamTid: move.tid,
          teamName: team.name,
          details: `Promoted from tier ${move.fromTier} to tier ${move.toTier}`,
          season: this.season,
        });
      }

      for (const move of relegated) {
        const team = miningTeams.find(t => t.tid === move.tid)!;
        relegatedTeams.push({
          tid: move.tid,
          from: `tier ${move.fromTier}`,
          to: `tier ${move.toTier}`,
        });
        this.events.push({
          type: 'relegated',
          teamTid: move.tid,
          teamName: team.name,
          details: `Relegated from tier ${move.fromTier} to tier ${move.toTier}`,
          season: this.season,
        });
      }
    }

    return { promotedTeams, relegatedTeams };
  }

  /**
   * Trim rosters to maximum size
   */
  private trimRosters(): void {
    console.log('Trimming rosters...');

    for (const team of this.teams) {
      const teamPlayers = this.players.filter(p => p.tid === team.tid);

      if (teamPlayers.length > MAX_ROSTER_SIZE) {
        // Sort by OVR, keep best players
        const sorted = [...teamPlayers].sort((a, b) => (b.ovr || 0) - (a.ovr || 0));
        const toRelease = sorted.slice(MAX_ROSTER_SIZE);

        for (const player of toRelease) {
          player.tid = undefined;
          this.events.push({
            type: 'released',
            playerPid: player.pid,
            playerName: player.name,
            teamTid: team.tid,
            teamName: team.name,
            details: 'Released to meet roster limit',
            season: this.season,
          });
        }
      }
    }
  }

  /**
   * Fill roster minimums with free agents
   */
  private fillRosterMinimums(): void {
    console.log('Filling roster minimums...');

    const freeAgents = this.players.filter(p => p.tid === undefined || p.tid < 0);

    for (const team of this.teams) {
      const teamPlayers = this.players.filter(p => p.tid === team.tid);

      while (teamPlayers.length < MIN_ROSTER_SIZE && freeAgents.length > 0) {
        // Sign best available free agent
        const best = freeAgents
          .filter(p => p.tid === undefined || p.tid < 0)
          .sort((a, b) => (b.ovr || 0) - (a.ovr || 0))[0];

        if (best) {
          best.tid = team.tid;
          const contractAmount = Math.round(500000 + (best.ovr || 50) * 10000);
          best.contract = createContract(contractAmount, 1, this.season);

          this.events.push({
            type: 'signed',
            playerPid: best.pid,
            playerName: best.name,
            teamTid: team.tid,
            teamName: team.name,
            details: 'Signed to fill roster minimum',
            season: this.season,
          });

          teamPlayers.push(best);
        } else {
          break;
        }
      }
    }
  }

  /**
   * Process Hall of Fame for retired players
   */
  private processHallOfFame(retiredPlayers: Player[]): Player[] {
    console.log('Processing Hall of Fame...');

    const inductees: Player[] = [];

    for (const player of retiredPlayers) {
      const chance = calculateHallOfFameChance(player);
      if (Math.random() < chance) {
        player.hallOfFame = true;
        inductees.push(player);
      }
    }

    console.log(`${inductees.length} players inducted to Hall of Fame`);
    return inductees;
  }

  /**
   * Prepare for new season
   */
  private prepareNewSeason(): void {
    console.log('Preparing new season...');

    // Reset team records
    for (const team of this.teams) {
      team.won = 0;
      team.lost = 0;
      team.tied = 0;
      team.streak = 0;
      team.lastTen = '';
      team.playoffsRoundsWon = 0;
    }

    // Reset player season stats
    for (const player of this.players) {
      // Keep career stats, reset season stats if any
      // This is handled by the stats system separately
    }

    // Generate new free agent pool
    const newFreeAgents = generateFreeAgentPool([], 50, this.season + 1);
    this.players.push(...newFreeAgents);
  }

  /**
   * Get updated players list
   */
  getPlayers(): Player[] {
    return this.players;
  }

  /**
   * Get updated teams list
   */
  getTeams(): Team[] {
    return this.teams;
  }

  /**
   * Get offseason events
   */
  getEvents(): OffseasonEvent[] {
    return this.events;
  }
}

export default OffseasonManager;
