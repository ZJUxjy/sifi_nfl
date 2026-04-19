/**
 * Single zod-validated save contract for both CLI and UI (FL7).
 *
 * Background: prior to FL7 there were two parallel save paths:
 *
 *   - `cli/saveManager.ts` wrote JSON files under `data/saves/` and
 *     enforced a zod schema (`SaveGameSchema`) and a CLI-local
 *     `CURRENT_SAVE_SCHEMA_VERSION`.
 *   - `worker/api/GameEngine.saveGame()/loadGame()` (the actual
 *     UI / production entry-point) wrote / read straight through the
 *     IndexedDB layer with NO schema, NO version field, and NO
 *     migration. Anything in IDB was trusted.
 *
 * That meant a partial / hand-edited / pre-FL5 save loaded over the
 * UI path could replace `engine.state` with arbitrary garbage, and a
 * save written by the CLI was structurally incompatible with the UI
 * loader. Two parallel save shapes is a recipe for silent corruption.
 *
 * This module is the SINGLE source of truth:
 *   - `CURRENT_SAVE_SCHEMA_VERSION` — the on-disk / on-IDB version.
 *   - `saveSchema` — zod schema for the `{ schemaVersion, state,
 *     stats?, savedAt, name }` envelope.
 *   - `migrateSave()` — accepts unknown legacy input and upgrades it
 *     to the current schema. Idempotent on already-current saves so
 *     `validateSave(serializeSave(...))` is a no-op round-trip.
 *   - `validateSave()` — `migrateSave()` + `saveSchema.parse()` with
 *     a friendly error.
 *   - `serializeSave()` — produces a freshly-validated save object,
 *     timestamped at call time.
 *
 * Both `GameEngine` and `cli/saveManager` MUST go through this module;
 * any future divergence between the two paths should fail at the
 * shared schema rather than getting smuggled in via a side channel.
 */
import { z } from 'zod';

/**
 * Bumped whenever the persisted save shape changes in a way that
 * older readers cannot understand. Migrations live in
 * `migrateSave()`; pre-FL7 saves had no `schemaVersion` field at all
 * and are treated as v0 → upgraded in place to the current version.
 */
export const CURRENT_SAVE_SCHEMA_VERSION = 1;

/**
 * Thrown by `validateSave()` when the migrated save still doesn't
 * match `saveSchema`. Wraps the underlying ZodError for callers that
 * want structured access to the failed paths.
 */
export class SaveValidationError extends Error {
  public readonly issues?: z.ZodIssue[];
  public readonly cause?: unknown;
  constructor(message: string, opts?: { issues?: z.ZodIssue[]; cause?: unknown }) {
    super(message);
    this.name = 'SaveValidationError';
    this.issues = opts?.issues;
    this.cause = opts?.cause;
  }
}

// ---------------------------------------------------------------------------
// State sub-schema. We deliberately leave the *contents* of teams /
// players / freeAgents / schedule loose (z.array(z.unknown())) — those
// are populated by generators that aren't owned by this module, and
// pinning their full shape here would couple unrelated subsystems.
// What we DO pin is the top-level field set: every required GameState
// key must be present, with the right primitive type, otherwise the
// engine will crash on first use after install.
//
// `teamFinances` is z.unknown() because it's a `Map<number, ...>` in
// memory but JSON.stringify (and IDB structured-clone) collapse it to
// `{}`. Both shapes must load; the engine is responsible for
// reconstructing the Map if it cares.
// ---------------------------------------------------------------------------
const stateSchema = z
  .object({
    initialized: z.boolean(),
    loading: z.boolean(),
    season: z.number(),
    week: z.number(),
    phase: z.number(),
    userTid: z.number().nullable(),
    region: z.string().nullable(),
    teams: z.array(z.unknown()),
    players: z.array(z.unknown()),
    freeAgents: z.array(z.unknown()),
    games: z.array(z.unknown()),
    schedule: z.array(z.unknown()),
    lastGame: z.unknown().nullable(),
    draftPicks: z.array(z.unknown()),
    originDraftResults: z.array(z.unknown()),
    teamFinances: z.unknown(),
  })
  .passthrough();

