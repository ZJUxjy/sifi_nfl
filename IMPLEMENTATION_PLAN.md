# Implementation Plan: Financial, Trading, Draft Systems + CLI

## Current State (55% Complete)
✅ Data Architecture
✅ Player/Team Generation
✅ Game Simulation
✅ Season Management
❌ Financial System
❌ Trading System
❌ Draft System
❌ User Interface

## Phase 5: Financial System

### Contract System
Files to create:
1. `src/worker/core/contract/negotiation.ts` - Contract negotiation logic
2. `src/worker/core/contract/salaryCap.ts` - Salary cap validation
3. `src/worker/core/contract/index.ts` - Exports

Features:
- Contract generation with years, amount, bonuses
- Salary cap validation per region (First/Second Continent: 200M cap)
- Minimum payroll enforcement (150M)
- Luxury tax calculation (over 250M)
- Contract expiration handling
- Rookie contract scales
- Veteran minimum contracts

### Key Functions:
- `generateContractOffer(player, team)` - Create initial offer
- `negotiateContract(player, team, offer)` - Counter-offer logic
- `validateSalaryCap(team, players)` - Check cap compliance
- `signPlayer(player, team, contract)` - Finalize signing
- `releasePlayer(player, team)` - Handle dead cap

## Phase 6: Trading System

### Trade Engine
Files to create:
1. `src/worker/core/trade/evaluate.ts` - Trade value calculator
2. `src/worker/core/trade/propose.ts` - Trade proposal system
3. `src/worker/core/trade/index.ts` - Exports

Features:
- Player trade value (based on age, ovr, pot, contract)
- Draft pick trade value (based on round, expected ovr)
- Multi-asset trades (players + picks)
- Trade validation (salary matching for cap teams)
- AI trade acceptance logic
- Trade deadline enforcement

### Key Functions:
- `calculateTradeValue(asset)` - Value calculator
- `evaluateTrade(team1Assets, team2Assets)` - Fairness check
- `proposeTrade(fromTeam, toTeam, assets)` - Create proposal
- `acceptTrade(proposal)` - Execute trade
- `canTrade(player)` - Check trade restrictions

## Phase 7: Draft System

### Draft Engine
Files to create:
1. `src/worker/core/draft/pool.ts` - College player generation
2. `src/worker/core/draft/order.ts` - Draft order calculation
3. `src/worker/core/draft/originDraft.ts` - Special Origin Draft
4. `src/worker/core/draft/index.ts` - Exports

Features:
- 7-round NFL-style draft
- Draft order by record (worst to best)
- Draft pick trading
- College player generation (21-22 year olds)
- Origin Draft special rules:
  - First Continent: 25+ years old
  - Second Continent: 24+ years, 2 seasons
  - Mining Island: 3+ seasons
  - Bidding system

### Key Functions:
- `generateDraftPool(season, numPlayers)` - Create prospects
- `calculateDraftOrder(teams, season)` - Determine picks
- `selectPlayer(team, player, pick)` - Make selection
- `runDraftRound(teams, availablePlayers, round)` - Simulate round
- `runOriginDraft(teams, eligiblePlayers)` - Special draft

## Phase 8: Rich CLI Interface

### CLI Structure
Files to create:
1. `src/cli/main.ts` - Entry point
2. `src/cli/views/dashboard.ts` - Main dashboard
3. `src/cli/views/roster.ts` - Team roster view
4. `src/cli/views/schedule.ts` - Schedule view
5. `src/cli/views/standings.ts` - Standings view
6. `src/cli/views/game.ts` - Game simulation view
7. `src/cli/views/draft.ts` - Draft interface
8. `src/cli/views/trade.ts` - Trading interface
9. `src/cli/components/menu.ts` - Navigation menu
10. `src/cli/components/table.ts` - Data tables
11. `src/cli/index.ts` - Exports

Features:
- Rich text display with colors
- Interactive menus
- Real-time game simulation view
- Player/team data tables
- Draft day interface
- Trade negotiation screen
- Season progression controls

### CLI Views:
1. **Dashboard**: Team overview, record, upcoming games
2. **Roster**: Player list with stats, contracts
3. **Schedule**: Weekly matchups, results
4. **Standings**: Division/conference rankings
5. **Game**: Live game simulation with play-by-play
6. **Draft**: Draft board, player selection
7. **Trade**: Trade proposal interface
8. **Free Agency**: Available players, contract offers

## Dependencies

Need to add to package.json:
```json
{
  "dependencies": {
    "rich": "^13.0.0"
  }
}
```

## Implementation Order

### Wave 1: Financial System (2 days)
1. Contract type definitions
2. Contract generation logic
3. Salary cap validation
4. Signing/release logic

### Wave 2: Trading System (2 days)
1. Trade value calculator
2. Trade proposal system
3. Trade execution
4. AI trade logic

### Wave 3: Draft System (2 days)
1. Draft pool generation
2. Draft order calculation
3. Draft simulation
4. Origin Draft special rules

### Wave 4: CLI Interface (3 days)
1. Rich library setup
2. Dashboard view
3. Roster/Schedule views
4. Game simulation view
5. Draft/Trade interfaces

### Wave 5: Integration (1 day)
1. Connect all systems
2. Create main game loop
3. Add save/load functionality
4. Testing

## Success Criteria

✅ Can generate a new league
✅ Can view team roster with player details
✅ Can advance through season week by week
✅ Can watch games simulate with play-by-play
✅ Can make draft picks
✅ Can propose and accept trades
✅ Can sign free agents
✅ Can view standings
✅ Can win championship

Total: ~10 days to complete all systems and CLI
