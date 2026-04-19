import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { makeGame } from './helpers/makeGame';

/**
 * Deterministic seedable PRNG (mulberry32) so we can mock Math.random
 * with a *stream* of distinct values. A fixed-return mock would make
 * every iteration of decideXpOrTwo() take the same branch, defeating
 * the point of running 1000 trials.
 */
function makeSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('GameSim.decideXpOrTwo (situational AI)', () => {
  beforeEach(() => {
    // Single seeded stream shared across all 1000 iterations of a test
    // so the proportion is deterministic but the individual decisions
    // sample the full probability distribution.
    const next = makeSeededRandom(424242);
    vi.spyOn(Math, 'random').mockImplementation(next);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('strongly favors 2PT in late 4Q when the scoring team is down by 2', () => {
    let twoCount = 0;
    for (let i = 0; i < 1000; i++) {
      const sim = makeGame({ quarter: 4, clock: 1 });
      // After scoreTouchdown(), pts have already been bumped by 6.
      // Mimic post-TD scoreboard: scoring team trails 14-16.
      sim.team[sim.o].stat.pts = 14;
      sim.team[sim.d].stat.pts = 16;
      if (sim.decideXpOrTwo() === 'two') twoCount++;
    }
    // Rule 1 of the heuristic targets ~90% in this exact spot.
    // 500/1000 leaves comfortable headroom for sampling noise.
    expect(twoCount).toBeGreaterThan(500);
  });

  it('rarely picks 2PT in 1Q opening (baseline only)', () => {
    let twoCount = 0;
    for (let i = 0; i < 1000; i++) {
      const sim = makeGame({ quarter: 1, clock: 15 });
      // Scoring team just took a 7-0 lead (XP would normally follow).
      sim.team[sim.o].stat.pts = 7;
      sim.team[sim.d].stat.pts = 0;
      if (sim.decideXpOrTwo() === 'two') twoCount++;
    }
    // Baseline is 5%, so out of 1000 we expect ~50. < 200 is generous.
    expect(twoCount).toBeLessThan(200);
  });
});

describe('GameSim.doTwoPointConversion (state machine)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('on a successful conversion: +2 pts, clears awaitingAfterTouchdown, queues kickoff', () => {
    // 0.3 < 0.48 success threshold, so the conversion is made.
    vi.spyOn(Math, 'random').mockReturnValue(0.3);

    const sim = makeGame();
    sim.awaitingKickoff = undefined;
    sim.awaitingAfterTouchdown = true;
    const offense = sim.o;
    const before = sim.team[offense].stat.pts;

    sim.doTwoPointConversion();

    expect(sim.team[offense].stat.pts - before).toBe(2);
    expect(sim.awaitingAfterTouchdown).toBe(false);
    // The scoring team kicks off after the conversion, mirroring XP flow.
    expect(sim.awaitingKickoff).toBe(offense);
  });

  it('on a failed conversion: 0 pts, but state is still cleared correctly', () => {
    // 0.99 > 0.48 success threshold, so the conversion fails.
    vi.spyOn(Math, 'random').mockReturnValue(0.99);

    const sim = makeGame();
    sim.awaitingKickoff = undefined;
    sim.awaitingAfterTouchdown = true;
    const offense = sim.o;
    const before = sim.team[offense].stat.pts;

    sim.doTwoPointConversion();

    expect(sim.team[offense].stat.pts).toBe(before);
    expect(sim.awaitingAfterTouchdown).toBe(false);
    expect(sim.awaitingKickoff).toBe(offense);
  });
});
