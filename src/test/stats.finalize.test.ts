import { describe, it, expect } from 'vitest';
import { GameSim } from '../worker/core/game/GameSim';
import { makeMinimalTeam } from './helpers/makeGame';

function makeSim(season: number): GameSim {
  return new GameSim({
    gid: 1,
    season,
    teams: [makeMinimalTeam(0), makeMinimalTeam(1)],
    quarterLength: 1,
    numPeriods: 1,
  });
}

describe('GameSim.finalizeGame', () => {
  it('writes the actual game season into the result, not hardcoded 2025', () => {
    const sim = makeSim(2030);
    const result = sim.finalizeGame();
    expect(result.season).toBe(2030);
  });

  it('honours season passed via the constructor for various values', () => {
    for (const season of [1999, 2025, 2042]) {
      const result = makeSim(season).finalizeGame();
      expect(result.season).toBe(season);
    }
  });
});
