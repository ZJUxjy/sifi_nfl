/**
 * Playoff System
 * Handles playoff simulation for all regions
 *
 * Region-specific formats:
 * - First/Second Continent: Single elimination bracket (12 teams, 4 get bye)
 * - Origin Continent: Double elimination bracket (top 8 from championship group)
 * - Mining Island: No playoffs (uses promotion/relegation)
 */

import type { Team } from '@common/entities';
import { GameSim } from '../game/GameSim';
import { calculateCompositeRatings } from '../player/ovr';
import type { TeamGameSim, PlayerGameSim } from '../game/types';
import { StatsManager } from '../stats/StatsManager';

export type PlayoffMatchup = {
  round: number;
  matchupId: number;
  team1Tid: number;
  team2Tid: number;
  team1Seed?: number;
  team2Seed?: number;
  winner?: number;
  loser?: number;
  score?: { team1: number; team2: number };
  played: boolean;
  /**
   * Where the winner of this matchup advances. Omitted for the
   * championship matchup (whose winner becomes `bracket.champion`
   * instead). `slot: 1` writes into `team1Tid` of the target matchup,
   * `slot: 2` writes into `team2Tid`. `matchIdx` is the index *within*
   * the target round's matchups, not the global matchup id - this is
   * the bug fix for the previous global-id arithmetic that produced
   * out-of-bounds writes.
   */
  winnerTo?: { round: number; matchIdx: number; slot: 1 | 2 };
};

export type PlayoffBracket = {
  region: string;
  year: number;
  teams: Team[];
  matchups: PlayoffMatchup[];
  champion?: number;
  currentRound: number;
};

export type DoubleEliminationRound = {
  roundType: 'winners' | 'losers' | 'championship';
  round: number;
  matchups: PlayoffMatchup[];
};

export type DoubleEliminationBracket = {
  region: string;
  year: number;
  teams: Team[];
  winnersBracket: DoubleEliminationRound[];
  losersBracket: DoubleEliminationRound[];
  championship?: PlayoffMatchup;
  champion?: number;
  currentRound: number;
  /**
   * Tids still alive in the losers bracket. Maintained by
   * advanceDoubleEliminationRound so we can correctly merge new
   * WB drops with prior LB survivors round-by-round.
   */
  lbAlive?: number[];
};

/**
 * Generate single elimination playoff bracket (First/Second Continent style).
 *
 * Layout: 12 teams, top 4 get a first-round bye. Bracket topology is
 * laid out *eagerly* (1-4 seeds are placed into the divisional slots
 * up-front; each non-final matchup carries `winnerTo` metadata pointing
 * to its destination slot in the next round). This replaces the old
 * implementation which (a) never wrote 1-4 seeds anywhere and (b) tried
 * to derive the next-round destination from a global `matchupId`, which
 * is meaningless once you cross round boundaries.
 *
 * The half/half split is the standard NFL-style fixed bracket: 1/8/9
 * and 4/5/12 share the top half, 2/7/10 and 3/6/11 share the bottom
 * half, so seeds #1 and #2 can only meet in the final.
 *
 *   Wildcard (R1)        Divisional (R2)         Conference (R3)    Final (R4)
 *   WC0: 5v12  ──────►   D1: 4 vs WC0 winner  ┐
 *                        D0: 1 vs WC3 winner  ┴► C0  ┐
 *   WC3: 8v9   ──────►                              │
 *                                                   ├► F0 (champion)
 *   WC2: 7v10  ──────►   D2: 2 vs WC2 winner  ┐    │
 *                        D3: 3 vs WC1 winner  ┴► C1 ┘
 *   WC1: 6v11  ──────►
 */
