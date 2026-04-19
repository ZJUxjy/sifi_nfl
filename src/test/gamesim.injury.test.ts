import { describe, it, expect } from 'vitest';
import { GameSim } from '../worker/core/game/GameSim';
import { calculateCompositeRatings } from '../worker/core/player/ovr';
import type { PlayerGameSim, TeamGameSim } from '../worker/core/game/types';
import type { Position } from '../common/types';

/**
 * Mid-tier ratings cribbed from `helpers/makeGame.ts` so a manually
 * constructed roster behaves like the canonical helper teams. Position
 * specific bonuses are layered on top.
 */
function baseRatings(pos: Position) {
  return {
    hgt: 70,
    stre: 65,
    spd: 70,
    endu: 75,
    thv: pos === 'QB' ? 80 : 50,
    thp: pos === 'QB' ? 75 : 50,
    tha: pos === 'QB' ? 78 : 50,
    bsc: pos === 'RB' || pos === 'WR' ? 75 : 60,
    elu: pos === 'RB' || pos === 'WR' || pos === 'CB' ? 78 : 60,
    rtr: pos === 'RB' || pos === 'WR' ? 72 : 55,
    hnd: pos === 'WR' || pos === 'TE' ? 76 : 55,
    rbk: pos === 'OL' ? 75 : 50,
    pbk: pos === 'OL' ? 76 : 50,
    pcv: pos === 'CB' || pos === 'S' ? 75 : 50,
    tck: pos === 'LB' || pos === 'S' ? 76 : 55,
    prs: pos === 'DL' ? 74 : 50,
    rns: pos === 'DL' ? 72 : 50,
    kpw: pos === 'K' ? 80 : 40,
    kac: pos === 'K' ? 82 : 40,
    ppw: pos === 'P' ? 78 : 40,
    pac: pos === 'P' ? 76 : 40,
    fuzz: 5,
    ovr: 70,
    pot: 75,
  };
}

function buildPlayer(tid: number, pid: number, pos: Position): PlayerGameSim {
  const ratings = baseRatings(pos);
  return {
    pid: tid * 100 + pid,
    name: `T${tid} P${pid} ${pos}`,
    pos,
    age: 25,
    ...ratings,
    stat: {},
    compositeRating: calculateCompositeRatings(ratings as never),
    energy: 1,
    ptModifier: 1,
  } as PlayerGameSim;
}

/**
 * Build a team with an extended QB room (two QBs by default) plus the
 * standard skill / line / defensive positions GameSim needs to function.
 */
function buildTeam(tid: number, qbCount: number = 2): TeamGameSim {
  const positions: Position[] = [];
  for (let i = 0; i < qbCount; i++) positions.push('QB');
  positions.push(
    'RB', 'RB', 'WR', 'WR', 'WR', 'TE',
    'OL', 'OL', 'OL', 'OL', 'OL',
    'DL', 'DL', 'DL', 'DL',
    'LB', 'LB', 'LB',
    'CB', 'CB', 'S', 'S',
    'K', 'P',
  );

  const players = positions.map((pos, i) => buildPlayer(tid, i, pos));
  const depth: Partial<Record<Position, PlayerGameSim[]>> = {};
  for (const pos of positions) {
    if (!depth[pos]) {
      depth[pos] = players.filter(p => p.pos === pos);
    }
  }

  return {
    id: tid,
    stat: { pts: 0 },
    player: players,
    compositeRating: {} as never,
    depth: depth as Record<Position, PlayerGameSim[]>,
  };
}

function makeSim(): GameSim {
  const home = buildTeam(0, 2);
  const away = buildTeam(1, 2);
  return new GameSim({ gid: 1, teams: [home, away], quarterLength: 1, numPeriods: 1 });
}

