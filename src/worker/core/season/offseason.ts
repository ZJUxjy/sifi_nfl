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
import type { Region, Contract, DraftPick } from '@common/types';
import { develop } from '../player/generate';
import {
  processRetirements,
  getRetirementReason,
  calculateHallOfFameChance,
} from '../player/retirement';
import { generateDraftPool, generateDraftPicks } from '../draft';
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

/**
 * Compute a player's state for the *next* season. Source of truth is
 * `bornYear` (immutable across seasons); `age` is derived from
 * `newSeason - bornYear`.
 *
 * Previously processAging incremented `age` *and* decremented
 * `bornYear`, so a 25yo in 2026 with bornYear 2001 became a 26yo with
 * bornYear 2000 - effectively aged 2 years per offseason and broke
 * every downstream computation that compared `season - bornYear`.
 */
export function ageOnePlayer<T extends { age: number; bornYear: number }>(
  p: T,
  newSeason: number
): T {
  return { ...p, age: newSeason - p.bornYear };
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
  // FL8: canonical pick ledger for the season being closed out. The
  // offseason draft selects strictly from this list (sorted by round +
  // intra-round pick) and credits each prospect to `pick.tid` (the
  // *current* holder, post-trade) — not to the original team. May be
  // omitted by callers; we'll bootstrap a fresh round-robin set from
  // standings if so, so direct unit tests of the manager keep working.
  private draftPicks: DraftPick[];

  constructor(
    players: Player[],
    teams: Team[],
    season: number,
    draftPicks: DraftPick[] = []
  ) {
    this.players = players;
    this.teams = teams;
    this.season = season;
    this.draftPicks = draftPicks;
  }

  /**
   * Expose draftPicks so callers (GameEngine) can re-sync state with
   * the played/playerPid annotations runDraft writes back.
   */
  getDraftPicks(): DraftPick[] {
    return this.draftPicks;
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

    const newSeason = this.season + 1;
    for (let i = 0; i < this.players.length; i++) {
      const aged = ageOnePlayer(this.players[i], newSeason);
      // Preserve identity for downstream consumers that hold references
      // to player objects from this list - apply in-place.
      this.players[i].age = aged.age;
      // bornYear intentionally left unchanged.

      const player = this.players[i];

      develop(player, 1);

      if (player.injury) {
        player.injury.gamesRemaining -= 17;
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
   * Process contract expirations.
   *
   * Canonical rule: every signing site (signFreeAgent, generateContract,
   * draft pool, negotiation.finalizeContract, createContract here) sets
   * `exp = signingSeason + years`, i.e. `exp` is the first season the
   * contract is *not* valid and `years remaining at season S = exp - S`.
   *
   * Previously this method checked `years <= 0` *before* decrementing
   * `years`, so a freshly-signed 1-year contract (years=1) survived the
   * offseason that should have ended it -- every contract effectively
   * got a free extra year, and `getPendingFreeAgents()` (which reads
   * `years <= 1`) reported the wrong cohort.
   *
   * We now use `exp <= newSeason` (where `newSeason = this.season + 1`)
   * as the single source of truth and re-derive `years` from `exp` for
   * non-expired contracts so the two fields can no longer drift apart.
   */
  private processContractExpirations(): Player[] {
    console.log('Processing contract expirations...');

    const newFreeAgents: Player[] = [];
    const newSeason = this.season + 1;

    for (const player of this.players) {
      if (!player.contract) continue;

      const expired = player.contract.exp <= newSeason;

      if (expired) {
        const team = this.teams.find(t => t.tid === player.tid);

        // High-value players may re-sign
        const ovr = player.ovr || 50;
        const shouldResign = ovr >= 75 && Math.random() < 0.6;

        if (shouldResign && team) {
          // Re-sign with team. The new contract is signed *for*
          // newSeason (the upcoming season), so anchor exp there.
          const oldAmount = player.contract.amount || 1000000;
          const newYears = Math.min(4, Math.max(1, 3 - Math.floor((player.age - 28) / 3)));
          const newAmount = Math.round(oldAmount * (0.9 + Math.random() * 0.3));
          player.contract = createContract(newAmount, newYears, newSeason);
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
        // Keep `years` in lockstep with `exp` (`exp` is the canonical
        // anchor; `years` is a derived view used by UI / pending-FA
        // hints). This prevents the two fields from silently drifting
        // if any future code path mutates one without the other.
        player.contract.years = player.contract.exp - newSeason;
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
    const newSeason = this.season + 1;

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
            player.contract = createContract(contractAmount, 1, newSeason);

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
   * Run the draft.
   *
   * FL8: source of truth is `this.draftPicks`, the canonical per-season
   * ledger that records who *currently* owns each pick (`pick.tid`,
   * mutated by trade/executeTrade) versus who originally owned it
   * (`pick.originalTid`). Every selection is credited to `pick.tid` and
   * the pick is annotated `played = true` + `playerPid = …` so a
   * replayed offseason can never pick the same slot twice.
   *
   * The previous round-robin path (sort teams by record, give each one
   * a pick per round) ignored draftPicks entirely, which silently undid
   * any in-season trade of a future pick the moment the offseason ran.
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

    // Bootstrap a pick ledger if no caller supplied one (direct unit
    // tests of OffseasonManager) so the new code path is the *only*
    // code path. Use the same generator GameEngine.initializeDraftPicks
    // does, anchored to the season being closed out.
    let pickLedger = this.draftPicks.filter(
      p => p.season === this.season && !p.played
    );
    if (pickLedger.length === 0 && this.draftPicks.length === 0) {
      const generated = generateDraftPicks(
        draftTeams.map(t => ({
          tid: t.tid,
          region: t.region,
          won: t.won || 0,
          lost: t.lost || 0,
        })),
        this.season,
        7
      );
      this.draftPicks.push(...generated);
      pickLedger = generated;
    }

    if (pickLedger.length === 0) {
      console.log('Drafted 0 players (no unplayed picks for this season)');
      return [];
    }

    const draftTeamIds = new Set(draftTeams.map(t => t.tid));

    // Generate the prospect pool. Use a size that can never starve the
    // pick ledger (32-team / 7-round leagues need 224 prospects; for
    // shorter leagues we still need at least one prospect per pick).
    const poolSize = Math.max(224, pickLedger.length);
    const draftPool = generateDraftPool(this.season + 1, poolSize);

    // Walk picks in canonical draft order: round ascending, then
    // intra-round pick index ascending.
    const ordered = [...pickLedger].sort(
      (a, b) => a.round - b.round || a.pick - b.pick
    );

    const drafted = new Set<number>();
    const draftedPlayers: Player[] = [];

    for (const pick of ordered) {
      // Defensive: a pick whose current holder isn't in the draft set
      // (e.g. relegated team that lost its draft seat) is still consumed
      // so we don't loop forever, but we don't materialise a player.
      if (!draftTeamIds.has(pick.tid)) {
        pick.played = true;
        continue;
      }

      // Pick the highest-rated prospect not yet selected. We use an
      // explicit `drafted` set rather than `!p.tid` because tid===0 is
      // a valid team id and the truthiness filter would let team 0's
      // earlier selections re-enter the pool.
      let bestAvailable: Player | undefined;
      let bestScore = -Infinity;
      for (const prospect of draftPool) {
        if (drafted.has(prospect.pid)) continue;
        const score = prospect.ovr || 0;
        if (score > bestScore) {
          bestScore = score;
          bestAvailable = prospect;
        }
      }
      if (!bestAvailable) break;

      drafted.add(bestAvailable.pid);
      const team = draftTeams.find(t => t.tid === pick.tid)!;
      bestAvailable.tid = pick.tid;
      const contractAmount = Math.round(800000 + (8 - pick.round) * 100000);
      // Drafted rookies start playing in newSeason; anchor exp there.
      bestAvailable.contract = createContract(contractAmount, 4, this.season + 1);
      bestAvailable.draft = {
        ...bestAvailable.draft,
        tid: pick.tid,
        originalTid: pick.originalTid,
        round: pick.round,
        pick: pick.pick,
      };

      pick.played = true;
      pick.playerPid = bestAvailable.pid;

      draftedPlayers.push(bestAvailable);

      this.events.push({
        type: 'drafted',
        playerPid: bestAvailable.pid,
        playerName: bestAvailable.name,
        teamTid: pick.tid,
        teamName: team.name,
        details: `Round ${pick.round}, Pick ${pick.pick}`,
        season: this.season,
      });
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
          best.contract = createContract(contractAmount, 1, this.season + 1);

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
