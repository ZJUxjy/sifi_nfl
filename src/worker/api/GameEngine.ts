/**
 * SIFI NFL Game Engine
 * Core game state management, shared by CLI and Web UI
 */

import { SeasonManager } from '../core/season/seasonManagerV2';
import {
  initDB,
  saveWorldData,
  loadWorldData,
  clearWorldData,
  saveGame as idbSaveGame,
  loadGame as idbLoadGame,
  deleteGame as idbDeleteGame,
  listSaves as idbListSaves,
} from './storage';
import {
  calculatePlayerValue,
  calculatePickValue,
  evaluateTrade as evalTrade,
  createTradeAsset,
  shouldAcceptTrade,
  executeTrade as doExecuteTrade,
} from '../core/trade';
import {
  generateContractDemand,
  evaluateOffer,
  signFreeAgent as doSignFreeAgent,
  releasePlayer as doReleasePlayer,
} from '../core/freeAgent';
import {
  generateDraftPool,
  calculateDraftOrder,
  selectPlayer as doSelectPlayer,
} from '../core/draft';
import type {
  GameState,
  NewGameOptions,
  ScheduleGame,
  GameResult,
  StandingEntry,
  PlayerFilter,
  TeamFilter,
  TradeProposal,
  TradeEvaluation,
  ContractOffer,
  DraftProspect,
  ContractDemand,
} from './types';
import type { Team, Player } from '@common/entities';
import type { Region } from '@common/types';

const GAME_VERSION = '0.2.0';

export class GameEngine {
  private state: GameState;
  private seasonManager: SeasonManager | null = null;

  constructor() {
    this.state = this.getInitialState();
  }

  private getInitialState(): GameState {
    return {
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
    };
  }

  // === State Access ===
  getState(): GameState {
    return { ...this.state };
  }

  // === Game Initialization ===
  async newGame(options: NewGameOptions): Promise<void> {
    console.log('GameEngine.newGame called with options:', options);
    this.state.loading = true;

    // Initialize IndexedDB
    if (typeof window !== 'undefined') {
      try {
        await initDB();
        console.log('IndexedDB initialized');
      } catch (error) {
        console.error('Failed to init IndexedDB:', error);
      }
    }

    // Check for cached data in IndexedDB
    if (typeof window !== 'undefined') {
      try {
        const cachedData = await loadWorldData();
        console.log('Cached data loaded:', cachedData ? `${cachedData.teams?.length} teams, ${cachedData.players?.length} players` : 'null');

        if (cachedData && cachedData.teams && cachedData.teams.length > 0 && cachedData.players && cachedData.players.length > 0) {
          console.log('Using cached world data from IndexedDB');

          // Use cached data
          this.seasonManager = new SeasonManager(cachedData.season, cachedData.teams);
          this.seasonManager.startRegularSeason();

          this.state = {
            ...this.state,
            initialized: true,
            loading: false,
            season: cachedData.season,
            week: 1,
            phase: 2,
            userTid: options.teamId,
            region: options.region,
            teams: cachedData.teams,
            players: cachedData.players,
            freeAgents: cachedData.freeAgents || [],
            schedule: this.seasonManager.schedule,
            games: [],
            lastGame: null,
          };
          console.log('GameEngine state initialized from cache:', {
            teams: this.state.teams.length,
            players: this.state.players.length,
            userTid: this.state.userTid,
            region: this.state.region,
          });
          return;
        }
      } catch (error) {
        console.error('Failed to load cached data:', error);
      }
    }

    // No cache available - generate new data (slow!)
    console.log('No valid cache, generating new world data...');

    try {
      // Import generateAllTeams dynamically
      const { generateAllTeams } = await import('../core/team/index');
      const { generateFreeAgentPool } = await import('../core/freeAgent/market');

      const season = options.season || 2025;
      console.log('Generating teams for season', season);
      const { teams, players } = generateAllTeams(season);
      console.log('Generated teams:', teams.length, 'players:', players.length);
      const freeAgents = generateFreeAgentPool([], 50, season);
      console.log('Generated free agents:', freeAgents.length);

      // Create season manager
      this.seasonManager = new SeasonManager(season, teams);
      this.seasonManager.startRegularSeason();
      console.log('Season manager created, schedule:', this.seasonManager.schedule.length, 'games');

      // Update state
      this.state = {
        ...this.state,
        initialized: true,
        loading: false,
        season,
        week: 1,
        phase: 2,
        userTid: options.teamId,
        region: options.region,
        teams,
        players,
        freeAgents,
        schedule: this.seasonManager.schedule,
        games: [],
        lastGame: null,
      };
      console.log('GameEngine state initialized from generation');

      // Cache to IndexedDB
      if (typeof window !== 'undefined') {
        try {
          await saveWorldData({
            season,
            teams,
            players,
            freeAgents,
            timestamp: Date.now(),
          });
          console.log('Cached world data to IndexedDB');
        } catch (error) {
          console.error('Failed to cache world data:', error);
        }
      }
    } catch (error) {
      console.error('Failed to generate world data:', error);
      this.state.loading = false;
      throw error;
    }
  }

