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
  type SaveData,
} from '../cli/saveManager';

const validSaveData: SaveData = {
  teams: [{ tid: 0, name: 'A', region: 'firstContinent' }],
  players: [],
  freeAgents: [],
  seasonYear: 2026,
  currentWeek: 1,
  schedule: [],
  standings: [],
  userTeamTid: 0,
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
      JSON.stringify({ id: 'save_1' })
    );
    expect(loadGame('save_1')).toBeNull();
  });

  it('rejects a save whose schemaVersion is missing', () => {
    const bad = {
      id: 'save_1',
      name: 'x',
      timestamp: 1,
      seasonYear: 2026,
      currentWeek: 1,
      userTeamName: 'X',
      userTeamRegion: 'firstContinent',
      data: validSaveData,
    };
    memFs.set(`${process.cwd()}/data/saves/save_1.json`, JSON.stringify(bad));
    expect(loadGame('save_1')).toBeNull();
  });

  it('rejects a save whose schemaVersion is incompatible (future version)', () => {
    const future = {
      schemaVersion: CURRENT_SAVE_SCHEMA_VERSION + 99,
      id: 'save_1',
      name: 'x',
      timestamp: 1,
      seasonYear: 2026,
      currentWeek: 1,
      userTeamName: 'X',
      userTeamRegion: 'firstContinent',
      data: validSaveData,
    };
    memFs.set(`${process.cwd()}/data/saves/save_1.json`, JSON.stringify(future));
    expect(loadGame('save_1')).toBeNull();
  });

  it('writes schemaVersion when saving', () => {
    const save = saveGame('test', validSaveData);
    const path = `${process.cwd()}/data/saves/${save.id}.json`;
    const written = memFs.get(path);
    expect(written, 'save file must be written').toBeDefined();
    const parsed = JSON.parse(written!);
    expect(parsed.schemaVersion).toBe(CURRENT_SAVE_SCHEMA_VERSION);
  });

  it('round-trips: a save written by saveGame loads cleanly', () => {
    const save = saveGame('roundtrip', validSaveData);
    const loaded = loadGame(save.id);
    expect(loaded).not.toBeNull();
    expect(loaded!.data.seasonYear).toBe(2026);
    expect(loaded!.schemaVersion).toBe(CURRENT_SAVE_SCHEMA_VERSION);
  });
});