export function generateSingleEliminationBracket(
  teams: Team[],
  region: string,
  year: number
): PlayoffBracket {
  const qualifiedTeams = teams.slice(0, 12);

  // Pad with TBD teams if the caller passed in fewer than 12 (kept for
  // compatibility with callers like PlayoffsView that occasionally hand
  // in 8 teams - the bracket is "incomplete but inert" in that case).
  while (qualifiedTeams.length < 12) {
    qualifiedTeams.push({ tid: -1, name: 'TBD' } as Team);
  }

  const matchups: PlayoffMatchup[] = [];
  let matchupId = 1;

  // Round 1 - Wildcard. The intra-round index of each matchup is what
  // its `winnerTo.matchIdx` on the *previous* round would point to, but
  // here R1 is the entry point so we encode the destination directly.
  type WildCardSpec = {
    seedHi: number; // higher seed (lower number)
    seedLo: number; // lower seed (higher number)
    /** divisional matchup intra-round index this winner advances into */
    divMatchIdx: number;
  };
  const wildCardSpecs: WildCardSpec[] = [
    { seedHi: 5, seedLo: 12, divMatchIdx: 1 }, // 5v12 → vs seed 4
    { seedHi: 6, seedLo: 11, divMatchIdx: 3 }, // 6v11 → vs seed 3
    { seedHi: 7, seedLo: 10, divMatchIdx: 2 }, // 7v10 → vs seed 2
    { seedHi: 8, seedLo: 9,  divMatchIdx: 0 }, // 8v9  → vs seed 1
  ];

  for (const spec of wildCardSpecs) {
    const t1 = qualifiedTeams[spec.seedHi - 1];
    const t2 = qualifiedTeams[spec.seedLo - 1];

    // If we got padded with TBDs (fewer than 12 real teams) we leave
    // the matchup out entirely so advanceSingleEliminationRound has
    // nothing to simulate.
    if (!t1 || !t2 || t1.tid === -1 || t2.tid === -1) continue;

    matchups.push({
      round: 1,
      matchupId: matchupId++,
      team1Tid: t1.tid,
      team2Tid: t2.tid,
      team1Seed: spec.seedHi,
      team2Seed: spec.seedLo,
      played: false,
      // The wildcard winner always lands in slot 2 of its divisional
      // matchup, since slot 1 is reserved for the bye seed.
      winnerTo: { round: 2, matchIdx: spec.divMatchIdx, slot: 2 },
    });
  }

  // Round 2 - Divisional. Slots are pre-seeded with 1-4 in team1, and
  // each matchup advances to a specific conference championship slot.
  //   div[0] = seed 1, div[1] = seed 4, div[2] = seed 2, div[3] = seed 3
  //   div[0] + div[1] → conf[0] (top half)
  //   div[2] + div[3] → conf[1] (bottom half)
  type DivisionalSpec = {
    byeSeed: number;
    confMatchIdx: number;
    confSlot: 1 | 2;
  };
  const divisionalSpecs: DivisionalSpec[] = [
    { byeSeed: 1, confMatchIdx: 0, confSlot: 1 },
    { byeSeed: 4, confMatchIdx: 0, confSlot: 2 },
    { byeSeed: 2, confMatchIdx: 1, confSlot: 1 },
    { byeSeed: 3, confMatchIdx: 1, confSlot: 2 },
  ];

  for (const spec of divisionalSpecs) {
    const byeTeam = qualifiedTeams[spec.byeSeed - 1];
    matchups.push({
      round: 2,
      matchupId: matchupId++,
      team1Tid: byeTeam && byeTeam.tid !== -1 ? byeTeam.tid : -1,
      team2Tid: -1,
      team1Seed: byeTeam && byeTeam.tid !== -1 ? spec.byeSeed : undefined,
      played: false,
      winnerTo: { round: 3, matchIdx: spec.confMatchIdx, slot: spec.confSlot },
    });
  }

  // Round 3 - Conference championship. Both feed into the final.
  matchups.push({
    round: 3,
    matchupId: matchupId++,
    team1Tid: -1,
    team2Tid: -1,
    played: false,
    winnerTo: { round: 4, matchIdx: 0, slot: 1 },
  });
  matchups.push({
    round: 3,
    matchupId: matchupId++,
    team1Tid: -1,
    team2Tid: -1,
    played: false,
    winnerTo: { round: 4, matchIdx: 0, slot: 2 },
  });

  // Round 4 - Final. No winnerTo: its winner becomes bracket.champion.
  matchups.push({
    round: 4,
    matchupId: matchupId++,
    team1Tid: -1,
    team2Tid: -1,
    played: false,
  });

  return {
    region,
    year,
    teams: qualifiedTeams,
    matchups,
    currentRound: 1,
  };
}

