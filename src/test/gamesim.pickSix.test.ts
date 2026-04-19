import { describe, it, expect, vi, afterEach } from 'vitest';
import { makeGame } from './helpers/makeGame';

/**
 * Defensive return TDs (pick-six and fumble-six) require precise control
 * over the order of `Math.random()` calls inside `doPass` / `doRun`. A
 * single fixed value can't cover all the conditional branches we want to
 * exercise (one branch needs a *high* random for "no sack" and another a
 * *low* random for "intercepted"), so we feed an explicit sequence and
 * fall back to a safe value once the sequence is exhausted.
 *
 * `truncGauss`, `bound`, and `choice` are mocked at the module boundary
 * because they each pull from a different stream:
 *   - `truncGauss` and `choice` use the seeded PRNG in common/random.ts
 *     (NOT Math.random), so the spy below would not pin them.
 *   - `bound` is a pure helper but is mocked here purely to keep the
 *     mock surface symmetric with the other GameSim test files
 *     (gamesim.safety.test.ts, gamesim.turnoverOnDowns.test.ts).
 */
vi.mock('../common/random', async () => {
  const actual = await vi.importActual<typeof import('../common/random')>('../common/random');
  return {
    ...actual,
    truncGauss: () => 8,
    bound: (value: number, min: number, max: number) => Math.max(min, Math.min(max, value)),
    // `choice` always returns the first element so picking the receiver,
    // defender and recoverer is deterministic across runs.
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

describe('GameSim pickSix (defensive INT return TD)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('awards 6 pts to the defense, emits a pickSix event, and queues XP/2PT for the new offense', () => {
    // makeGame() must be constructed BEFORE the Math.random spy is
    // installed because the GameSim constructor itself calls
    // `Math.random()` once to randomise `awaitingKickoff`. If we
    // mocked first, that constructor call would silently consume the
    // first sequence value and shift every subsequent assertion.
    const sim = makeGame({ scrimmage: 50, down: 1, toGo: 10, awaitingKickoff: 0 });

    // doPass random sequence (with mocked penalty/sack/etc. above):
    //   [pen-off, pen-def, sack, completion, defenderLottery, int, pickSix]
    //   - pen-off, pen-def: 0.99 > basePenaltyProb (0.08)  -> no penalty
    //   - sack:             0.99 > sackProb max (0.15)     -> no sack
    //   - completion:       0.99 > completionProb max (0.75) -> not a completion
    //   - defenderLottery:  0.99 > 0.3                     -> defender = undefined
    //   - int:              0.001 < intProb (>=0.01 floor) -> intercepted!
    //   - pickSix:          0.001 < pickSixProb            -> returned for TD!
    vi.spyOn(Math, 'random').mockImplementation(
      makeSequence([0.99, 0.99, 0.99, 0.99, 0.99, 0.001, 0.001]),
    );

    const offenseBefore = sim.o;
    const defenseBefore = sim.d;
    const ptsDefBefore = sim.team[defenseBefore].stat.pts;
    const ptsOffBefore = sim.team[offenseBefore].stat.pts;

    sim.doPass();

    expect(
      sim.team[defenseBefore].stat.pts - ptsDefBefore,
      'defense should score a 6-point TD on the return',
    ).toBe(6);
    expect(
      sim.team[offenseBefore].stat.pts - ptsOffBefore,
      'offense should not gain any points on a turnover',
    ).toBe(0);

    // After scoreDefensiveTouchdown, the defending team becomes the new
    // offense so it can attempt the XP/2PT — mirrors the standard TD
    // state machine fixed in B2/C2.
    expect(sim.awaitingAfterTouchdown, 'XP/2PT should be queued after a return TD').toBe(true);
    expect(sim.o, 'returning team is now the offense').toBe(defenseBefore);
    expect(sim.d, 'team that threw the INT is now defense').toBe(offenseBefore);

    const events = sim.playByPlayLogger.playByPlay;
    const pickSix = events.find(e => e.type === 'pickSix');
    expect(pickSix, 'pickSix event should be emitted').toBeDefined();
    expect((pickSix as { t: 0 | 1 }).t).toBe(defenseBefore);

    const intEvent = events.find(e => e.type === 'interception');
    expect(intEvent, 'an interception event should also be emitted').toBeDefined();
    expect((intEvent as { td: boolean }).td, 'INT event should flag td=true on a pick-six').toBe(true);
  });

  it('only changes possession when an interception is NOT returned for TD', () => {
    const sim = makeGame({ scrimmage: 50, down: 1, toGo: 10, awaitingKickoff: 0 });

    // Same sequence as above, but the *last* value (pickSix roll) is
    // bumped above any reasonable pickSixProb so the return fails.
    vi.spyOn(Math, 'random').mockImplementation(
      makeSequence([0.99, 0.99, 0.99, 0.99, 0.99, 0.001, 0.99]),
    );

    const offenseBefore = sim.o;
    const defenseBefore = sim.d;
    const ptsDefBefore = sim.team[defenseBefore].stat.pts;
    const ptsOffBefore = sim.team[offenseBefore].stat.pts;

    sim.doPass();

    expect(sim.team[defenseBefore].stat.pts - ptsDefBefore, 'no points on a non-return INT').toBe(0);
    expect(sim.team[offenseBefore].stat.pts - ptsOffBefore).toBe(0);
    expect(sim.awaitingAfterTouchdown, 'no XP/2PT when no TD').toBe(false);
    expect(sim.o, 'possession changed to the intercepting team').toBe(defenseBefore);
    expect(sim.d).toBe(offenseBefore);

    const events = sim.playByPlayLogger.playByPlay;
    expect(events.find(e => e.type === 'pickSix'), 'no pickSix event without a return TD').toBeUndefined();
    const intEvent = events.find(e => e.type === 'interception');
    expect(intEvent).toBeDefined();
    expect((intEvent as { td: boolean }).td).toBe(false);
  });
});

