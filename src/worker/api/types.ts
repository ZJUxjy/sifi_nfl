/**
 * SIFI NFL API Types
 * 统一的类型定义，供 GameEngine、Store 和组件使用
 */

import type { Team, Player } from '@common/entities';
import type { Region, Phase, Position } from '@common/types';

// === 核心状态 ===
export interface GameState {
  initialized: boolean;
  loading: boolean;
  season: number;
  week: number;
  phase: Phase;
  userTid: number | null;
  region: Region | null;
  teams: Team[];
  players: Player[];
  freeAgents: Player[];
  games: any[];
  schedule: ScheduleGame[];
  lastGame: GameResult | null;
  draftPicks: DraftPick[];
  originDraftResults: OriginDraftResult[];
  teamFinances: Map<number, TeamFinances>;
}

// === 起源选秀结果 ===
export interface OriginDraftResult {
  season: number;
  playerPid: number;
  fromTid: number;
  toTid: number;
  bidAmount: number;
  compensation: number;
}

export interface NewGameOptions {
  region: Region;
  teamId: number;
  season?: number;
}

// === 页面类型 ===
export type Page =
  | 'home'
  | 'roster'
  | 'schedule'
  | 'standings'
  | 'play'
  | 'finances'
  | 'trade'
  | 'free-agency'
  | 'draft'
  | 'stats'
  | 'imperial-cup'
  | 'ai-management'
  | 'game-viz'
  | 'save-load';

// === 赛程类型 ===
export interface ScheduleGame {
  gid: number;
  season: number;
  day: number;
  homeTid: number;
  awayTid: number;
  won?: { tid: number; pts: number };
  lost?: { tid: number; pts: number };
  played?: boolean;
  phase?: string; // 'regular' | 'phase1' | 'phase2' | 'playoffs'
  league?: string; // For pyramid leagues: 'level1' | 'level2' | etc.
}

// === 比赛结果 ===
export interface GameResult {
  gid: number;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  winner: number;
  playByPlay: PlayByPlayEvent[];
  scoringSummary: ScoringEvent[];
  penalties: PenaltySummary[];
  injuries: InjurySummary[];
}

export interface PlayByPlayEvent {
  clock: number;
  quarter: number;
  type: string;
  t?: 0 | 1;
  [key: string]: any;
}

export interface ScoringEvent {
  team: string;
  type: string;
  time: string;
  points: number;
}

export interface PenaltySummary {
  team: string;
  count: number;
  yards: number;
}

export interface InjurySummary {
  player: string;
  team: string;
  injury: string;
  gamesRemaining: number;
}

// === 积分榜 ===
export interface StandingEntry {
  tid: number;
  region: Region;
  cid?: number;
  did?: number;
  league?: string;
  won: number;
  lost: number;
  tied?: number;
  pts: number;
  oppPts: number;
  winPct: number;
  streak?: number;
}

// === 交易 ===
export interface TradeProposal {
  fromTeam: number;
  toTeam: number;
  fromPlayerIds: number[];
  toPlayerIds: number[];
  fromDraftPicks?: number[];
  toDraftPicks?: number[];
  fromCash?: number;
  toCash?: number;
}

export interface TradeEvaluation {
  fromValue: number;
  toValue: number;
  ratio: number;
  fair: boolean;
  aiAccepts: boolean;
}

// === 自由球员 ===
export interface ContractDemand {
  minSalary: number;
  minYears: number;
  reason?: string;
}

export interface ContractOffer {
  salary: number;
  years: number;
  signingBonus?: number;
}

// === 选秀 ===
export interface DraftPick {
  dpid: number;
  tid: number;
  originalTid: number;
  round: number;
  pick: number;
  season: number;
}

export interface CombineResults {
  fortyTime: number;
  benchPress: number;
  verticalJump: number;
  broadJump: number;
}

export interface DraftProspect {
  pid: number;
  name: string;
  pos: Position;
  ovr: number;
  pot: number;
  age: number;
  tid?: number;
  projectedRound: number;
  combineResults: CombineResults;
}

// === 财务 ===
export interface Revenue {
  ticketSales: number;
  merchandise: number;
  tvRights: number;
  sponsorships: number;
  prizeMoney: number;
  total: number;
}

export interface Expenses {
  salary: number;
  signingBonuses: number;
  coaching: number;
  facilities: number;
  travel: number;
  total: number;
}

export interface TeamFinances {
  budget: number;
  cash: number;
  payroll: number;
  capSpace: number;
  revenue: Revenue;
  expenses: Expenses;
  profit: number;
}

// === 存档 ===
export interface SaveData {
  version: string;
  timestamp: number;
  name: string;
  state: GameState;
}

// === 过滤器 ===
export interface PlayerFilter {
  tid?: number;
  pos?: Position;
  minOvr?: number;
  maxOvr?: number;
  minAge?: number;
  maxAge?: number;
  freeAgent?: boolean;
}

export interface TeamFilter {
  region?: Region;
  tid?: number;
}
