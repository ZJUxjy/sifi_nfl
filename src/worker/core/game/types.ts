import type { Position } from '../../../common/types';
import type { Player, Team, GamePlayer } from '../../../common/entities';

export type TeamNum = 0 | 1;

export type CompositeRating =
  | 'passingAccuracy'
  | 'passingDeep'
  | 'passingVision'
  | 'athleticism'
  | 'rushing'
  | 'catching'
  | 'gettingOpen'
  | 'passBlocking'
  | 'runBlocking'
  | 'passRushing'
  | 'runStopping'
  | 'passCoverage'
  | 'tackling'
  | 'avoidingSacks'
  | 'ballSecurity'
  | 'endurance'
  | 'kpw'
  | 'kac'
  | 'ppw'
  | 'pac';

export type PlayerGameSim = GamePlayer & {
  stat: Record<string, number>;
  compositeRating: Record<CompositeRating, number>;
  energy: number;
  ptModifier: number;
};

export type PlayersOnField = Partial<Record<Position, PlayerGameSim[]>>;

export type TeamGameSim = {
  id: number;
  stat: Record<string, number>;
  player: PlayerGameSim[];
  compositeRating: Record<string, number>;
  depth: Record<Position, PlayerGameSim[]>;
};

export type PlayEventType =
  | 'k'
  | 'onsideKick'
  | 'touchbackKick'
  | 'kr'
  | 'onsideKickRecovery'
  | 'krTD'
  | 'p'
  | 'touchbackPunt'
  | 'pr'
  | 'prTD'
  | 'rus'
  | 'rusTD'
  | 'kneel'
  | 'sk'
  | 'dropback'
  | 'pss'
  | 'pssCmp'
  | 'pssInc'
  | 'pssTD'
  | 'int'
  | 'intTD'
  | 'touchbackInt'
  | 'xp'
  | 'fg'
  | 'penalty'
  | 'fmb'
  | 'fmbRec'
  | 'fmbTD'
  | 'twoPointConversion'
  | 'twoPointConversionDone'
  | 'defSft'
  | 'possessionChange'
  | 'tck';

export type PlayEvent =
  | { type: 'k'; p: PlayerGameSim; kickTo: number }
  | { type: 'kr'; p: PlayerGameSim; yds: number }
  | { type: 'krTD'; p: PlayerGameSim }
  | { type: 'p'; p: PlayerGameSim; yds: number }
  | { type: 'pr'; p: PlayerGameSim; yds: number }
  | { type: 'prTD'; p: PlayerGameSim }
  | { type: 'rus'; p: PlayerGameSim; yds: number }
  | { type: 'rusTD'; p: PlayerGameSim }
  | { type: 'kneel'; p: PlayerGameSim; yds: number }
  | { type: 'sk'; qb: PlayerGameSim; p: PlayerGameSim; yds: number }
  | { type: 'pssCmp'; qb: PlayerGameSim; target: PlayerGameSim; yds: number }
  | { type: 'pssInc'; defender: PlayerGameSim | undefined }
  | { type: 'pssTD'; qb: PlayerGameSim; target: PlayerGameSim }
  | { type: 'int'; qb: PlayerGameSim; defender: PlayerGameSim; ydsReturn: number }
  | { type: 'intTD'; p: PlayerGameSim }
  | { type: 'xp'; p: PlayerGameSim; distance: number; made: boolean }
  | { type: 'fg'; p: PlayerGameSim; distance: number; made: boolean; late: boolean }
  | { type: 'fmb'; pFumbled: PlayerGameSim; pForced: PlayerGameSim; yds: number }
  | { type: 'fmbRec'; pFumbled: PlayerGameSim; pRecovered: PlayerGameSim; lost: boolean; yds: number }
  | { type: 'fmbTD'; p: PlayerGameSim }
  | { type: 'defSft'; p: PlayerGameSim }
  | { type: 'possessionChange'; yds: number; kickoff?: boolean }
  | { type: 'tck'; tacklers: Set<PlayerGameSim>; loss: boolean };

export const SCRIMMAGE_KICKOFF = 35;
export const SCRIMMAGE_EXTRA_POINT = 85;
export const SCRIMMAGE_TWO_POINT_CONVERSION = 98;
export const SCRIMMAGE_TOUCHBACK = 20;
export const FIELD_GOAL_DISTANCE_ADDED = 17;
export const NUM_DOWNS = 4;
export const STARTING_TIMEOUTS = 3;
