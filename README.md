# SIFI NFL - Sci-Fi American Football Manager Game

A futuristic American football manager game set on a colonized planet, featuring multi-region leagues with different structures, complex transfer systems, and inter-regional competitions.

## Status: **Beta** - CLI Fully Playable ✅

## Project Overview

### Setting
- **Four Administrative Regions**: First Continent, Second Continent, Origin Continent (Metropolis), and Mining Island
- **NFL Rules**: Authentic American football gameplay
- **Sci-Fi Themes**: Future technology, advanced civilization background
- **Complex Transfer System**: Cross-region player movement with special drafting rules

### Unique Features
1. **Multi-Region Leagues**: Each region has different league structures
   - First/Second Continent: Closed leagues (36/40 teams, salary caps)
   - Origin Continent: 3 parallel top leagues with promotion/relegation
   - Mining Island: English-style pyramid with 4 levels

2. **Imperial Cup**: Every 4 years, top teams from all regions compete

3. **Origin Draft**: Special drafting system for players from other regions to join Metropolis

4. **Sci-Fi Names**: Futuristic player names and team identities

5. **Fixed Team Attributes**: Each team has predefined market size and strength (elite/strong/average/weak)

## Architecture

### Tech Stack
- **Frontend**: React 19 + TypeScript + Bootstrap 5 (planned)
- **CLI**: Inquirer + Chalk + cli-table3 + Ora
- **Data Storage**: JSON files (save/load system)
- **Game Engine**: Worker-based simulation (isolated from UI)
- **Build**: Vite + TypeScript

### Code Organization
```
src/
├── common/          # Shared code (types, constants, utilities)
│   ├── types.ts           # Core type definitions
│   ├── types.football.ts  # Football-specific types
│   ├── entities.ts        # Player, Team entities
│   ├── constants.ts       # General constants
│   ├── constants.football.ts  # League structures, team names
│   ├── teamConfig.ts      # Fixed team market/strength config
│   ├── random.ts          # Random number utilities
│   ├── names.ts           # Sci-fi name generation
│   └── utils.ts           # Helper functions
├── worker/          # Game logic (simulation, database, AI)
│   ├── db/                # IndexedDB layer
│   │   ├── Cache.ts       # Data caching system
│   │   └── connectLeague.ts
│   └── core/
│       ├── player/        # Player generation & ratings
│       ├── team/          # Team generation & roster
│       ├── game/          # Game simulation engine
│       │   ├── GameSim.ts       # Main game simulation
│       │   ├── PlayByPlayLogger.ts  # Play-by-play logging
│       │   ├── penalties.ts     # Penalty system (22 types)
│       │   └── injuries.ts      # Injury system (7 types)
│       ├── season/        # Season & schedule management
│       ├── league/        # Multi-region league systems
│       │   ├── originContinent.ts  # 3-league system
│       │   ├── miningIsland.ts     # 4-tier pyramid
│       │   └── index.ts            # UnifiedSeasonManager
│       ├── imperialCup/   # Inter-region tournament
│       ├── contract/      # Contract negotiation
│       ├── trade/         # Trade evaluation with AI
│       ├── draft/         # Draft system
│       └── freeAgent/     # Free agency market
├── cli/             # Interactive CLI interface
│   ├── main.ts            # Main game loop
│   └── saveManager.ts     # Save/load system
├── data/            # Data storage
│   └── saves/             # Game save files
└── test/            # Unit tests
```

## Current Implementation Status

### ✅ Completed Features

#### Phase 1: Foundation (100%)
- [x] Project configuration (package.json, tsconfig.json)
- [x] Build system setup (Vite)
- [x] Code formatting (Prettier)
- [x] Type system (22 player attributes, 12 positions)
- [x] Constants (4 regions, 170 teams, league structures)
- [x] Utilities (random, names, helpers)
- [x] Fixed team configuration (market size, strength)

#### Phase 2: Core Systems (100%)
- [x] IndexedDB schema & Cache system
- [x] Player generation (22 ratings, potential, age curves)
- [x] Team generation (170 teams across 4 regions)
- [x] Roster management & depth charts
- [x] OVR calculation algorithms
- [x] Game save/load persistence (JSON files)

