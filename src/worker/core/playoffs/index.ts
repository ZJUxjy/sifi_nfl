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
import { getStatsManager } from '../stats/StatsManager';

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
 * Top 8 teams from championship group
 */
export function generateDoubleEliminationBracket(
  teams: Team[],
  region: string,
  year: number
): DoubleEliminationBracket {
  const qualifiedTeams = teams.slice(0, 8);

  const winnersBracket: DoubleEliminationRound[] = [];
  const losersBracket: DoubleEliminationRound[] = [];

  // Winners Bracket Round 1: 1v8, 2v7, 3v6, 4v5
  const wbRound1Matchups: PlayoffMatchup[] = [];
  const seeds = [0, 7, 1, 6, 2, 5, 3, 4];

  for (let i = 0; i < 8; i += 2) {
    const team1 = qualifiedTeams[seeds[i]];
    const team2 = qualifiedTeams[seeds[i + 1]];

    if (team1 && team2) {
      wbRound1Matchups.push({
        round: 1,
        matchupId: i / 2 + 1,
        team1Tid: team1.tid,
        team2Tid: team2.tid,
        team1Seed: seeds[i] + 1,
        team2Seed: seeds[i + 1] + 1,
        played: false,
      });
    }
  }

  winnersBracket.push({
    roundType: 'winners',
    round: 1,
    matchups: wbRound1Matchups,
  });

  // Add empty rounds for later
  winnersBracket.push({ roundType: 'winners', round: 2, matchups: [] });
  winnersBracket.push({ roundType: 'winners', round: 3, matchups: [] });

  // Losers bracket starts empty (teams drop down as they lose)
  losersBracket.push({ roundType: 'losers', round: 1, matchups: [] });
  losersBracket.push({ roundType: 'losers', round: 2, matchups: [] });
  losersBracket.push({ roundType: 'losers', round: 3, matchups: [] });
  losersBracket.push({ roundType: 'losers', round: 4, matchups: [] });

  return {
    region,
    year,
    teams: qualifiedTeams,
    winnersBracket,
    losersBracket,
    currentRound: 1,
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
  season: number
): { winner: number; loser: number; score: { team1: number; team2: number } } {
  const team1Sim = convertTeamForSimulation(team1, allPlayers);
  const team2Sim = convertTeamForSimulation(team2, allPlayers);

  const statsManager = getStatsManager(season);

  const game = new GameSim({
    gid: Date.now(),
    day: 1,
    teams: [team1Sim, team2Sim],
    quarterLength: 15,
    numPeriods: 4,
    statsManager,
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
  season: number
): void {
  const currentRoundMatchups = bracket.matchups.filter(m => m.round === bracket.currentRound);

  for (const matchup of currentRoundMatchups) {
    if (matchup.played || matchup.team1Tid === -1 || matchup.team2Tid === -1) continue;

    const team1 = bracket.teams.find(t => t.tid === matchup.team1Tid);
    const team2 = bracket.teams.find(t => t.tid === matchup.team2Tid);

    if (!team1 || !team2) continue;

    const result = simulatePlayoffGame(team1, team2, allPlayers, season);

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
 * Advance double elimination bracket
 */
export function advanceDoubleEliminationRound(
  bracket: DoubleEliminationBracket,
  allPlayers: any[],
  season: number
): void {
  // Get current winners bracket round
  const wbRound = bracket.winnersBracket.find(r => r.round === bracket.currentRound);

  if (wbRound && wbRound.matchups.length > 0) {
    for (const matchup of wbRound.matchups) {
      if (matchup.played) continue;

      const team1 = bracket.teams.find(t => t.tid === matchup.team1Tid);
      const team2 = bracket.teams.find(t => t.tid === matchup.team2Tid);

      if (!team1 || !team2) continue;

      const result = simulatePlayoffGame(team1, team2, allPlayers, season);

      matchup.winner = result.winner;
      matchup.loser = result.loser;
      matchup.score = result.score;
      matchup.played = true;

      // Winner advances in winners bracket
      // Loser drops to losers bracket
      advanceLoserToLosersBracket(bracket, result.loser, bracket.currentRound);
    }
  }

  // Process losers bracket games
  const lbRound = bracket.losersBracket.find(r => r.round === bracket.currentRound);

  if (lbRound && lbRound.matchups.length > 0) {
    for (const matchup of lbRound.matchups) {
      if (matchup.played) continue;

      const team1 = bracket.teams.find(t => t.tid === matchup.team1Tid);
      const team2 = bracket.teams.find(t => t.tid === matchup.team2Tid);

      if (!team1 || !team2) continue;

      const result = simulatePlayoffGame(team1, team2, allPlayers, season);

      matchup.winner = result.winner;
      matchup.loser = result.loser;
      matchup.score = result.score;
      matchup.played = true;

      // Loser is eliminated
    }
  }

  // Check if current round is complete and advance
  const wbComplete = !wbRound || wbRound.matchups.every(m => m.played);
  const lbComplete = !lbRound || lbRound.matchups.every(m => m.played || m.team1Tid === -1 || m.team2Tid === -1);

  if (wbComplete && lbComplete) {
    setupNextRoundMatchups(bracket);
    bracket.currentRound++;
  }
}

/**
 * Add loser to losers bracket
 */
function advanceLoserToLosersBracket(
  bracket: DoubleEliminationBracket,
  loserTid: number,
  fromRound: number
): void {
  // Losers from WB round 1 go to LB round 1 or 2
  const lbRound = bracket.losersBracket.find(r => r.round === Math.ceil(fromRound / 2) + 1);

  if (lbRound) {
    const emptyMatchup = lbRound.matchups.find(m => m.team1Tid === -1);

    if (emptyMatchup) {
      emptyMatchup.team1Tid = loserTid;
    } else {
      const newMatchup: PlayoffMatchup = {
        round: lbRound.round,
        matchupId: lbRound.matchups.length + 1,
        team1Tid: loserTid,
        team2Tid: -1,
        played: false,
      };
      lbRound.matchups.push(newMatchup);
    }
  }
}

/**
 * Setup matchups for the next round
 */
function setupNextRoundMatchups(bracket: DoubleEliminationBracket): void {
  const nextRound = bracket.currentRound + 1;

  // Setup winners bracket next round
  const currentWb = bracket.winnersBracket.find(r => r.round === bracket.currentRound);
  const nextWb = bracket.winnersBracket.find(r => r.round === nextRound);

  if (currentWb && nextWb) {
    const winners = currentWb.matchups
      .filter(m => m.played && m.winner !== undefined)
      .map(m => m.winner as number);

    for (let i = 0; i < winners.length; i += 2) {
      if (winners[i] && winners[i + 1]) {
        nextWb.matchups.push({
          round: nextRound,
          matchupId: nextWb.matchups.length + 1,
          team1Tid: winners[i],
          team2Tid: winners[i + 1],
          played: false,
        });
      }
    }
  }
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
