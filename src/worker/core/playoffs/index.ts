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
 * Generate single elimination playoff bracket (First/Second Continent style)
 * Top 12 teams qualify, top 4 get first-round bye
 */
export function generateSingleEliminationBracket(
  teams: Team[],
  region: string,
  year: number
): PlayoffBracket {
  const qualifiedTeams = teams.slice(0, 12);

  if (qualifiedTeams.length < 12) {
    // Fill with byes if not enough teams
    while (qualifiedTeams.length < 12) {
      qualifiedTeams.push({ tid: -1, name: 'TBD' } as Team);
    }
  }

  const matchups: PlayoffMatchup[] = [];
  let matchupId = 1;

  // Wild Card Round (Seeds 5-12)
  // Matchups: 5 vs 12, 6 vs 11, 7 vs 10, 8 vs 9
  const wildCardMatchups = [
    [4, 11],   // Seed 5 vs Seed 12 (indices)
    [5, 10],   // Seed 6 vs Seed 11
    [6, 9],    // Seed 7 vs Seed 10
    [7, 8],    // Seed 8 vs Seed 9
  ];

  for (const [idx1, idx2] of wildCardMatchups) {
    const team1 = qualifiedTeams[idx1];
    const team2 = qualifiedTeams[idx2];

    if (team1 && team2 && team1.tid !== -1 && team2.tid !== -1) {
      matchups.push({
        round: 1,
        matchupId: matchupId++,
        team1Tid: team1.tid,
        team2Tid: team2.tid,
        team1Seed: idx1 + 1,
        team2Seed: idx2 + 1,
        played: false,
      });
    }
  }

  // Divisional Round placeholders (Seeds 1-4 + Wild Card winners)
  for (let i = 0; i < 4; i++) {
    matchups.push({
      round: 2,
      matchupId: matchupId++,
      team1Tid: -1,
      team2Tid: -1,
      played: false,
    });
  }

  // Conference Championship placeholders
  matchups.push({
    round: 3,
    matchupId: matchupId++,
    team1Tid: -1,
    team2Tid: -1,
    played: false,
  });
  matchups.push({
    round: 3,
    matchupId: matchupId++,
    team1Tid: -1,
    team2Tid: -1,
    played: false,
  });

  // Finals placeholder
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
 * Advance single elimination bracket by one round
 */
export function advanceSingleEliminationRound(
  bracket: PlayoffBracket,
  allPlayers: any[],
  season: number,
  statsManager?: StatsManager,
): void {
  const currentRoundMatchups = bracket.matchups.filter(m => m.round === bracket.currentRound);

  for (const matchup of currentRoundMatchups) {
    if (matchup.played || matchup.team1Tid === -1 || matchup.team2Tid === -1) continue;

    const team1 = bracket.teams.find(t => t.tid === matchup.team1Tid);
    const team2 = bracket.teams.find(t => t.tid === matchup.team2Tid);

    if (!team1 || !team2) continue;

    const result = simulatePlayoffGame(team1, team2, allPlayers, season, statsManager);

    matchup.winner = result.winner;
    matchup.loser = result.loser;
    matchup.score = result.score;
    matchup.played = true;

    // Advance winner to next round
    const nextRoundMatchups = bracket.matchups.filter(m => m.round === bracket.currentRound + 1);

    if (nextRoundMatchups.length > 0) {
      // Find appropriate next matchup
      const nextMatchupIdx = Math.floor((matchup.matchupId - 1) / 2);
      const nextMatchup = nextRoundMatchups[nextMatchupIdx];

      if (nextMatchup) {
        if (nextMatchup.team1Tid === -1) {
          nextMatchup.team1Tid = result.winner;
        } else {
          nextMatchup.team2Tid = result.winner;
        }
      }
    }

    // Check for champion
    if (bracket.currentRound === 4) {
      bracket.champion = result.winner;
    }
  }

  // Move to next round if all current matchups are played
  if (currentRoundMatchups.every(m => m.played || m.team1Tid === -1 || m.team2Tid === -1)) {
    bracket.currentRound++;
  }
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