/**
 * Generate double elimination playoff bracket (Origin Continent style)
 * Top 8 teams from championship group.
 *
 * Throws if fewer than 8 qualified teams are passed in. The previous
 * implementation silently padded with `tid: -1` placeholders and
 * generated only winners-bracket round 1, leaving the losers bracket
 * permanently empty.
 */
export const MIN_DOUBLE_ELIM_TEAMS = 8;

export function generateDoubleEliminationBracket(
  teams: Team[],
  region: string,
  year: number
): DoubleEliminationBracket {
  if (teams.length < MIN_DOUBLE_ELIM_TEAMS) {
    throw new Error(
      `double elimination requires at least ${MIN_DOUBLE_ELIM_TEAMS} teams (got ${teams.length})`
    );
  }
  const qualifiedTeams = teams.slice(0, MIN_DOUBLE_ELIM_TEAMS);

  // Standard 1v8 / 4v5 / 2v7 / 3v6 seeding so the top half stays
  // separated from the bottom half until later rounds.
  const seedPairs: [number, number][] = [
    [0, 7],
    [3, 4],
    [1, 6],
    [2, 5],
  ];
  const wbRound1Matchups: PlayoffMatchup[] = seedPairs.map(([i, j], idx) => ({
    round: 1,
    matchupId: idx + 1,
    team1Tid: qualifiedTeams[i].tid,
    team2Tid: qualifiedTeams[j].tid,
    team1Seed: i + 1,
    team2Seed: j + 1,
    played: false,
  }));

  return {
    region,
    year,
    teams: qualifiedTeams,
    winnersBracket: [{ roundType: 'winners', round: 1, matchups: wbRound1Matchups }],
    losersBracket: [],
    currentRound: 1,
    lbAlive: [],
  };
}

/**
 * Convert Team to TeamGameSim for game simulation
 */
function convertTeamForSimulation(
  team: Team,
  players: any[]
): TeamGameSim {
  const gameSimPlayers: PlayerGameSim[] = players
    .filter(p => p.tid === team.tid)
    .map(p => ({
      pid: p.pid,
      name: p.name,
      pos: p.pos,
      hgt: p.hgt,
      stre: p.stre,
      spd: p.spd,
      endu: p.endu,
      thv: p.thv,
      thp: p.thp,
      tha: p.tha,
      bsc: p.bsc,
      elu: p.elu,
      rtr: p.rtr,
      hnd: p.hnd,
      rbk: p.rbk,
      pbk: p.pbk,
      pcv: p.pcv,
      tck: p.tck,
      prs: p.prs,
      rns: p.rns,
      kpw: p.kpw,
      kac: p.kac,
      ppw: p.ppw,
      pac: p.pac,
      fuzz: p.fuzz,
      ovr: p.ovr,
      pot: p.pot,
      stat: {},
      compositeRating: calculateCompositeRatings(p) as any,
      energy: 100,
      ptModifier: 1,
      injury: p.injury,
    }));

  // Build depth chart
  const depth: Record<string, PlayerGameSim[]> = {};
  const positions = ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'CB', 'S', 'K', 'P'];

  for (const pos of positions) {
    depth[pos] = gameSimPlayers
      .filter(p => p.pos === pos)
      .sort((a, b) => b.ovr - a.ovr);
  }

  return {
    id: team.tid,
    stat: { pts: 0 },
    player: gameSimPlayers,
    compositeRating: {},
    depth,
  };
}

/**
 * Simulate a single playoff game
 */