describe('GameSim fumbleSix (defensive fumble return TD)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('awards 6 pts to the defense, emits a fumbleSix event, and queues XP/2PT for the new offense', () => {
    // doRun random sequence:
    //   [pen-off, fumble, fumbleSix]
    //   - pen-off: 0.99 > 0.08 -> no penalty
    //   - fumble:  0.001 < fumbleProb -> fumble!
    //   - fumbleSix: 0.001 < fumbleSixProb -> returned for TD!
    const sim = makeGame({ scrimmage: 50, down: 1, toGo: 10, awaitingKickoff: 0 });

    vi.spyOn(Math, 'random').mockImplementation(
      makeSequence([0.99, 0.001, 0.001]),
    );

    const offenseBefore = sim.o;
    const defenseBefore = sim.d;
    const ptsDefBefore = sim.team[defenseBefore].stat.pts;
    const ptsOffBefore = sim.team[offenseBefore].stat.pts;

    sim.doRun();

    expect(
      sim.team[defenseBefore].stat.pts - ptsDefBefore,
      'defense should score a 6-point TD on the fumble return',
    ).toBe(6);
    expect(sim.team[offenseBefore].stat.pts - ptsOffBefore).toBe(0);
    expect(sim.awaitingAfterTouchdown).toBe(true);
    expect(sim.o, 'returning team is now the offense').toBe(defenseBefore);
    expect(sim.d).toBe(offenseBefore);

    const events = sim.playByPlayLogger.playByPlay;
    const fumbleSix = events.find(e => e.type === 'fumbleSix');
    expect(fumbleSix, 'fumbleSix event should be emitted').toBeDefined();
    expect((fumbleSix as { t: 0 | 1 }).t).toBe(defenseBefore);

    const fumbleEvent = events.find(e => e.type === 'fumble');
    expect(fumbleEvent).toBeDefined();
    expect((fumbleEvent as { td: boolean }).td).toBe(true);
  });
});