  // === Save/Load ===
  async saveGame(name?: string): Promise<string> {
    const saveName = name || `Save_${this.state.season}_Week${this.state.week}`;
    const saveData = {
      version: GAME_VERSION,
      timestamp: Date.now(),
      name: saveName,
      state: this.state,
    };

    if (typeof window !== 'undefined') {
      await idbSaveGame(saveName, saveData);
      console.log(`Game saved as "${saveName}"`);
      return saveName;
    } else {
      return JSON.stringify(saveData, null, 2);
    }
  }

  async loadGame(saveIdOrData: string): Promise<void> {
    let saveData: any;

    if (typeof window !== 'undefined') {
      saveData = await idbLoadGame(saveIdOrData);
      if (!saveData) {
        throw new Error(`Save not found: ${saveIdOrData}`);
      }
    } else {
      saveData = JSON.parse(saveIdOrData);
    }

    // Restore state
    this.state = saveData.state;

    // Rebuild season manager
    if (this.state.teams.length > 0) {
      this.seasonManager = new SeasonManager(this.state.season, this.state.teams);
      this.seasonManager.currentWeek = this.state.week;
      this.seasonManager.schedule = this.state.schedule;
    }
  }

  async listSaves(): Promise<any[]> {
    if (typeof window !== 'undefined') {
      return await idbListSaves();
    }
    return [];
  }

  async deleteGame(name: string): Promise<void> {
    if (typeof window !== 'undefined') {
      await idbDeleteGame(name);
    }
  }

  // === Query Methods ===
  getTeam(tid: number): Team | null {
    return this.state.teams.find(t => t.tid === tid) || null;
  }

  getPlayer(pid: number): Player | null {
    return this.state.players.find(p => p.pid === pid) || null;
  }

  getTeams(filter?: TeamFilter): Team[] {
    let teams = this.state.teams;
    if (filter?.region) {
      teams = teams.filter(t => t.region === filter.region);
    }
    if (filter?.tid !== undefined) {
      teams = teams.filter(t => t.tid === filter.tid);
    }
    return teams;
  }

  getPlayers(filter?: PlayerFilter): Player[] {
    let players = this.state.players;
    if (filter?.tid !== undefined) {
      players = players.filter(p => p.tid === filter.tid);
    }
    if (filter?.pos) {
      players = players.filter(p => p.pos === filter.pos);
    }
    if (filter?.minOvr !== undefined) {
      players = players.filter(p => p.ovr >= filter.minOvr!);
    }
    if (filter?.maxOvr !== undefined) {
      players = players.filter(p => p.ovr <= filter.maxOvr!);
    }
    return players;
  }

  getUserTeam(): Team | null {
    if (this.state.userTid === null) return null;
    return this.getTeam(this.state.userTid);
  }

  getSchedule(week?: number): ScheduleGame[] {
    let schedule = this.state.schedule;
    if (week !== undefined) {
      schedule = schedule.filter(g => g.day === week);
    }
    return schedule;
  }

  getStandings(region?: Region): StandingEntry[] {
    if (!this.seasonManager) return [];

    const standings = this.seasonManager.getStandings();

    if (region) {
      return standings.filter(s => s.region === region);
    }

    return standings;
  }

  getFreeAgents(): Player[] {
    return this.state.freeAgents;
  }

