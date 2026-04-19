import { describe, it, expect } from 'vitest';
import { makeGame } from './helpers/makeGame';
import type { PlayByPlayEvent } from '../worker/core/game/PlayByPlayLogger';

describe('GameSim.onEvent (Task 23 — worker bridge)', () => {
  it('streams every logged event through onEvent in order', () => {
    const sim = makeGame({ quarterLength: 1, numPeriods: 1 });

    const captured: PlayByPlayEvent[] = [];
    sim.onEvent = (event) => captured.push(event);

    // Drive the sim manually for a fixed number of plays so we don't have
    // to depend on run()'s overtime path (which has unrelated edge cases
    // tracked in the baseline notes).
    sim.playByPlayLogger.logEvent({ type: 'quarter', clock: 15, quarter: 1 });
    for (let i = 0; i < 30; i++) {
      sim.simPlay();
      if (sim.clock <= 0) break;
    }

    const logged = sim.playByPlayLogger.playByPlay;
    expect(logged.length).toBeGreaterThan(0);
    expect(captured.length).toBe(logged.length);
    for (let i = 0; i < captured.length; i++) {
      expect(captured[i]).toBe(logged[i]);
    }
  });

  it('does not throw when onEvent is unset', () => {
    const sim = makeGame({ quarterLength: 1, numPeriods: 1 });
    sim.playByPlayLogger.logEvent({ type: 'quarter', clock: 15, quarter: 1 });
    expect(() => {
      for (let i = 0; i < 10; i++) sim.simPlay();
    }).not.toThrow();
  });

  it('swallows errors thrown inside onEvent (sink isolation)', () => {
    const sim = makeGame({ quarterLength: 1, numPeriods: 1 });
    sim.onEvent = () => {
      throw new Error('boom');
    };
    sim.playByPlayLogger.logEvent({ type: 'quarter', clock: 15, quarter: 1 });
    expect(() => sim.simPlay()).not.toThrow();
    expect(sim.playByPlayLogger.playByPlay.length).toBeGreaterThan(0);
  });
});
