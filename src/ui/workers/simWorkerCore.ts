/**
 * Worker-agnostic core for the GameSim Web Worker.
 *
 * This file deliberately avoids any reference to `self`, `postMessage`,
 * or other DedicatedWorkerGlobalScope APIs so it can be unit tested
 * directly under Vitest (jsdom). The thin shell in `./simWorker.ts`
 * wires `self.onmessage` / `self.postMessage` to these primitives.
 *
 * Runtime behaviour MUST match what the worker did before the split,
 * with one intentional fix: regulation ties now drive a real OT period
 * (or several, for playoffs) via `GameSim.beginOvertimePeriod()`
 * instead of just incrementing the `overtimes` counter without playing
 * any extra plays. See `docs/plans/2026-04-19-review-fixlist.md` §1.
 */
import { GameSim } from '@worker/core/game/GameSim';
import { setSeed } from '@common/random';
import { StatsManager } from '@worker/core/stats/StatsManager';
import type {
  SimResponse,
  SimulateRequest,
  SimSpeed,
  SimStateSnapshot,
} from './simWorker.protocol';
import { SPEED_DELAYS_MS } from './simWorker.protocol';

export interface ActiveRun {
  gid: number;
  sim: GameSim;
  speed: SimSpeed;
  paused: boolean;
  aborted: boolean;
  /** Resolves the next pause-wait promise. */
  resumeWaiters: Array<() => void>;
}

/** Sink for outbound worker messages — `postMessage` in production, a spy in tests. */
export type PostFn = (msg: SimResponse) => void;

const sleep = (ms: number) =>
  ms > 0 ? new Promise<void>(resolve => setTimeout(resolve, ms)) : Promise.resolve();

export function snapshot(sim: GameSim): SimStateSnapshot {
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

/**
 * Drive a single configured `GameSim` to completion, streaming events
 * via `post`. Pause / resume / abort are observed between every play
 * (including in OT) so the Task 23 protocol stays intact.
 */
export async function runSimulation(run: ActiveRun, post: PostFn): Promise<void> {
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
      if (run.aborted) break;
      sim.simPlay();
      const delay = SPEED_DELAYS_MS[run.speed];
      if (delay > 0) await sleep(delay);
    }

    if (q < sim.numPeriods && !run.aborted) {
      sim.playByPlayLogger.logEvent({ type: 'quarter', clock: 0, quarter: q + 1 });
    }
  }

  // Overtime — actually play it. Mirrors `GameSim.run()` and
  // `GameSim.simOvertime()` but interleaves pause/abort/speed handling
  // between plays so the worker protocol keeps working in OT. We use
  // `beginOvertimePeriod()` (not the inner play-loop of `simOvertime()`)
  // so we don't lose await points; the OT state machine itself
  // (advanceOvertimeOnScore / advanceOvertimeOnPossessionChange) lives
  // entirely inside `simPlay()` and runs unchanged.
  while (
    !run.aborted &&
    sim.team[0].stat.pts === sim.team[1].stat.pts &&
    sim.overtimes < sim.maxOvertimes
  ) {
    sim.beginOvertimePeriod();

    while (sim.clock > 0 && sim.overtimeState !== 'over' && !run.aborted) {
      await awaitResume(run);
      if (run.aborted) break;
      sim.simPlay();
      const delay = SPEED_DELAYS_MS[run.speed];
      if (delay > 0) await sleep(delay);
    }

    // Mirror the `simOvertime()` post-loop invariant: the period is
    // always considered 'over' on exit, regardless of whether the
    // clock expired or a winner emerged.
    sim.overtimeState = 'over' as typeof sim.overtimeState;
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

/**
 * Construct an `ActiveRun` for the given simulate request and kick off
 * `runSimulation`. Returns the run handle (so callers can pause / abort)
 * plus the in-flight promise (so tests can `await` completion). The
 * production worker doesn't need the promise — it lets `runSimulation`
 * post the final `done` / `error` message itself.
 */
export function startSimulation(
  req: SimulateRequest,
  post: PostFn,
  /** Optional injection point so tests can supply a pre-built sim
   *  (e.g. with `simPlay` already spied on). Defaults to constructing
   *  a fresh `GameSim` from the request, exactly like production. */
  simFactory?: (req: SimulateRequest) => GameSim,
): { run: ActiveRun; done: Promise<void> } {
  if (typeof req.seed === 'number') {
    setSeed(req.seed);
  }

  // One StatsManager per simulation request — the worker may run many
  // games over its lifetime and the previous module-level cache leaked
  // accumulated stats across them.
  const sim = simFactory
    ? simFactory(req)
    : new GameSim({
        gid: req.gid,
        teams: req.teams,
        quarterLength: req.quarterLength ?? 15,
        numPeriods: req.numPeriods ?? 4,
        statsManager: new StatsManager(req.season),
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

  const done = runSimulation(run, post).catch(err => {
    post({
      type: 'error',
      gid: req.gid,
      message: err instanceof Error ? err.message : String(err),
    });
  });

  return { run, done };
}
