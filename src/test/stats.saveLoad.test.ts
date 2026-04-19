/**
 * FL5 — StatsManager must enter the save/load boundary.
 *
 * Background: `GameEngine.saveGame()` historically serialized only
 * `this.state`, dropping the entire per-engine `StatsManager`
 * accumulator. After a reload:
 *   1. all season player/team stats were silently lost (round-trip), and
 *   2. when the same engine instance later loaded a different save for
 *      the same season, the *prior* in-memory `StatsManager` survived,
 *      so the freshly loaded game looked like it had stats it never
 *      recorded (cross-save leak — orthogonal to the P2/D1 isolation
 *      fix, which only addressed multiple GameEngine instances sharing
 *      a module-level singleton).
 *
 * Strategy: drive `GameEngine.saveGame()` / `loadGame()` end-to-end via
 * an in-memory replacement for the IDB storage layer so the test
 * exercises the real serialization path. We deliberately do NOT poke
 * `StatsManager` directly — the contract under test is that the public
 * save/load surface persists stats and that loading always installs a
 * fresh accumulator.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DEFAULT_PASSING_STATS } from '@common/stats';
import type { Player } from '@common/entities';

// In-memory IDB substitute. Declared up front because `vi.mock` is
// hoisted and the factory must not capture out-of-scope live references.
const memSaves = new Map<string, any>();

vi.mock('../worker/api/storage', () => {
  return {
    initDB: vi.fn(async () => ({})),
    saveWorldData: vi.fn(async () => {}),
    loadWorldData: vi.fn(async () => null),
    clearWorldData: vi.fn(async () => {}),
    saveGame: vi.fn(async (name: string, data: any) => {
      // Round-trip JSON to mirror IDB structured-clone losing class
      // identity (Map -> {}, etc.) — this is what catches the "Map
      // didn't survive serialization" sub-bug too.
      memSaves.set(name, JSON.parse(JSON.stringify({ ...data, name })));
    }),
    loadGame: vi.fn(async (name: string) => {
      const v = memSaves.get(name);
      if (!v) throw new Error(`Save not found: ${name}`);
      return v;
    }),
    deleteGame: vi.fn(async (name: string) => {
      memSaves.delete(name);
    }),
    listSaves: vi.fn(async () => Array.from(memSaves.values())),
  };
});

import { GameEngine } from '../worker/api/GameEngine';

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

beforeEach(() => {
  memSaves.clear();
});

describe('FL5: StatsManager must persist across save/load', () => {
  it('round-trips per-player stats: stats recorded before save are visible after load', async () => {
    const engine = new GameEngine();
    const sm = engine.getStatsManager();

    sm.initPlayerStats(makePlayer(0, 0));
    sm.recordPlayerGameStats(0, {
      pass: { ...DEFAULT_PASSING_STATS, att: 30, cmp: 20, yds: 250, td: 2 },
    });

    await engine.saveGame('A');

    const engine2 = new GameEngine();
    await engine2.loadGame('A');

    const restored = engine2.getStatsManager().getPlayerSeasonStats(0);
    expect(restored, 'restored stats must exist after load').toBeDefined();
    expect(restored?.pass.yds).toBe(250);
    expect(restored?.pass.td).toBe(2);
    expect(restored?.gp).toBe(1);
  });

  it('does not leak across saves: loading save A only sees stats present at A-time, never the post-A increments persisted in save B', async () => {
    const engine = new GameEngine();
    const sm = engine.getStatsManager();

    sm.initPlayerStats(makePlayer(0, 0));
    sm.recordPlayerGameStats(0, {
      pass: { ...DEFAULT_PASSING_STATS, att: 30, cmp: 20, yds: 250, td: 2 },
    });
    await engine.saveGame('A');

    // Continue accumulating, then snapshot a different save.
    sm.initPlayerStats(makePlayer(7, 0));
    sm.recordPlayerGameStats(7, {
      pass: { ...DEFAULT_PASSING_STATS, att: 10, cmp: 5, yds: 60, td: 0 },
    });
    await engine.saveGame('B');

    // Fresh engine reloads A; pid 7 was post-A, so it must NOT be there.
    const engine2 = new GameEngine();
    await engine2.loadGame('A');
    const sm2 = engine2.getStatsManager();
    expect(sm2.getPlayerSeasonStats(0)?.pass.yds).toBe(250);
    expect(sm2.getPlayerSeasonStats(7), 'pid 7 was recorded after save A and must not appear').toBeUndefined();
  });

  it('same-season cross-save reload installs a fresh StatsManager (no inherited accumulator from prior in-memory state)', async () => {
    const engine = new GameEngine();
    const sm = engine.getStatsManager();

    sm.initPlayerStats(makePlayer(0, 0));
    sm.recordPlayerGameStats(0, {
      pass: { ...DEFAULT_PASSING_STATS, att: 30, cmp: 20, yds: 250, td: 2 },
    });
    await engine.saveGame('A');

    // Same engine: keep recording past the snapshot. These post-A
    // increments live only in memory and were NEVER saved to A.
    sm.recordPlayerGameStats(0, {
      pass: { ...DEFAULT_PASSING_STATS, att: 20, cmp: 10, yds: 999, td: 5 },
    });

    // Reload save A on the same engine. Without the fix, loadGame()
    // leaves the in-memory StatsManager untouched, so the QB still
    // shows the inflated post-A totals.
    await engine.loadGame('A');

    const restored = engine.getStatsManager().getPlayerSeasonStats(0);
    expect(restored?.pass.yds).toBe(250);
    expect(restored?.pass.td).toBe(2);
    expect(restored?.gp).toBe(1);
  });

  it('getStatsManager() after loadGame() must NOT be the pre-load instance (fresh-instance contract)', async () => {
    const engine = new GameEngine();
    const before = engine.getStatsManager();
    before.initPlayerStats(makePlayer(0, 0));
    before.recordPlayerGameStats(0, {
      pass: { ...DEFAULT_PASSING_STATS, att: 1, cmp: 1, yds: 10, td: 0 },
    });

    await engine.saveGame('A');
    await engine.loadGame('A');

    const after = engine.getStatsManager();
    expect(after).not.toBe(before);
  });

  it('backwards compatible: loading an old save with no `stats` field yields an empty StatsManager (not a throw)', async () => {
    const engine = new GameEngine();
    await engine.saveGame('legacy');

    // Strip the stats field to mimic a save written before FL5.
    const raw = memSaves.get('legacy');
    delete raw.stats;
    memSaves.set('legacy', raw);

    const engine2 = new GameEngine();
    await expect(engine2.loadGame('legacy')).resolves.not.toThrow();

    const sm = engine2.getStatsManager();
    expect(sm.getAllPlayerStats()).toEqual([]);
  });
});
