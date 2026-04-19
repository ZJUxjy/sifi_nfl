import { afterEach, describe, expect, it, vi } from 'vitest';
import { GameSim } from '../worker/core/game/GameSim';
import { startSimulation } from '../ui/workers/simWorkerCore';
import type {
  DoneResponse,
  EventResponse,
  SimResponse,
  SimulateRequest,
} from '../ui/workers/simWorker.protocol';
import { makeMinimalTeam } from './helpers/makeGame';

/**
 * Worker path OT regression — Review Fixlist §1 (P0).
 *
 * Background: the worker used to "exit OT" by bumping
 * `sim.overtimes++` without ever playing a single OT play. UI manual
 * games could finish tied even when they shouldn't have, and playoff
 * games could return a tied result, which the bracket layer is not
 * allowed to consume.
 *
 * These tests drive the worker core (`startSimulation`) directly with
 * an in-memory `post` sink. The actual Web Worker runtime is just
 * `self.onmessage` glue around the same core, so this exercises the
 * real code path the UI uses.
 */
describe('simWorker overtime — worker path executes real OT', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function makeReq(overrides: Partial<SimulateRequest> = {}): SimulateRequest {
    return {
      type: 'simulate',
      gid: 1,
      teams: [makeMinimalTeam(0), makeMinimalTeam(1)],
      season: 2025,
      // quarterLength = 0 deterministically yields a regulation tie at
      // 0-0: the worker's regulation while-loop is gated on
      // `clock > 0 || playUntimedPossession` and clock starts at 0.
      // No plays are run in regulation; the only OT-trigger condition
      // (tied score) is satisfied without any randomness.
      quarterLength: 0,
      numPeriods: 1,
      speed: 'instant',
      ...overrides,
    };
  }

  /**
   * Stub `simPlay` to score a TD for whichever team is on offense in OT.
   * Combined with `quarterLength: 0` for regulation (no plays at all),
   * this gives a fully deterministic fixture: regulation 0-0 tied,
   * first OT play resolves the period.
   *
   * The TD scoring here mirrors what `GameSim.scoreTouchdown()` does at
   * the level the OT-state-machine cares about (points + state advance).
   * We don't go through the real scoreTouchdown to avoid pulling in
   * kickoff / clock-bookkeeping side effects.
   */
  function stubSimPlayToScoreInOT() {
    vi.spyOn(GameSim.prototype, 'simPlay').mockImplementation(function (
      this: GameSim,
    ) {
      // Burn the OT clock either way so a no-score branch terminates
      // the period instead of looping forever.
      this.clock = Math.max(0, this.clock - 1);

      if (this.overtimeState === 'initial') {
        // First-possession TD: 6 points, period ends.
        this.team[this.o].stat.pts += 6;
        this.advanceOvertimeOnScore('td');
      }
    });
  }

  it('regulation tie triggers a real OT period (regular season)', async () => {
    stubSimPlayToScoreInOT();

    const messages: SimResponse[] = [];
    const { done } = startSimulation(makeReq({ playoffs: false }), msg => {
      messages.push(msg);
    });
    await done;

    const doneMsg = messages.find((m): m is DoneResponse => m.type === 'done');
    expect(doneMsg, 'worker should post a done message').toBeDefined();

    // `overtimes` reflects the number of OT periods STARTED. A real OT
    // run also emits an `overtime` PBP event; the broken code bumped
    // the counter without ever playing OT, so this event was missing.
    const otEvents = messages.filter(
      (m): m is EventResponse => m.type === 'event' && m.event.type === 'overtime',
    );
    expect(otEvents.length, 'OT period should have been entered').toBeGreaterThanOrEqual(1);
    expect(doneMsg!.result.overtimes).toBeGreaterThanOrEqual(1);

    // Sanity: at least one PBP entry of type `overtime` survived into
    // the playByPlay payload returned to the UI.
    const otPbp = doneMsg!.playByPlay.filter(e => e.type === 'overtime');
    expect(otPbp.length).toBeGreaterThanOrEqual(1);
  });

  it('playoff game cannot end in a tie — worker must produce a winner', async () => {
    stubSimPlayToScoreInOT();

    const messages: SimResponse[] = [];
    const { done } = startSimulation(makeReq({ playoffs: true, gid: 2 }), msg => {
      messages.push(msg);
    });
    await done;

    const doneMsg = messages.find((m): m is DoneResponse => m.type === 'done');
    expect(doneMsg).toBeDefined();

    const home = doneMsg!.result.teams[0].pts;
    const away = doneMsg!.result.teams[1].pts;
    expect(home, `playoff result must not be tied (got ${home}-${away})`).not.toBe(away);
    expect(doneMsg!.result.overtimes).toBeGreaterThanOrEqual(1);
  });

  it('worker OT path matches GameSim.run() OT behaviour for the same fixture', async () => {
    // Two parallel runs through the same deterministic fixture. The
    // worker path and the synchronous `sim.run()` path must agree on
    // (a) whether OT was played and (b) the shape of the final score,
    // since the OT state machine lives entirely inside `simPlay()` /
    // `advanceOvertimeOnScore` and both paths share it.
    //
    // We compare aggregate shape (overtimes count + total points + a
    // single 6-point winner) rather than team-by-team scores because
    // `GameSim`'s constructor picks `awaitingKickoff` via Math.random,
    // so the team that gets first possession differs across the two
    // independent constructions.
    stubSimPlayToScoreInOT();

    const messages: SimResponse[] = [];
    const { done } = startSimulation(makeReq({ playoffs: true, gid: 3 }), msg => {
      messages.push(msg);
    });
    await done;
    const workerDone = messages.find((m): m is DoneResponse => m.type === 'done')!;

    const directSim = new GameSim({
      gid: 3,
      teams: [makeMinimalTeam(0), makeMinimalTeam(1)],
      quarterLength: 0,
      numPeriods: 1,
      playoffs: true,
      season: 2025,
    });
    const directResult = directSim.run();

    const workerScores = [
      workerDone.result.teams[0].pts,
      workerDone.result.teams[1].pts,
    ].sort();
    const directScores = [
      directResult.teams[0].pts,
      directResult.teams[1].pts,
    ].sort();
    expect(workerScores).toEqual(directScores);
    expect(workerDone.result.overtimes).toBe(directResult.overtimes);
  });
});
