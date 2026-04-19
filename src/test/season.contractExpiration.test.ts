import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setSeed } from '../common/random';
import { OffseasonManager } from '../worker/core/season/offseason';
import { signFreeAgent } from '../worker/core/freeAgent';
import type { Player, Team } from '../common/entities';
import type { Contract } from '../common/types';

// Stub all the network-y / IDB-y bits that draft pool and free-agent
// pool generators reach for so the offseason runs in a pure unit
// context. We only care about contract expirations here.
vi.mock('../worker/api/storage', () => ({
  initDB: vi.fn().mockResolvedValue({}),
  saveWorldData: vi.fn().mockResolvedValue(undefined),
  loadWorldData: vi.fn().mockResolvedValue(null),
  clearWorldData: vi.fn().mockResolvedValue(undefined),
  saveGame: vi.fn().mockResolvedValue(undefined),
  loadGame: vi.fn().mockResolvedValue(null),
  deleteGame: vi.fn().mockResolvedValue(undefined),
  listSaves: vi.fn().mockResolvedValue([]),
}));

const SEASON = 2026;
const NEW_SEASON = SEASON + 1;

function makeContract(years: number, signedSeason = SEASON): Contract {
  // Mirror the canonical convention used by every signing site
  // (signFreeAgent / generateContract / draft pool / negotiation):
  //   exp = signedSeason + years (= first season the contract is NOT
  //   valid). i.e. years remaining at season S = exp - S.
  return {
    amount: 1_000_000,
    exp: signedSeason + years,
    years,
    incentives: 0,
    signingBonus: 0,
    guaranteed: 0,
    noTrade: false,
  };
}

function makePlayer(opts: {
  pid: number;
  tid: number | undefined;
  contract?: Contract;
  ovr?: number;
  age?: number;
}): Player {
  const ovr = opts.ovr ?? 60;
  const age = opts.age ?? 26;
  return {
    pid: opts.pid,
    tid: opts.tid,
    name: `Player ${opts.pid}`,
    age,
    bornYear: SEASON - age,
    bornLoc: 'USA',
    pos: 'WR',
    hgt: 75,
    stre: 60,
    spd: 60,
    endu: 60,
    ovrs: { QB: ovr, RB: ovr, WR: ovr, TE: ovr, OL: ovr, DL: ovr, LB: ovr, CB: ovr, S: ovr, K: ovr, P: ovr } as never,
    pots: { QB: ovr, RB: ovr, WR: ovr, TE: ovr, OL: ovr, DL: ovr, LB: ovr, CB: ovr, S: ovr, K: ovr, P: ovr } as never,
    ratingsIndex: 0,
    statsIndex: 0,
    draft: { year: SEASON - 3, round: 0, pick: 0, tid: -1, originalTid: -1, pot: ovr, ovr, skills: [] },
    numBrothers: 0,
    numSons: 0,
    hallOfFame: false,
    contract: opts.contract,
    ovr,
    pot: ovr,
  } as unknown as Player;
}

function makeTeam(tid: number): Team {
  return {
    tid,
    cid: 0,
    did: 0,
    region: 'firstContinent',
    name: `Team ${tid}`,
    abbrev: `T${tid}`,
    colors: ['#000', '#fff', '#888'],
    pop: '1',
    srID: '',
    budget: 0,
    cash: 0,
    salaryPaid: 0,
    season: SEASON,
    won: 5,
    lost: 5,
    playoffsRoundsWon: 0,
    streak: 0,
    lastTen: '',
  } as unknown as Team;
}

describe('FL4: contract expiration is off-by-one safe', () => {
  beforeEach(() => {
    setSeed(2026);
  });

  it('a 1-year contract (years=1, exp=season+1) MUST expire this offseason', () => {
    // The bug: processContractExpirations checks `years <= 0` *before*
    // decrementing, so a 1-year contract (years=1) survives this
    // offseason and gets an extra free year.
    const player = makePlayer({
      pid: 1001,
      tid: 0,
      contract: makeContract(1, SEASON),
      // Below the resign bar (ovr>=75) so the result is deterministic:
      // expired -> FA, no random re-sign branch.
      ovr: 60,
      age: 27,
    });
    const team = makeTeam(0);

    const mgr = new OffseasonManager([player], [team], SEASON);
    const result = mgr.runOffseason();

    expect(result.newFreeAgents.map(p => p.pid)).toContain(player.pid);
  });

  it('a fresh 1-year contract signed via signFreeAgent expires on the next offseason', () => {
    const player = makePlayer({ pid: 2002, tid: undefined, ovr: 60, age: 27 });
    const team = makeTeam(0);

    // Use the production signing path so we exercise the same exp/years
    // convention end-to-end. signFreeAgent sets exp = season + years.
    signFreeAgent(player, team, 1_000_000, 1, SEASON);

    expect(player.tid).toBe(0);
    expect(player.contract!.years).toBe(1);
    expect(player.contract!.exp).toBe(NEW_SEASON);

    const mgr = new OffseasonManager([player], [team], SEASON);
    const result = mgr.runOffseason();

    expect(result.newFreeAgents.map(p => p.pid)).toContain(player.pid);
  });

  it('a 3-year contract decrements to 2 years remaining and player stays on team', () => {
    const player = makePlayer({
      pid: 3003,
      tid: 0,
      contract: makeContract(3, SEASON),
      ovr: 60,
      age: 27,
    });
    const team = makeTeam(0);

    const mgr = new OffseasonManager([player], [team], SEASON);
    const result = mgr.runOffseason();

    expect(result.newFreeAgents.map(p => p.pid)).not.toContain(player.pid);
    expect(player.tid).toBe(0);
    // After offseason, 2 seasons remaining (player just played 1 of 3).
    expect(player.contract!.years).toBe(2);
    // exp must NOT have moved -- it is the absolute "first invalid
    // season", anchored at signing time.
    expect(player.contract!.exp).toBe(SEASON + 3);
  });

  it('years and exp do not drift apart after offseason (single source of truth)', () => {
    // Mix of contract lengths across players still on a roster.
    const players: Player[] = [
      makePlayer({ pid: 4001, tid: 0, contract: makeContract(2, SEASON), ovr: 60, age: 26 }),
      makePlayer({ pid: 4002, tid: 0, contract: makeContract(3, SEASON), ovr: 60, age: 26 }),
      makePlayer({ pid: 4003, tid: 0, contract: makeContract(4, SEASON), ovr: 60, age: 26 }),
    ];
    const team = makeTeam(0);

    const mgr = new OffseasonManager(players, [team], SEASON);
    mgr.runOffseason();

    for (const p of players) {
      // Survivors must satisfy the canonical invariant: years remaining
      // == exp - newSeason. Otherwise there are two parallel time axes
      // that will silently disagree the next time anyone reads them.
      if (p.contract && p.tid !== undefined && p.tid >= 0) {
        expect(p.contract.years).toBe(p.contract.exp - NEW_SEASON);
        expect(p.contract.years).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
