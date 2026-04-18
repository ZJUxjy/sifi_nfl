import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { makeGame } from './helpers/makeGame';

// Force passes to be incomplete deterministically and keep all randomised
// branches on the "non-eventful" side (no penalty, no sack, no PI).
vi.mock('../common/random', async () => {
  const actual = await vi.importActual<typeof import('../common/random')>('../common/random');
  return {
    ...actual,
    truncGauss: () => 0,
    bound: (value: number, min: number, max: number) => Math.max(min, Math.min(max, value)),
  };
});

describe('GameSim turnover on downs', () => {
  beforeEach(() => {
    // 0.99 > sackProb (max 0.15)            -> no sack
    // 0.99 > completionProb (max 0.75)      -> incomplete pass
    // 0.99 > 0.3 in the DPI lottery branch  -> no defender / no DPI
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('changes possession on 4th down incomplete pass', () => {
    const sim = makeGame({ scrimmage: 50, down: 4, toGo: 10, awaitingKickoff: 0 });
    const offBefore = sim.o;
    const defBefore = sim.d;

    sim.doPass();

    expect(sim.o, 'possession should have flipped to the previous defense').toBe(defBefore);
    expect(sim.d).toBe(offBefore);
    expect(sim.down, 'new offense should start with a fresh first down').toBe(1);
    expect(sim.toGo, 'fresh first-and-10').toBe(10);
    // Possession change flips field: previous scrimmage 50 -> 100 - 50 = 50.
    expect(sim.scrimmage).toBe(50);
  });

  it('does not flip possession on 1st down incomplete pass', () => {
    const sim = makeGame({ scrimmage: 50, down: 1, toGo: 10, awaitingKickoff: 0 });
    const offBefore = sim.o;

    sim.doPass();

    expect(sim.o).toBe(offBefore);
    expect(sim.down).toBe(2);
  });
});
