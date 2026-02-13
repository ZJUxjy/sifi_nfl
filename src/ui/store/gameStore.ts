import { create } from 'zustand';
import type { Team, Player, Game, ScheduleGame, Region, Phase } from '../../common/types';

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
  | 'imperial-cup';

interface GameState {
  // Game state
  initialized: boolean;
  loading: boolean;
  phase: Phase;
  season: number;
  week: number;
  
  // User's team
  userTeam: Team | null;
  userTid: number | null;
  region: Region | null;
  
  // All data
  teams: Team[];
  players: Player[];
  schedule: ScheduleGame[];
  games: Game[];
  
  // UI state
  currentPage: Page;
  
  // Actions
  initGame: (region: Region, tid: number) => Promise<void>;
  loadGame: (saveData: any) => Promise<void>;
  saveGame: () => Promise<any>;
  setPage: (page: Page) => void;
  playWeek: () => Promise<Game | null>;
  simWeek: () => Promise<void>;
}

// Mock data generators for demo
const generateMockTeams = (region: Region): Team[] => {
  const teamNames: Record<Region, { names: string[]; count: number }> = {
    firstContinent: {
      names: ['Aurora Sentinels', 'Pixel Pirates', 'Titan Titans', 'Quantum Reapers', 
              'Ion Storm', 'Stack Stormers', 'Thread Threshers', 'Compile Kings',
              'Null Knights', 'Neural Network', 'Debug Destroyers', 'Heap Hammers',
              'Nebula Knights', 'Nova Force', 'Syntax Soldiers', 'Binary Blazers',
              'Cache Crushers', 'Logic Lords', 'Pixel Pioneers', 'Data Dragons',
              'Cyber Centurions', 'Matrix Marauders', 'Vector Vipers', 'Byte Brawlers',
              'Code Commanders', 'Algorithm Avengers', 'Protocol Phantoms', 'Circuit Champions',
              'Digital Demons', 'Virtual Vanguards', 'Hologram Heroes', 'Plasma Prowlers',
              'Quantum Questers', 'Stellar Strikers', 'Galaxy Guardians', 'Cosmo Crusaders'],
      count: 36
    },
    secondContinent: {
      names: Array.from({ length: 40 }, (_, i) => `Team ${i + 1} SC`),
      count: 40
    },
    originContinent: {
      names: Array.from({ length: 36 }, (_, i) => `Team ${i + 1} OC`),
      count: 36
    },
    miningIsland: {
      names: Array.from({ length: 58 }, (_, i) => `Team ${i + 1} MI`),
      count: 58
    }
  };

  const strengths: Array<'elite' | 'strong' | 'average' | 'weak'> = ['elite', 'strong', 'average', 'weak'];
  const markets: Array<'huge' | 'large' | 'medium' | 'small'> = ['huge', 'large', 'medium', 'small'];

  return teamNames[region].names.map((name, i) => ({
    tid: i,
    cid: Math.floor(i / 12),
    did: i % 4,
    region,
    name,
    abbrev: name.split(' ').map(w => w[0]).join('').slice(0, 3).toUpperCase(),
    colors: ['#00d4ff', '#7c3aed', '#0f172a'] as [string, string, string],
    pop: '1.0M',
    srID: `${region}-${i}`,
    budget: (Math.floor(Math.random() * 4) + 1) * 100,
    cash: Math.floor(Math.random() * 100),
    salaryPaid: 0,
    season: 2025,
    won: 0,
    lost: 0,
    streak: 0,
    lastTen: '-',
    playoffsRoundsWon: 0,
    market: markets[Math.floor(Math.random() * 4)],
    strength: strengths[Math.floor(Math.random() * 4)],
    revenue: {
      ticketSales: 0,
      merchandise: 0,
      tvRights: 0,
      sponsorships: 0,
      prizeMoney: 0,
      total: 0
    },
    expenses: {
      salary: 0,
      signingBonuses: 0,
      coaching: 0,
      facilities: 0,
      travel: 0,
      total: 0
    }
  }));
};

