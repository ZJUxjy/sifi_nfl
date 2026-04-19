/**
 * Stats isolation guarantees.
 *
 * Background (P2 D1): the original `StatsManager` was exposed via a
 * module-level singleton (`getStatsManager(season)` cached one instance per
 * season). That meant two `GameEngine` instances — or two test cases that
 * both reach for `getStatsManager(2025)` — silently shared the same
 * accumulator. The second game's stats then aggregated on top of the
 * first game's, so a QB with pid `0` finished "two games" with double
 * yardage even though only one was played per engine.
 *
 * These tests pin down the contract directly against `StatsManager` /
 * `GameEngine.getStatsManager()` instead of going through `sim.run()`.
 * Driving the contract end-to-end via a real game introduced flakiness
 * because a single game does not deterministically produce passing stats
 * for any specific pid (a team can run-only the whole game, the QB can be
 * benched after an injury, etc.). The bug we want to lock down is purely
 * about whether two engines share an accumulator — `recordPlayerGameStats`
 * is the smallest surface that lets us prove that without depending on
 * RNG behaviour.
 */
import { describe, it, expect } from 'vitest';
import { GameEngine } from '../worker/api/GameEngine';
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

describe('StatsManager isolation across GameEngine instances', () => {
  it('returns a distinct StatsManager instance per GameEngine', () => {
    const e1 = new GameEngine();
    const e2 = new GameEngine();

    const sm1 = e1.getStatsManager();
    const sm2 = e2.getStatsManager();

    // Singleton bug: same module-level cache returns identical reference.
    expect(sm1).not.toBe(sm2);
  });

  it('does not leak per-player stats between two engines that both recorded one game', () => {
    const e1 = new GameEngine();
    const e2 = new GameEngine();

    const sm1 = e1.getStatsManager();
    const sm2 = e2.getStatsManager();

    sm1.initPlayerStats(makePlayer(0, 0));
    sm2.initPlayerStats(makePlayer(0, 0));

    sm1.recordPlayerGameStats(0, { pass: { ...DEFAULT_PASSING_STATS, att: 30, cmp: 20, yds: 250, td: 2 } });
    sm2.recordPlayerGameStats(0, { pass: { ...DEFAULT_PASSING_STATS, att: 25, cmp: 15, yds: 180, td: 1 } });

    const qb1 = sm1.getPlayerSeasonStats(0);
    const qb2 = sm2.getPlayerSeasonStats(0);

    // Both engines saw exactly one game; the singleton bug would make
    // either side report gp=2 (one game posted, then the second engine's
    // post aggregated on top of the cached counter).
    expect(qb1?.gp).toBe(1);
    expect(qb2?.gp).toBe(1);
  });

  it('does not double-count yardage for a pid that appears in two engines', () => {
    const e1 = new GameEngine();
    const e2 = new GameEngine();

    const sm1 = e1.getStatsManager();
    const sm2 = e2.getStatsManager();

    sm1.initPlayerStats(makePlayer(0, 0));
    sm2.initPlayerStats(makePlayer(0, 0));

    sm1.recordPlayerGameStats(0, { pass: { ...DEFAULT_PASSING_STATS, att: 30, cmp: 20, yds: 250, td: 2 } });
    const yds1 = sm1.getPlayerSeasonStats(0)?.pass.yds ?? 0;

    sm2.recordPlayerGameStats(0, { pass: { ...DEFAULT_PASSING_STATS, att: 25, cmp: 15, yds: 180, td: 1 } });
    const yds2 = sm2.getPlayerSeasonStats(0)?.pass.yds ?? 0;

    // Each engine carries only its own input.
    expect(yds1).toBe(250);
    expect(yds2).toBe(180);
  });
});