export function simulatePlayoffGame(
  team1: Team,
  team2: Team,
  allPlayers: any[],
  season: number,
  statsManager?: StatsManager,
): { winner: number; loser: number; score: { team1: number; team2: number } } {
  const team1Sim = convertTeamForSimulation(team1, allPlayers);
  const team2Sim = convertTeamForSimulation(team2, allPlayers);

  // Caller (GameEngine) owns the per-season accumulator; if none was
  // supplied we fall back to a fresh, throw-away one so this function
  // stays callable in isolation (tests, scripts) without resurrecting
  // the old module-level singleton.
  const sm = statsManager ?? new StatsManager(season);

  const game = new GameSim({
    gid: Date.now(),
    day: 1,
    teams: [team1Sim, team2Sim],
    quarterLength: 15,
    numPeriods: 4,
    statsManager: sm,
    playoffs: true,
    season,
  });

  const result = game.run();

  const score = {
    team1: result.teams[0].pts,
    team2: result.teams[1].pts,
  };

  return {
    winner: score.team1 > score.team2 ? team1.tid : team2.tid,
    loser: score.team1 > score.team2 ? team2.tid : team1.tid,
    score,
  };
}

/**
 * Pure simulator callback used by {@link advanceSingleEliminationRound}.
 * Returns the winning team id and (optionally) the recorded score.
 */
export type SingleElimSimulator = (
  team1Tid: number,
  team2Tid: number,
) => { winner: number; score?: { team1: number; team2: number } };

/**
 * Advance the single-elimination bracket by one round.
 *
 * Behaviour:
 *  - For every matchup in `bracket.currentRound` that has both teams
 *    set and is unplayed, calls `simulate(team1, team2)`, records the
 *    winner/loser/score, and propagates the winner via the matchup's
 *    `winnerTo` metadata (or sets `bracket.champion` for the final).
 *  - Skips matchups whose teams are still TBD (`-1`); this covers the
 *    degraded "fewer than 12 teams" case where wildcards were never
 *    scheduled.
 *  - Once a champion has been crowned, returns immediately - making
 *    repeat calls a no-op.
 *
 * The previous implementation had two real bugs:
 *   1. Round 1 (wildcard) winners advanced via the global `matchupId`
 *      so floor((id-1)/2) sent multiple winners into the wrong slots
 *      and left the rest of the divisional round stuck at -1.
 *   2. Seeds 1-4 were never written into the divisional round at all,
 *      so even when round 1 advancement worked the bye seeds vanished.
 *
 * Both are fixed by the new {@link PlayoffMatchup.winnerTo} field set
 * up at bracket-generation time.
 */
export function advanceSingleEliminationRound(
  bracket: PlayoffBracket,
  simulate: SingleElimSimulator,
): void {
  if (bracket.champion !== undefined) return;

  const currentRoundMatchups = bracket.matchups.filter(
    m => m.round === bracket.currentRound,
  );
  if (currentRoundMatchups.length === 0) return;

  for (const matchup of currentRoundMatchups) {
    if (matchup.played) continue;
    if (matchup.team1Tid === -1 || matchup.team2Tid === -1) continue;

    const result = simulate(matchup.team1Tid, matchup.team2Tid);

    matchup.winner = result.winner;
    matchup.loser =
      result.winner === matchup.team1Tid ? matchup.team2Tid : matchup.team1Tid;
    if (result.score) matchup.score = result.score;
    matchup.played = true;

    if (matchup.winnerTo) {
      const { round: nextRound, matchIdx, slot } = matchup.winnerTo;
      const nextRoundMatchups = bracket.matchups.filter(
        m => m.round === nextRound,
      );
      const target = nextRoundMatchups[matchIdx];
      if (target) {
        if (slot === 1) target.team1Tid = result.winner;
        else target.team2Tid = result.winner;
      }
    } else {
      // No winnerTo => this is the championship matchup.
      bracket.champion = result.winner;
    }
  }

  // Advance round only if every matchup in this round is either played
  // or perma-blocked (TBD slot from a degraded layout).
  const allDone = currentRoundMatchups.every(
    m => m.played || m.team1Tid === -1 || m.team2Tid === -1,
  );
  if (allDone) bracket.currentRound++;
}

/**
 * Production adapter: drives single-elim using the project's GameSim.
 * Wraps {@link simulatePlayoffGame} so callers can keep passing the
 * roster + season + stats manager triple instead of constructing a
 * simulator callback themselves.
 */
