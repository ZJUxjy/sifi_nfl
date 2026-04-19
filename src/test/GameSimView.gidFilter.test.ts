/**
 * Review Fixlist FL11 — `GameSimView` must drop worker messages whose
 * `gid` no longer matches the current run.
 *
 * Background: `worker.onmessage` used to forward every event / done /
 * error straight into React state, even if the user had already moved
 * on (Play Again, Reset, Pause+Resume). A late `event` from a
 * just-aborted prior run would bump the new run's scoreboard; a stale
 * `done` would fire `onComplete` against the wrong game.
 *
 * The fix is a tiny pure helper, `handleWorkerMessage(currentGid, msg)`,
 * that returns the message untouched when its gid matches the live
 * `gidRef.current` and `null` otherwise. Testing the helper directly
 * keeps the contract explicit and avoids spinning up a real Worker /
 * React renderer just to assert "the late message was ignored".
 */
import { describe, expect, it, vi } from 'vitest';

import { handleWorkerMessage } from '@ui/workers/simWorkerClient';
import type {
  DoneResponse,
  ErrorResponse,
  EventResponse,
  SimResponse,
} from '@ui/workers/simWorker.protocol';

function makeEvent(gid: number, ptsHome = 0): EventResponse {
  return {
    type: 'event',
    gid,
    event: {
      type: 'kickoff',
      clock: 15,
      names: ['K'],
      t: 0,
      touchback: true,
      yds: 0,
    },
    state: {
      quarter: 1,
      clock: 15,
      scores: [ptsHome, 0],
      isOvertime: false,
    },
  };
}

function makeDone(gid: number): DoneResponse {
  return {
    type: 'done',
    gid,
    // The shape of `result` doesn't matter here — handleWorkerMessage
    // is type-agnostic about payload contents.
    result: {} as DoneResponse['result'],
    playByPlay: [],
  };
}

function makeError(gid: number): ErrorResponse {
  return { type: 'error', gid, message: 'boom' };
}

describe('handleWorkerMessage — FL11 gid filter', () => {
  it('drops a stray event whose gid does not match the current run', () => {
    const stale = makeEvent(1, 7);
    expect(handleWorkerMessage(2, stale)).toBeNull();
  });

  it('passes through an event whose gid matches the current run', () => {
    const fresh = makeEvent(2, 7);
    expect(handleWorkerMessage(2, fresh)).toBe(fresh);
  });

  it('drops a stale done message so onComplete is not fired against the wrong run', () => {
    // Mirror the exact wiring `GameSimView`'s onmessage uses: filter
    // first, then dispatch by `msg.type`.
    const onComplete = vi.fn();
    const dispatch = (currentGid: number, msg: SimResponse) => {
      const filtered = handleWorkerMessage(currentGid, msg);
      if (!filtered) return;
      if (filtered.type === 'done') onComplete(filtered.gid);
    };

    // Late `done` from the previous run (gid=1) must NOT fire onComplete
    // for the new run (currentGid=2).
    dispatch(2, makeDone(1));
    expect(onComplete).not.toHaveBeenCalled();

    // The matching `done` for the live run does fire it.
    dispatch(2, makeDone(2));
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith(2);
  });

  it('still drops messages from a run that was aborted and superseded', () => {
    // Simulated sequence:
    //   1. Run gid=7 starts, user clicks Reset (worker is told to abort
    //      but might still have one in-flight `simPlay` / pending error).
    //   2. User clicks Start Game again -> `gidRef.current` is bumped
    //      to 8 BEFORE any new worker traffic happens.
    //   3. The aborted run's late `event` and `error` arrive with gid=7.
    // Both must be filtered against the live gid=8.
    const lateEvent = makeEvent(7, 99);
    const lateError = makeError(7);

    expect(handleWorkerMessage(8, lateEvent)).toBeNull();
    expect(handleWorkerMessage(8, lateError)).toBeNull();

    // And once a real message for the new run arrives, it's accepted.
    const liveEvent = makeEvent(8, 0);
    expect(handleWorkerMessage(8, liveEvent)).toBe(liveEvent);
  });
});
