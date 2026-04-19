import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GameSim } from '../worker/core/game/GameSim';
import { calculateCompositeRatings } from '../worker/core/player/ovr';
import type { PlayerGameSim, TeamGameSim } from '../worker/core/game/types';
import type { Position } from '../common/types';

// Capture every call to `bound()` so we can assert that none of the
// values flowing into it (e.g. sackProb, completionProb) are NaN.
// Use `vi.hoisted` so the array reference is shared between the mock
// factory (which is hoisted above imports) and the test body.
const { boundCalls } = vi.hoisted(() => ({
  boundCalls: [] as Array<{ value: number; min: number; max: number }>,
}));

vi.mock('../common/random', async () => {
  const actual =
    await vi.importActual<typeof import('../common/random')>('../common/random');
  return {
    ...actual,
    bound: (value: number, min: number, max: number) => {
      boundCalls.push({ value, min, max });
      return Math.max(min, Math.min(max, value));
    },
  };
});

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

function buildTeam(tid: number, positions: Position[]): TeamGameSim {
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

describe('GameSim doPass with no DL/LB on defense', () => {
  beforeEach(() => {
    boundCalls.length = 0;
    // 0.5 is:
    //   * > basePenaltyProb (0.08)        -> no penalty (offense or defense)
    //   * > sackProb max (0.15)           -> no sack
    //   * > completionProb max (0.75)?    -> no, 0.5 < 0.75 so completion succeeds
    // The exact branch doesn't matter; what matters is `bound()` gets called
    // with a finite value when computing sackProb.
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('computes a finite sack probability even when the defense has no DL/LB', () => {
    // Offense: full skill + line; Defense: ONLY DBs / skill players, NO DL/LB.
    // This makes `getPlayers(d, ['DL', 'LB'])` return [], which previously
    // produced `passRushComposite = 0/0 = NaN`, contaminating sackProb.
    const offense = buildTeam(0, [
      'QB',
      'RB',
      'RB',
      'WR',
      'WR',
      'WR',
      'TE',
      'OL',
      'OL',
      'OL',
      'OL',
      'OL',
      'K',
      'P',
    ]);
    const defense = buildTeam(1, [
      // Intentionally no DL or LB:
      'QB',
      'RB',
      'WR',
      'WR',
      'CB',
      'CB',
      'S',
      'S',
      'K',
      'P',
    ]);

    const sim = new GameSim({
      gid: 1,
      teams: [offense, defense],
    });
    sim.awaitingKickoff = 1;
    sim.d = 1;
    sim.o = 0;
    sim.scrimmage = 50;
    sim.down = 1;
    sim.toGo = 10;

    expect(() => sim.doPass()).not.toThrow();

    // The first `bound()` call inside doPass is the sackProb computation.
    expect(boundCalls.length).toBeGreaterThan(0);
    for (const call of boundCalls) {
      expect(
        Number.isNaN(call.value),
        `bound() received NaN: ${JSON.stringify(call)}`,
      ).toBe(false);
      expect(
        Number.isFinite(call.value),
        `bound() received non-finite value: ${JSON.stringify(call)}`,
      ).toBe(true);
    }

    // No recorded stat anywhere should be NaN.
    for (const team of [offense, defense]) {
      for (const [key, val] of Object.entries(team.stat)) {
        expect(
          Number.isNaN(val),
          `team ${team.id} stat ${key} is NaN`,
        ).toBe(false);
      }
      for (const p of team.player) {
        for (const [key, val] of Object.entries(p.stat)) {
          expect(
            Number.isNaN(val),
            `${p.name} stat ${key} is NaN`,
          ).toBe(false);
        }
      }
    }
  });
});
