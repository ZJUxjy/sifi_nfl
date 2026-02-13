import { describe, it, expect } from 'vitest';
import { GameSim } from '../worker/core/game/GameSim';
import type { TeamGameSim, PlayerGameSim } from '../worker/core/game/types';
import { calculateCompositeRatings } from '../worker/core/player/ovr';

function createMockTeam(id: number): TeamGameSim {
  const players: PlayerGameSim[] = [];
  
  const positions = ['QB', 'RB', 'RB', 'WR', 'WR', 'WR', 'TE', 'OL', 'OL', 'OL', 'OL', 'OL',
                     'DL', 'DL', 'DL', 'DL', 'LB', 'LB', 'LB', 'CB', 'CB', 'S', 'S', 'K', 'P'];
  
  for (let i = 0; i < positions.length; i++) {
    const pos = positions[i];
    const ratings = {
      hgt: 70, stre: 65, spd: 70, endu: 75,
      thv: pos === 'QB' ? 80 : 50,
      thp: pos === 'QB' ? 75 : 50,
      tha: pos === 'QB' ? 78 : 50,
      bsc: ['RB', 'WR'].includes(pos) ? 75 : 60,
      elu: ['RB', 'WR', 'CB'].includes(pos) ? 78 : 60,
      rtr: ['RB', 'WR'].includes(pos) ? 72 : 55,
      hnd: ['WR', 'TE'].includes(pos) ? 76 : 55,
      rbk: pos === 'OL' ? 75 : 50,
      pbk: pos === 'OL' ? 76 : 50,
      pcv: ['CB', 'S'].includes(pos) ? 75 : 50,
      tck: ['LB', 'S'].includes(pos) ? 76 : 55,
      prs: pos === 'DL' ? 74 : 50,
      rns: pos === 'DL' ? 72 : 50,
      kpw: pos === 'K' ? 80 : 40,
      kac: pos === 'K' ? 82 : 40,
      ppw: pos === 'P' ? 78 : 40,
      pac: pos === 'P' ? 76 : 40,
      fuzz: 5, ovr: 70, pot: 75,
    };
    
    players.push({
      pid: i,
      name: `Player ${i}`,
      age: 25,
      pos: pos as any,
      ...ratings,
      stat: {},
      compositeRating: calculateCompositeRatings(ratings as any),
      energy: 1,
      ptModifier: 1,
    } as PlayerGameSim);
  }
  
  return {
    id,
    stat: { pts: 0 },
    player: players,
    compositeRating: {} as any,
    depth: {} as any,
  };
}

describe('GameSim', () => {
  it('should simulate a complete game', () => {
    const team1 = createMockTeam(1);
    const team2 = createMockTeam(2);
    
    const game = new GameSim({
      gid: 1,
      day: 1,
      teams: [team1, team2],
      quarterLength: 15,
      numPeriods: 4,
    });
    
    const result = game.run();
    
    expect(result).toBeDefined();
    expect(result.teams).toHaveLength(2);
    expect(result.teams[0].pts).toBeGreaterThanOrEqual(0);
    expect(result.teams[1].pts).toBeGreaterThanOrEqual(0);
  });

  it('should handle overtime if tied', () => {
    const team1 = createMockTeam(1);
    const team2 = createMockTeam(2);
    
    const game = new GameSim({
      gid: 1,
      teams: [team1, team2],
      quarterLength: 1,
      numPeriods: 1,
    });
    
    const result = game.run();
    
    expect(result.overtimes).toBeGreaterThanOrEqual(0);
  });
});
