/**
 * Main-thread side helpers for talking to the GameSim Web Worker.
 *
 * Right now this module exposes a single primitive: `handleWorkerMessage`,
 * a pure filter that drops responses whose `gid` no longer matches the
 * current run. See `docs/plans/2026-04-19-review-fixlist.md` §11.
 *
 * Why a separate file:
 *   - Keeps `GameSimView.tsx` free of test-only export gymnastics.
 *   - Lives on the main-thread side, so it deliberately doesn't sit
 *     next to `simWorkerCore.ts` (which must avoid worker-global APIs
 *     yes, but is conceptually the worker's own code).
 *
 * Usage contract from `GameSimView`:
 *   1. Always pass `gidRef.current` (a ref, not a closed-over state
 *      value) so the live gid is observed even when the message
 *      handler was bound on an earlier render — otherwise we'd reopen
 *      the very stale-closure problem this filter exists to prevent.
 *   2. Bump `gidRef.current` BEFORE posting the new `simulate` request
 *      so any in-flight messages from the prior run, which still carry
 *      the old gid, are guaranteed to be dropped here.
 */
import type { SimResponse } from './simWorker.protocol';

/**
 * Returns `msg` unchanged if it belongs to the current run, otherwise
 * `null`. Callers should treat `null` as "drop and ignore this message
 * entirely" — including not firing any `onComplete` / `onError`
 * callbacks derived from it.
 */
export function handleWorkerMessage(
  currentGid: number,
  msg: SimResponse,
): SimResponse | null {
  if (msg.gid !== currentGid) return null;
  return msg;
}
