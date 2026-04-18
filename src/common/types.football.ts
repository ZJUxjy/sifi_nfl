import type { PlayerInjury, Position } from './types';

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
  | 'endurance';

export type PlayerRatings = {
  hgt: number;
  stre: number;
  spd: number;
  endu: number;
  thv: number;
  thp: number;
  tha: number;
  bsc: number;
  elu: number;
  rtr: number;
  hnd: number;
  rbk: number;
  pbk: number;
  pcv: number;
  tck: number;
  prs: number;
  rns: number;
  kpw: number;
  kac: number;
  ppw: number;
  pac: number;
  fuzz: number;
  ovr: number;
  pot: number;
  ovrs: Record<Position, number>;
  pots: Record<Position, number>;
  pos: Position;
  season: number;
  skills: string[];
  injuryIndex?: number;
  locked?: boolean;
};

export type Player = PlayerRatings & {
  pid: number;
  tid: number | undefined;
  name: string;
  age: number;
  bornYear: number;
  pos: Position;
  ratingsIndex: number;
  statsIndex: number;
  contract?: Contract;
  injury?: PlayerInjury;
  watch?: number;
};

export type Contract = {
  amount: number;
  exp: number;
  years: number;
  incentives: number;
  signingBonus: number;
  guaranteed: number;
  options: number[];
  noTrade: boolean;
};

export type GamePlayer = PlayerRatings & {
  pid: number;
  name: string;
  age: number;
  pos: Position;
  stat: any;
  compositeRating: any;
  skills: string[];
  injured: boolean;
  newInjury: boolean;
  injury: PlayerInjury & { playingThrough: boolean };
  ptModifier: number;
  ovrs: Record<Position, number>;
};

export type PlayersOnField = Partial<Record<Position, GamePlayer[]>>;

export type TeamGameSim = {
  id: number;
  pace: number;
  stat: any;
  player: GamePlayer[];
  compositeRating: any;
  depth: Record<Position, GamePlayer[]>;
};

export type Formation = {
  off: Partial<Record<Position, number>>;
  def: Partial<Record<Position, number>>;
};

export type PenaltyPlayType =
  | 'beforeSnap'
  | 'kickoffReturn'
  | 'fieldGoal'
  | 'punt'
  | 'puntReturn'
  | 'pass'
  | 'run';

export type PrimaryPosition =
  | 'QB'
  | 'RB'
  | 'WR'
  | 'TE'
  | 'OL'
  | 'DL'
  | 'LB'
  | 'CB'
  | 'S'
  | 'K'
  | 'P';

export type RatingKey =
  | 'hgt'
  | 'stre'
  | 'spd'
  | 'endu'
  | 'thv'
  | 'thp'
  | 'tha'
  | 'bsc'
  | 'elu'
  | 'rtr'
  | 'hnd'
  | 'rbk'
  | 'pbk'
  | 'pcv'
  | 'tck'
  | 'prs'
  | 'rns'
  | 'kpw'
  | 'kac'
  | 'ppw'
  | 'pac';

export type GameTeam = {
  tid: number;
  players: any[];
  ovr?: number;
  won?: number;
  lost?: number;
  tied?: number;
  otl?: number;
  playerFeat?: boolean;
  playoffs?: { seed: number; won: number; lost: number };
  pts: number;
  sPts?: number;
};

export type Game = {
  att: number;
  clutchPlays?: string[];
  day?: number;
  finals?: boolean;
  forceWin?: number;
  gid: number;
  lost: { tid: number; pts: number; sPts?: number };
  neutralSite?: boolean;
  note?: string;
  noteBool?: 1;
  numGamesToWinSeries?: number;
  numPeriods?: number;
  numPlayersOnCourt?: number;
  playoffs?: boolean;
  overtimes: number;
  scoringSummary?: any;
  season: number;
  teams: [GameTeam, GameTeam];
  won: { tid: number; pts: number; sPts?: number };
};

export type GameAttributesNonLeague = { lid: undefined };

export type ScheduledEventGameAttributes = {
  type: 'gameAttributes';
  season: number;
  phase: import('./types').Phase;
  info: Partial<GameAttributesLeague>;
};

export type ScheduledEventTeamInfo = {
  type: 'teamInfo';
  season: number;
  phase: import('./types').Phase;
  info: {
    tid: number;
    region?: string;
    srID?: string;
    name?: string;
    pop?: number;
    did?: number;
    abbrev?: string;
    imgURL?: string;
    imgURLSmall?: string;
    colors?: [string, string, string];
    jersey?: string;
  };
};

export type ScheduledEvent =
  | ScheduledEventTeamInfo
  | ScheduledEventGameAttributes
  | {
      type: 'imperialCup';
      season: number;
      phase: import('./types').Phase;
    };

export type GameAttributeWithHistory<T> = import('./types').NonEmptyArray<{ start: number; value: T }>;

export type InjuriesSetting = {
  name: string;
  frequency: number;
  games: number;
}[];

export type FootballOvertime = 'suddenDeath' | 'exceptFg' | 'bothPossess';

