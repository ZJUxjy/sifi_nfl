/**
 * SIFI NFL API Types
 *
 * Single source of truth for the type vocabulary that the UI / CLI
 * are allowed to depend on. Anything UI / CLI imports from
 * `@worker/core/...` is a layering violation; instead, re-export it
 * from here and let consumers import from `@worker/api/types`. The
 * ESLint `no-restricted-imports` rule enforces this boundary.
 */

import type { Team, Player } from '@common/entities';
import type { Region, Phase, Position, DraftPick } from '@common/types';
import type { PlayByPlayEvent as InternalPlayByPlayEvent } from '@worker/core/game/PlayByPlayLogger';

// Re-exports of internal worker types so UI / CLI never need to
// reach into @worker/core directly.
export type { PlayerGameSim, TeamGameSim, TeamNum } from '@worker/core/game/types';
export type { PlayByPlayEvent } from '@worker/core/game/PlayByPlayLogger';
export type { OffseasonResult, OffseasonEvent } from '@worker/core/season/offseason';
export type {
  TradeAsset,
  TradeProposal as TradeProposalInternal,
} from '@worker/core/trade/evaluate';
export type { DraftProspect as DraftProspectInternal } from '@worker/core/draft';
export type { FreeAgentDemand } from '@worker/core/freeAgent';
export type {
  ImperialCupMatch,
  ImperialCupSeason,
  ImperialCupRound,
  ImperialCupHistory,
} from '@worker/core/imperialCup';
export type {
  PlayoffBracket,
  PlayoffMatchup,
  DoubleEliminationBracket,
  DoubleEliminationRound,
} from '@worker/core/playoffs';
export type { StatsManager } from '@worker/core/stats/StatsManager';
export type { GameSim } from '@worker/core/game/GameSim';

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
  playByPlay: InternalPlayByPlayEvent[];
  scoringSummary: ScoringEvent[];
  penalties: PenaltySummary[];
  injuries: InjurySummary[];
}

// PlayByPlayEvent intentionally re-exported above from
// @worker/core/game/PlayByPlayLogger as the single source of truth.

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
// DraftPick is defined in @common/types as the single source of truth
// (its `season` field also accepts the special string 'originDraft').
// The API layer just re-exports it so consumers can keep importing from
// @worker/api/types without coupling to the common module.
export type { DraftPick };

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
