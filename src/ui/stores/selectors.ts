/**
 * Fine-grained selector hooks for the gameStore.
 *
 * Why: `useGameStore()` (no selector) subscribes to the entire store, so every
 * `set()` triggers a re-render of every consumer — even ones that only read
 * `season` or `teams`. After a `simWeek()` the whole tree re-renders.
 *
 * Each hook below subscribes to a single stable slice (or a stable action
 * reference). Components that only need one field stop re-rendering when
 * unrelated fields change.
 *
 * Rules of thumb when adding new selectors here:
 * - Return a single primitive / array / map reference held by the store.
 *   Do NOT compute a new object/array inside the selector — that defeats the
 *   purpose because Zustand uses Object.is by default and a fresh array is
 *   never `===` to the previous one. If a derived value is needed, either:
 *     (a) memoize it via the `useShallow` wrapper, or
 *     (b) compute it in the consumer with `useMemo` keyed on the slice ref.
 * - Action functions are stable for the lifetime of the store, so selecting
 *   them individually is safe. Use `useGameActions` (with `useShallow`) only
 *   when you genuinely need a bag of actions in one call.
 */

import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from './gameStore';

// === Slice selectors (stable references inside the store) ===

export const useSeason = () => useGameStore(s => s.season);
export const useWeek = () => useGameStore(s => s.week);
export const usePhase = () => useGameStore(s => s.phase);
export const useUserTid = () => useGameStore(s => s.userTid);
export const useRegion = () => useGameStore(s => s.region);
export const useLoading = () => useGameStore(s => s.loading);
export const useInitialized = () => useGameStore(s => s.initialized);

export const useTeams = () => useGameStore(s => s.teams);
export const usePlayers = () => useGameStore(s => s.players);
export const useFreeAgents = () => useGameStore(s => s.freeAgents);
export const useSchedule = () => useGameStore(s => s.schedule);
export const useGames = () => useGameStore(s => s.games);
export const useLastGame = () => useGameStore(s => s.lastGame);
export const useDraftPicks = () => useGameStore(s => s.draftPicks);
export const useOriginDraftResults = () => useGameStore(s => s.originDraftResults);
export const useTeamFinances = () => useGameStore(s => s.teamFinances);

export const useCurrentPage = () => useGameStore(s => s.currentPage);

// === Derived selectors ===
//
// `Array.prototype.find` returns the same reference if the input array hasn't
// changed, so as long as `s.teams` itself is unchanged Zustand sees the same
// value and skips the re-render. The selector is therefore safe without an
// explicit equality fn.
export const useTeamById = (tid: number | null | undefined) =>
  useGameStore(s => (tid == null ? undefined : s.teams.find(t => t.tid === tid)));

// === Action selectors ===
//
// Each action is created once inside `create()` and never replaced, so picking
// one out is a stable reference and won't cause re-renders.
export const useSimWeek = () => useGameStore(s => s.simWeek);
export const usePlayWeek = () => useGameStore(s => s.playWeek);
export const useAdvanceWeek = () => useGameStore(s => s.advanceWeek);
export const useSyncState = () => useGameStore(s => s.syncState);
export const useSetPage = () => useGameStore(s => s.setPage);
export const useInitGame = () => useGameStore(s => s.initGame);
export const useResetGame = () => useGameStore(s => s.resetGame);
export const useSelectTeam = () => useGameStore(s => s.selectTeam);
export const useSaveGame = () => useGameStore(s => s.saveGame);
export const useLoadGame = () => useGameStore(s => s.loadGame);
export const useListSaves = () => useGameStore(s => s.listSaves);

// Bag-of-actions hook for callers that destructure several actions together.
// Wrapped in `useShallow` so the *new* object literal returned by the selector
// is treated as equal when its fields are referentially the same.
export const useGameActions = () =>
  useGameStore(
    useShallow(s => ({
      simWeek: s.simWeek,
      playWeek: s.playWeek,
      advanceWeek: s.advanceWeek,
      syncState: s.syncState,
      setPage: s.setPage,
      initGame: s.initGame,
      resetGame: s.resetGame,
      selectTeam: s.selectTeam,
      saveGame: s.saveGame,
      loadGame: s.loadGame,
      listSaves: s.listSaves,
    })),
  );