  getLastGame(): GameResult | null {
    return this.state.lastGame;
  }

  // === Game Operations ===
  async simWeek(): Promise<void> {
    if (!this.seasonManager) return;

    this.seasonManager.simWeek();
    this.state.week = this.seasonManager.currentWeek;
    this.state.phase = this.seasonManager.phase as any;
    this.state.lastGame = null;
  }

  async playWeek(): Promise<GameResult | null> {
    if (!this.seasonManager || this.state.userTid === null) {
      return null;
    }

    const currentWeek = this.seasonManager.currentWeek;
    const userGame = this.state.schedule.find(
      g => g.day === currentWeek &&
      (g.homeTid === this.state.userTid || g.awayTid === this.state.userTid)
    );

    if (!userGame) {
      await this.simWeek();
      return null;
    }

    const result = this.simulateGame(userGame);
    this.state.lastGame = result;

    // Sim other games
    this.seasonManager.simWeek();
    this.state.week = this.seasonManager.currentWeek;

    return result;
  }

  private simulateGame(game: ScheduleGame): GameResult {
    const homeTeam = this.state.teams.find(t => t.tid === game.homeTid)!;
    const awayTeam = this.state.teams.find(t => t.tid === game.awayTid)!;

    // Simple simulation
    const homeStrength = this.getTeamStrength(homeTeam);
    const awayStrength = this.getTeamStrength(awayTeam);

    const homeScore = Math.floor(10 + Math.random() * homeStrength + Math.random() * 20);
    const awayScore = Math.floor(10 + Math.random() * awayStrength + Math.random() * 20);

    // Update game result
    game.won = {
      tid: homeScore > awayScore ? homeTeam.tid : awayTeam.tid,
      pts: Math.max(homeScore, awayScore),
    };
    game.lost = {
      tid: homeScore > awayScore ? awayTeam.tid : homeTeam.tid,
      pts: Math.min(homeScore, awayScore),
    };
    game.played = true;

    return {
      gid: game.gid,
      homeTeam: homeTeam.name,
      awayTeam: awayTeam.name,
      homeScore,
      awayScore,
      winner: game.won.tid,
      playByPlay: [],
      scoringSummary: [],
      penalties: [],
      injuries: [],
    };
  }

  private getTeamStrength(team: Team): number {
    const budgetFactor = team.budget / 300000;
    return 50 + budgetFactor * 50;
  }

  // === Trade Methods ===
  evaluateTrade(proposal: TradeProposal): TradeEvaluation {
    const fromAssets = [
      ...proposal.fromPlayerIds.map(pid => {
        const player = this.getPlayer(pid);
        return player ? createTradeAsset('player', player) : null;
      }).filter(Boolean),
      ...(proposal.fromDraftPicks || []).map(() => createTradeAsset('pick', { dpid: 0, tid: proposal.toTeam, originalTid: proposal.fromTeam, round: 1, pick: 1, season: this.state.season })),
    ].filter(Boolean) as any[];

    const toAssets = [
      ...proposal.toPlayerIds.map(pid => {
        const player = this.getPlayer(pid);
        return player ? createTradeAsset('player', player) : null;
      }).filter(Boolean),
      ...(proposal.toDraftPicks || []).map(() => createTradeAsset('pick', { dpid: 0, tid: proposal.fromTeam, originalTid: proposal.toTeam, round: 1, pick: 1, season: this.state.season })),
    ].filter(Boolean) as any[];

    if (proposal.fromCash) {
      fromAssets.push(createTradeAsset('cash', proposal.fromCash));
    }
    if (proposal.toCash) {
      toAssets.push(createTradeAsset('cash', proposal.toCash));
    }

    const internalProposal = {
      fromTeam: proposal.fromTeam,
      toTeam: proposal.toTeam,
      fromAssets,
      toAssets,
      status: 'pending' as const,
    };

    const evaluation = evalTrade(internalProposal);
    const aiAccepts = shouldAcceptTrade(internalProposal, true);

    return {
      fromValue: evaluation.fromValue,
      toValue: evaluation.toValue,
      ratio: evaluation.fromValue > 0 ? evaluation.toValue / evaluation.fromValue : 0,
      fair: evaluation.fair,
      aiAccepts,
    };
  }

