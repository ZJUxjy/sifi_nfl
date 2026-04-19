import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setSeed } from '../common/random';
import { OffseasonManager } from '../worker/core/season/offseason';
import { generateDraftPicks } from '../worker/core/draft';
import type { Player, Team } from '../common/entities';
import type { Contract, DraftPick } from '../common/types';

// Stub IDB-backed storage so any incidental import path that touches
// it (e.g. via GameEngine) doesn't trip jsdom's mock IDB.
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

function makeContract(years: number, signedSeason = SEASON): Contract {
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

function makeTeam(tid: number, won = 5, lost = 5): Team {
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
    budget: 100_000_000,
    cash: 0,
    salaryPaid: 0,
    season: SEASON,
    won,
    lost,
    tied: 0,
    playoffsRoundsWon: 0,
    streak: 0,
    lastTen: '',
  } as unknown as Team;
}

function makePlayer(opts: { pid: number; tid: number; ovr?: number; age?: number }): Player {
  const ovr = opts.ovr ?? 65;
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
    contract: makeContract(3, SEASON),
    ovr,
    pot: ovr,
  } as unknown as Player;
}

describe('FL8: offseason draft consumes state.draftPicks ownership', () => {
  beforeEach(() => {
    setSeed(2026);
  });

  it('credits the round-1 pick A originally owned to B after B trades for it', () => {
    // A has the worst record so calculateDraftOrder() puts A at index 0
    // (=> originalTid 0 owns round R pick 1 for every round R).
    // B has the best record so B owns pick 2 in every round.
    const teamA = makeTeam(0, 2, 14);
    const teamB = makeTeam(1, 14, 2);
    const teams = [teamA, teamB];

    // Seed each roster with a couple of existing players so the offseason
    // pipeline (aging / contract expirations / trim / fill) has something
    // sane to operate on. Only the `draftedPlayers` outcome matters here.
    const players: Player[] = [
      makePlayer({ pid: 100, tid: 0 }),
      makePlayer({ pid: 101, tid: 0 }),
      makePlayer({ pid: 200, tid: 1 }),
      makePlayer({ pid: 201, tid: 1 }),
    ];

    // Generate the canonical draftPicks for the season being closed out.
    // 2 teams * 7 rounds = 14 picks. For each round R, pick 1 belongs
    // to A (originalTid=0, tid=0) and pick 2 to B (originalTid=1, tid=1).
    const draftPicks: DraftPick[] = generateDraftPicks(teams, SEASON, 7);

    const aRound1Pick = draftPicks.find(p => p.round === 1 && p.originalTid === 0)!;
    const bRound1Pick = draftPicks.find(p => p.round === 1 && p.originalTid === 1)!;
    expect(aRound1Pick).toBeDefined();
    expect(bRound1Pick).toBeDefined();
    expect(aRound1Pick.tid).toBe(0);
    expect(aRound1Pick.pick).toBe(1);
    expect(bRound1Pick.tid).toBe(1);
    expect(bRound1Pick.pick).toBe(2);

    // TRADE: B acquires A's round-1 pick (canonical mid-season trade
    // mechanics from executeTrade / tradeDraftPick — current owner moves,
    // originalTid is preserved so the lineage is still readable).
    aRound1Pick.tid = 1;

    const mgr = new OffseasonManager(players, teams, SEASON, draftPicks);
    const result = mgr.runOffseason();

    // Round-1 pick #1 (A's old slot) MUST land with B.
    const round1Pick1Player = result.draftedPlayers.find(
      p => p.draft.round === 1 && p.draft.pick === 1
    );
    expect(round1Pick1Player).toBeDefined();
    expect(round1Pick1Player!.tid).toBe(1);

    // The canonical draftPick record should now reference that selection
    // and be marked played, so the next runDraft() can't double-pick it.
    expect(aRound1Pick.played).toBe(true);
    expect(aRound1Pick.playerPid).toBe(round1Pick1Player!.pid);

    // B's own round-1 pick (pick #2) also goes to B, sanity-check.
    const round1Pick2Player = result.draftedPlayers.find(
      p => p.draft.round === 1 && p.draft.pick === 2
    );
    expect(round1Pick2Player).toBeDefined();
    expect(round1Pick2Player!.tid).toBe(1);

    // A drafted ZERO round-1 players (the bug: round-robin would have
    // given A pick #1 in round 1 regardless of the trade).
    const aRound1Drafts = result.draftedPlayers.filter(
      p => p.draft.round === 1 && p.tid === 0
    );
    expect(aRound1Drafts.length).toBe(0);
  });

  it('skips draftPicks already marked played (idempotent against re-run)', () => {
    const teamA = makeTeam(0, 2, 14);
    const teamB = makeTeam(1, 14, 2);
    const teams = [teamA, teamB];

    const players: Player[] = [
      makePlayer({ pid: 300, tid: 0 }),
      makePlayer({ pid: 400, tid: 1 }),
    ];

    const draftPicks: DraftPick[] = generateDraftPicks(teams, SEASON, 7);
    // Pre-mark every round-1 pick as already used (simulates a partial
    // / replayed offseason). They MUST be skipped, not re-drafted.
    for (const p of draftPicks) {
      if (p.round === 1) {
        p.played = true;
        p.playerPid = -1;
      }
    }

    const mgr = new OffseasonManager(players, teams, SEASON, draftPicks);
    const result = mgr.runOffseason();

    const round1Drafts = result.draftedPlayers.filter(p => p.draft.round === 1);
    expect(round1Drafts.length).toBe(0);

    // Other rounds still execute normally for both teams.
    const round2Drafts = result.draftedPlayers.filter(p => p.draft.round === 2);
    expect(round2Drafts.length).toBe(2);
  });
});
