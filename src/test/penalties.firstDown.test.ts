import { describe, it, expect } from 'vitest';
import { applyPenalty, type GamePenalty } from '../worker/core/game/penalties';

// applyPenalty only reads penalty.info / penalty.spotYards, so we can use
// a partial cast for the rest of GamePenalty's required fields.
function makePenalty(
  partial: Partial<GamePenalty> & { info: GamePenalty['info'] }
): GamePenalty {
  return partial as GamePenalty;
}

const offside5 = makePenalty({
  spotYards: undefined,
  info: {
    name: 'Offsides',
    yards: 5,
    isOffensive: false,
    isSpotFoul: false,
    isDeadBall: true,
    automaticFirstDown: false,
  },
});

const dpi = makePenalty({
  spotYards: 18,
  info: {
    name: 'Defensive Pass Interference',
    yards: 0,
    isOffensive: false,
    isSpotFoul: true,
    isDeadBall: false,
    automaticFirstDown: true,
  },
});

const offensiveHolding = makePenalty({
  spotYards: undefined,
  info: {
    name: 'Holding',
    yards: 10,
    isOffensive: true,
    isSpotFoul: false,
    isDeadBall: false,
    automaticFirstDown: false,
  },
});

describe('applyPenalty firstDown semantics', () => {
  it('does not grant first down on a 5yd defensive offsides when toGo is more than penalty yards', () => {
    const result = applyPenalty(offside5, /*scrimmage=*/ 50, /*toGo=*/ 10);
    expect(result.firstDown).toBe(false);
    expect(result.newScrimmage).toBe(55);
    expect(result.newToGo).toBe(5);
  });

  it('grants first down when defensive penalty yards reach the line to gain', () => {
    const result = applyPenalty(offside5, /*scrimmage=*/ 50, /*toGo=*/ 4);
    expect(result.firstDown).toBe(true);
    expect(result.newToGo).toBe(10);
  });

  it('always grants first down on automatic-first-down penalty (DPI)', () => {
    const result = applyPenalty(dpi, /*scrimmage=*/ 30, /*toGo=*/ 10);
    expect(result.firstDown).toBe(true);
    expect(result.newScrimmage).toBe(48);
  });

  it('does not grant first down on offensive penalty', () => {
    const result = applyPenalty(offensiveHolding, /*scrimmage=*/ 50, /*toGo=*/ 5);
    expect(result.firstDown).toBe(false);
  });
});
