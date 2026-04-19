import { describe, it, expect } from 'vitest';
import { makeGame, makeMinimalTeam } from './makeGame';

describe('makeMinimalTeam', () => {
  it('builds a team with one player at every required position', () => {
    const team = makeMinimalTeam(0);

    expect(team.id).toBe(0);
    expect(team.player.length).toBeGreaterThanOrEqual(11);

    for (const pos of ['QB', 'RB', 'WR', 'OL', 'DL', 'LB', 'CB', 'S', 'K', 'P'] as const) {
      const players = team.player.filter(p => p.pos === pos);
      expect(players.length, `should have at least one ${pos}`).toBeGreaterThan(0);
      expect(team.depth[pos]?.length ?? 0, `${pos} depth chart`).toBeGreaterThan(0);
    }
  });

  it('gives each team a disjoint pid range so players are identifiable', () => {
    const home = makeMinimalTeam(0);
    const away = makeMinimalTeam(1);

    const homePids = new Set(home.player.map(p => p.pid));
    for (const p of away.player) {
      expect(homePids.has(p.pid), `away pid ${p.pid} collides with home`).toBe(false);
    }
  });
});

describe('makeGame', () => {
  it('returns a GameSim with sensible defaults', () => {
    const sim = makeGame();
    expect(sim.scrimmage).toBeDefined();
    expect(sim.down).toBe(1);
    expect(sim.toGo).toBe(10);
    expect(sim.quarter).toBe(1);
    expect(sim.team).toHaveLength(2);
    expect(sim.awaitingKickoff).toBe(0);
  });

  it('honours overrides for game state', () => {
    const sim = makeGame({
      scrimmage: 25,
      down: 3,
      toGo: 7,
      quarter: 2,
      clock: 12,
    });

    expect(sim.scrimmage).toBe(25);
    expect(sim.down).toBe(3);
    expect(sim.toGo).toBe(7);
    expect(sim.quarter).toBe(2);
    expect(sim.clock).toBe(12);
  });

  it('lets the kickoff side be pinned for deterministic tests', () => {
    const sim = makeGame({ awaitingKickoff: 1 });
    expect(sim.awaitingKickoff).toBe(1);
    expect(sim.d).toBe(1);
    expect(sim.o).toBe(0);
  });
});