export function advanceSingleEliminationRoundWithGameSim(
  bracket: PlayoffBracket,
  allPlayers: any[],
  season: number,
  statsManager?: StatsManager,
): void {
  advanceSingleEliminationRound(bracket, (t1Tid, t2Tid) => {
    const team1 = bracket.teams.find(t => t.tid === t1Tid);
    const team2 = bracket.teams.find(t => t.tid === t2Tid);
    if (!team1 || !team2) {
      // Shouldn't happen - we already filtered TBD slots upstream -
      // but keep the signature total. Default to team1 advancing.
      return { winner: t1Tid };
    }
    const result = simulatePlayoffGame(
      team1,
      team2,
      allPlayers,
      season,
      statsManager,
    );
    return { winner: result.winner, score: result.score };
  });
}

/**
 * Drive a double-elimination bracket forward by one full round.
 *
 * @param bracket   bracket produced by generateDoubleEliminationBracket;
 *                  treated as immutable - the function returns a new
 *                  bracket object.
 * @param simulate  pure function that picks the winner from two team
 *                  ids. Inject a real GameSim wrapper in production
 *                  (see {@link simulateMatchupWithGameSim}); tests
 *                  pass a deterministic stub.
 *
 * Behaviour:
 *  - Plays every unplayed matchup in the current winners-bracket
 *    round, then every unplayed losers-bracket round. Losers from
 *    WB drop into the next LB round; LB losers are eliminated.
 *  - When WB has narrowed to a single team and LB has narrowed to a
 *    single team the next call schedules / plays the grand finals
 *    (single game; no bracket-reset for now to keep the model simple).
 *  - If `bracket.champion` is already set the call is a no-op.
 */
export type DoubleElimSimulator = (team1Tid: number, team2Tid: number) => number;

export function advanceDoubleEliminationRound(
  bracket: DoubleEliminationBracket,
  simulate: DoubleElimSimulator
): DoubleEliminationBracket {
  if (bracket.champion !== undefined) {
    return bracket;
  }

  const next: DoubleEliminationBracket = {
    ...bracket,
    teams: bracket.teams,
    winnersBracket: bracket.winnersBracket.map(r => ({
      ...r,
      matchups: r.matchups.map(m => ({ ...m })),
    })),
    losersBracket: bracket.losersBracket.map(r => ({
      ...r,
      matchups: r.matchups.map(m => ({ ...m })),
    })),
    lbAlive: bracket.lbAlive ? [...bracket.lbAlive] : [],
  };

  // 1. Play the current (latest, unplayed) WB round if any.
  const lastWb = next.winnersBracket[next.winnersBracket.length - 1];
  const wbLosersThisCall: number[] = [];
  for (const m of lastWb.matchups) {
    if (!m.played) {
      m.winner = simulate(m.team1Tid, m.team2Tid);
      m.loser = m.winner === m.team1Tid ? m.team2Tid : m.team1Tid;
      m.played = true;
    }
    if (m.loser !== undefined) {
      wbLosersThisCall.push(m.loser);
    }
  }
  const wbWinnersThisCall = lastWb.matchups
    .filter(m => m.winner !== undefined)
    .map(m => m.winner as number);

  // 2. Drop this round's WB losers into the LB.
  // Round 1 is special: there are no prior LB survivors, so we just
  // pair WB R1 losers among themselves. Subsequent calls perform a
  // "merge" round (LB survivors + new WB drops) immediately followed
  // by enough consolidation rounds to either narrow LB to 1 (if WB
  // is exhausted) or stop with one survivor in waiting for the next
  // WB drop.
  if (wbLosersThisCall.length > 0) {
    const lbAlive = next.lbAlive ?? [];
    const merged = lbAlive.length === 0
      ? wbLosersThisCall
      : interleave(lbAlive, wbLosersThisCall);
    next.lbAlive = playLbRound(next, merged, simulate);
  }

  // 3. If WB is exhausted but LB still has > 1 alive, drain LB with
  // pure consolidate rounds until one survivor remains.
  const wbExhausted = wbWinnersThisCall.length <= 1;
  if (wbExhausted) {
    while ((next.lbAlive?.length ?? 0) > 1) {
      next.lbAlive = playLbRound(next, next.lbAlive!, simulate);
    }
  }

  // 4. Build next WB round from this round's winners.
  if (wbWinnersThisCall.length >= 2) {
    next.winnersBracket.push({
      roundType: 'winners',
      round: lastWb.round + 1,
      matchups: pairUp(wbWinnersThisCall, lastWb.round + 1),
    });
  }

  // 5. Grand finals: a single WB survivor and a single LB survivor.
  if (wbWinnersThisCall.length === 1 && (next.lbAlive?.length ?? 0) === 1) {
    const finalsMatchup: PlayoffMatchup = {
      round: 99,
      matchupId: 1,
      team1Tid: wbWinnersThisCall[0],
      team2Tid: next.lbAlive![0],
      played: true,
    };
    finalsMatchup.winner = simulate(finalsMatchup.team1Tid, finalsMatchup.team2Tid);
    finalsMatchup.loser =
      finalsMatchup.winner === finalsMatchup.team1Tid
        ? finalsMatchup.team2Tid
        : finalsMatchup.team1Tid;
    next.championship = finalsMatchup;
    next.champion = finalsMatchup.winner;
  }

  next.currentRound = bracket.currentRound + 1;
  return next;
}

