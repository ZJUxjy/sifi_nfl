/**
 * SIFI NFL React UI Store
 * Uses Zustand for state management, calling real GameEngine API
 */

import { create } from 'zustand';
import { getGameEngine, resetGameEngine } from '../../worker/api';
import type {
  GameState,
  Page,
  GameResult,
  TradeProposal,
  TradeEvaluation,
  ContractOffer,
  TeamFinances,
  DraftProspect,
  StandingEntry,
  ScheduleGame,
} from '../../worker/api/types';
import type { Region } from '../../common/types';
import type { Team, Player } from '../../common/entities';

// Re-export Page type for components
export type { Page } from '../../worker/api/types';

interface GameStore extends GameState {
  // UI state
  currentPage: Page;

  // Actions
  initGame: (region: Region, tid: number) => Promise<void>;
  selectTeam: (tid: number) => void;
  loadGame: (saveId: string) => Promise<void>;
  saveGame: (name?: string) => Promise<string>;
  listSaves: () => Promise<any[]>;
  setPage: (page: Page) => void;
  playWeek: () => Promise<GameResult | null>;
  simWeek: () => Promise<void>;
  resetGame: () => void;
  advanceWeek: () => Promise<void>;

  // Sync state after external changes
  syncState: () => void;

  // Query
  getUserTeam: () => Team | null;
  getTeamPlayers: () => Player[];
  getTeamSchedule: () => ScheduleGame[];
  getTeamStandings: () => StandingEntry[];
  getFreeAgents: () => Player[];
  getDraftProspects: () => DraftProspect[];

  // Trade
  evaluateTrade: (proposal: TradeProposal) => TradeEvaluation;
  executeTrade: (proposal: TradeProposal) => boolean;

  // Free agency
  getContractDemand: (pid: number) => { minSalary: number; minYears: number };
  signFreeAgent: (pid: number, offer: ContractOffer) => { success: boolean; reason?: string };

  // Draft
  draftPlayer: (prospectId: number) => { success: boolean; reason?: string };

  // Finances
  getFinances: () => TeamFinances | null;
}

