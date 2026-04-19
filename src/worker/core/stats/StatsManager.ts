/**
 * Stats Manager
 * Tracks player and team statistics throughout the season.
 *
 * Bucket model (FL6):
 *   Per-player and per-team accumulators are split by `(id, playoffs)`
 *   so a single pid (or tid) can carry an independent regular-season
 *   row and an independent postseason row in the same season. Prior
 *   to FL6 the maps were keyed on the raw id, which meant the
 *   `playoffs` flag was frozen at the first init call and any
 *   subsequent record from the *other* bucket aggregated on top of
 *   the first one. League leaders / team stats then filtered the
 *   merged row by `playoffs`, returning either an empty playoff
 *   bucket or a regular-season bucket polluted with playoff totals.
 *
 *   Key shape: `${id}:${playoffs ? 'p' : 'r'}` — a string composite
 *   stored in a `Map<string, ...>`. JSON-friendly (already a string
 *   so `Array.from(entries)` survives `JSON.stringify`), and the
 *   minimum-invasive choice vs. nesting `{ regular, playoffs }`.
 *
 *   Backwards compatibility: `import()` accepts the legacy snapshot
 *   shape (numeric id keys / `playerStats: PlayerSeasonStats[]`) and
 *   maps it onto the regular-season bucket; the `playoffs` flag on
 *   each row is honored if present.
 */

import type { Player } from '@common/entities';
import {
  type PlayerGameStats,
  type PlayerSeasonStats,
  type TeamGameStats,
  DEFAULT_PLAYER_GAME_STATS,
  aggregateStats,
  finalizeStats,
} from '@common/stats';

type BucketKey = string;

function bucketKey(id: number, playoffs: boolean): BucketKey {
  return `${id}:${playoffs ? 'p' : 'r'}`;
}

export class StatsManager {
  /** `${pid}:r` | `${pid}:p` -> PlayerSeasonStats. */
  private playerSeasonStats: Map<BucketKey, PlayerSeasonStats>;
  /** `${tid}:r` | `${tid}:p` -> TeamGameStats[]. */
  private teamSeasonStats: Map<BucketKey, TeamGameStats[]>;
  private season: number;

  constructor(season: number) {
    this.season = season;
    this.playerSeasonStats = new Map();
    this.teamSeasonStats = new Map();
  }

  /**
   * Initialize stats for a player in the requested bucket. The
   * `playoffs` flag selects which bucket (regular season vs
   * postseason); both buckets can coexist for the same pid.
   */
  initPlayerStats(player: Player, playoffs: boolean = false): void {
    const key = bucketKey(player.pid, playoffs);
    if (!this.playerSeasonStats.has(key)) {
      this.playerSeasonStats.set(key, {
        ...JSON.parse(JSON.stringify(DEFAULT_PLAYER_GAME_STATS)),
        pid: player.pid,
        tid: player.tid ?? -1,
        season: this.season,
        playoffs,
      });
    }
  }

  /**
   * Initialize the team's accumulator bucket. Same `(tid, playoffs)`
   * split as the player buckets — playoff team-level totals must not
   * leak into regular-season team totals.
   */
  initTeamStats(tid: number, playoffs: boolean = false): void {
    const key = bucketKey(tid, playoffs);
    if (!this.teamSeasonStats.has(key)) {
      this.teamSeasonStats.set(key, []);
    }
  }

  /**
   * Record game stats for a player into the requested bucket.
   * Callers (sim) must pass the same `playoffs` flag used at
   * `initPlayerStats` time — otherwise the record either lands in an
   * empty bucket (no-op due to missing init) or in the wrong bucket.
   */
  recordPlayerGameStats(
    pid: number,
    gameStats: Partial<PlayerGameStats>,
    playoffs: boolean = false,
  ): void {
    const key = bucketKey(pid, playoffs);
    const existing = this.playerSeasonStats.get(key);
    if (!existing) return;

    const completeGameStats: PlayerGameStats = {
      ...DEFAULT_PLAYER_GAME_STATS,
      ...gameStats,
      gp: 1,
    } as PlayerGameStats;

    const aggregated = aggregateStats(existing, completeGameStats);
    const finalized = finalizeStats(aggregated);

    this.playerSeasonStats.set(key, {
      ...finalized,
      pid,
      tid: existing.tid,
      season: this.season,
      playoffs,
    });
  }

  /**
   * Record team game stats into the `(tid, playoffs)` bucket.
   */
  recordTeamGameStats(
    tid: number,
    gameStats: TeamGameStats,
    playoffs: boolean = false,
  ): void {
    this.initTeamStats(tid, playoffs);
    this.teamSeasonStats.get(bucketKey(tid, playoffs))?.push(gameStats);
  }

  /**
   * Get season stats for a player. Defaults to the regular-season
   * bucket — never returns a merged view.
   */
  getPlayerSeasonStats(
    pid: number,
    playoffs: boolean = false,
  ): PlayerSeasonStats | undefined {
    return this.playerSeasonStats.get(bucketKey(pid, playoffs));
  }

