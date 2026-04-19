/**
 * Stats Manager
 * Tracks player and team statistics throughout the season
 */

import type { Player, Team } from '@common/entities';
import {
  type PlayerGameStats,
  type PlayerSeasonStats,
  type TeamGameStats,
  DEFAULT_PLAYER_GAME_STATS,
  aggregateStats,
  finalizeStats,
} from '@common/stats';

export class StatsManager {
  private playerSeasonStats: Map<number, PlayerSeasonStats>; // pid -> stats
  private teamSeasonStats: Map<number, TeamGameStats[]>; // tid -> array of game stats
  private season: number;

  constructor(season: number) {
    this.season = season;
    this.playerSeasonStats = new Map();
    this.teamSeasonStats = new Map();
  }

  /**
   * Initialize stats for a player
   */
  initPlayerStats(player: Player, playoffs: boolean = false): void {
    if (!this.playerSeasonStats.has(player.pid)) {
      this.playerSeasonStats.set(player.pid, {
        ...JSON.parse(JSON.stringify(DEFAULT_PLAYER_GAME_STATS)),
        pid: player.pid,
        tid: player.tid ?? -1,
        season: this.season,
        playoffs,
      });
    }
  }

  /**
   * Initialize stats for a team
   */
  initTeamStats(tid: number): void {
    if (!this.teamSeasonStats.has(tid)) {
      this.teamSeasonStats.set(tid, []);
    }
  }

  /**
   * Record game stats for a player
   */
  recordPlayerGameStats(pid: number, gameStats: Partial<PlayerGameStats>): void {
    const existing = this.playerSeasonStats.get(pid);
    if (!existing) return;

    // Create a complete game stats object
    const completeGameStats: PlayerGameStats = {
      ...DEFAULT_PLAYER_GAME_STATS,
      ...gameStats,
      gp: 1,
    } as PlayerGameStats;

    // Aggregate with existing stats
    const aggregated = aggregateStats(existing, completeGameStats);
    const finalized = finalizeStats(aggregated);

    this.playerSeasonStats.set(pid, {
      ...finalized,
      pid,
      tid: existing.tid,
      season: this.season,
      playoffs: existing.playoffs,
    });
  }

  /**
   * Record team game stats
   */
  recordTeamGameStats(tid: number, gameStats: TeamGameStats): void {
    this.initTeamStats(tid);
    this.teamSeasonStats.get(tid)?.push(gameStats);
  }

  /**
   * Get season stats for a player
   */
  getPlayerSeasonStats(pid: number): PlayerSeasonStats | undefined {
    return this.playerSeasonStats.get(pid);
  }

  /**
   * Get all stats for a team's players
   */
  getTeamPlayerStats(tid: number): PlayerSeasonStats[] {
    const stats: PlayerSeasonStats[] = [];
    for (const [pid, stat] of this.playerSeasonStats) {
      if (stat.tid === tid) {
        stats.push(stat);
      }
    }
    return stats;
  }

  /**
   * Get team season totals
   */
  getTeamSeasonStats(tid: number): TeamGameStats {
    const games = this.teamSeasonStats.get(tid) || [];
    return this.aggregateTeamStats(games);
  }

  /**
   * Aggregate multiple team game stats
   */
  private aggregateTeamStats(games: TeamGameStats[]): TeamGameStats {
    if (games.length === 0) {
      return this.getEmptyTeamStats();
    }

    return games.reduce((acc, game) => ({
      pts: acc.pts + game.pts,
      ptsQtrs: [
        acc.ptsQtrs[0] + (game.ptsQtrs[0] || 0),
        acc.ptsQtrs[1] + (game.ptsQtrs[1] || 0),
        acc.ptsQtrs[2] + (game.ptsQtrs[2] || 0),
        acc.ptsQtrs[3] + (game.ptsQtrs[3] || 0),
        (acc.ptsQtrs[4] || 0) + (game.ptsQtrs[4] || 0),
      ] as [number, number, number, number, number?],
      totalYds: acc.totalYds + game.totalYds,
      totalPlays: acc.totalPlays + game.totalPlays,
      pssAtt: acc.pssAtt + game.pssAtt,
      pssCmp: acc.pssCmp + game.pssCmp,
      pssYds: acc.pssYds + game.pssYds,
      pssTD: acc.pssTD + game.pssTD,
      pssInt: acc.pssInt + game.pssInt,
      rusAtt: acc.rusAtt + game.rusAtt,
      rusYds: acc.rusYds + game.rusYds,
      rusTD: acc.rusTD + game.rusTD,
      fmb: acc.fmb + game.fmb,
      fmbLost: acc.fmbLost + game.fmbLost,
      int: acc.int + game.int,
      pen: acc.pen + game.pen,
      penYds: acc.penYds + game.penYds,
      thirdDownAtt: acc.thirdDownAtt + game.thirdDownAtt,
      thirdDownCmp: acc.thirdDownCmp + game.thirdDownCmp,
      fourthDownAtt: acc.fourthDownAtt + game.fourthDownAtt,
      fourthDownCmp: acc.fourthDownCmp + game.fourthDownCmp,
      rzAtt: acc.rzAtt + game.rzAtt,
      rzTD: acc.rzTD + game.rzTD,
      rzFG: acc.rzFG + game.rzFG,
      top: acc.top + game.top,
      fgMade: acc.fgMade + game.fgMade,
      fgAtt: acc.fgAtt + game.fgAtt,
      xpMade: acc.xpMade + game.xpMade,
      xpAtt: acc.xpAtt + game.xpAtt,
      punts: acc.punts + game.punts,
      puntYds: acc.puntYds + game.puntYds,
    }));
  }

