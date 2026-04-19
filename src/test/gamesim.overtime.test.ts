import { describe, it, expect, vi, afterEach } from 'vitest';
import { makeGame } from './helpers/makeGame';

/**
 * NFL modern overtime state machine (regular season 2022+, playoff
 * extends with no tie). The state machine itself is exercised through
 * the dedicated helpers `advanceOvertimeOnScore` and
 * `advanceOvertimeOnPossessionChange`, which the scoring / turnover
 * paths in GameSim wire up. Driving the helpers directly here keeps
 * the assertions pinned to the state-transition rules instead of
 * incidental random outcomes from doPass / doRun.
 */
describe('GameSim overtime — modern NFL rules (state machine)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('test 1 — first-possession TD ends OT immediately (scoring team wins)', () => {
    const sim = makeGame();
    sim.team[0].stat.pts = 17;
    sim.team[1].stat.pts = 17;
    sim.overtimeState = 'initial';

    const scoring = sim.o;
    sim.scoreTouchdown();

    expect(sim.overtimeState).toBe('over');
    // The scoring team has at least 6 more points than the other team
    // (TD = 6, no XP/2PT in OT per the simplification).
    expect(sim.team[scoring].stat.pts).toBeGreaterThan(
      sim.team[scoring === 0 ? 1 : 0].stat.pts,
    );
  });

  it('test 2 — first-possession FG concedes a possession (state → secondPossession)', () => {
    const sim = makeGame();
    sim.team[0].stat.pts = 17;
    sim.team[1].stat.pts = 17;
    sim.overtimeState = 'initial';

    sim.advanceOvertimeOnScore('fg');

    expect(sim.overtimeState).toBe('secondPossession');
    // Sudden death only triggers AFTER both teams had a possession.
    expect(sim.overtimeSuddenDeath).toBe(false);
  });

  it('test 3 — FG vs FG enters sudden death; next score wins', () => {
    const sim = makeGame();
    sim.team[0].stat.pts = 17;
    sim.team[1].stat.pts = 17;
    sim.overtimeState = 'initial';

    // First team makes a FG → secondPossession.
    sim.team[sim.o].stat.pts += 3;
    sim.advanceOvertimeOnScore('fg');
    expect(sim.overtimeState).toBe('secondPossession');
    expect(sim.overtimeSuddenDeath).toBe(false);

    // Second team responds with a FG to tie → sudden death.
    // (We don't actually flip possession via possessionChange because
    // the helpers are agnostic to who's on offense — they read team
    // scores directly. Just bump the trailing team to tie.)
    const trailing = sim.team[0].stat.pts < sim.team[1].stat.pts ? 0 : 1;
    sim.team[trailing].stat.pts += 3;
    sim.advanceOvertimeOnScore('fg');
    expect(sim.overtimeSuddenDeath).toBe(true);
    expect(sim.overtimeState).not.toBe('over');

    // Next score (any kind) ends the game.
    sim.team[sim.o].stat.pts += 3;
    sim.advanceOvertimeOnScore('fg');
    expect(sim.overtimeState).toBe('over');
  });

  it('test 4 — regular season ends in tie when no team scores within the OT period', () => {
    const sim = makeGame({ playoffs: false });
    sim.team[0].stat.pts = 17;
    sim.team[1].stat.pts = 17;

    // Stub simPlay to burn clock without scoring or transitioning state.
    // Each "play" eats 30 seconds, so the loop terminates in <= 20 iters.
    vi.spyOn(sim, 'simPlay').mockImplementation(() => {
      sim.clock = Math.max(0, sim.clock - 0.5);
    });

    sim.simOvertime();

    expect(sim.overtimeState).toBe('over');
    expect(sim.team[0].stat.pts).toBe(sim.team[1].stat.pts);
    // Regular season caps OT at one period; the run() loop won't start a
    // second one. maxOvertimes encodes that cap.
    expect(sim.maxOvertimes).toBe(1);
  });

  it('test 5 — playoff allows multiple OT periods until a winner emerges (no tie)', () => {
    const sim = makeGame({ playoffs: true });
    sim.team[0].stat.pts = 14;
    sim.team[1].stat.pts = 14;

    // Playoff cap must exceed the regular-season cap of 1, so the run()
    // loop can cycle through additional periods when the first one ends
    // tied.
    expect(sim.maxOvertimes).toBeGreaterThan(1);

    // Stub simPlay so plays burn clock without scoring; first OT period
    // therefore ends tied.
    vi.spyOn(sim, 'simPlay').mockImplementation(() => {
      sim.clock = Math.max(0, sim.clock - 0.5);
    });

    sim.simOvertime();
    expect(sim.overtimeState).toBe('over');
    expect(sim.team[0].stat.pts).toBe(sim.team[1].stat.pts);
    sim.overtimes++;

    // The run-loop precondition (still tied AND overtimes < maxOvertimes)
    // is satisfied → playoff would start another OT period.
    expect(sim.team[0].stat.pts).toBe(sim.team[1].stat.pts);
    expect(sim.overtimes).toBeLessThan(sim.maxOvertimes);
  });
});

describe('GameSim overtime — turnover and safety transitions', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('first-possession turnover (punt / INT / 4-down) hands ball to second team without ending OT', () => {
    const sim = makeGame();
    sim.team[0].stat.pts = 17;
    sim.team[1].stat.pts = 17;
    sim.overtimeState = 'initial';

    sim.advanceOvertimeOnPossessionChange();

    expect(sim.overtimeState).toBe('secondPossession');
    expect(sim.overtimeSuddenDeath).toBe(false);
  });

  it('second-possession turnover with leader → game over (leader wins)', () => {
    const sim = makeGame();
    // Simulate: first team had a FG (now leads 20-17), second team has the
    // ball and turns it over without scoring.
    sim.team[0].stat.pts = 20;
    sim.team[1].stat.pts = 17;
    sim.overtimeState = 'secondPossession';

    sim.advanceOvertimeOnPossessionChange();

    expect(sim.overtimeState).toBe('over');
  });

  it('second-possession safety → game over', () => {
    const sim = makeGame();
    sim.team[0].stat.pts = 17;
    sim.team[1].stat.pts = 17;
    sim.overtimeState = 'secondPossession';

    // Defending team scores a safety → award and advance.
    sim.team[sim.d].stat.pts += 2;
    sim.advanceOvertimeOnScore('safety');

    expect(sim.overtimeState).toBe('over');
  });
});