#### Phase 3: Game Simulation (100%)
- [x] GameSim class - complete game simulation
- [x] Play types: pass, run, field goal, punt, kickoff
- [x] Game state (down, distance, clock, score)
- [x] Overtime logic
- [x] Statistics tracking
- [x] Penalty system (22 penalty types with enforcement)
- [x] Play-by-play logging with event descriptions
- [x] Injury system (7 injury types with recovery)

#### Phase 4: Season Management (100%)
- [x] Schedule generation (17 games)
- [x] Week-by-week simulation
- [x] Standings calculation
- [x] Playoff bracket generation
- [x] Imperial Cup tournament (4-year cycle, 16 teams)

#### Phase 5: Financial System (100%)
- [x] Contract negotiation logic
- [x] Salary calculation (age/ability/potential)
- [x] Salary cap validation (200M for closed leagues)
- [x] Minimum payroll enforcement (150M)
- [x] Luxury tax calculation
- [x] Revenue/expense tracking (ticket, TV, merchandise, sponsorships)

#### Phase 6: Trade System (100%)
- [x] Player value calculator
- [x] Draft pick value calculator
- [x] Trade evaluation (fairness check ≥85%)
- [x] Multi-asset trades (players + picks + cash)
- [x] AI trade decision logic (enhanced with smart value assessment)
- [x] CLI trade interface

#### Phase 7: Draft System (100%)
- [x] Draft pool generation (224 prospects)
- [x] Draft order calculation
- [x] 7-round draft simulation
- [x] Origin Draft special rules (cross-region bidding)
- [x] Rookie contract generation
- [x] Draft room interface (CLI)

#### Phase 8: Free Agency (100%)
- [x] Free agent market
- [x] Contract demands system
- [x] Signing logic
- [x] Waiver system

#### Phase 9: League Systems (100%)
- [x] Origin Continent: 3 parallel leagues (Metropolis, Imperial, Royal)
  - Phase 1: Intra-league schedule (11 games)
  - Phase 2: Championship/Relegation groups
  - Double-elimination playoffs
  - Relegation playoff system
- [x] Mining Island: 4-tier pyramid
  - Super League (20 teams)
  - Championship (20 teams)
  - A League (18 teams)
  - B League (amateur)
  - Promotion/relegation system

#### Phase 10: User Interface
- **CLI (100%)** ✅ Fully Playable
  - [x] Main menu & team selection
  - [x] Region selection (4 regions)
  - [x] Origin Continent league selection (Metropolis/Imperial/Royal)
  - [x] Mining Island tier selection (4 levels)
  - [x] Team selection with market/strength display
  - [x] Roster viewer
  - [x] Schedule viewer
  - [x] Standings display
  - [x] Game simulation with play-by-play
  - [x] Penalty and injury viewing
  - [x] Financial overview (revenue/expense breakdown)
  - [x] Trade interface (smart AI evaluation)
  - [x] Stats viewer (roster values, league leaders, team stats)
  - [x] Save/Load game system
  - [x] Free agency interface
  - [x] Draft interface
  - [x] Imperial Cup viewing
- **React UI (0%)** - Planned

#### Phase 11: Testing (30%)
- [x] Test setup (Vitest)
- [x] Unit tests (random, names, player, team)
- [ ] Comprehensive test coverage
- [ ] Integration tests

---

## Quick Start

```bash
# Install dependencies
pnpm install

# Play the game (CLI)
pnpm play

# Run tests
pnpm test

# Build
pnpm build
```

## CLI Game Features

### Main Menu
- 🎮 **New Game** - Generate universe (170 teams, 7200+ players)
- 📊 **Load Game** - Load saved game
- ❌ **Exit**