// Mirrors `StatsManager.export()` (FL5/FL6). Per-row content is left
// as z.unknown() for the same reason as the state arrays above —
// `PlayerSeasonStats` carries every recorded category and we don't
// want this module to drift every time a stat is added. The team
// stats key tuple uses `string | number` so pre-FL6 snapshots
// (numeric tid keys) still validate.
const statsSchema = z
  .object({
    season: z.number(),
    playerStats: z.array(z.unknown()),
    teamStats: z.array(z.tuple([z.union([z.number(), z.string()]), z.array(z.unknown())])),
  })
  .passthrough();

export const saveSchema = z
  .object({
    schemaVersion: z.literal(CURRENT_SAVE_SCHEMA_VERSION),
    state: stateSchema,
    stats: statsSchema.nullable().optional(),
    savedAt: z.string(),
    name: z.string(),
  })
  .passthrough();

export type SaveData = z.infer<typeof saveSchema>;

/**
 * Accepts any unknown input and produces a value that *should* satisfy
 * `saveSchema` (still validated by the caller via `saveSchema.parse`).
 *
 * Migration ladder:
 *
 *   v0 → v1 (pre-FL7 → current):
 *     - Pre-FL7 GameEngine wrote `{ version, timestamp, name, state,
 *       stats? }` with NO `schemaVersion`. Treat any save without
 *       `schemaVersion` as v0 and upgrade in place.
 *     - `savedAt` is derived from the legacy `timestamp` field (ISO
 *       string) when present, else `new Date().toISOString()`.
 *     - `stats` may be missing (pre-FL5); coerce to `null` so the
 *       engine installs an empty StatsManager rather than throwing.
 *     - `name` may be missing on the very oldest test fixtures;
 *       synthesise something deterministic.
 *
 * Idempotent: a save already at the current version passes through
 * with only the missing-defaults fixed up (nothing is overwritten).
 */
export function migrateSave(raw: unknown): unknown {
  if (raw === null || typeof raw !== 'object') {
    throw new SaveValidationError(
      `save must be a non-null object, got ${raw === null ? 'null' : typeof raw}`,
    );
  }

  const working: Record<string, unknown> = { ...(raw as Record<string, unknown>) };

  // v0 → v1: stamp a schemaVersion on legacy (pre-FL7) saves. We do
  // NOT touch a save that already declares one, even if the value
  // looks wrong — that's the validator's job to reject.
  if (working.schemaVersion === undefined) {
    working.schemaVersion = CURRENT_SAVE_SCHEMA_VERSION;
  }

  // FL5 introduced `stats`; pre-FL5 saves predate it.
  if (working.stats === undefined) {
    working.stats = null;
  }

  // FL7 introduces `savedAt`. Pre-FL7 saves stored only the legacy
  // numeric `timestamp`; carry it forward as an ISO string.
  if (working.savedAt === undefined) {
    if (typeof working.timestamp === 'number') {
      working.savedAt = new Date(working.timestamp).toISOString();
    } else {
      working.savedAt = new Date().toISOString();
    }
  }

  // `name` should always be there on real saves but legacy / hand-
  // crafted fixtures sometimes omit it. Provide a deterministic
  // fallback so the schema doesn't fail on this single field alone
  // (the rejection should come from the actually-missing data).
  if (typeof working.name !== 'string') {
    working.name = `save_${working.savedAt}`;
  }

  return working;
}

/**
 * Migrate + validate. Throws `SaveValidationError` (wrapping the
 * underlying `ZodError`) on failure with a friendly message that
 * lists the failing field paths — the engine's `loadGame()` surface
 * propagates this to the UI/CLI as-is.
 */
export function validateSave(raw: unknown): SaveData {
  const migrated = migrateSave(raw);
  const result = saveSchema.safeParse(migrated);
  if (!result.success) {
    const summary = result.error.issues
      .map(i => `${i.path.join('.') || '<root>'}: ${i.message}`)
      .join('; ');
    throw new SaveValidationError(`invalid save: ${summary}`, {
      issues: result.error.issues,
      cause: result.error,
    });
  }
  return result.data;
}

/**
 * Build a fresh save envelope and validate it before handing it back.
 * Validation here means the in-memory state *can* be restored on
 * reload (single round-trip contract).
 */
export function serializeSave(opts: {
  state: unknown;
  stats?: unknown;
  name: string;
}): SaveData {
  return validateSave({
    schemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
    state: opts.state,
    stats: opts.stats ?? null,
    savedAt: new Date().toISOString(),
    name: opts.name,
  });
}
