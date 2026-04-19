import { describe, it, expect, vi, afterEach } from 'vitest';
import { makeGame } from './helpers/makeGame';

/**
 * Defensive scores on blocked kicks:
 *
 *   - `doFieldGoal` rolls a small block probability before computing
 *     make/miss. On a block we then roll a 30% return-TD probability;
 *     otherwise the defense recovers and possession flips at the spot
 *     (the existing turnover-on-downs path).
 *   - `doPunt` mirrors the same shape with a 1.5% block rate and a 20%
 *     return-TD probability. The lower TD rate reflects the fact that a
 *     typical punt is from own-30, so even a clean recovery leaves the
 *     defense well short of the goal line.
 *
 * Random helpers (`truncGauss`, `bound`, `choice`) come from
 * `common/random` and are mocked here so the sim's choice of return
 * yardage / blocker / returner stays deterministic across runs.
 */
vi.mock('../common/random', async () => {
  const actual = await vi.importActual<typeof import('../common/random')>('../common/random');
  return {
    ...actual,
    truncGauss: () => 8,
    bound: (value: number, min: number, max: number) => Math.max(min, Math.min(max, value)),
    choice: <T>(arr: readonly T[]): T => arr[0]!,
  };
});

/**
 * Build a `Math.random` mock that returns the supplied values one by one
 * and falls back to `fallback` (a "safe" 0.99) once exhausted. The
 * fallback keeps later random calls (e.g. clock-running stochastics
 * inside updateState) on a stable side of every conditional.
 */
function makeSequence(values: number[], fallback = 0.99): () => number {
  let i = 0;
  return () => (i < values.length ? values[i++]! : fallback);
}

describe('GameSim blockedFieldGoalReturnTD', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('awards 6 pts to the defense, emits blockedFieldGoalReturnTD, and queues XP/2PT', () => {
    // makeGame() must be constructed BEFORE installing the spy because
    // the GameSim constructor itself calls Math.random() once for the
    // coin-toss kickoff. Mocking earlier would consume a sequence value.
    const sim = makeGame({ scrimmage: 70, down: 4, toGo: 3, awaitingKickoff: 0 });

    // doFieldGoal random sequence (with mocked common/random above):
    //   [block, returnTD]
    //   - block:    0.001 < blockProb (0.03)  -> kick is blocked
    //   - returnTD: 0.001 < returnTDProb (0.30) -> returned for a TD
    vi.spyOn(Math, 'random').mockImplementation(makeSequence([0.001, 0.001]));

    const offenseBefore = sim.o;
    const defenseBefore = sim.d;
    const ptsDefBefore = sim.team[defenseBefore].stat.pts;
    const ptsOffBefore = sim.team[offenseBefore].stat.pts;

    sim.doFieldGoal();

    expect(
      sim.team[defenseBefore].stat.pts - ptsDefBefore,
      'defense should score a 6-point TD on the blocked-FG return',
    ).toBe(6);
    expect(
      sim.team[offenseBefore].stat.pts - ptsOffBefore,
      'kicking team should not gain any points on a blocked FG',
    ).toBe(0);

    // After scoreDefensiveTouchdown, the defending team becomes the new
    // offense for the XP/2PT — same state-machine contract used by the
    // pick-six / fumble-six paths in C3.
    expect(sim.awaitingAfterTouchdown, 'XP/2PT should be queued after a return TD').toBe(true);
    expect(sim.o, 'returning team is now the offense').toBe(defenseBefore);
    expect(sim.d, 'team that kicked the FG is now defense').toBe(offenseBefore);

    const events = sim.playByPlayLogger.playByPlay;
    const td = events.find(e => e.type === 'blockedFieldGoalReturnTD');
    expect(td, 'blockedFieldGoalReturnTD event should be emitted').toBeDefined();
    expect((td as { t: 0 | 1 }).t).toBe(defenseBefore);
  });

  it('only changes possession when the blocked FG is NOT returned for a TD', () => {
    const sim = makeGame({ scrimmage: 70, down: 4, toGo: 3, awaitingKickoff: 0 });

    // [block=0.001, returnTD=0.99] -> blocked but not returned for TD.
    vi.spyOn(Math, 'random').mockImplementation(makeSequence([0.001, 0.99]));

    const offenseBefore = sim.o;
    const defenseBefore = sim.d;
    const ptsDefBefore = sim.team[defenseBefore].stat.pts;
    const ptsOffBefore = sim.team[offenseBefore].stat.pts;

    sim.doFieldGoal();

    expect(sim.team[defenseBefore].stat.pts - ptsDefBefore, 'no points on a non-return block').toBe(0);
    expect(sim.team[offenseBefore].stat.pts - ptsOffBefore).toBe(0);
    expect(sim.awaitingAfterTouchdown, 'no XP/2PT when no TD').toBe(false);
    expect(sim.o, 'possession changed to the recovering team').toBe(defenseBefore);
    expect(sim.d).toBe(offenseBefore);

    const events = sim.playByPlayLogger.playByPlay;
    expect(
      events.find(e => e.type === 'blockedFieldGoalReturnTD'),
      'no return-TD event when the block is not returned',
    ).toBeUndefined();
  });
});

