import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setSeed } from '../common/random';

// Stub IndexedDB-backed storage so newGame() takes the
// "generate fresh world" branch without touching jsdom's mock IDB.
vi.mock('../worker/api/storage', () => ({
  initDB: vi.fn().mockResolvedValue({}),
  saveWorldData: vi.fn().mockResolvedValue(undefined),
  loadWorldData: vi.fn().mockResolvedValue(null),
  clearWorldData: vi.fn().mockResolvedValue(undefined),
  saveGame: vi.fn().mockResolvedValue(undefined),
  loadGame: vi.fn().mockResolvedValue(null),
  deleteGame: vi.fn().mockResolvedValue(undefined),
  listSaves: vi.fn().mockResolvedValue([]),
}));

import { GameEngine } from '../worker/api/GameEngine';

describe('FL3: free agent pool stays consistent with players after advanceSeason', () => {
  beforeEach(() => {
    setSeed(2026);
  });

  it(
    'state.freeAgents matches state.players.filter(tid undefined/<0) post-advance',
    async () => {
      const engine = new GameEngine();

      await engine.newGame({
        region: 'firstContinent',
        teamId: 0,
        season: 2026,
      } as never);

      const state0 = engine.getState();

      // Manually mark a few rostered players as FA. This simulates the
      // mid-season "we already have some FAs in state.players" world that
      // the offseason pipeline is supposed to honour.
      const someRostered = state0.players
        .filter(p => p.tid !== undefined && p.tid >= 0)
        .slice(0, 5);
      for (const p of someRostered) {
        p.tid = undefined;
      }

      // Advance the season: contract expirations, re-signs, draft,
      // promotion/relegation, prepareNewSeason FA pool, etc. all run.
      const advance = await engine.advanceSeason();
      expect(advance.success).toBe(true);

      const state1 = engine.getState();

      const derivedFromPlayers = state1.players.filter(
        p => p.tid === undefined || p.tid < 0
      );
      const exposed = engine.getFreeAgents();

      // Length agreement.
      expect(exposed.length).toBe(derivedFromPlayers.length);

      // Identity agreement (pid sets must be identical).
      const exposedPids = new Set(exposed.map(p => p.pid));
      const derivedPids = new Set(derivedFromPlayers.map(p => p.pid));
      expect(exposedPids.size).toBe(derivedPids.size);
      for (const pid of derivedPids) {
        expect(exposedPids.has(pid)).toBe(true);
      }

      // Object-identity agreement: every exposed FA must be the same
      // object that lives in state.players. Otherwise getFreeAgents()
      // is handing UI a stale snapshot whose mutations don't propagate
      // to the canonical roster (and vice versa).
      const playerSet = new Set(state1.players);
      for (const fa of exposed) {
        expect(playerSet.has(fa)).toBe(true);
      }
    },
    30_000
  );
});
