export type Env = {
  enableLogging: boolean;
  heartbeatID: string;
  mobile: boolean;
  useSharedWorker: boolean;
};

declare global {
  interface Window {
    sifi: any;
    sifiVersion: string;
    enableLogging: boolean;
    getTheme: () => 'dark' | 'light';
  }

  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: 'development' | 'production' | 'test';
    }
  }
}

export type NonEmptyArray<T> = [T, ...T[]];

export type Region =
  | 'firstContinent'
  | 'secondContinent'
  | 'originContinent'
  | 'miningIsland';

export type RegionInfo = {
  id: Region;
  name: string;
  population: number;
  capital?: string;
  populationScale: string;
};

export type LeagueType = 'closed' | 'open' | 'pyramid';

export type LeagueStructure = {
  region: Region;
  type: LeagueType;
  teams: number;
  levels: number;
  promotionSpots?: number;
  relegationSpots?: number;
};

export enum Phase {
  UNINITIALIZED = 0,
  PRESEASON = 1,
  REGULAR_SEASON = 2,
  PLAYOFFS = 3,
  IMPERIAL_CUP = 4,
  END_OF_SEASON = 5,
  FREE_AGENCY = 6,
  DRAFT = 7,
}

export type GameAttributeKey = string;

export type Position =
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
  | 'P'
  | 'KR'
  | 'PR';

export type Conference = {
  cid: number;
  region: Region;
  name: string;
};

export type Division = {
  did: number;
  cid: number;
  name: string;
};

export type PlayerInjury = {
  type: string;
  gamesRemaining: number;
  ovr: number;
};

export type Achievement = {
  slug: string;
  name: string;
  category: string;
  desc: string;
  check?: () => Promise<boolean>;
  when?: 'afterAwards' | 'afterPlayoffs' | 'afterRegularSeason';
};

export type Event = {
  type: string;
  text: string;
  pids?: number[];
  tids?: number[];
  season: number;
  score?: number;
};

export type Contract = {
  amount: number;
  exp: number;
  years: number;
  incentives: number;
  signingBonus: number;
  guaranteed: number;
  noTrade: boolean;
};

export type DraftPick = {
  dpid: number;
  tid: number;
  originalTid: number;
  round: number;
  pick: number;
  season: number | 'originDraft';
  note?: string;
};

export type PlayerStats = {
  season: number;
  tid: number;
  pss: number;
  pssCmp: number;
  pssYds: number;
  pssTD: number;
  pssInt: number;
  pssSk: number;
  pssSkYds: number;
  pssLng: number;
  rus: number;
  rusYds: number;
  rusTD: number;
  rusLng: number;
  rec: number;
  recYds: number;
  recTD: number;
  recLng: number;
  defTck: number;
  defSk: number;
  defInt: number;
  defPssDef: number;
  defFmbFrc: number;
  defFmbRec: number;
  defIntYds: number;
  defIntLng: number;
  defFmbYds: number;
  defFmbLng: number;
  fgAtt: number;
  fg: number;
  fgLng: number;
  xpAtt: number;
  xp: number;
  pnt: number;
  pntYds: number;
  pntLng: number;
  pntTB: number;
  kr: number;
  krYds: number;
  krLng: number;
  krTD: number;
  pr: number;
  prYds: number;
  prLng: number;
  prTD: number;
  gp: number;
  gs: number;
  pts: number;
};

export type TeamStats = {
  season: number;
  tid: number;
  won: number;
  lost: number;
  tied?: number;
  otl?: number;
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
