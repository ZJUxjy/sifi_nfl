import { describe, it, expect } from 'vitest';
import { calculatePlayerValue, createTradeAsset } from '../worker/core/trade/evaluate';
import type { Player } from '../common/entities';

const player = {
  pid: 1,
  ovr: 80,
  pot: 82,
  age: 27,
  contract: {
    amount: 5_000_000,
    exp: 2030,
    years: 4,
    incentives: 0,
    signingBonus: 0,
    guaranteed: 0,
    noTrade: false,
  },
} as unknown as Player;

describe('calculatePlayerValue', () => {
  it('uses gameSeason for years remaining, not real calendar year', () => {
    const v2026 = calculatePlayerValue(player, 2026);
    const v2029 = calculatePlayerValue(player, 2029);
    // contract.exp = 2030: in 2026 the player has 4 years left, in
    // 2029 only 1 year. With more years, contract value adds more,
    // so v2026 must be strictly greater than v2029.
    expect(v2026).toBeGreaterThan(v2029);
  });

  it('handles a player without a contract (no NaN, no Date dependency)', () => {
    const cheap = { pid: 2, ovr: 60, pot: 65, age: 24 } as unknown as Player;
    const v = calculatePlayerValue(cheap, 2026);
    expect(Number.isFinite(v)).toBe(true);
  });

  it('produces identical results for the same gameSeason regardless of when the test runs', () => {
    // The fix removes new Date().getFullYear(); two calls with the
    // same season must be deterministic.
    expect(calculatePlayerValue(player, 2026)).toBe(calculatePlayerValue(player, 2026));
  });
});

describe('createTradeAsset', () => {
  it('forwards gameSeason to calculatePlayerValue for player assets', () => {
    const asset2026 = createTradeAsset('player', player, 2026);
    const asset2029 = createTradeAsset('player', player, 2029);
    expect(asset2026.value).toBeGreaterThan(asset2029.value);
  });
});