describe('GameSim blockedPuntReturnTD', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('awards 6 pts to the defense, emits blockedPuntReturnTD, and queues XP/2PT', () => {
    const sim = makeGame({ scrimmage: 30, down: 4, toGo: 8, awaitingKickoff: 0 });

    // doPunt random sequence:
    //   [block, returnTD]
    //   - block:    0.001 < blockProb (0.015)  -> punt is blocked
    //   - returnTD: 0.001 < returnTDProb (0.20) -> returned for TD
    vi.spyOn(Math, 'random').mockImplementation(makeSequence([0.001, 0.001]));

    const offenseBefore = sim.o;
    const defenseBefore = sim.d;
    const ptsDefBefore = sim.team[defenseBefore].stat.pts;
    const ptsOffBefore = sim.team[offenseBefore].stat.pts;

    sim.doPunt();

    expect(
      sim.team[defenseBefore].stat.pts - ptsDefBefore,
      'defense should score a 6-point TD on the blocked-punt return',
    ).toBe(6);
    expect(sim.team[offenseBefore].stat.pts - ptsOffBefore).toBe(0);
    expect(sim.awaitingAfterTouchdown, 'XP/2PT should be queued after a return TD').toBe(true);
    expect(sim.o, 'returning team is now the offense').toBe(defenseBefore);
    expect(sim.d).toBe(offenseBefore);

    const events = sim.playByPlayLogger.playByPlay;
    const td = events.find(e => e.type === 'blockedPuntReturnTD');
    expect(td, 'blockedPuntReturnTD event should be emitted').toBeDefined();
    expect((td as { t: 0 | 1 }).t).toBe(defenseBefore);
  });

  it('only changes possession when the blocked punt is NOT returned for a TD', () => {
    const sim = makeGame({ scrimmage: 30, down: 4, toGo: 8, awaitingKickoff: 0 });

    vi.spyOn(Math, 'random').mockImplementation(makeSequence([0.001, 0.99]));

    const offenseBefore = sim.o;
    const defenseBefore = sim.d;
    const ptsDefBefore = sim.team[defenseBefore].stat.pts;
    const ptsOffBefore = sim.team[offenseBefore].stat.pts;

    sim.doPunt();

    expect(sim.team[defenseBefore].stat.pts - ptsDefBefore).toBe(0);
    expect(sim.team[offenseBefore].stat.pts - ptsOffBefore).toBe(0);
    expect(sim.awaitingAfterTouchdown).toBe(false);
    expect(sim.o, 'possession changed to the recovering team').toBe(defenseBefore);
    expect(sim.d).toBe(offenseBefore);

    const events = sim.playByPlayLogger.playByPlay;
    expect(
      events.find(e => e.type === 'blockedPuntReturnTD'),
      'no return-TD event when the block is not returned',
    ).toBeUndefined();
  });
});
