/**
 * Wire protocol for the GameSim Web Worker (Task 23).
 *
 * The main thread owns the Team / Player domain objects; the worker only
 * sees the slim `TeamGameSim` snapshot the engine builds for it. All
 * messages are plain JSON-cloneable values so they survive `postMessage`.
 */

import type { TeamGameSim, TeamNum } from '@worker/core/game/types';
import type { PlayByPlayEvent } from '@worker/core/game/PlayByPlayLogger';
import type { Game } from '@common/entities';

/** Speed presets the UI exposes — also drive worker-side delays. */
export type SimSpeed = 'instant' | 'fast' | 'normal' | 'slow';

export interface SimulateRequest {
  type: 'simulate';
  /** Game id; echoed back in every response so multiple sims can share a worker. */
  gid: number;
  /** Pre-built TeamGameSim snapshots from `GameEngine.convertTeamToGameSim`. */
  teams: [TeamGameSim, TeamGameSim];
  /** In-game season; finalizeGame uses it for the resulting Game record. */
  season: number;
  /** Whether this is a playoff game (affects tiebreakers). */
  playoffs?: boolean;
  /** Initial speed; can be changed mid-flight via SetSpeedRequest. */
  speed?: SimSpeed;
  /** Optional seed for the `@common/random` PRNG. */
  seed?: number;
  /** Quarter length in minutes. Defaults to 15. */
  quarterLength?: number;
  /** Number of regulation periods. Defaults to 4. */
  numPeriods?: number;
}

export interface SetSpeedRequest {
  type: 'setSpeed';
  gid: number;
  speed: SimSpeed;
}

export interface PauseRequest {
  type: 'pause';
  gid: number;
}

export interface ResumeRequest {
  type: 'resume';
  gid: number;
}

export interface AbortRequest {
  type: 'abort';
  gid: number;
}

export type SimRequest =
  | SimulateRequest
  | SetSpeedRequest
  | PauseRequest
  | ResumeRequest
  | AbortRequest;

/** Snapshot of mutable scoreboard state, sent alongside each event. */
export interface SimStateSnapshot {
  quarter: number;
  clock: number;
  scores: [number, number];
  down?: number;
  toGo?: number;
  scrimmage?: number;
  possession?: TeamNum;
  isOvertime: boolean;
}

export interface EventResponse {
  type: 'event';
  gid: number;
  event: PlayByPlayEvent;
  state: SimStateSnapshot;
}

export interface DoneResponse {
  type: 'done';
  gid: number;
  result: Game;
  /** Final play-by-play log (also delivered incrementally via 'event'). */
  playByPlay: PlayByPlayEvent[];
}

export interface ErrorResponse {
  type: 'error';
  gid: number;
  message: string;
}

export interface AckResponse {
  type: 'ack';
  gid: number;
  ack: 'paused' | 'resumed' | 'speedChanged' | 'aborted';
}

export type SimResponse = EventResponse | DoneResponse | ErrorResponse | AckResponse;

/** Per-event delay in ms for each speed preset. */
export const SPEED_DELAYS_MS: Record<SimSpeed, number> = {
  instant: 0,
  fast: 5,
  normal: 50,
  slow: 200,
};
