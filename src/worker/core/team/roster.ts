import type { Position } from '../../../common/types';
import type { Team, Player } from '../../../common/entities';
import { POSITIONS } from '../../../common/constants';

export function populateDepthChart(team: Team, players: Player[]): Record<Position, Player[]> {
  const depth: Partial<Record<Position, Player[]>> = {};

  const teamPlayers = players.filter(p => p.tid === team.tid);

  for (const pos of POSITIONS) {
    const posPlayers = teamPlayers
      .filter(p => p.pos === pos)
      .sort((a, b) => b.ovr - a.ovr);

    const maxDepth: Record<Position, number> = {
      QB: 3,
      RB: 4,
      WR: 6,
      TE: 3,
      OL: 9,
      DL: 9,
      LB: 7,
      CB: 6,
      S: 5,
      K: 2,
      P: 2,
    };

    depth[pos] = posPlayers.slice(0, maxDepth[pos] ?? 3);
  }

  return depth as Record<Position, Player[]>;
}

export function getStarters(depth: Record<Position, Player[]>): Player[] {
  const starters: Player[] = [];

  if (depth.QB?.[0]) starters.push(depth.QB[0]);
  if (depth.RB?.[0]) starters.push(depth.RB[0]);
  for (let i = 0; i < 3; i++) {
    if (depth.WR?.[i]) starters.push(depth.WR[i]);
  }
  if (depth.TE?.[0]) starters.push(depth.TE[0]);
  for (let i = 0; i < 5; i++) {
    if (depth.OL?.[i]) starters.push(depth.OL[i]);
  }
  for (let i = 0; i < 4; i++) {
    if (depth.DL?.[i]) starters.push(depth.DL[i]);
  }
  for (let i = 0; i < 3; i++) {
    if (depth.LB?.[i]) starters.push(depth.LB[i]);
  }
  for (let i = 0; i < 2; i++) {
    if (depth.CB?.[i]) starters.push(depth.CB[i]);
  }
  for (let i = 0; i < 2; i++) {
    if (depth.S?.[i]) starters.push(depth.S[i]);
  }
  if (depth.K?.[0]) starters.push(depth.K[0]);
  if (depth.P?.[0]) starters.push(depth.P[0]);

  return starters;
}

export function calculateTeamSalary(players: Player[], teamTid: number): number {
  return players
    .filter(p => p.tid === teamTid && p.contract)
    .reduce((total, p) => total + (p.contract?.amount ?? 0), 0);
}

export function addPlayerToRoster(team: Team, player: Player, players: Player[]): boolean {
  const currentSalary = calculateTeamSalary(players, team.tid);
  const maxSalary = team.budget;

  if (player.contract && currentSalary + player.contract.amount > maxSalary) {
    return false;
  }

  player.tid = team.tid;
  return true;
}

export function removePlayerFromRoster(player: Player): void {
  player.tid = undefined;
}

export function isRosterFull(team: Team, players: Player[], maxSize: number = 55): boolean {
  const teamPlayers = players.filter(p => p.tid === team.tid);
  return teamPlayers.length >= maxSize;
}

export function getTopPlayersByPosition(
  players: Player[],
  position: Position,
  count: number = 5
): Player[] {
  return players
    .filter(p => p.pos === position)
    .sort((a, b) => b.ovr - a.ovr)
    .slice(0, count);
}
