import type { Position, Contract, PlayerInjury, Region } from './types';

export type MarketSize = 'huge' | 'large' | 'medium' | 'small';
export type TeamStrength = 'elite' | 'strong' | 'average' | 'weak';

export type Team = {
  tid: number;
  cid: number;
  did: number;
  region: Region;
  name: string;
  abbrev: string;
  colors: [string, string, string];
  pop: string;
  srID: string;
  imgURL?: string;
  imgURLSmall?: string;
  jersey?: string;
  budget: number;
  cash: number;
  salaryPaid: number;
  season: number;
  won: number;
  lost: number;
  tied?: number;
  otl?: number;
  playoffsRoundsWon: number;
  streak: number;
  lastTen: string;
  stats?: TeamStats;
  seasons?: TeamSeason[];
  market?: MarketSize;
  strength?: TeamStrength;
  revenue?: Revenue;
  expenses?: Expenses;
};

export type Revenue = {
  ticketSales: number;
  merchandise: number;
  tvRights: number;
  sponsorships: number;
  prizeMoney: number;
  total: number;
};

export type Expenses = {
  salary: number;
  signingBonuses: number;
  coaching: number;
  facilities: number;
  travel: number;
  total: number;
};

export type TeamSeason = {
  rid: number;
  tid: number;
  season: number;
  cid: number;
  did: number;
  region: Region;
  gp: number;
  won: number;
  lost: number;
  tied?: number;
  otl?: number;
  homeWon: number;
  homeLost: number;
  awayWon: number;
  awayLost: number;
  divWon: number;
  divLost: number;
  confWon: number;
  confLost: number;
  streak: number;
  lastTen: string;
  playoffsRoundsWon: number;
  wonDivision: boolean;
  wonConference: boolean;
  wonImperialCup: boolean;
  pts: number;
  oppPts: number;
  att: number;
  payroll: number;
};

export type TeamStats = {
  rid: number;
  tid: number;
  season: number;
  playoffs: boolean;
  gp: number;
  pssYds: number;
  rusYds: number;
  totalYds: number;
  pssTD: number;
  rusTD: number;
  totalTD: number;
  oppPssYds: number;
  oppRusYds: number;
  oppTotalYds: number;
  oppPssTD: number;
  oppRusTD: number;
  oppTotalTD: number;
  fg: number;
  fgAtt: number;
  xp: number;
  xpAtt: number;
  pnt: number;
  pntYds: number;
  kr: number;
  krYds: number;
  krTD: number;
  pr: number;
  prYds: number;
  prTD: number;
  pen: number;
  penYds: number;
  top: string;
};

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
};

export type Player = {
  pid: number;
  tid: number | undefined;
  name: string;
  age: number;
  bornYear: number;
  bornLoc: string;
  pos: Position;
} & PlayerRatings & {
  ovrs: Record<Position, number>;
  pots: Record<Position, number>;
  ratingsIndex: number;
  statsIndex: number;
  draft: {
    year: number;
    round: number;
    pick: number;
    tid: number;
    originalTid: number;
    pot: number;
    ovr: number;
    skills: string[];
  };
  contract?: Contract;
  injury?: PlayerInjury;
  injuryHistory?: PlayerInjury[];
  retiredYear?: number;
  watch?: number;
  gamesUntilTradable?: number;
  numBrothers: number;
  numSons: number;
  mvpScore?: number;
  bestStats?: any;
  hallOfFame?: boolean;
};

export type GameTeam = {
  tid: number;
  players: GamePlayer[];
  ovr?: number;
  won?: number;
  lost?: number;
  tied?: number;
  otl?: number;
  playerFeat?: boolean;
  playoffs?: {
    seed: number;
    won: number;
    lost: number;
  };
  pts: number;
  sPts?: number;
};

export type GamePlayer = {
  pid: number;
  name: string;
  pos: Position;
} & PlayerRatings & {
  stat: any;
};

