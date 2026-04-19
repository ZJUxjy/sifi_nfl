/**
 * FL7 — saveManager now operates on the shared `@common/saveSchema`
 * envelope (`{ schemaVersion, state, stats?, savedAt, name }`)
 * instead of the pre-FL7 CLI-local `{ schemaVersion, id, name,
 * timestamp, seasonYear, ..., data }` shape. The on-disk format is
 * identical to what `GameEngine.saveGame()` writes to IndexedDB so
 * a save written by either path can be loaded by the other.
 *
 * These tests focus on the CLI side of that contract:
 *   - schemaVersion is stamped on write
 *   - malformed JSON is rejected gracefully
 *   - missing required fields are rejected
 *   - missing `schemaVersion` is *migrated* (legacy saves still load)
 *   - round-trip works end to end
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Build a stateful in-memory fs mock so loadGame/saveGame can interact
// like a real filesystem. We have to declare the mock factory before
// importing saveManager.
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

import {
  loadGame,
  saveGame,
  CURRENT_SAVE_SCHEMA_VERSION,
} from '../cli/saveManager';

// Minimal valid GameState. saveSchema validates the top-level field
// set; the inner array element shapes are intentionally loose so this
// fixture can stay small.
const validState = {
  initialized: true,
  loading: false,
  season: 2026,
  week: 1,
  phase: 2,
  userTid: 0,
  region: 'firstContinent',
  teams: [{ tid: 0, name: 'A', region: 'firstContinent' }],
  players: [],
  freeAgents: [],
  games: [],
  schedule: [],
  lastGame: null,
  draftPicks: [],
  originDraftResults: [],
  teamFinances: {},
};

beforeEach(() => {
  memFs.clear();
});

describe('save schema validation', () => {
  it('exports a numeric CURRENT_SAVE_SCHEMA_VERSION', () => {
    expect(typeof CURRENT_SAVE_SCHEMA_VERSION).toBe('number');
    expect(CURRENT_SAVE_SCHEMA_VERSION).toBeGreaterThanOrEqual(1);
  });

  it('rejects malformed JSON gracefully (returns null, no throw)', () => {
    memFs.set(`${process.cwd()}/data/saves/save_1.json`, '{ not json');
    expect(loadGame('save_1')).toBeNull();
  });

  it('rejects a save with missing required fields', () => {
    memFs.set(
      `${process.cwd()}/data/saves/save_1.json`,
      JSON.stringify({ id: 'save_1' }),
    );
    expect(loadGame('save_1')).toBeNull();
  });

  it('migrates a save whose schemaVersion is missing (legacy v0 → current)', () => {
    // Pre-FL7 GameEngine saves had no `schemaVersion` field. They
    // must still load via the migrate path; rejecting them outright
    // would break every save in users' IDB / data/saves dir.
    const legacy = {
      // No schemaVersion. No savedAt. Old `timestamp` instead.
      timestamp: 1700000000000,
      name: 'legacy',
      state: validState,
    };
    memFs.set(`${process.cwd()}/data/saves/save_1.json`, JSON.stringify(legacy));
    const loaded = loadGame('save_1');
    expect(loaded).not.toBeNull();
    expect(loaded!.schemaVersion).toBe(CURRENT_SAVE_SCHEMA_VERSION);
    expect(loaded!.state.season).toBe(2026);
  });

  it('rejects a save whose schemaVersion is incompatible (future version)', () => {
    const future = {
      schemaVersion: CURRENT_SAVE_SCHEMA_VERSION + 99,
      state: validState,
      savedAt: new Date().toISOString(),
      name: 'future',
    };
    memFs.set(`${process.cwd()}/data/saves/save_1.json`, JSON.stringify(future));
    expect(loadGame('save_1')).toBeNull();
  });

  it('writes schemaVersion when saving', () => {
    const save = saveGame('test', validState as any);
    const filePath = `${process.cwd()}/data/saves/${save.id}.json`;
    const written = memFs.get(filePath);
    expect(written, 'save file must be written').toBeDefined();
    const parsed = JSON.parse(written!);
    expect(parsed.schemaVersion).toBe(CURRENT_SAVE_SCHEMA_VERSION);
    expect(parsed.savedAt).toBeTypeOf('string');
    expect(parsed.name).toBe('test');
  });

  it('round-trips: a save written by saveGame loads cleanly', () => {
    const save = saveGame('roundtrip', validState as any);
    const loaded = loadGame(save.id);
    expect(loaded).not.toBeNull();
    expect(loaded!.state.season).toBe(2026);
    expect(loaded!.schemaVersion).toBe(CURRENT_SAVE_SCHEMA_VERSION);
    expect(loaded!.name).toBe('roundtrip');
  });
});
