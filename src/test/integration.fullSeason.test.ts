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

describe('integration: full season smoke test (Task 25)', () => {
  beforeEach(() => {
    setSeed(2026);
  });

  it(
    'init -> regular season -> playoffs -> offseason -> next season',
    async () => {
      const engine = new GameEngine();

      await engine.newGame({
        region: 'firstContinent',
        teamId: 0,
        season: 2026,
      } as never);

      const state0 = engine.getState();
      expect(state0.initialized).toBe(true);
      expect(state0.season).toBe(2026);
      expect(state0.teams.length).toBeGreaterThan(0);
      expect(state0.players.length).toBeGreaterThan(0);
      expect(state0.schedule.length).toBeGreaterThan(0);

      // Regular season — sim until the schedule says we are out of weeks.
      // Cap at a generous upper bound so a runaway loop fails loudly
      // instead of hanging the test runner.
      const MAX_WEEKS = 60;
      let safety = 0;
      while (!engine.isSeasonComplete() && safety < MAX_WEEKS) {
        await engine.simWeek();
        safety++;
      }
      expect(engine.isSeasonComplete()).toBe(true);

      const standings = engine.getStandings('firstContinent');
      expect(standings.length).toBeGreaterThan(0);

      const winsTotal = standings.reduce((acc, s) => acc + s.won, 0);
      expect(winsTotal).toBeGreaterThan(0);

      // Offseason -> advances season, re-seeds schedule, ages players.
      const advance = await engine.advanceSeason();
      expect(advance.success).toBe(true);

      const state1 = engine.getState();
      expect(state1.season).toBe(2027);
      expect(state1.week).toBe(1);
      expect(state1.schedule.length).toBeGreaterThan(0);
      expect(state1.teams.length).toBe(state0.teams.length);
      // Players may be ±retirees, but should still be well above zero.
      expect(state1.players.length).toBeGreaterThan(0);
    },
    30_000
  );
});