export type Game = {
  gid: number;
  season: number;
  day?: number;
  playoffs?: boolean;
  finals?: boolean;
  imperialCup?: boolean;
  neutralSite?: boolean;
  note?: string;
  numGamesToWinSeries?: number;
  numPeriods?: number;
  overtimes: number;
  teams: [GameTeam, GameTeam];
  won: { tid: number; pts: number; sPts?: number };
  lost: { tid: number; pts: number; sPts?: number };
  att: number;
  scoringSummary?: any;
  playByPlay?: any;
  forceWin?: number;
};

export type ScheduleGame = {
  gid: number;
  season: number;
  day: number;
  homeTid: number;
  awayTid: number;
  playoffs?: boolean;
  imperialCup?: boolean;
  neutralSite?: boolean;
  won?: { tid: number; pts: number };
  lost?: { tid: number; pts: number };
  overtime?: string;
  phase?: string;
  league?: string;
  played?: boolean;
};

export type PlayoffSeries = {
  season: number;
  currentRound: number;
  series: {
    id: string;
    home: {
      tid: number;
      seed: number;
      won: number;
    };
    away: {
      tid: number;
      seed: number;
      won: number;
    };
  }[];
};

export type Event = {
  eid: number;
  type: string;
  text: string;
  pids?: number[];
  tids?: number[];
  season: number;
  score?: number;
  showNotification?: boolean;
};

export type Negotiation = {
  pid: number;
  tid: number;
  resignation?: boolean;
};

export type ReleasedPlayer = {
  rid: number;
  pid: number;
  tid: number;
};

export type SavedTrade = {
  hash: string;
  teams: [{
    tid: number;
    pids: number[];
    dpids: number[];
  }, {
    tid: number;
    pids: number[];
    dpids: number[];
  }];
};

export type SavedTradingBlock = {
  rid: number;
  tid: number;
  pids: number[];
  dpids: number[];
};

export type Awards = {
  season: number;
  mvp?: AwardPlayer;
  dpoy?: AwardPlayer;
  oroy?: AwardPlayer;
  droy?: AwardPlayer;
  allLeague: AwardPlayer[][];
  allRookie: AwardPlayer[];
  finalsMvp?: AwardPlayer;
  bestRecord?: AwardTeam;
};

export type AwardPlayer = {
  pid: number;
  name: string;
  tid: number;
  pos: string;
  keyStats: string;
};

export type AwardTeam = {
  tid: number;
  abbrev: string;
  region: string;
  name: string;
  won: number;
  lost: number;
  tied?: number;
  otl?: number;
};

export type HeadToHead = {
  season: number;
  results: {
    [key: string]: {
      won: number;
      lost: number;
      tied?: number;
      otl?: number;
    };
  };
};

export type PlayerFeat = {
  fid: number;
  pid: number;
  name: string;
  pos: string;
  tid: number;
  oppTid: number;
  season: number;
  playoffs: boolean;
  gid: number;
  stats: any;
  won: boolean;
  score: string;
};

export type ScheduledEvent =
  | {
      id: number;
      type: 'gameAttributes';
      season: number;
      phase: number;
      info: any;
    }
  | {
      id: number;
      type: 'teamInfo';
      season: number;
      phase: number;
      info: any;
    }
  | {
      id: number;
      type: 'imperialCup';
      season: number;
      phase: number;
    };

export type AllStars = {
  season: number;
  teamNames: [string, string];
  teams: [AllStarPlayer[], AllStarPlayer[]];
  remaining: AllStarPlayer[];
  finalized: boolean;
  gid?: number;
  score?: [number, number];
  overtimes?: number;
  mvp?: AllStarMvp;
};

export type AllStarPlayer = {
  pid: number;
  tid: number;
  name: string;
  injured?: boolean;
};

export type AllStarMvp = {
  pid: number;
  tid: number;
  name: string;
};

export type SeasonLeaders = {
  season: number;
  tid: number;
  minStats: any;
  maxStats: any;
};