export type GameAttributesLeague = {
  aiJerseyRetirement: boolean;
  aiTradesFactor: number;
  allStarGame: number | null;
  allStarNum: number;
  allStarType: 'draft' | 'byRegion' | 'top';
  allStarDunk: boolean;
  allStarThree: boolean;
  autoExpand: boolean;
  autoExpandProb: number;
  autoExpandNumTeams: number;
  autoExpandMaxNumTeams: number;
  autoExpandGeo: string;
  autoRelocate: boolean;
  autoRelocateProb: number;
  autoRelocateGeo: string;
  autoRelocateRebrand: boolean;
  autoRelocateRealign: boolean;
  alwaysShowCountry: boolean;
  budget: boolean;
  challengeFiredLuxuryTax: boolean;
  challengeFiredMissPlayoffs: boolean;
  challengeLoseBestPlayer: boolean;
  challengeNoDraftPicks: boolean;
  challengeNoFreeAgents: boolean;
  challengeNoRatings: boolean;
  challengeNoTrades: boolean;
  challengeSisyphusMode: boolean;
  challengeThanosMode: number;
  thanosCooldownEnd: number;
  currencyFormat: [string, string, string];
  dailyWages: boolean;
  draftLotteryCustomChances: number[];
  draftLotteryCustomNumPicks: number;
  draftType: 'originDraft' | 'noLottery' | 'random';
  draftAges: [number, number];
  enableInjuries: boolean;
  equalizeRegions: boolean;
  fantasyPoints: 'standard' | 'ppr' | 'halfPpr' | null;
  fumbleFactor: number;
  fgAccuracyFactor: number;
  fourthDownFactor: number;
  gameAttributesHistory: { lid: number }[];
  godMode: boolean;
  godModeInPast: boolean;
  gracePeriodEnd: number;
  homeCourtAdvantage: number;
  imperialCupEveryYears: number;
  injuryFrequency: InjuriesSetting;
  injuryRate: number;
  lid: number;
  luxuryPayroll: number;
  luxuryTax: number;
  maxContract: number;
  maxOvertimes: number | null;
  maxOvertimesPlayoffs: number | null;
  minContract: number;
  minPayroll: number;
  minRosterSize: number;
  minContractLength: number;
  maxContractLength: number;
  maxRosterSize: number;
  nextPhase: import('./types').Phase | undefined;
  numActiveTeams: number;
  numDraftPicksCurrent: number;
  numDraftRounds: number;
  numGames: number;
  numGamesConf: number;
  numGamesDiv: number;
  numGamesPlayoffSeries: number[];
  numPeriods: number;
  numPlayoffByes: number;
  numSeasonsFutureDraftPicks: number;
  numTeams: number;
  numPlayersDunk: number;
  numPlayersThree: number;
  onsideFactor: number;
  onsideRecoveryFactor: number;
  otherTeamsWantToHire: boolean;
  overtimeLength: number;
  overtimeLengthPlayoffs: number;
  pace: number;
  passFactor: number;
  passYdsFactor: number;
  playIn: boolean;
  playersRefuseToNegotiate: boolean;
  pointsFormula: string;
  playoffReseed: boolean;
  playoffsByConf: boolean;
  playoffsNumTeamsDiv: number;
  playoffsType: 'imperialCup' | 'doubleElimination';
  quarters: number;
  quarterLength: number;
  repeatSeason: number | undefined;
  rookieContractLengths: [number, number];
  rookiesCanRefuse: boolean;
  rushYdsFactor: number;
  salaryCap: number;
  salaryCapType: 'hard' | 'soft' | 'none';
  scrambleFactor: number;
  scrimmageTouchbackKickoff: number;
  season: number;
  shooutRounds: number;
  softCapTradeSalaryMatch: number;
  startingSeason: number;
  stopOnInjury: boolean;
  stopOnInjuryGames: number;
  subseasonPhase: 'regular' | 'championship' | 'relegation' | 'imperialCup';
  teamInfoCache: unknown[];
  tiebreakers: import('./types').NonEmptyArray<string>;
  tradeDeadline: number;
  twoPointConversions: boolean;
  userTid: number;
  userTids: number[];
  difficulty: number;
  lowestDifficulty: number;
  footballOvertime: FootballOvertime;
  footballOvertimePlayoffs: FootballOvertime;
  completionFactor: number;
  sackFactor: number;
  intFactor: number;
  salaryPaid: number;
  cash: number;
  // NOTE: `budget: boolean` is the league-level "is budgeting enabled" flag,
  // declared earlier in this type. The team-season fields below (won/lost/tied/
  // otl/playoffsRoundsWon/streak) are mistakenly part of GameAttributesLeague —
  // they are tracked per TeamSeason, not per league. Removing them is left to
  // a follow-up cleanup; for now we drop the duplicate `budget: number` so the
  // type can compile.
  won: number;
  lost: number;
  tied: number;
  otl: number;
  playoffsRoundsWon: number;
  streak: number;
};

export type GameAttributesLeagueWithHistory = {
  [K in keyof GameAttributesLeague]: GameAttributesLeague[K] extends number ? GameAttributeWithHistory<GameAttributesLeague[K]> : GameAttributesLeague[K];
};
