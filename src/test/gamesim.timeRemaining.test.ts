import { describe, it, expect } from 'vitest';
import { computeTimeRemaining } from '../worker/core/game/GameSim';

describe('computeTimeRemaining', () => {
  it('returns full game minutes left at start of Q1', () => {
    expect(
      computeTimeRemaining({ clock: 15, quarter: 1, numPeriods: 4, quarterLength: 15 })
    ).toBe(60);
  });

  it('returns 15 minutes left in Q4 with full clock', () => {
    expect(
      computeTimeRemaining({ clock: 15, quarter: 4, numPeriods: 4, quarterLength: 15 })
    ).toBe(15);
  });

  it('returns 1 minute left in Q4 with 1 minute on clock', () => {
    expect(
      computeTimeRemaining({ clock: 1, quarter: 4, numPeriods: 4, quarterLength: 15 })
    ).toBe(1);
  });

  it('returns 30 minutes left at start of Q3 (one full quarter + the current 15)', () => {
    expect(
      computeTimeRemaining({ clock: 15, quarter: 3, numPeriods: 4, quarterLength: 15 })
    ).toBe(30);
  });

  it('clamps to clock-only when quarter > numPeriods (overtime)', () => {
    // In overtime quarter > numPeriods; we shouldn't add negative full periods.
    expect(
      computeTimeRemaining({ clock: 5, quarter: 5, numPeriods: 4, quarterLength: 10 })
    ).toBe(5);
  });
});
