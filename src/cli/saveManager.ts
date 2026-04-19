import fs from 'fs';
import path from 'path';
import {
  CURRENT_SAVE_SCHEMA_VERSION,
  SaveValidationError,
  saveSchema,
  serializeSave,
  validateSave,
  type SaveData,
} from '@common/saveSchema';

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
 * FL7 — re-export the shared `CURRENT_SAVE_SCHEMA_VERSION` so callers
 * (and the test suite) can keep importing from the CLI module without
 * the CLI keeping its own duplicate constant. The pre-FL7 version
 * value lived here AND in the GameEngine path; that drift is exactly
 * the bug FL7 closes.
 */
export { CURRENT_SAVE_SCHEMA_VERSION, SaveValidationError } from '@common/saveSchema';
export type { SaveData } from '@common/saveSchema';

/**
 * On-disk envelope. The CLI persists each save as its own JSON file
 * under `data/saves/<id>.json`, so it tacks an `id` on top of the
 * shared `SaveData`. The id is filename-only (validated against
 * `SAVE_ID_RE` to prevent traversal); the rest of the payload is the
 * exact same shape that `GameEngine.saveGame()` writes to IndexedDB.
 *
 * Keeping the inner shape identical to the GameEngine save is the
 * whole point of FL7: a save written by either path can be loaded
 * by the other after a quick id swap.
 */
export type SaveGame = SaveData & { id: string };

function ensureSavesDir(): void {
  if (!fs.existsSync(SAVES_DIR)) {
    fs.mkdirSync(SAVES_DIR, { recursive: true });
  }
}

function readAndValidate(filePath: string): SaveData | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(content);
    return validateSave(parsed);
  } catch (e) {
    // Both JSON.parse syntax errors and SaveValidationError land here.
    // Surface them via console.error so listSaves() / loadGame() can
    // skip the file gracefully without blowing up the entire CLI.
    const issues =
      e instanceof SaveValidationError && e.issues
        ? e.issues
        : (e as Error).message;
    console.error(`Invalid save at ${filePath}:`, issues);
    return null;
  }
}

export function listSaves(): SaveGame[] {
  ensureSavesDir();

  const files = fs.readdirSync(SAVES_DIR).filter(f => f.endsWith('.json'));
  const saves: SaveGame[] = [];

  for (const file of files) {
    const id = file.replace(/\.json$/, '');
    if (!SAVE_ID_RE.test(id)) {
      // Skip non-conforming filenames silently — these can't be loaded
      // through the validated path anyway.
      continue;
    }
    const filePath = path.join(SAVES_DIR, file);
    const data = readAndValidate(filePath);
    if (data) {
      saves.push({ ...data, id });
    }
  }

  // Newest first. `savedAt` is an ISO string so a lexicographic sort
  // is also chronological.
  return saves.sort((a, b) => (a.savedAt < b.savedAt ? 1 : -1));
}

/**
 * Persist a save to disk under `<SAVES_DIR>/<id>.json`. The save is
 * built via the shared `serializeSave()` so it carries the current
 * `schemaVersion`, an ISO `savedAt`, and survives `validateSave()`
 * before the file is even written.
 *
 * Unlike pre-FL7, this function does NOT take its own SaveData shape
 * — the inner `state` is the engine's GameState (or any object
 * matching `saveSchema.shape.state`).
 */
export function saveGame(
  name: string,
  state: SaveData['state'],
  stats: SaveData['stats'] = null,
): SaveGame {
  ensureSavesDir();

  const id = `save_${Date.now()}`;
  const data = serializeSave({ state, stats, name });

  const filePath = path.join(SAVES_DIR, `${id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

  return { ...data, id };
}

export function loadGame(id: string): SaveGame | null {
  assertValidSaveId(id);
  ensureSavesDir();

  const filePath = path.join(SAVES_DIR, `${id}.json`);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  const data = readAndValidate(filePath);
  return data ? { ...data, id } : null;
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

/**
 * Format an ISO `savedAt` (or numeric legacy timestamp) for display
 * in the CLI menus. Accepts a number for backwards compat with
 * pre-FL7 callers that still hand in `Date.now()`-style values.
 */
export function formatDate(savedAt: string | number): string {
  const date =
    typeof savedAt === 'number' ? new Date(savedAt) : new Date(savedAt);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Internal — exposed for tests and any caller that wants to validate
// without going through the filesystem (e.g. the GameEngine path).
export { saveSchema, validateSave, serializeSave };
