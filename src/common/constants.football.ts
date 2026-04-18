import type { NonEmptyArray } from './types';

export const FIRST_CONTINENT_TEAMS = 36;
export const SECOND_CONTINENT_TEAMS = 40;
export const ORIGIN_CONTINENT_LEAGUES = 3;
export const ORIGIN_CONTINENT_TEAMS_PER_LEAGUE = 12;
export const MINING_ISLAND_TEAMS = 80;  // 20+20+20+20 (4级联赛每级20队)
export const MINING_ISLAND_PROMOTION_RELEGATION = 3;

export const TEAM_NAMES = {
  firstContinent: [
    'Aurora Sentinels', 'Nebula Knights', 'Nova Force', 'Pulsar Raiders',
    'Quantum Reapers', 'Cyber Wolves', 'Droid Destroyers', 'Ion Storm',
    'Binary Banshees', 'Titan Titans', 'Stellar Spartans', 'Vortex Vipers',
    'Circuit Breakers', 'Logic Lords', 'Data Dragons', 'Matrix Marauders',
    'Pixel Pirates', 'Vector Vanguards', 'Render Renegades', 'Cache Crusaders',
    'Stack Stormers', 'Heap Hammers', 'Thread Threshers', 'Lock Legion',
    'Async Avengers', 'Sync Saviors', 'Null Knights', 'Void Wanderers',
    'Neural Network', 'Algorithm Alliance', 'Debug Destroyers', 'Compile Kings',
    'Syntax Soldiers', 'Protocol Phantoms', 'Gateway Guardians', 'Router Raiders'
  ],
  secondContinent: [
    'Apex Predators', 'Storm Chasers', 'Thunder Bolts', 'Lightning Strikes',
    'Cyclone Crushers', 'Tornado Twisters', 'Hurricane Hunters', 'Blizzard Brawlers',
    'Frost Giants', 'Ice Dragons', 'Glacier Guardians', 'Avalanche Riders',
    'Volcanic Eruption', 'Lava Flow', 'Magma Men', 'Rock Solid',
    'Diamond Cutters', 'Crystal Shards', 'Sapphire Spirits', 'Emerald Empire',
    'Ruby Rebels', 'Topaz Titans', 'Amber Angels', 'Onyx Outlaws',
    'Quartz Quest', 'Jade Juggernauts', 'Garnet Gladiators', 'Opal Oracle',
    'Pearl Protectors', 'Coral Corsairs', 'Jade Jaguars', 'Zephyr Zealots',
    'Tempest Titans', 'Monsoon Masters', 'Typhoon Troopers', 'Gale Gladiators',
    'Blaze Bringers', 'Inferno Invaders', 'Solar Storm', 'Lunar Legion'
  ],
  originContinent: [
    'Metropolis Emperors', 'Imperial Eagles', 'Royal Guards', 'Noble Lions',
    'Crown Jewelers', 'Scepter Bearers', 'Throne Defenders', 'Palace Protectors',
    'Dynasty Dragons', 'Empire Enforcers', 'Legend Keepers', 'Myth Breakers',
    'Fate Weavers', 'Destiny Chasers', 'Fortune Seekers', 'Glory Hunters',
    'Honor Knights', 'Valor Vanguards', 'Courage Crusaders', 'Wisdom Wizards',
    'Power Masters', 'Authority Lords', 'Command Centurions', 'Control Phantoms',
    'Dominion Demons', 'Supreme Overlords', 'Eternal Champions', 'Infinite Immortals',
    'Legacy Lords', 'Heritage Heroes', 'Ancestral Avengers', 'Dynasty Defenders',
    'Reign Raiders', 'Sovereign Soldiers', 'Majestic Masters', 'Regal Raiders'
  ],
  miningIsland: [
    'Core Extractors', 'Magma Miners', 'Crystal Harvesters', 'Ore Lords',
    'Metal Mongers', 'Gem Seekers', 'Rock Crushers', 'Drill Masters',
    'Blast Engineers', 'Excavation Experts', 'Mining Syndicate', 'Resource Raiders',
    'Deep Dwellers', 'Underground Kings', 'Terraform Knights', 'Geology Guild',
    'Mineral Marauders', 'Elemental Guardians', 'Earth Shapers', 'Stone Wardens',
    'Iron Forgers', 'Steel Smiths', 'Copper Craftsmen', 'Bronze Artificers',
    'Silver Scavengers', 'Gold Rushers', 'Platinum Prospectors', 'Rare Finders',
    'Cobalt Commanders', 'Titanium Titans', 'Nickel Knights', 'Zinc Zealots',
    'Bismuth Battlers', 'Tungsten Troopers', 'Uranium United', 'Lithium Legion',
    'Carbon Crushers', 'Silicon Soldiers', 'Osmium Outlaws', 'Rhodium Raiders',
    'Palladium Phantoms', 'Indium Invaders', 'Gallium Gladiators', 'Selenium Storm',
    'Tellurium Titans', 'Antimony Avengers', 'Thallium Thunder', 'Germanium Giants',
    'Scandium Spartans', 'Vanadium Vipers', 'Chromium Chargers', 'Manganese Masters',
    'Cobalt Crushers', 'Molybdenum Monarchs', 'Ruthenium Raiders', 'Cadmium Crusaders',
    'Hafnium Heroes', 'Tantalum Titans',
    // Amateur B League teams (lower quality, hobbyist names)
    'Weekend Warriors', 'Sunday Strikers', 'Casual Crushers', 'Hobby Heroes',
    'Amateur Athletes', 'Recreation Raiders', 'Pickup Players', 'Sandbox Spartans',
    'Rookie Rebels', 'Novice Knights', 'Training Titans', 'Practice Pirates',
    'Backyard Brawlers', 'Garage Giants', 'Street Smarts', 'Playground Phantoms',
    'Community Crusaders', 'Local Legends', 'Neighborhood Ninjas', 'District Defenders'
  ]
};