const generateMockPlayers = (teams: Team[]): Player[] => {
  const positions: Array<'QB' | 'RB' | 'WR' | 'TE' | 'OL' | 'DL' | 'LB' | 'CB' | 'S' | 'K' | 'P'> = 
    ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'CB', 'S', 'K', 'P'];
  
  const firstNames = ['Zane', 'Noah', 'Zoey', 'Tyrus', 'Lyra', 'Zylos', 'Hazel', 'Zoe', 
                      'Charlotte', 'Samuel', 'Addison', 'Maya', 'Nathan', 'Eva', 'Rian',
                      'Riley', 'Isaac', 'Ayla', 'Aria', 'Elijah', 'Grace', 'Layla'];
  const lastNames = ['Campbell', 'Takahashi', 'Zhang', 'Torres', 'Parker', 'Green', 
                     'Gonzalez', 'Kobayashi', 'Hernandez', 'Nelson', 'Evans', 'Wright',
                     'Brown', 'Diaz', 'Huang', 'Han', 'Kim', 'Stewart', 'Baker', 'Roberts'];

  const players: Player[] = [];
  let pid = 0;

  for (const team of teams) {
    // Generate ~40 players per team
    for (let i = 0; i < 40; i++) {
      const pos = positions[Math.floor(Math.random() * positions.length)];
      const age = Math.floor(Math.random() * 15) + 21;
      const ovr = Math.floor(Math.random() * 40) + 50;
      const pot = Math.floor(Math.random() * 30) + ovr - 10;

      players.push({
        pid: pid++,
        tid: team.tid,
        name: `${firstNames[Math.floor(Math.random() * firstNames.length)]} ${lastNames[Math.floor(Math.random() * lastNames.length)]}`,
        age,
        bornYear: 2025 - age,
        bornLoc: 'Earth Colony',
        pos,
        // Ratings
        hgt: Math.floor(Math.random() * 100),
        stre: Math.floor(Math.random() * 100),
        spd: Math.floor(Math.random() * 100),
        endu: Math.floor(Math.random() * 100),
        thv: Math.floor(Math.random() * 100),
        thp: Math.floor(Math.random() * 100),
        tha: Math.floor(Math.random() * 100),
        bsc: Math.floor(Math.random() * 100),
        elu: Math.floor(Math.random() * 100),
        rtr: Math.floor(Math.random() * 100),
        hnd: Math.floor(Math.random() * 100),
        rbk: Math.floor(Math.random() * 100),
        pbk: Math.floor(Math.random() * 100),
        pcv: Math.floor(Math.random() * 100),
        tck: Math.floor(Math.random() * 100),
        prs: Math.floor(Math.random() * 100),
        rns: Math.floor(Math.random() * 100),
        kpw: Math.floor(Math.random() * 100),
        kac: Math.floor(Math.random() * 100),
        ppw: Math.floor(Math.random() * 100),
        pac: Math.floor(Math.random() * 100),
        fuzz: 0,
        ovr,
        pot,
        ovrs: {} as any,
        pots: {} as any,
        ratingsIndex: 0,
        statsIndex: 0,
        draft: {
          year: 2025 - (age - 21),
          round: Math.floor(Math.random() * 7) + 1,
          pick: Math.floor(Math.random() * 32) + 1,
          tid: team.tid,
          originalTid: team.tid,
          pot,
          ovr: ovr - 10,
          skills: []
        },
        contract: {
          amount: ovr * 100000,
          exp: 2026 + Math.floor(Math.random() * 4),
          years: Math.floor(Math.random() * 4) + 1,
          incentives: 0,
          signingBonus: 0,
          guaranteed: 0,
          noTrade: false
        },
        numBrothers: 0,
        numSons: 0
      });
    }
  }

  return players;
};

const generateMockSchedule = (teams: Team[]): ScheduleGame[] => {
  const schedule: ScheduleGame[] = [];
  let gid = 0;

  // Generate 17 weeks of games
  for (let week = 1; week <= 17; week++) {
    // Each team plays once per week (simplified)
    const weekTeams = [...teams];
    for (let i = 0; i < weekTeams.length; i += 2) {
      if (i + 1 < weekTeams.length) {
        schedule.push({
          gid: gid++,
          season: 2025,
          day: week,
          homeTid: weekTeams[i].tid,
          awayTid: weekTeams[i + 1].tid
        });
      }
    }
  }

  return schedule;
};