export const useGameStore = create<GameStore>((set, get) => {
  const engine = getGameEngine();

  const syncState = () => {
    const state = engine.getState();
    set({
      initialized: state.initialized,
      loading: false, // Always set loading to false after sync
      season: state.season,
      week: state.week,
      phase: state.phase,
      userTid: state.userTid,
      region: state.region,
      teams: state.teams,
      players: state.players,
      freeAgents: state.freeAgents,
      games: state.games,
      schedule: state.schedule,
      lastGame: state.lastGame,
    });
  };

  return {
    // Initial state
    initialized: false,
    loading: false,
    season: 2025,
    week: 1,
    phase: 1,
    userTid: null,
    region: null,
    teams: [],
    players: [],
    freeAgents: [],
    games: [],
    schedule: [],
    lastGame: null,
    currentPage: 'home',

    // Actions
    resetGame: () => {
      resetGameEngine();
      syncState();
    },

    initGame: async (region: Region, tid: number) => {
      console.log('initGame called with region:', region, 'tid:', tid);
      set({ loading: true });

      try {
        // Use engine's newGame method
        await engine.newGame({
          region,
          teamId: tid,
          season: 2025,
        });

        console.log('engine.newGame completed, syncing state...');
        syncState();
        console.log('syncState completed');
        set({ currentPage: 'roster' });

        const newState = get();
        console.log('Store state after initGame:', {
          userTid: newState.userTid,
          region: newState.region,
          teamsCount: newState.teams.length,
          currentTeamName: newState.teams.find(t => t.tid === tid)?.name,
        });
      } catch (error) {
        console.error('Failed to init game:', error);
        set({ loading: false });
      }
    },

    selectTeam: (tid: number) => {
      const team = engine.getTeam(tid);
      if (team) {
        set({
          userTid: tid,
          region: team.region,
          currentPage: 'roster'
        });
      }
    },

    loadGame: async (saveId: string) => {
      set({ loading: true });

      try {
        await engine.loadGame(saveId);
        syncState();
      } catch (error) {
        console.error('Failed to load game:', error);
        set({ loading: false });
      }
    },

    saveGame: async (name?: string) => {
      const result = await engine.saveGame(name);
      return result;
    },

    listSaves: async () => {
      return await engine.listSaves();
    },

    setPage: (page: Page) => {
      set({ currentPage: page });
    },

    playWeek: async () => {
      const result = await engine.playWeek();
      syncState();
      return result;
    },

    simWeek: async () => {
      await engine.simWeek();
      syncState();
    },

    advanceWeek: async () => {
      await engine.simWeek();
      syncState();
    },

    syncState: () => {
      syncState();
    },

    // Query
    getUserTeam: () => {
      return engine.getUserTeam();
    },

    getTeamPlayers: () => {
      const state = get();
      if (state.userTid === null) return [];
      return engine.getPlayers({ tid: state.userTid });
    },

    getTeamSchedule: () => {
      const state = get();
      return engine.getSchedule().filter(
        g => g.homeTid === state.userTid || g.awayTid === state.userTid
      );
    },

    getTeamStandings: () => {
      const state = get();
      return engine.getStandings(state.region || undefined);
    },

    getFreeAgents: () => {
      return engine.getFreeAgents();
    },

    getDraftProspects: () => {
      return engine.getDraftProspects();
    },

    // Trade
    evaluateTrade: (proposal: TradeProposal) => {
      return engine.evaluateTrade(proposal);
    },

    executeTrade: (proposal: TradeProposal) => {
      const result = engine.executeTrade(proposal);
      if (result) {
        syncState();
      }
      return result;
    },

    // Free agency
    getContractDemand: (pid: number) => {
      return engine.getContractDemand(pid);
    },

    signFreeAgent: (pid: number, offer: ContractOffer) => {
      const result = engine.signFreeAgent(pid, offer);
      if (result.success) {
        syncState();
      }
      return result;
    },

    // Draft
    draftPlayer: (prospectId: number) => {
      const result = engine.draftPlayer(prospectId);
      if (result.success) {
        syncState();
      }
      return result;
    },

    // Finances
    getFinances: () => {
      const state = get();
      if (state.userTid === null) return null;

      const team = engine.getTeam(state.userTid);
      if (!team) return null;

      const teamPlayers = engine.getPlayers({ tid: state.userTid });
      const payroll = teamPlayers.reduce((sum, p) => sum + (p.contract?.amount || 0), 0);

      return {
        budget: team.budget,
        cash: team.cash,
        payroll,
        capSpace: team.budget - payroll,
        revenue: {
          ticketSales: 0,
          merchandise: 0,
          tvRights: 0,
          sponsorships: 0,
          prizeMoney: 0,
          total: 0,
        },
        expenses: {
          salary: payroll,
          signingBonuses: 0,
          coaching: 5000,
          facilities: 3000,
          travel: 2000,
          total: payroll + 10000,
        },
        profit: 0,
      };
    },
  };
});

// Export convenience hooks
export const useUserTeam = () => useGameStore(state => {
  if (state.userTid === null) return null;
  return state.teams.find(t => t.tid === state.userTid) || null;
});

// Alias for GameScreen compatibility
export const useCurrentTeam = useUserTeam;

export const useTeamPlayers = () => {
  const userTid = useGameStore(state => state.userTid);
  const players = useGameStore(state => state.players);

  if (userTid === null) return [];
  return players.filter(p => p.tid === userTid);
};

export const useTeamSchedule = () => useGameStore(state => {
  return state.schedule.filter(
    g => g.homeTid === state.userTid || g.awayTid === state.userTid
  );
});

export const useStandings = () => useGameStore(state => {
  const engine = getGameEngine();
  return engine.getStandings(state.region || undefined);
});