// Economic system configuration per region
// All values in actual dollars (not thousands)

export const REGION_LEAGUE_STRUCTURE = {
  firstContinent: {
    type: 'closed',
    teams: FIRST_CONTINENT_TEAMS,
    salaryCap: 180000000,        // $180M salary cap (NFL-style)
    minPayroll: 135000000,       // $135M floor (75% of cap)
    luxuryPayroll: 200000000,    // $200M luxury tax threshold
    minContract: 750000,         // $750K minimum salary
    maxContract: 50000000,       // $50M max annual salary
    minRosterSize: 40,
    maxRosterSize: 55,
  },
  secondContinent: {
    type: 'closed',
    teams: SECOND_CONTINENT_TEAMS,
    salaryCap: 200000000,        // $200M salary cap (slightly higher)
    minPayroll: 150000000,       // $150M floor
    luxuryPayroll: 220000000,    // $220M luxury tax threshold
    minContract: 750000,         // $750K minimum salary
    maxContract: 55000000,       // $55M max annual salary
    minRosterSize: 40,
    maxRosterSize: 55,
  },
  originContinent: {
    type: 'pyramid',
    leagues: ORIGIN_CONTINENT_LEAGUES,
    teamsPerLeague: ORIGIN_CONTINENT_TEAMS_PER_LEAGUE,
    salaryCap: null,             // No salary cap - teams manage own finances
    minPayroll: null,
    luxuryPayroll: null,
    minContract: 500000,         // $500K minimum
    maxContract: 80000000,       // $80M max (richer teams can pay more)
    minRosterSize: 40,
    maxRosterSize: 55,
  },
  miningIsland: {
    type: 'pyramid',
    levels: 4,
    teams: [20, 20, 20, 20],
    promotionSpots: MINING_ISLAND_PROMOTION_RELEGATION,
    relegationSpots: MINING_ISLAND_PROMOTION_RELEGATION,
    salaryCap: 50000000,         // $50M salary cap (smaller market)
    minPayroll: 30000000,        // $30M floor
    minContract: 300000,         // $300K minimum
    maxContract: 15000000,       // $15M max
    minRosterSize: 25,
    maxRosterSize: 40,
  }
};

export const ORIGIN_DRAFT_ELIGIBILITY = {
  firstContinent: { minAge: 25, minSeasons: 0 },
  secondContinent: { minAge: 24, minSeasons: 2 },
  miningIsland: { minSeasons: 3 },
};

export const IMPERIAL_CUP_QUALIFICATION = {
  originContinent: 6,
  firstContinent: 4,
  secondContinent: 4,
  miningIsland: 2,
};

export const IMPERIAL_CUP_HISTORY = {
  totalCups: 25,
  champions: {
    originContinent: 17,
    miningIsland: 4,
    firstContinent: 3,
    secondContinent: 1,
  },
};

export const POSITION_GROUPS = {
  QB: { primary: 'QB', related: [] },
  RB: { primary: 'RB', related: ['KR'] },
  WR: { primary: 'WR', related: ['PR', 'KR'] },
  TE: { primary: 'TE', related: [] },
  OL: { primary: 'OL', related: [] },
  DL: { primary: 'DL', related: [] },
  LB: { primary: 'LB', related: [] },
  CB: { primary: 'CB', related: ['PR'] },
  S: { primary: 'S', related: ['KR', 'PR'] },
  K: { primary: 'K', related: ['P'] },
  P: { primary: 'P', related: ['K'] },
  KR: { primary: 'KR', related: ['RB', 'WR', 'S'] },
  PR: { primary: 'PR', related: ['WR', 'CB', 'S'] },
} as const;

export const POSITIONS = ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'CB', 'S', 'K', 'P', 'KR', 'PR'] as const;

export const SCRIMMAGE_KICKOFF = 35;
export const SCRIMMAGE_EXTRA_POINT = 85;
export const SCRIMMAGE_TWO_POINT_CONVERSION = 98;
export const SCRIMMAGE_TOUCHBACK = 20;

export const FIELD_GOAL_DISTANCE_YARDS_ADDED = 17;

export const STARTING_NUM_TIMEOUTS = 3;

export const TWO_MINUTE_WARNING_TIME = 2;

export const NUM_DOWNS = 4;

export const AVERAGE_TACKLING_COMPOSITE = 0.56;

