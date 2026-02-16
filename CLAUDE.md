# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
- `npm run dev` - Start Vite dev server (for React UI)
- `npm run dev:cli` - Watch CLI build and serve
- `npm run play` or `npm run cli` - Play the CLI game

### Building
- `npm run build` - Build the web app (TypeScript + Vite)
- `npm run build:cli` - Build CLI

### Testing
- `npm test` - Run all tests
- `npm run pre-test` - Pre-test setup
- Individual test files: Use `vitest run <path>` (e.g., `vitest run src/test/player.test.ts`)

### Linting/Formatting
- `npm run lint` - Run ESLint and TypeScript checks
- `npm run lint-js` - ESLint only
- `npm run lint-ts` - TypeScript check only
- `npm run prettier` - Format code

## Architecture Overview

### Tech Stack
- **Frontend**: React 19 + TypeScript + Bootstrap 5 (planned, currently CLI-only)
- **CLI**: Inquirer + Chalk + cli-table3 + Ora
- **Data Storage**: IndexedDB + JSON file saves
- **Build**: Vite + TypeScript
- **Testing**: Vitest + jsdom

### Path Aliases (configured in both tsconfig.json and vite.config.ts)
- `@/*` → `./src/*`
- `@worker/*` → `./src/worker/*`
- `@common/*` → `./src/common/*`
- `@ui/*` → `./src/ui/*`

### Project Structure

```
src/
├── common/              # Shared code (types, constants, utilities, entities)
│   ├── types.ts              # Core type definitions (Region, Phase, Position, etc.)
│   ├── types.football.ts     # Football-specific types
│   ├── entities.ts           # Player, Team, Game entities
│   ├── constants.ts          # General constants
│   ├── constants.football.ts # League structures, 170 team names
│   ├── teamConfig.ts         # Fixed team market/strength config
│   ├── random.ts             # Random number utilities (choice, randInt, gauss)
│   ├── names.ts              # Sci-fi name generation
│   └── utils.ts              # Helper functions
│
├── worker/              # Game logic - core simulation engine (isolated from UI)
│   ├── db/
│   │   ├── Cache.ts           # IndexedDB caching layer
│   │   └── connectLeague.ts   # League connection
│   │
│   └── core/
│       ├── player/            # Player generation (22 ratings) & OVR calculation
│       ├── team/              # Team generation & roster management
│       ├── game/              # GameSim class, PlayByPlayLogger, penalties, injuries
│       ├── season/            # Season schedule & UnifiedSeasonManager
│       ├── league/            # Multi-region league systems (originContinent, miningIsland)
│       ├── imperialCup/       # Inter-region tournament (every 4 years)
│       ├── contract/          # Contract negotiation
│       ├── trade/             # Trade evaluation with AI
│       ├── draft/             # Draft pool & selection
│       └── freeAgent/         # Free agency market
│
├── cli/                 # Interactive CLI interface (fully playable)
│   ├── main.ts              # Main game loop (SIFINFLGame class)
│   └── saveManager.ts       # Save/load system (JSON files in src/data/saves/)
│
└── test/                # Unit tests (Vitest)
```

## Core Game Systems

### Multi-Region League System
Four administrative regions with different league structures:
- **First Continent** (36 teams): Closed league, NFL-style draft, salary cap
- **Second Continent** (40 teams): Closed league, same structure
- **Origin Continent** (36 teams): 3 parallel top leagues (Metropolis/Imperial/Royal) with promotion/relegation
- **Mining Island** (58 teams): 4-tier pyramid with promotion/relegation

The `UnifiedSeasonManager` (src/worker/core/league/index.ts) coordinates all regions.

### Player System
- **22 ratings**: Physical (HGT, STR, SPD, ENDU), Technical (THV, THP, THA, BSC, ELU, RTR, HND, PBK, RBK, PCV, TCK, PRS, RNS), Special (KPW, KAC, PPW, PAC)
- **12 positions**: QB, RB, WR, TE, OL, DL, LB, CB, S, K, P, KR, PR
- **OVR calculation**: Position-weighted composite ratings (see src/worker/core/player/ovr.ts)
- **Potential system**: Players develop based on age curve, potential caps attribute growth

### Game Simulation (GameSim)
Located in src/worker/core/game/GameSim.ts:
- Full NFL-rules game simulation with plays (pass, run, FG, punt, kickoff)
- State management (down, distance, clock, quarter, overtime)
- 22 penalty types with enforcement logic
- 7 injury types with recovery tracking
- Play-by-play logging system

### Special Systems
- **Imperial Cup**: Every 4 years, top teams from all regions compete (16-team single elimination)
- **Origin Draft**: Cross-region player drafting with special rules (age/experience eligibility)
- **Trade System**: Player/draft pick value calculator with AI evaluation (≥85% fairness threshold)

## Important Implementation Notes

### Team Configuration
Teams have **fixed attributes** defined in src/common/teamConfig.ts:
- Market size (Huge/Large/Medium/Small)
- Strength (Elite/Strong/Average/Weak)

### Save System
Games are saved as JSON files in src/data/saves/. The `SIFINFLGame` class manages the game state including teams, players, season, and user team.

### CLI Game Loop
The CLI is built around the `SIFINFLGame` class (src/cli/main.ts). Key state:
- `teams`: All 170 teams
- `players`: All players (~7200)
- `season`: UnifiedSeasonManager instance
- `userTeam`: Player's selected team
- `imperialCup`: Imperial Cup state (if active)

### Region Selection Flow
When starting a new game:
1. Select region (4 options)
2. If Origin Continent: select league (Metropolis/Imperial/Royal)
3. If Mining Island: select tier (4 levels)
4. Select team (displayed with market size and strength)

### Random System
Use src/common/random.ts for all random operations:
- `choice(array)` - Random element from array
- `randInt(min, max)` - Random integer
- `gauss(mean, stdev)` - Normal distribution
