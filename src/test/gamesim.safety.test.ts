import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { makeGame } from './helpers/makeGame';

// Mock the random helpers so doPass/doRun behave deterministically:
//   - sack never triggers (we route through the completion / run path)
//   - completion always succeeds
//   - all yardage helpers return a large negative number, pushing the
//     ball back into the offense's own end zone for a safety.
vi.mock('../common/random', async () => {
  const actual = await vi.importActual<typeof import('../common/random')>('../common/random');
  return {
    ...actual,
    truncGauss: () => -50,
    bound: (value: number, min: number, max: number) => Math.max(min, Math.min(max, value)),
  };
});

describe('GameSim safety scoring', () => {
  beforeEach(() => {
    // Force Math.random to a value that:
    //   * is greater than sackProb (max 0.15)              -> no sack
    //   * is less than completionProb (min 0.35)           -> completion / continue
    //   * keeps clock-running stochastics deterministic
    vi.spyOn(Math, 'random').mockReturnValue(0.2);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('awards 2 points to defense when offense is downed in own end zone on a run', () => {
    const sim = makeGame({ scrimmage: 2, down: 1, toGo: 10, awaitingKickoff: 0 });
    const offense = sim.o;
    const defense = sim.d;
    const beforeDefPts = sim.team[defense].stat.pts;

    sim.doRun();

    expect(sim.team[defense].stat.pts - beforeDefPts).toBe(2);
    expect(sim.awaitingAfterSafety).toBe(true);
    // After a safety the conceding team kicks off back to the other team.
    expect(sim.awaitingKickoff).toBe(offense);
  });

  it('awards 2 points to defense on a completed pass driven back into own end zone', () => {
    const sim = makeGame({ scrimmage: 2, down: 1, toGo: 10, awaitingKickoff: 0 });
    const offense = sim.o;
    const defense = sim.d;
    const beforeDefPts = sim.team[defense].stat.pts;

    sim.doPass();

    expect(sim.team[defense].stat.pts - beforeDefPts).toBe(2);
    expect(sim.awaitingAfterSafety).toBe(true);
    expect(sim.awaitingKickoff).toBe(offense);
  });
});
