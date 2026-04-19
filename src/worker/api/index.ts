/**
 * SIFI NFL API
 *
 * Public surface for UI / CLI consumers. Anything UI / CLI uses
 * MUST flow through this barrel. The ESLint rule
 * `no-restricted-imports` forbids importing from `@worker/core` /
 * `@worker/db` outside of `worker/api` itself.
 */

export * from './types';
export { GameEngine, getGameEngine, resetGameEngine } from './GameEngine';
export {
  initDB,
  saveWorldData,
  loadWorldData,
  clearWorldData,
  saveGame,
  loadGame,
  deleteGame,
  listSaves,
} from './storage';

// Stateless helpers / constants exposed as part of the API. These
// have no dependency on engine state, so it's cheaper to forward
// them here than to wrap them as engine methods.
export {
  getRoundName as getImperialCupRoundName,
  IMPERIAL_CUP_HISTORY,
  IMPERIAL_CUP_QUALIFYING,
  IMPERIAL_CUP_INTERVAL,
  IMPERIAL_CUP_START_SEASON,
} from '../core/imperialCup';