  /**
   * Get all stats for a team's players in the requested bucket.
   */
  getTeamPlayerStats(
    tid: number,
    playoffs: boolean = false,
  ): PlayerSeasonStats[] {
    const stats: PlayerSeasonStats[] = [];
    for (const stat of this.playerSeasonStats.values()) {
      if (stat.tid === tid && stat.playoffs === playoffs) {
        stats.push(stat);
      }
    }
    return stats;
  }

  /**
   * Get team season totals for the requested bucket.
   */
  getTeamSeasonStats(tid: number, playoffs: boolean = false): TeamGameStats {
    const games = this.teamSeasonStats.get(bucketKey(tid, playoffs)) || [];
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
   * Get league leaders for a stat category in the requested bucket.
   * Defaults to the regular season — playoff leaders need to be
   * requested explicitly so legacy callers stay regular-season only.
   */
  getLeagueLeaders(
    category: 'pass' | 'rush' | 'recv' | 'def' | 'kick' | 'punt' | 'ret',
    stat: string,
    limit: number = 10,
    playoffs: boolean = false,
  ): Array<{ pid: number; tid: number; value: number }> {
    const leaders: Array<{ pid: number; tid: number; value: number }> = [];

    for (const stats of this.playerSeasonStats.values()) {
      if (stats.playoffs !== playoffs) continue;

      const categoryStats = stats[category] as Record<string, number>;
      const value = categoryStats[stat] ?? 0;

      if (value > 0) {
        leaders.push({ pid: stats.pid, tid: stats.tid, value });
      }
    }

    leaders.sort((a, b) => b.value - a.value);

    return leaders.slice(0, limit);
  }

  /**
   * Update player's team across both regular-season and postseason
   * buckets — a mid-season trade should reflect on either row that
   * already exists.
   */
  updatePlayerTeam(pid: number, newTid: number): void {
    for (const playoffs of [false, true]) {
      const stats = this.playerSeasonStats.get(bucketKey(pid, playoffs));
      if (stats) {
        stats.tid = newTid;
      }
    }
  }

  /**
   * Export a JSON-safe snapshot of all accumulators (FL5/FL6).
   *
   * The shape is symmetric with `import()` so that
   * `mgr.import(mgr.export())` is a no-op, and so a snapshot can survive
   * `JSON.parse(JSON.stringify(...))` (or IndexedDB structured-clone)
   * without losing data — `Map` does not survive `JSON.stringify`, so
   * `teamStats` is serialized as `Array<[key, games[]]>` instead.
   *
   * `season` is included in the snapshot so a loader can sanity-check
   * (or directly install) the year the stats belong to without having
   * to keep that metadata in a sibling field.
   *
   * Per-row `playoffs` is the source of truth on the player side; on
   * the team side the bucket key carries the flag because team rows
   * are arrays of game stats with no per-row metadata. The team
   * shape changed in FL6 from `[number, TeamGameStats[]]` (numeric
   * tid) to `[string, TeamGameStats[]]` (composite key).
   */
  export(): {
    season: number;
    playerStats: PlayerSeasonStats[];
    teamStats: Array<[string, TeamGameStats[]]>;
  } {
    return {
      season: this.season,
      playerStats: Array.from(this.playerSeasonStats.values()),
      teamStats: Array.from(this.teamSeasonStats.entries()),
    };
  }

  /**
   * Restore accumulators from an `export()` snapshot. Always clears
   * existing in-memory state first so a partial snapshot can never bleed
   * into prior data — callers that want to merge instead of replace
   * should aggregate before calling.
   *
   * Backwards compatible with the pre-FL6 snapshot shape:
   *   - `teamStats` entries with a numeric tid are mapped onto the
   *     regular-season bucket (`${tid}:r`).
   *   - `playerStats` rows already carry `playoffs`, so the bucket
   *     they land in is inferred from each row's flag.
   */
  import(data: {
    season?: number;
    playerStats: PlayerSeasonStats[];
    teamStats: Array<[number | string, TeamGameStats[]]>;
  }): void {
    if (typeof data.season === 'number') {
      this.season = data.season;
    }
    this.playerSeasonStats.clear();
    this.teamSeasonStats.clear();

    for (const stats of data.playerStats) {
      this.playerSeasonStats.set(
        bucketKey(stats.pid, !!stats.playoffs),
        stats,
      );
    }

    for (const [rawKey, games] of data.teamStats) {
      // Pre-FL6 snapshots used a numeric tid; treat those as regular-season.
      const key =
        typeof rawKey === 'number' ? bucketKey(rawKey, false) : rawKey;
      this.teamSeasonStats.set(key, games);
    }
  }

  /**
   * Get all player stats in the requested bucket. Defaults to the
   * regular season; pass `true` for the postseason bucket. There is
   * intentionally no "merged" view — UIs that want both must query
   * each bucket and compose them.
   */
  getAllPlayerStats(playoffs: boolean = false): PlayerSeasonStats[] {
    const out: PlayerSeasonStats[] = [];
    for (const stats of this.playerSeasonStats.values()) {
      if (stats.playoffs === playoffs) out.push(stats);
    }
    return out;
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