export const useGameStore = create<GameState>((set, get) => ({
  initialized: false,
  loading: false,
  phase: 1, // PRESEASON
  season: 2025,
  week: 1,
  userTeam: null,
  userTid: null,
  region: null,
  teams: [],
  players: [],
  schedule: [],
  games: [],
  currentPage: 'home',

  initGame: async (region: Region, tid: number) => {
    set({ loading: true });
    
    // Simulate loading delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const teams = generateMockTeams(region);
    const userTeam = teams.find(t => t.tid === tid) || teams[0];
    const players = generateMockPlayers(teams);
    const schedule = generateMockSchedule(teams);

    set({
      initialized: true,
      loading: false,
      region,
      userTid: tid,
      userTeam,
      teams,
      players,
      schedule,
      phase: 2, // REGULAR_SEASON
      currentPage: 'roster'
    });
  },

  loadGame: async (saveData: any) => {
    set({ loading: true });
    await new Promise(resolve => setTimeout(resolve, 500));
    
    set({
      ...saveData,
      loading: false,
      initialized: true
    });
  },

  saveGame: async () => {
    const state = get();
    return {
      season: state.season,
      week: state.week,
      region: state.region,
      userTid: state.userTid,
      teams: state.teams,
      players: state.players,
      schedule: state.schedule,
      games: state.games
    };
  },

  setPage: (page: Page) => {
    set({ currentPage: page });
  },

  playWeek: async () => {
    const state = get();
    if (!state.userTeam || !state.schedule.length) return null;

    // Find user's game this week
    const userGame = state.schedule.find(g => 
      g.day === state.week && 
      (g.homeTid === state.userTid || g.awayTid === state.userTid)
    );

    if (!userGame) return null;

    // Simulate game
    const homeTeam = state.teams.find(t => t.tid === userGame.homeTid);
    const awayTeam = state.teams.find(t => t.tid === userGame.awayTid);
    
    if (!homeTeam || !awayTeam) return null;

    const homeScore = Math.floor(Math.random() * 35);
    const awayScore = Math.floor(Math.random() * 35);

    const game: Game = {
      gid: userGame.gid,
      season: state.season,
      day: state.week,
      overtimes: 0,
      teams: [
        { tid: homeTeam.tid, players: [], pt: homeScore },
        { tid: awayTeam.tid, players: [], pt: awayScore }
      ] as any,
      won: { tid: homeScore >= awayScore ? homeTeam.tid : awayTeam.tid, pts: Math.max(homeScore, awayScore) },
      lost: { tid: homeScore >= awayScore ? awayTeam.tid : homeTeam.tid, pts: Math.min(homeScore, awayScore) },
      att: 50000 + Math.floor(Math.random() * 20000)
    };

    // Update teams record
    const updatedTeams = state.teams.map(t => {
      if (t.tid === state.userTid) {
        const isHome = userGame.homeTid === state.userTid;
        const won = isHome ? homeScore > awayScore : awayScore > homeScore;
        return {
          ...t,
          won: won ? t.won + 1 : t.won,
          lost: won ? t.lost : t.lost + 1
        };
      }
      return t;
    });

    // Simulate all other games
    const otherGames = state.schedule.filter(g => 
      g.day === state.week && g.gid !== userGame.gid
    );

    const newGames = otherGames.map(g => {
      const homeScore = Math.floor(Math.random() * 35);
      const awayScore = Math.floor(Math.random() * 35);
      return {
        gid: g.gid,
        season: state.season,
        day: state.week,
        overtimes: 0,
        teams: [
          { tid: g.homeTid, players: [], pt: homeScore },
          { tid: g.awayTid, players: [], pt: awayScore }
        ] as any,
        won: { tid: homeScore >= awayScore ? g.homeTid : g.awayTid, pts: Math.max(homeScore, awayScore) },
        lost: { tid: homeScore >= awayScore ? g.awayTid : g.homeTid, pts: Math.min(homeScore, awayScore) },
        att: 30000 + Math.floor(Math.random() * 30000)
      };
    });

    // Update all team records
    const finalTeams = updatedTeams.map(t => {
      const teamGames = [...otherGames].filter(g => g.homeTid === t.tid || g.awayTid === t.tid);
      if (teamGames.length === 0 || t.tid === state.userTid) return t;
      
      const g = teamGames[0];
      const isHome = g.homeTid === t.tid;
      // Re-use the same random scores
      const hs = Math.floor(Math.random() * 35);
      const as = Math.floor(Math.random() * 35);
      const won = isHome ? hs > as : as > hs;
      
      return {
        ...t,
        won: won ? t.won + 1 : t.won,
        lost: won ? t.lost : t.lost + 1
      };
    });

    set({
      teams: finalTeams,
      games: [...state.games, game, ...newGames],
      week: state.week + 1,
      userTeam: finalTeams.find(t => t.tid === state.userTid) || state.userTeam
    });

    return game;
  },

  simWeek: async () => {
    const state = get();
    if (!state.userTeam) return;

    // Simulate all games including user's
    const weekGames = state.schedule.filter(g => g.day === state.week);
    
    const newGames: Game[] = weekGames.map(g => {
      const homeScore = Math.floor(Math.random() * 35);
      const awayScore = Math.floor(Math.random() * 35);
      return {
        gid: g.gid,
        season: state.season,
        day: state.week,
        overtimes: 0,
        teams: [
          { tid: g.homeTid, players: [], pt: homeScore },
          { tid: g.awayTid, players: [], pt: awayScore }
        ] as any,
        won: { tid: homeScore >= awayScore ? g.homeTid : g.awayTid, pts: Math.max(homeScore, awayScore) },
        lost: { tid: homeScore >= awayScore ? g.awayTid : g.homeTid, pts: Math.min(homeScore, awayScore) },
        att: 30000 + Math.floor(Math.random() * 30000)
      };
    });

    // Update team records
    const updatedTeams = state.teams.map(t => {
      const teamGames = weekGames.filter(g => g.homeTid === t.tid || g.awayTid === t.tid);
      if (teamGames.length === 0) return t;
      
      const g = teamGames[0];
      const game = newGames.find(ng => ng.gid === g.gid);
      if (!game) return t;
      
      const isHome = g.homeTid === t.tid;
      const won = isHome ? game.won.tid === t.tid : game.won.tid === t.tid;
      
      return {
        ...t,
        won: won ? t.won + 1 : t.won,
        lost: won ? t.lost : t.lost + 1
      };
    });

    set({
      teams: updatedTeams,
      games: [...state.games, ...newGames],
      week: state.week + 1,
      userTeam: updatedTeams.find(t => t.tid === state.userTid) || state.userTeam
    });
  }
}));
