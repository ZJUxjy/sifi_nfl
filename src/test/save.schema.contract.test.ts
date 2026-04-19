/**
 * FL7 — Single zod-validated save contract for CLI and UI.
 *
 * Background: prior to FL7, `cli/saveManager.ts` validated saves with
 * its own zod schema + `CURRENT_SAVE_SCHEMA_VERSION`, but
 * `GameEngine.saveGame()/loadGame()` (the real UI entry-point) wrote /
 * read straight through `worker/api/storage.ts` (IndexedDB) with no
 * validation at all. Two consequences:
 *
 *   1. Bad / partial / future-version saves could be injected directly
 *      into the runtime via `engine.loadGame(name)` and the engine
 *      would happily install whatever JSON it found.
 *   2. Saves written by the CLI and saves written by the UI were
 *      parallel codepaths, so a CLI-written save could not be
 *      meaningfully consumed by the UI (or vice versa).
 *
 * Contract under test: there is exactly ONE shared save shape
 * (`@common/saveSchema`), `GameEngine.loadGame()` always runs
 * `validateSave()`, and the CLI saveManager imports the same module
 * (no duplicate `CURRENT_SAVE_SCHEMA_VERSION` const, no duplicate
 * schema). Migration handles legacy saves without a `schemaVersion`
 * field so existing on-disk / in-IDB saves still load.
 *
 * The five tests below mirror the brief:
 *   1. legacy save with no `schemaVersion` → migrate path → loads
 *   2. save with a missing required `state` field → throws
 *   3. malformed shape (`schemaVersion: 'NaN'`, `state: 42`) → throws
 *   4. CLI/UI consistency: the same fixture round-trips through both
 *      saveManager and GameEngine
 *   5. round-trip with stats: FL5 stats survival + FL6 (pid, playoffs)
 *      bucket survival
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DEFAULT_PASSING_STATS } from '@common/stats';
import type { Player } from '@common/entities';

// In-memory IDB substitute for the GameEngine path (mirrors the
// FL5 stats.saveLoad.test.ts approach so the JSON round-trip
// catches structured-clone-equivalent shape loss).
const memSaves = new Map<string, any>();

vi.mock('../worker/api/storage', () => {
  return {
    initDB: vi.fn(async () => ({})),
    saveWorldData: vi.fn(async () => {}),
    loadWorldData: vi.fn(async () => null),
    clearWorldData: vi.fn(async () => {}),
    saveGame: vi.fn(async (name: string, data: any) => {
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

// In-memory fs substitute for the CLI path. We import the saveManager
// after the mock so the module sees the mocked fs.
const memFs = new Map<string, string>();
vi.mock('fs', () => {
  return {
    default: {
      existsSync: (p: string) => memFs.has(p),
      readFileSync: (p: string) => {
        if (!memFs.has(p)) throw new Error(`ENOENT: ${p}`);
        return memFs.get(p)!;
      },
      writeFileSync: (p: string, data: string | Buffer) => {
        memFs.set(p, typeof data === 'string' ? data : data.toString('utf-8'));
      },
      mkdirSync: () => {},
      readdirSync: () => [...memFs.keys()].map(k => k.split('/').pop()!),
      unlinkSync: (p: string) => {
        memFs.delete(p);
      },
    },
  };
});

import { GameEngine } from '../worker/api/GameEngine';
import {
  CURRENT_SAVE_SCHEMA_VERSION,
  SaveValidationError,
  validateSave,
  serializeSave,
} from '@common/saveSchema';
import * as cliSaveManager from '../cli/saveManager';

beforeEach(() => {
  memSaves.clear();
  memFs.clear();
});

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

// A minimal valid GameState, matching what GameEngine.getInitialState()
// produces but populated enough to look like a real save.
const sampleState = {
  initialized: true,
  loading: false,
  season: 2025,
  week: 1,
  phase: 2,
  userTid: 0,
  region: 'firstContinent',
  teams: [{ tid: 0, name: 'Alpha', region: 'firstContinent' }],
  players: [],
  freeAgents: [],
  games: [],
  schedule: [],
  lastGame: null,
  draftPicks: [],
  originDraftResults: [],
  // Map serializes as an empty object after JSON round-trip — the
  // schema must accept either shape (this is what currently happens
  // in production via the IDB structured-clone path).
  teamFinances: {},
};

describe('FL7: unified zod-validated save contract for CLI and UI', () => {
  it('CURRENT_SAVE_SCHEMA_VERSION is exported as a finite number', () => {
    expect(typeof CURRENT_SAVE_SCHEMA_VERSION).toBe('number');
    expect(Number.isFinite(CURRENT_SAVE_SCHEMA_VERSION)).toBe(true);
    expect(CURRENT_SAVE_SCHEMA_VERSION).toBeGreaterThanOrEqual(1);
  });

  it('CLI saveManager re-exports the SAME CURRENT_SAVE_SCHEMA_VERSION (no duplicate constant)', () => {
    expect(cliSaveManager.CURRENT_SAVE_SCHEMA_VERSION).toBe(CURRENT_SAVE_SCHEMA_VERSION);
  });

  it('Test 1 — migrates a legacy save that has no schemaVersion (v0 baseline) on load', async () => {
    // Pre-FL7 GameEngine wrote `{ version, timestamp, name, state, stats? }`
    // with NO `schemaVersion`. Such saves still live in real users' IDB and
    // must load — the migrate step inserts `schemaVersion = CURRENT` and
    // synthesises any newly-required fields (`savedAt`).
    memSaves.set('legacy', {
      version: '0.2.0',
      timestamp: 1700000000000,
      name: 'legacy',
      state: sampleState,
    });

    const engine = new GameEngine();
    await expect(engine.loadGame('legacy')).resolves.not.toThrow();
    const state = engine.getState();
    expect(state.season).toBe(2025);
    expect(state.userTid).toBe(0);
  });

  it('Test 2 — throws SaveValidationError when a required state field is missing', async () => {
    const broken: any = {
      schemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
      // state has players + teams but is missing `season` (required)
      state: { players: [], teams: [] },
      savedAt: new Date().toISOString(),
      name: 'broken',
    };
    memSaves.set('broken', broken);
    const engine = new GameEngine();
    await expect(engine.loadGame('broken')).rejects.toThrow(SaveValidationError);
  });

  it('Test 3 — throws on malformed shape (schemaVersion is not a number, state is a primitive)', async () => {
    memSaves.set('bad', { schemaVersion: 'NaN', state: 42 });
    const engine = new GameEngine();
    await expect(engine.loadGame('bad')).rejects.toThrow();
  });

  it('Test 4 — CLI/UI consistency: a fixture written by the CLI saveManager validates against the shared schema (and vice versa)', () => {
    // Build a save through the shared serializer and confirm:
    //   (a) it satisfies validateSave()
    //   (b) the CLI's load path can consume it
    //   (c) CLI's save path produces a structurally-identical shape
    const shared = serializeSave({
      state: sampleState as any,
      stats: null,
      name: 'shared',
    });

    // (a) shared serializer output is itself valid input
    const reparsed = validateSave(shared);
    expect(reparsed.schemaVersion).toBe(CURRENT_SAVE_SCHEMA_VERSION);
    expect(reparsed.state.season).toBe(2025);

    // (b) drop the shared save into the CLI's filesystem store and load
    // it through the CLI loader — must succeed because CLI uses the
    // same schema.
    const id = `save_${Date.now()}`;
    memFs.set(
      `${process.cwd()}/data/saves/${id}.json`,
      JSON.stringify(shared),
    );
    const cliLoaded = cliSaveManager.loadGame(id);
    expect(cliLoaded).not.toBeNull();
    expect(cliLoaded!.schemaVersion).toBe(CURRENT_SAVE_SCHEMA_VERSION);
    expect(cliLoaded!.state.season).toBe(2025);

    // (c) the CLI's saveGame writes a save that also passes validateSave
    // — proving both paths emit the same shape.
    const cliWritten = cliSaveManager.saveGame('cli-side', sampleState as any);
    expect(() => validateSave(cliWritten)).not.toThrow();
    expect(cliWritten.schemaVersion).toBe(CURRENT_SAVE_SCHEMA_VERSION);
  });

  it('Test 5 — round-trips stats with both regular-season and playoff (pid, playoffs) buckets (FL5 + FL6 compat)', async () => {
    const engine = new GameEngine();
    const sm = engine.getStatsManager();

    sm.initPlayerStats(makePlayer(0, 0), false);
    sm.recordPlayerGameStats(
      0,
      { pass: { ...DEFAULT_PASSING_STATS, att: 30, cmp: 20, yds: 250, td: 2 } },
      false,
    );

    sm.initPlayerStats(makePlayer(0, 0), true);
    sm.recordPlayerGameStats(
      0,
      { pass: { ...DEFAULT_PASSING_STATS, att: 25, cmp: 15, yds: 180, td: 1 } },
      true,
    );

    await engine.saveGame('round');

    const engine2 = new GameEngine();
    await engine2.loadGame('round');

    const sm2 = engine2.getStatsManager();
    const reg = sm2.getPlayerSeasonStats(0, false);
    const post = sm2.getPlayerSeasonStats(0, true);

    expect(reg, 'regular-season bucket must survive save/load').toBeDefined();
    expect(post, 'playoff bucket must survive save/load').toBeDefined();
    expect(reg?.pass.yds).toBe(250);
    expect(reg?.pass.td).toBe(2);
    expect(reg?.playoffs).toBe(false);
    expect(post?.pass.yds).toBe(180);
    expect(post?.pass.td).toBe(1);
    expect(post?.playoffs).toBe(true);
  });
});
