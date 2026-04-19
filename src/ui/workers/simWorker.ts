/// <reference lib="webworker" />
/**
 * GameSim Web Worker (Task 23). Drives a `GameSim` off the main thread and
 * streams play-by-play events back via `postMessage`. Supports
 * pause / resume / setSpeed / abort while the simulation is in flight.
 *
 * The worker keeps at most one active simulation per `gid`. The protocol is
 * defined in `./simWorker.protocol.ts`. All non-trivial logic lives in
 * `./simWorkerCore.ts` so it can be unit tested without spinning up a
 * real Web Worker.
 */
import type { ActiveRun, PostFn } from './simWorkerCore';
import { startSimulation } from './simWorkerCore';
import type { SimRequest, SimResponse, SimulateRequest } from './simWorker.protocol';

declare const self: DedicatedWorkerGlobalScope;

let active: ActiveRun | null = null;

const post: PostFn = (msg: SimResponse) => {
  self.postMessage(msg);
};

function handleSimulate(req: SimulateRequest) {
  // Aborting any prior run to keep this worker single-tenant.
  if (active && !active.aborted) {
    active.aborted = true;
    for (const w of active.resumeWaiters) w();
  }

  const { run } = startSimulation(req, post);
  active = run;
}

self.onmessage = (e: MessageEvent<SimRequest>) => {
  const msg = e.data;

  if (msg.type === 'simulate') {
    handleSimulate(msg);
    return;
  }

  if (!active || active.gid !== msg.gid) {
    // No active sim for this gid; ignore (could log).
    return;
  }

  switch (msg.type) {
    case 'pause':
      active.paused = true;
      post({ type: 'ack', gid: msg.gid, ack: 'paused' });
      break;
    case 'resume': {
      active.paused = false;
      const waiters = active.resumeWaiters;
      active.resumeWaiters = [];
      for (const w of waiters) w();
      post({ type: 'ack', gid: msg.gid, ack: 'resumed' });
      break;
    }
    case 'setSpeed':
      active.speed = msg.speed;
      post({ type: 'ack', gid: msg.gid, ack: 'speedChanged' });
      break;
    case 'abort': {
      active.aborted = true;
      const waiters = active.resumeWaiters;
      active.resumeWaiters = [];
      for (const w of waiters) w();
      post({ type: 'ack', gid: msg.gid, ack: 'aborted' });
      break;
    }
  }
};

export {};