  executeTrade(proposal: TradeProposal): boolean {
    const evaluation = this.evaluateTrade(proposal);
    if (!evaluation.aiAccepts) {
      return false;
    }

    // Transfer players from -> to
    for (const pid of proposal.fromPlayerIds) {
      const player = this.getPlayer(pid);
      if (player) {
        player.tid = proposal.toTeam;
      }
    }

    // Transfer players to -> from
    for (const pid of proposal.toPlayerIds) {
      const player = this.getPlayer(pid);
      if (player) {
        player.tid = proposal.fromTeam;
      }
    }

    return true;
  }

  // === Free Agent Methods ===
  getContractDemand(pid: number): ContractDemand {
    const player = this.getPlayer(pid);
    if (!player) {
      return { minSalary: 500, minYears: 1, reason: 'Player not found' };
    }

    const demand = generateContractDemand(player);
    return {
      minSalary: demand.minSalary,
      minYears: demand.minYears,
    };
  }

  signFreeAgent(pid: number, offer: ContractOffer): { success: boolean; reason?: string } {
    const player = this.getPlayer(pid);
    if (!player) {
      return { success: false, reason: 'Player not found' };
    }

    if (player.tid !== undefined && player.tid !== -1) {
      return { success: false, reason: 'Player is not a free agent' };
    }

    const team = this.getUserTeam();
    if (!team) {
      return { success: false, reason: 'No team selected' };
    }

    const demand = generateContractDemand(player);
    const result = evaluateOffer(player, demand, {
      salary: offer.salary,
      years: offer.years,
      team,
    });

    if (result.accepted) {
      doSignFreeAgent(player, team, offer.salary, offer.years, this.state.season);

      // Remove from free agents list
      this.state.freeAgents = this.state.freeAgents.filter(p => p.pid !== pid);

      // Add to players if not already there
      if (!this.state.players.find(p => p.pid === pid)) {
        this.state.players.push(player);
      }

      return { success: true, reason: result.reason };
    }

    return { success: false, reason: result.reason };
  }

  releasePlayer(pid: number): { success: boolean; reason?: string } {
    const player = this.getPlayer(pid);
    if (!player) {
      return { success: false, reason: 'Player not found' };
    }

    if (player.tid !== this.state.userTid) {
      return { success: false, reason: 'Player is not on your team' };
    }

    doReleasePlayer(player);
    this.state.freeAgents.push(player);

    return { success: true };
  }

  // === Draft Methods ===
  getDraftProspects(): DraftProspect[] {
    // Generate draft pool if not already generated for this season
    return generateDraftPool(this.state.season, 224);
  }

  draftPlayer(prospectId: number): { success: boolean; reason?: string } {
    const prospects = this.getDraftProspects();
    const prospect = prospects.find(p => p.pid === prospectId);

    if (!prospect) {
      return { success: false, reason: 'Prospect not found' };
    }

    if (prospect.tid !== undefined && prospect.tid !== -1) {
      return { success: false, reason: 'Prospect already drafted' };
    }

    const team = this.getUserTeam();
    if (!team) {
      return { success: false, reason: 'No team selected' };
    }

    // Create a dummy pick for the selection
    const pick = {
      dpid: Date.now(),
      tid: team.tid,
      originalTid: team.tid,
      round: 1,
      pick: 1,
      season: this.state.season,
    };

    const draftedPlayer = doSelectPlayer(team.tid, prospect as any, pick, this.state.season);

    // Add to players list
    this.state.players.push(draftedPlayer);

    return { success: true };
  }

  // === Game Simulation with Full Engine ===
  simulateGameFull(game: ScheduleGame): GameResult {
    // For now, use simple simulation
    // TODO: Integrate with GameSim for full play-by-play
    return this.simulateGame(game);
  }
}

// Singleton export
let engineInstance: GameEngine | null = null;

export function getGameEngine(): GameEngine {
  if (!engineInstance) {
    engineInstance = new GameEngine();
  }
  return engineInstance;
}

export function resetGameEngine(): void {
  engineInstance = null;
}

// Export API index
export * from './types';
export { initDB, saveWorldData, loadWorldData, clearWorldData } from './storage';
