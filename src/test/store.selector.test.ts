/**
 * Verifies the gameStore + selectors split keeps references stable so React
 * consumers using `useGameStore(selector)` skip re-renders when their slice
 * is unchanged. Zustand bails on selector results via `Object.is` by default,
 * so the test mirrors that exact contract using the vanilla store API
 * (no React renderer required).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '@ui/stores/gameStore';
import { resetGameEngine } from '@worker/api';

const initialState = useGameStore.getState();

beforeEach(() => {
  resetGameEngine();
  useGameStore.setState(initialState, true);
});

describe('gameStore selector stability', () => {
  it('keeps unrelated slices referentially equal across set()', () => {
    const before = useGameStore.getState();

    useGameStore.setState({ season: before.season + 5 });

    const after = useGameStore.getState();
    expect(after.season).toBe(before.season + 5);
    expect(after.teams).toBe(before.teams);
    expect(after.players).toBe(before.players);
    expect(after.freeAgents).toBe(before.freeAgents);
    expect(after.schedule).toBe(before.schedule);
  });

  it('keeps action references stable across set()', () => {
    const before = useGameStore.getState();

    useGameStore.setState({ season: 2099, week: 17 });

    const after = useGameStore.getState();
    expect(after.simWeek).toBe(before.simWeek);
    expect(after.syncState).toBe(before.syncState);
    expect(after.setPage).toBe(before.setPage);
    expect(after.initGame).toBe(before.initGame);
    expect(after.resetGame).toBe(before.resetGame);
  });

  it('only triggers selector listener when its slice changes', () => {
    let teamsChanges = 0;
    let seasonChanges = 0;

    let lastTeams = useGameStore.getState().teams;
    let lastSeason = useGameStore.getState().season;

    const unsub = useGameStore.subscribe((state) => {
      if (!Object.is(state.teams, lastTeams)) {
        teamsChanges++;
        lastTeams = state.teams;
      }
      if (!Object.is(state.season, lastSeason)) {
        seasonChanges++;
        lastSeason = state.season;
      }
    });

    useGameStore.setState({ season: 2030 });
    useGameStore.setState({ week: 5 });
    useGameStore.setState({ season: 2031 });

    expect(seasonChanges).toBe(2);
    expect(teamsChanges).toBe(0);

    unsub();
  });
});