export const FATIGUE_POS = new Set(['RB', 'WR', 'TE', 'DL', 'LB', 'CB', 'S']);

export const FEWER_INJURIES_POS = new Set(['QB', 'P', 'K']);

const wrap = <T>(value: T): NonEmptyArray<{ start: number; value: T }> => [
  { start: -Infinity, value },
];

export const gameAttributesDefaults = {
  phase: 0,
  nextPhase: undefined,
  playerBioInfo: undefined,
  injuries: undefined,
  daysLeft: 0,
  gameOver: false,
  godMode: false,
  godModeInPast: false,
  salaryCap: wrap(200000),
  minPayroll: wrap(150000),
  luxuryPayroll: wrap(250000),
  luxuryTax: 1.5,
  minContract: wrap(500),
  maxContract: wrap(30000),
  minContractLength: 1,
  maxContractLength: 7,
  minRosterSize: 40,
  maxRosterSize: 55,
  softCapTradeSalaryMatch: 125,
  numGames: wrap(17),
  numGamesDiv: 6,
  numGamesConf: 6,
  otherTeamsWantToHire: false,
  numPeriods: 4,
  quarterLength: wrap(15),
  overtimeLength: 10,
  overtimeLengthPlayoffs: wrap(15),
  numGamesPlayoffSeries: wrap([1, 1, 1, 1]),
  numPlayoffByes: wrap(0),
  aiTradesFactor: 1,
  stopOnInjury: false,
  stopOnInjuryGames: 1,
  injuryRate: 2 / 1000,
  homeCourtAdvantage: 1,
  tragicDeathRate: 1 / (20 * 50),
  sonRate: 0.005,
  brotherRate: 0.005,
  forceRetireAge: 0,
  forceRetireSeasons: 0,
  minRetireAge: 26,
  groupScheduleSeries: false,
  salaryCapType: 'hard',
  maxOvertimes: wrap(1),
  shooutRounds: wrap(0),
  maxOvertimesPlayoffs: null,
  otl: wrap(false),
  draftType: 'originDraft',
  draftAges: [21, 22],
  defaultStadiumCapacity: 60000,
  playersRefuseToNegotiate: true,
  allStarGame: -1,
  allStarNum: 44,
  allStarType: 'byRegion',
  allStarDunk: false,
  allStarThree: false,
  budget: true,
  numSeasonsFutureDraftPicks: 4,
  foulRateFactor: 1,
  pace: 1,
  rookieContractLengths: [3, 2],
  rookiesCanRefuse: true,
  tradeDeadline: 0.5,
  tiebreakers: wrap([
    'headToHeadRecord',
    'regionRecordIfSame',
    'commonOpponentsRecord',
    'regionRecordIfSame',
    'strengthOfVictory',
    'strengthOfSchedule',
    'marginOfVictory',
    'coinFlip',
  ]),
  hofFactor: 1.2,
  neutralSite: 'finals',
  imperialCupEveryYears: 4,
  passFactor: wrap(1),
  rushYdsFactor: wrap(1),
  passYdsFactor: wrap(1),
  completionFactor: wrap(1),
  scrambleFactor: wrap(1),
  sackFactor: wrap(1),
  fumbleFactor: wrap(1),
  intFactor: wrap(1),
  fgAccuracyFactor: wrap(1),
  fourthDownFactor: wrap(1),
  onsideFactor: wrap(1),
  onsideRecoveryFactor: wrap(1),
  scrimmageTouchbackKickoff: 35,
  twoPointConversions: true,
  footballOvertime: 'bothPossess',
  footballOvertimePlayoffs: 'bothPossess',

  lid: 0,
  userTid: wrap(0),
  userTids: [0],
  season: 0,
  startingSeason: 0,
  teamInfoCache: [],
  gracePeriodEnd: 0,
  numTeams: 0,
  numActiveTeams: 0,
  difficulty: wrap(0),
  lowestDifficulty: wrap(0),
  fantasyPoints: undefined,

  challengeNoDraftPicks: false,
  challengeNoFreeAgents: false,
  challengeNoRatings: false,
  challengeNoTrades: false,
  challengeLoseBestPlayer: false,
  challengeFiredLuxuryTax: false,
  challengeFiredMissPlayoffs: false,
  challengeSisyphusMode: false,
  challengeThanosMode: 0,
  thanosCooldownEnd: undefined,
  repeatSeason: undefined,
  equalizeRegions: false,
  realPlayerDeterminism: 0,
  spectator: false,
  playerMoodTraits: true,
  numPlayersOnCourt: 11,
  aiJerseyRetirement: true,
  playIn: false,
  playoffsNumTeamsDiv: wrap(0),
  playoffsReseed: false,
  playoffsType: 'doubleElimination',
  subseasonPhase: 'regular',

  draftPickAutoContract: false,
  draftPickAutoContractPercent: 10,
  draftPickAutoContractRounds: 1,

  saveOldBoxScores: {
    pastSeasons: 2,
    pastSeasonsType: 'all',
    note: 'all',
  },
  currencyFormat: ['C', '.', ''],
  forceRetireRealPlayers: false,
  forceHistoricalRosters: false,
} as const;
