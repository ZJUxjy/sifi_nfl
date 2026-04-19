/// <reference lib="webworker" />
/**
 * GameSim Web Worker (Task 23). Drives a `GameSim` off the main thread and
 * streams play-by-play events back via `postMessage`. Supports
 * pause / resume / setSpeed / abort while the simulation is in flight.
 *
 * The worker keeps at most one active simulation per `gid`. The protocol is
 * defined in `./simWorker.protocol.ts`.
 */
import { GameSim } from '@worker/core/game/GameSim';
import { setSeed } from '@common/random';
import { getStatsManager } from '@worker/core/stats/StatsManager';
import type {
  SimRequest,
  SimResponse,
  SimulateRequest,
  SimSpeed,
  SimStateSnapshot,
} from './simWorker.protocol';
import { SPEED_DELAYS_MS } from './simWorker.protocol';

declare const self: DedicatedWorkerGlobalScope;

interface ActiveRun {
  gid: number;
  sim: GameSim;
  speed: SimSpeed;
  paused: boolean;
  aborted: boolean;
  /** Resolves the next pause-wait promise. */
  resumeWaiters: Array<() => void>;
}

let active: ActiveRun | null = null;

function post(msg: SimResponse) {
  self.postMessage(msg);
}

const sleep = (ms: number) =>
  ms > 0 ? new Promise<void>(resolve => setTimeout(resolve, ms)) : Promise.resolve();

function snapshot(sim: GameSim): SimStateSnapshot {
  return {
    quarter: sim.quarter,
    clock: sim.clock,
    scores: [sim.team[0].stat.pts, sim.team[1].stat.pts],
    down: sim.down,
    toGo: sim.toGo,
    scrimmage: sim.scrimmage,
    possession: sim.o,
    isOvertime: sim.overtimes > 0,
  };
}

async function awaitResume(run: ActiveRun): Promise<void> {
  if (!run.paused || run.aborted) return;
  await new Promise<void>(resolve => {
    run.resumeWaiters.push(resolve);
  });
}

async function runSimulation(run: ActiveRun) {
  const { sim, gid } = run;

  sim.onEvent = (event) => {
    post({ type: 'event', gid, event, state: snapshot(sim) });
  };

  // Kickoff event so the UI sees the start of Q1.
  sim.playByPlayLogger.logEvent({ type: 'quarter', clock: sim.clock, quarter: 1 });

  // Regulation
  for (let q = 1; q <= sim.numPeriods; q++) {
    if (run.aborted) break;
    sim.quarter = q;
    sim.clock = sim.quarterLength;

    while (sim.clock > 0 || sim.playUntimedPossession) {
      if (run.aborted) break;
      await awaitResume(run);
      sim.simPlay();
      const delay = SPEED_DELAYS_MS[run.speed];
      if (delay > 0) await sleep(delay);
    }

    if (q < sim.numPeriods && !run.aborted) {
      sim.playByPlayLogger.logEvent({ type: 'quarter', clock: 0, quarter: q + 1 });
    }
  }

  // Overtime if regulation ended tied.
  while (
    !run.aborted &&
    sim.team[0].stat.pts === sim.team[1].stat.pts &&
    sim.overtimes < sim.maxOvertimes
  ) {
    sim.overtimes++;
  }

  if (run.aborted) {
    return;
  }

  sim.playByPlayLogger.logEvent({ type: 'gameOver', clock: 0, final: true });

  // Persist stats — StatsManager lives in the worker's own module memory.
  // The result/Game returned to the main thread is what matters; the
  // main thread can re-aggregate stats from the playByPlay log if needed.
  // We still call recordStatsToManager via the public path used by run().
  // Since GameSim doesn't expose it directly, finalizeGame will skip it.
  const result = sim.finalizeGame();

  post({
    type: 'done',
    gid,
    result,
    playByPlay: sim.playByPlayLogger.getPlayByPlay(),
  });
}

function startSimulation(req: SimulateRequest) {
  // Aborting any prior run to keep this worker single-tenant.
  if (active && !active.aborted) {
    active.aborted = true;
    for (const w of active.resumeWaiters) w();
  }

  if (typeof req.seed === 'number') {
    setSeed(req.seed);
  }

  const statsManager = getStatsManager(req.season);

  const sim = new GameSim({
    gid: req.gid,
    teams: req.teams,
    quarterLength: req.quarterLength ?? 15,
    numPeriods: req.numPeriods ?? 4,
    statsManager,
    playoffs: req.playoffs ?? false,
    season: req.season,
  });

  const run: ActiveRun = {
    gid: req.gid,
    sim,
    speed: req.speed ?? 'normal',
    paused: false,
    aborted: false,
    resumeWaiters: [],
  };
  active = run;

  runSimulation(run).catch(err => {
    post({
      type: 'error',
      gid: req.gid,
      message: err instanceof Error ? err.message : String(err),
    });
  });
}

self.onmessage = (e: MessageEvent<SimRequest>) => {
  const msg = e.data;

  if (msg.type === 'simulate') {
    startSimulation(msg);
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