  /**
   * Get empty team stats
   */
  private getEmptyTeamStats(): TeamGameStats {
    return {
      pts: 0,
      ptsQtrs: [0, 0, 0, 0],
      totalYds: 0,
      totalPlays: 0,
      pssAtt: 0,
      pssCmp: 0,
      pssYds: 0,
      pssTD: 0,
      pssInt: 0,
      rusAtt: 0,
      rusYds: 0,
      rusTD: 0,
      fmb: 0,
      fmbLost: 0,
      int: 0,
      pen: 0,
      penYds: 0,
      thirdDownAtt: 0,
      thirdDownCmp: 0,
      fourthDownAtt: 0,
      fourthDownCmp: 0,
      rzAtt: 0,
      rzTD: 0,
      rzFG: 0,
      top: 0,
      fgMade: 0,
      fgAtt: 0,
      xpMade: 0,
      xpAtt: 0,
      punts: 0,
      puntYds: 0,
    };
  }

  /**
   * Get league leaders for a stat category
   */
  getLeagueLeaders(
    category: 'pass' | 'rush' | 'recv' | 'def' | 'kick' | 'punt' | 'ret',
    stat: string,
    limit: number = 10
  ): Array<{ pid: number; tid: number; value: number }> {
    const leaders: Array<{ pid: number; tid: number; value: number }> = [];

    for ( const stats of this.playerSeasonStats.values()) {
      if (stats.playoffs) continue; // Only regular season

      const categoryStats = stats[category] as Record<string, number>;
      const value = categoryStats[stat] ?? 0;

      if (value > 0) {
        leaders.push({ pid: stats.pid, tid: stats.tid, value });
      }
    }

    // Sort by value descending
    leaders.sort((a, b) => b.value - a.value);

    return leaders.slice(0, limit);
  }

  /**
   * Update player's team (for trades)
   */
  updatePlayerTeam(pid: number, newTid: number): void {
    const stats = this.playerSeasonStats.get(pid);
    if (stats) {
      stats.tid = newTid;
    }
  }

  /**
   * Export stats for saving
   */
  export(): { playerStats: PlayerSeasonStats[]; teamStats: Map<number, TeamGameStats[]> } {
    return {
      playerStats: Array.from(this.playerSeasonStats.values()),
      teamStats: this.teamSeasonStats,
    };
  }

  /**
   * Import stats from save
   */
  import(data: { playerStats: PlayerSeasonStats[]; teamStats: [number, TeamGameStats[]][] }): void {
    this.playerSeasonStats.clear();
    this.teamSeasonStats.clear();

    for (const stats of data.playerStats) {
      this.playerSeasonStats.set(stats.pid, stats);
    }

    for (const [tid, games] of data.teamStats) {
      this.teamSeasonStats.set(tid, games);
    }
  }

  /**
   * Get all player stats
   */
  getAllPlayerStats(): PlayerSeasonStats[] {
    return Array.from(this.playerSeasonStats.values());
  }

  /**
   * Reset all accumulated stats and switch to a new season. Used when the
   * owning engine advances seasons so the same instance can be reused
   * without leaking the prior season's totals.
   */
  resetForSeason(season: number): void {
    this.season = season;
    this.playerSeasonStats.clear();
    this.teamSeasonStats.clear();
  }
}