describe('GameSim — injured players are demoted from the depth chart', () => {
  it('does not return an injured starter QB from getPlayer when a healthy backup exists', () => {
    const sim = makeSim();
    const team = sim.team[0];
    const starter = team.player.find(p => p.pos === 'QB' && p.pid === 0)!;
    const backup = team.player.find(p => p.pos === 'QB' && p.pid === 1)!;

    // Mark the natural starter (first in array order) as injured. The
    // penalty values mirror what `injuries.ts` would generate for a
    // moderate-to-severe injury — enough that real lineup management ought
    // to bench them.
    starter.injury = { type: 'Fracture', gamesRemaining: 5, ovr: 50 };

    // Spec contract for both `getPlayer` (single starter) and `getPlayers`
    // (entire unit, used by passRushers / receivers / blockers / coverage):
    // injured players must be demoted out of the active rotation when at
    // least one healthy alternative exists.
    const picked = sim.getPlayer(0, 'QB');
    expect(picked.pid).toBe(backup.pid);
    expect(picked.pid).not.toBe(starter.pid);

    const qbList = sim.getPlayers(0, ['QB']);
    expect(qbList.map(p => p.pid)).toEqual([backup.pid]);
  });

  it('falls back to playing injured players when the entire position group is hurt (no crash, no NaN)', () => {
    const sim = makeSim();
    const team = sim.team[0];

    // All QBs on offense are on IR.
    for (const qb of team.player.filter(p => p.pos === 'QB')) {
      qb.injury = { type: 'Fracture', gamesRemaining: 4, ovr: 30 };
    }

    // `getPlayer` must still return one of the team's QBs (not undefined,
    // not a P/K). `getPlayers` must still return the full QB roster (so
    // composite-rating averages don't divide by zero — the C1 contract).
    const picked = sim.getPlayer(0, 'QB');
    expect(picked.pos).toBe('QB');

    const qbList = sim.getPlayers(0, ['QB']);
    expect(qbList).toHaveLength(2);
    expect(qbList.every(p => p.pos === 'QB')).toBe(true);

    // Same defensive contract for getPlayers when called with multiple
    // positions: passRushers calls `getPlayers(d, ['DL', 'LB'])`. Mark
    // every DL/LB on team 1 as injured and verify the unit isn't
    // emptied (which would NaN-poison `passRushComposite`).
    for (const dl of sim.team[1].player.filter(p => p.pos === 'DL' || p.pos === 'LB')) {
      dl.injury = { type: 'Fracture', gamesRemaining: 4, ovr: 30 };
    }
    const passRushers = sim.getPlayers(1, ['DL', 'LB']).slice(0, 4);
    expect(passRushers.length).toBeGreaterThan(0);

    // Whole-game smoke test: full sim must run to completion without
    // throwing or producing NaN stats anywhere on either roster.
    expect(() => sim.run()).not.toThrow();
    for (const t of sim.team) {
      for (const [key, val] of Object.entries(t.stat)) {
        expect(
          Number.isNaN(val),
          `team ${t.id} stat ${key} is NaN`,
        ).toBe(false);
      }
      for (const p of t.player) {
        for (const [key, val] of Object.entries(p.stat)) {
          expect(
            Number.isNaN(val),
            `${p.name} stat ${key} is NaN`,
          ).toBe(false);
        }
      }
    }
  });

  it('does not exclude players whose injury.gamesRemaining has reached 0 (recovered)', () => {
    const sim = makeSim();
    const team = sim.team[0];
    const starter = team.player.find(p => p.pos === 'QB' && p.pid === 0)!;
    const backup = team.player.find(p => p.pos === 'QB' && p.pid === 1)!;

    // Stale `injury` object whose recovery counter has already hit 0 —
    // semantically "available" per `isPlayerAvailable` in injuries.ts.
    // The filter must mirror that: > 0 only, NOT >= 0.
    starter.injury = { type: 'Bruise', gamesRemaining: 0, ovr: 5 };

    const picked = sim.getPlayer(0, 'QB');
    expect(picked.pid).toBe(starter.pid);

    const qbList = sim.getPlayers(0, ['QB']);
    expect(qbList.map(p => p.pid)).toEqual([starter.pid, backup.pid]);
  });
});