/**
 * Play one losers-bracket round given the participants. Mutates
 * `bracket.losersBracket` to record the matchups and returns the
 * winners (which become the new lbAlive list).
 */
function playLbRound(
  bracket: DoubleEliminationBracket,
  participants: number[],
  simulate: DoubleElimSimulator
): number[] {
  const roundNum = (bracket.losersBracket[bracket.losersBracket.length - 1]?.round ?? 0) + 1;
  const matchups = pairUp(participants, roundNum);
  const winners: number[] = [];
  for (const m of matchups) {
    m.winner = simulate(m.team1Tid, m.team2Tid);
    m.loser = m.winner === m.team1Tid ? m.team2Tid : m.team1Tid;
    m.played = true;
    winners.push(m.winner);
  }
  // Carry forward any odd participant who didn't get paired (rare).
  if (participants.length % 2 === 1) {
    winners.push(participants[participants.length - 1]);
  }
  bracket.losersBracket.push({ roundType: 'losers', round: roundNum, matchups });
  return winners;
}

function pairUp(teamIds: number[], roundNumber: number): PlayoffMatchup[] {
  const matchups: PlayoffMatchup[] = [];
  for (let i = 0; i + 1 < teamIds.length; i += 2) {
    matchups.push({
      round: roundNumber,
      matchupId: i / 2 + 1,
      team1Tid: teamIds[i],
      team2Tid: teamIds[i + 1],
      played: false,
    });
  }
  return matchups;
}

function interleave(a: number[], b: number[]): number[] {
  const out: number[] = [];
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    if (i < a.length) out.push(a[i]);
    if (i < b.length) out.push(b[i]);
  }
  return out;
}

/**
 * Adapter: drive the bracket using the project's GameSim. Keeps the
 * older 3-arg signature working for callers that haven't migrated to
 * the simulate-callback form yet.
 */
export function advanceDoubleEliminationRoundWithGameSim(
  bracket: DoubleEliminationBracket,
  allPlayers: any[],
  season: number,
  statsManager?: StatsManager,
): DoubleEliminationBracket {
  return advanceDoubleEliminationRound(bracket, (t1, t2) => {
    const team1 = bracket.teams.find(t => t.tid === t1);
    const team2 = bracket.teams.find(t => t.tid === t2);
    if (!team1 || !team2) return t1;
    const result = simulatePlayoffGame(team1, team2, allPlayers, season, statsManager);
    return result.winner;
  });
}

/**
 * Check if playoffs are complete
 */
export function isPlayoffComplete(bracket: PlayoffBracket | DoubleEliminationBracket): boolean {
  if ('champion' in bracket) {
    return bracket.champion !== undefined;
  }

  if ('matchups' in bracket) {
    const finalRound = Math.max(...bracket.matchups.map(m => m.round));
    const finalMatchups = bracket.matchups.filter(m => m.round === finalRound);
    return finalMatchups.every(m => m.played);
  }

  return false;
}
