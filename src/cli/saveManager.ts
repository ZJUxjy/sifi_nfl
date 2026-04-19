import fs from 'fs';
import path from 'path';
import { z } from 'zod';

const SAVES_DIR = path.join(process.cwd(), 'data', 'saves');

// Save ids are produced by saveGame() as `save_${Date.now()}`, so a
// strict `save_<digits>` whitelist exactly matches what we generate and
// rejects anything that could escape SAVES_DIR (`..`, slashes, NUL,
// backslashes on Windows, etc.). Validate at the public API boundary.
const SAVE_ID_RE = /^save_\d+$/;

function assertValidSaveId(id: string): void {
  if (typeof id !== 'string' || !SAVE_ID_RE.test(id)) {
    throw new Error(`invalid save id: ${JSON.stringify(id)}`);
  }
}

/**
 * Bumped whenever the on-disk SaveGame shape changes in a way that
 * older readers can't understand. loadGame() only accepts saves with
 * a schemaVersion === CURRENT_SAVE_SCHEMA_VERSION; older versions
 * should be funnelled through a future migrate() step (not yet
 * implemented - currently they're rejected with a clear error).
 */
export const CURRENT_SAVE_SCHEMA_VERSION = 1;

const SaveDataSchema = z.object({
  teams: z.array(z.unknown()),
  players: z.array(z.unknown()),
  freeAgents: z.array(z.unknown()).optional(),
  seasonYear: z.number(),
  currentWeek: z.number(),
  schedule: z.array(z.unknown()),
  standings: z.array(z.unknown()),
  userTeamTid: z.number(),
});

const SaveGameSchema = z.object({
  schemaVersion: z.literal(CURRENT_SAVE_SCHEMA_VERSION),
  id: z.string().regex(SAVE_ID_RE),
  name: z.string(),
  timestamp: z.number(),
  seasonYear: z.number(),
  currentWeek: z.number(),
  userTeamName: z.string(),
  userTeamRegion: z.string(),
  data: SaveDataSchema,
});

export type SaveData = z.infer<typeof SaveDataSchema>;
export type SaveGame = z.infer<typeof SaveGameSchema>;

function ensureSavesDir(): void {
  if (!fs.existsSync(SAVES_DIR)) {
    fs.mkdirSync(SAVES_DIR, { recursive: true });
  }
}

export function listSaves(): SaveGame[] {
  ensureSavesDir();

  const files = fs.readdirSync(SAVES_DIR).filter(f => f.endsWith('.json'));
  const saves: SaveGame[] = [];

  for (const file of files) {
    try {
      const filePath = path.join(SAVES_DIR, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(content);
      const result = SaveGameSchema.safeParse(parsed);
      if (result.success) {
        saves.push(result.data);
      } else {
        console.error(`Skipping invalid save ${file}:`, result.error.issues);
      }
    } catch (e) {
      console.error(`Error reading save file ${file}:`, e);
    }
  }

  return saves.sort((a, b) => b.timestamp - a.timestamp);
}

export function saveGame(name: string, data: SaveData): SaveGame {
  ensureSavesDir();

  const id = `save_${Date.now()}`;
  const save: SaveGame = {
    schemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
    id,
    name,
    timestamp: Date.now(),
    seasonYear: data.seasonYear,
    currentWeek: data.currentWeek,
    userTeamName:
      (data.teams.find((t: any) => t?.tid === data.userTeamTid) as any)?.name ?? 'Unknown',
    userTeamRegion:
      (data.teams.find((t: any) => t?.tid === data.userTeamTid) as any)?.region ?? 'Unknown',
    data,
  };

  const filePath = path.join(SAVES_DIR, `${id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(save, null, 2));

  return save;
}

export function loadGame(id: string): SaveGame | null {
  assertValidSaveId(id);
  ensureSavesDir();

  const filePath = path.join(SAVES_DIR, `${id}.json`);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(content);
    const result = SaveGameSchema.safeParse(parsed);
    if (!result.success) {
      console.error(`Invalid save ${id}:`, result.error.issues);
      return null;
    }
    return result.data;
  } catch (e) {
    console.error(`Error loading save ${id}:`, e);
    return null;
  }
}

export function deleteSave(id: string): boolean {
  assertValidSaveId(id);
  ensureSavesDir();

  const filePath = path.join(SAVES_DIR, `${id}.json`);

  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    return true;
  }

  return false;
}

export function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
