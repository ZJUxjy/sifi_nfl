/**
 * FL6 — StatsManager must split per-player season buckets by
 *       (pid, playoffs) so the same player can have an independent
 *       regular-season row and an independent postseason row.
 *
 * Bug background: prior to this fix, `playerSeasonStats` was keyed on
 * `pid` alone, and the `playoffs` flag on the row was frozen at the
 * first `initPlayerStats` call. The flow that broke things:
 *
 *   1) Regular-season game → `initPlayerStats(p, /*playoffs*\/ false)`
 *      → row created with `playoffs=false`.
 *   2) `recordPlayerGameStats` aggregates the regular-season game.
 *   3) Postseason game → `initPlayerStats(p, /*playoffs*\/ true)`
 *      → no-op because the row already exists; `playoffs` stays false.
 *   4) `recordPlayerGameStats` aggregates the postseason yards on TOP
 *      of the regular-season row, still flagged `playoffs=false`.
 *
 * UI consequences: `StatsView` and league-leader queries filter by
 * `playoffs`, so the playoff bucket appeared empty and the regular-
 * season bucket was polluted with postseason totals.
 *
 * The contract under test isolates the StatsManager surface (no game
 * sim, no engine wiring) so the failure is purely about whether two
 * recorded games for the same pid land in the same bucket.
 */
import { describe, it, expect } from 'vitest';
import { StatsManager } from '../worker/core/stats/StatsManager';
import { DEFAULT_PASSING_STATS } from '@common/stats';
import type { Player } from '@common/entities';

function makePlayer(pid: number, tid: number): Player {
  return {
    pid,
    tid,
    name: `Player ${pid}`,
    pos: 'QB',
    age: 25,
    region: 'firstContinent',
  } as unknown as Player;
}

describe('FL6: StatsManager separates regular-season and playoff buckets per pid', () => {
  it('keeps regular-season totals at 250 yards and playoff totals at 180 yards for the same pid', () => {
    const sm = new StatsManager(2025);
    const p = makePlayer(0, 0);

    // Regular season: one 250-yd, 2-TD passing game.
    sm.initPlayerStats(p, false);
    sm.recordPlayerGameStats(
      0,
      { pass: { ...DEFAULT_PASSING_STATS, att: 30, cmp: 20, yds: 250, td: 2 } },
      false,
    );

    // Playoffs: one 180-yd, 1-TD passing game.
    sm.initPlayerStats(p, true);
    sm.recordPlayerGameStats(
      0,
      { pass: { ...DEFAULT_PASSING_STATS, att: 25, cmp: 15, yds: 180, td: 1 } },
      true,
    );

    const reg = sm.getPlayerSeasonStats(0, false);
    const post = sm.getPlayerSeasonStats(0, true);

    expect(reg, 'regular-season row must exist').toBeDefined();
    expect(post, 'playoff row must exist').toBeDefined();

    expect(reg?.pass.yds).toBe(250);
    expect(reg?.pass.td).toBe(2);
    expect(reg?.gp).toBe(1);
    expect(reg?.playoffs).toBe(false);

    expect(post?.pass.yds).toBe(180);
    expect(post?.pass.td).toBe(1);
    expect(post?.gp).toBe(1);
    expect(post?.playoffs).toBe(true);
  });

  it('getAllPlayerStats(false) returns regular-season rows only; getAllPlayerStats(true) returns playoff rows only', () => {
    const sm = new StatsManager(2025);
    const p = makePlayer(0, 0);

    sm.initPlayerStats(p, false);
    sm.recordPlayerGameStats(
      0,
      { pass: { ...DEFAULT_PASSING_STATS, att: 30, cmp: 20, yds: 250, td: 2 } },
      false,
    );

    sm.initPlayerStats(p, true);
    sm.recordPlayerGameStats(
      0,
      { pass: { ...DEFAULT_PASSING_STATS, att: 25, cmp: 15, yds: 180, td: 1 } },
      true,
    );

    const regAll = sm.getAllPlayerStats(false);
    const postAll = sm.getAllPlayerStats(true);

    expect(regAll.length).toBe(1);
    expect(regAll[0].playoffs).toBe(false);
    expect(regAll[0].pass.yds).toBe(250);

    expect(postAll.length).toBe(1);
    expect(postAll[0].playoffs).toBe(true);
    expect(postAll[0].pass.yds).toBe(180);
  });

  it('default getPlayerSeasonStats / getAllPlayerStats return the regular-season bucket (never a merged view)', () => {
    const sm = new StatsManager(2025);
    const p = makePlayer(0, 0);

    sm.initPlayerStats(p, false);
    sm.recordPlayerGameStats(
      0,
      { pass: { ...DEFAULT_PASSING_STATS, att: 30, cmp: 20, yds: 250, td: 2 } },
      false,
    );

    sm.initPlayerStats(p, true);
    sm.recordPlayerGameStats(
      0,
      { pass: { ...DEFAULT_PASSING_STATS, att: 25, cmp: 15, yds: 180, td: 1 } },
      true,
    );

    // No playoffs arg → must default to regular season, NOT a merged view.
    const defaultRow = sm.getPlayerSeasonStats(0);
    expect(defaultRow?.pass.yds).toBe(250);
    expect(defaultRow?.playoffs).toBe(false);

    const defaultAll = sm.getAllPlayerStats();
    expect(defaultAll.length).toBe(1);
    expect(defaultAll[0].playoffs).toBe(false);
  });

  it('league leaders filter by playoffs flag: regular-season leaders never include playoff yardage', () => {
    const sm = new StatsManager(2025);
    const p = makePlayer(0, 0);

    sm.initPlayerStats(p, false);
    sm.recordPlayerGameStats(
      0,
      { pass: { ...DEFAULT_PASSING_STATS, att: 30, cmp: 20, yds: 250, td: 2 } },
      false,
    );
    sm.initPlayerStats(p, true);
    sm.recordPlayerGameStats(
      0,
      { pass: { ...DEFAULT_PASSING_STATS, att: 25, cmp: 15, yds: 180, td: 1 } },
      true,
    );

    const regLeaders = sm.getLeagueLeaders('pass', 'yds', 10);
    expect(regLeaders).toHaveLength(1);
    expect(regLeaders[0]).toMatchObject({ pid: 0, value: 250 });
  });
});
