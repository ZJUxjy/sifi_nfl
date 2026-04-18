import { GameSim } from '../../worker/core/game/GameSim';
import { calculateCompositeRatings } from '../../worker/core/player/ovr';
import type { PlayerGameSim, TeamGameSim } from '../../worker/core/game/types';
import type { Position } from '../../common/types';

/**
 * Reasonable mid-tier ratings for a generic player. Position-specific bonuses
 * are layered on top in {@link makeMinimalTeam}.
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

const ROSTER_POSITIONS: Position[] = [
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
  'DL',
  'DL',
  'DL',
  'DL',
  'LB',
  'LB',
  'LB',
  'CB',
  'CB',
  'S',
  'S',
  'K',
  'P',
];

/**
 * Build a `TeamGameSim` populated with one player at every position GameSim
 * needs, plus a depth chart so `getStarter` doesn't blow up.
 *
 * The pid offset (`tid * 100`) is the same trick the existing GameStatsView
 * uses to assign injuries back to a team without round-tripping through tid.
 */
export function makeMinimalTeam(tid: number): TeamGameSim {
  const players: PlayerGameSim[] = ROSTER_POSITIONS.map((pos, i) => {
    const ratings = baseRatings(pos);
    return {
      pid: tid * 100 + i,
      name: `Team ${tid} Player ${i}`,
      pos,
      age: 25,
      ...ratings,
      stat: {},
      compositeRating: calculateCompositeRatings(ratings as never),
      energy: 1,
      ptModifier: 1,
    } as PlayerGameSim;
  });

  // Depth chart: every position points to the first player at that spot.
  const depth: Partial<Record<Position, PlayerGameSim[]>> = {};
  for (const pos of ROSTER_POSITIONS) {
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

export interface MakeGameOptions {
  scrimmage?: number;
  down?: number;
  toGo?: number;
  quarter?: number;
  clock?: number;
  /**
   * Fix the receiving team. Defaults to home (`0`); without this GameSim
   * randomises via Math.random which would make tests flaky.
   */
  awaitingKickoff?: 0 | 1;
  /** Override the default 4×15 minute regulation. */
  quarterLength?: number;
  numPeriods?: number;
}

/**
 * Construct a `GameSim` instance with controllable initial state. Used by
 * the rule-level unit tests (timeRemaining, safety, turnover-on-downs, ...).
 */
export function makeGame(opts: MakeGameOptions = {}): GameSim {
  const home = makeMinimalTeam(0);
  const away = makeMinimalTeam(1);

  const sim = new GameSim({
    gid: 1,
    teams: [home, away],
    quarterLength: opts.quarterLength ?? 15,
    numPeriods: opts.numPeriods ?? 4,
  });

  // Pin the kickoff side so the constructor's Math.random doesn't make tests flaky.
  const receiving = opts.awaitingKickoff ?? 0;
  sim.awaitingKickoff = receiving;
  sim.d = receiving;
  sim.o = receiving === 0 ? 1 : 0;

  if (opts.scrimmage !== undefined) sim.scrimmage = opts.scrimmage;
  if (opts.down !== undefined) sim.down = opts.down;
  if (opts.toGo !== undefined) sim.toGo = opts.toGo;
  if (opts.quarter !== undefined) sim.quarter = opts.quarter;
  if (opts.clock !== undefined) sim.clock = opts.clock;

  return sim;
}