### Game Menu
- 🏈 **View Roster** - See all players with OVR, POT, salary, injury status
- 📅 **View Schedule** - 17-week schedule with results
- 🏆 **Standings** - Region standings with W/L, PF/PA, streak
- ▶️ **Play Week** - Simulate current week's game with play-by-play
- ⚡ **Sim Week** - Quick simulate week
- 📝 **View Play-by-Play** - Full game log, scoring summary, penalties, injuries
- 💰 **Finances** - Revenue breakdown, expenses, payroll, cap space
- 🔄 **Trade** - Trade players with AI evaluation (smart decision logic)
- 📋 **Free Agency** - Browse and sign free agents
- 🎯 **Draft** - View draft board, make selections, simulate rounds
- 📈 **Stats** - Roster values, league leaders, team stats
- 🏆 **Imperial Cup** - View tournament bracket (every 4 years)
- 💾 **Save Game** - Save current progress
- 🔙 **Main Menu** - Return to main menu

## Game Features

### Multi-Region System
Each region has distinct characteristics:
- **First Continent**: 36 teams, closed league, NFL-style draft, salary cap
- **Second Continent**: 40 teams, closed league, NFL-style draft, salary cap
- **Origin Continent**: 36 teams in 3 parallel leagues with promotion/relegation
  - Metropolis League: Emperors, Eagles, and more
  - Imperial League: Raiders, Defenders, and more
  - Royal League: Lions, Guards, and more
- **Mining Island**: 58 teams in 4-tier pyramid with promotion/relegation

### Team Attributes
Each team has fixed attributes:
- **Market Size**: Huge (💰💰💰), Large (💰💰), Medium (💰), Small
- **Strength**: Elite (⭐⭐⭐), Strong (⭐⭐), Average (⭐), Weak

### Trade System
- Select trade partner from same region
- Choose players to trade away/receive
- Evaluate trade fairness (≥85% = fair)
- Smart AI decision logic:
  - Very bad deal (<70% value): 5% accept rate
  - Bad deal (70-85%): 15% accept rate
  - Good deal (≥85%): 90% accept rate

### Penalty System
22 penalty types with realistic enforcement:
- Offensive: False Start, Holding, Illegal Block, etc.
- Defensive: Offside, Holding, Pass Interference, etc.
- Special Teams: Kickoff Out of Bounds, Fair Catch Interference, etc.

### Injury System
7 injury types with recovery tracking:
- Minor: Bruise (1-2 games), Strain (2-3 games)
- Moderate: Sprain (3-4 games), Strain (4-6 games)
- Severe: Fracture (6-8 games), Tear (8-12 games)
- Career-threatening: Career-Ending Injury

### Imperial Cup
Every 4 years, top teams compete:
- Origin Continent: Top 6 qualify
- First Continent: Top 4 qualify
- Second Continent: Top 4 qualify
- Mining Island: Top 2 qualify
- 16-team single-elimination tournament
- Historical record: 17 Origin, 4 Mining Island, 3 First Continent, 1 Second Continent

### Origin Draft
Special drafting mechanism for inter-region transfers:
- First Continent: Players ≥25 years eligible
- Second Continent: Players ≥24 years + 2 seasons experience eligible
- Mining Island: Players with ≥3 seasons experience eligible
- Origin League teams bid on eligible players
- Winning teams sign 2x rookie salary contracts
- Original teams receive 10% of contract + bidding fee

## Statistics

| Metric | Value |
|--------|-------|
| TypeScript Files | 48 |
| Lines of Code | ~10,000 |
| Teams | 170 |
| Players | ~7,200 |
| Player Attributes | 22 |
| Positions | 12 |
| Regions | 4 |
| Penalty Types | 22 |
| Injury Types | 7 |

## Roadmap

### Completed ✅
- [x] Core game engine
- [x] Player/team generation
- [x] Game simulation with penalties & injuries
- [x] Play-by-play logging
- [x] Season management
- [x] Financial system
- [x] Trade system (with smart AI)
- [x] Free agency system
- [x] Save/load system
- [x] Draft system
- [x] Imperial Cup tournament
- [x] Multi-region league systems
- [x] CLI interface (100%)

### Planned 📋
- [ ] React web UI
- [ ] Multiplayer support
- [ ] Save migration system

## License
MIT

## Contributing
Contributions welcome! The core engine is stable and ready for feature additions.
