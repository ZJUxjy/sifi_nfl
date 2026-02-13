# Phase 2: Core Systems Implementation Plan

## Overview
Implement foundational systems: Database layer, Player generation, Team management, and Rating calculations.

## Current Status
- ✅ Phase 1: Foundation Complete (types, constants, utilities, documentation)
- 🚧 Phase 2: Core Systems (Starting)

---

## Task 1: IndexedDB Schema & Cache System

### Files to Create
1. `src/worker/db/index.ts` - Database connection and exports
2. `src/worker/db/connectLeague.ts` - League database setup
3. `src/worker/db/Cache.ts` - Cache implementation adapted for multi-region
4. `src/worker/db/getAll.ts` - Generic get-all functions

### Implementation Details

#### Database Schema Design

**Object Stores:**
- `players` - All players (active + released)
- `teams` - All teams across all regions
- `games` - All completed games
- `schedule` - Season schedules
- `events` - Game history events
- `gameAttributes` - Game settings
- `draftPicks` - Draft picks
- `draftLotteryResults` - Lottery results
- `playoffSeries` - Playoff series
- `teamSeasons` - Team season records
- `teamStats` - Team statistics
- `seasonLeaders` - Season leaders
- `playerFeats` - Player achievements
- `negotiations` - Contract negotiations
- `releasedPlayers` - Released player tracking
- `savedTrades` - Saved trade proposals
- `allStars` - All-star game data
- `awards` - Season awards
- `headToHeads` - Head-to-head records

**Indexes for Performance:**
- Players by: tid, draft.year, retiredYear
- Games by: season, tid
- Schedule by: season, tid
- Draft picks by: season, tid, dpid

#### Cache System Adaptation

**Adapt zengm's Cache pattern for multi-region:**
1. `_data`: In-memory cache of hot data
2. `_dirty`: Tracking of modified records
3. `_dirtyIndexes`: Set of modified index keys
4. `_requestQueue`: Batching write operations
5. `_maxIds`: Track auto-increment keys

**Multi-region considerations:**
- Track region for each team (tid + region)
- Different salary cap rules per region
- Support for Origin draft eligibility tracking

### Key Functions
- `connectLeague()` - Open/create database
- `loadGame()` - Load saved game
- `saveGame()` - Save current game state
- `Cache` class with get/add/put/delete operations
- Auto-flush mechanism (4 second interval)

---

## Task 2: Player Generation System

### Files to Create
1. `src/worker/core/player/index.ts` - Player module exports
2. `src/worker/core/player/generate.ts` - Random player generation
3. `src/worker/core/player/develop.ts` - Rating development logic
4. `src/worker/core/player/ratings.ts` - Rating calculations

### Implementation Details

#### Player Generation Algorithm

**Sci-Fi Attribute Distribution:**
- All 22 ratings (hgt, stre, spd, endu, thv, thp, tha, bsc, elu, rtr, hnd, rbk, pbk, pcv, tck, prs, rns, kpw, kac, ppw, pac)
- Using Gaussian distribution with mean ~50, standard deviation ~15
- Position-specific attribute weights:
  - QB: Higher thv, thp, tha
  - RB: Higher bsc, elu, rtr
  - WR: Higher elu, rtr, hnd
  - TE: Balanced hnd, elu, rtr
  - OL: Higher stre, rbk, pbk
  - DL: Higher stre, prs, tck
  - LB: Balanced tck, prs, rns
  - CB: Higher spd, elu, pcv
  - S: Balanced tck, pcv, elu
  - K: Higher kpw, kac
  - P: Higher ppw, pac

**Potential System:**
- Random assignment (0-100) independent of ratings
- Influences: scouting level, draft round
- Age affects potential ceiling (young players can exceed initial pot)

**Age Development Curves:**
- 18-23: Rapid growth (+1-3 per year)
- 24-28: Moderate growth (+0.5-2 per year)
- 29-32: Peak maintenance (+/-0.5)
- 33-36: Slow decline (-1 to -2 per year)
- 37+: Rapid decline (-3 to -5 per year)

#### Rating Calculations

**Overall Rating (ovr):**
Position-weighted formula:
- QB: (thv*2 + thp + tha + spd + bsc + elu) / 6
- RB: (bsc*2 + elu + rtr + hnd + spd + stre) / 6
- WR: (elu*2 + rtr + hnd + spd + bsc) / 5
- TE: (hnd*2 + elu + rtr + bsc + stre) / 5
- OL: (stre*2 + rbk + pbk) / 4
- DL: (stre*2 + prs + tck + spd) / 5
- LB: (tck*2 + prs + rns + spd) / 5
- CB: (pcv*2 + elu + spd) / 4
- S: (pcv*2 + tck + elu + spd) / 5
- K: (kpw + kac) / 2
- P: (ppw + pac) / 2

**Composite Ratings (for simulation):**
- passingAccuracy: (thv + tha) / 2
- passingDeep: (thv + thp) / 2
- passingVision: thv
- athleticism: (spd + bsc + elu) / 3
- rushing: (bsc + elu + rtr + spd) / 4
- catching: (hnd + elu + spd) / 3
- gettingOpen: (elu + spd) / 2
- passBlocking: (rbk + pbk + stre) / 3
- runBlocking: (rbk + pbk + stre) / 3
- passRushing: (prs + stre + spd) / 3
- runStopping: (tck + rns + stre) / 3
- passCoverage: (pcv + elu + spd) / 3
- tackling: (tck + stre + spd) / 3
- avoidingSacks: (elu + spd) / 2
- ballSecurity: (hnd + bsc) / 2
- endurance: endu

### Player Object Structure

```typescript
Player {
  pid: number;                    // Auto-increment
  tid: number | undefined;      // Team ID
  name: string;                 // Full name
  age: number;                  // Current age
  bornYear: number;             // Birth year
  bornLoc: string;              // Birth region
  pos: Position;                // Primary position
  // 22 individual ratings (hgt, stre, spd, endu, thv, thp, tha, bsc, elu, rtr, hnd, rbk, pbk, pcv, tck, prs, rns, kpw, kac, ppw, pac)
  fuzz: number;                  // Rating noise
  ovr: number;                  // Overall rating
  pot: number;                  // Potential
  ovrs: Record<Position, number>; // Position-specific ovr
  pots: Record<Position, number>; // Position-specific pot
  ratingsIndex: number;          // Current ratings index
  statsIndex: number;            // Current stats index
  contract?: Contract;             // Contract details
  injury?: PlayerInjury;         // Current injury
  skills: string[];              // Special abilities
}
```

---

## Task 3: Team Generation System

### Files to Create
1. `src/worker/core/team/index.ts` - Team module exports
2. `src/worker/core/team/generate.ts` - Team generation
3. `src/worker/core/team/roster.ts` - Roster management
4. `src/worker/core/team/depth.ts` - Depth chart system

### Implementation Details

#### Team Generation Algorithm

**Per-Region Team Generation:**

**First Continent (36 teams):**
- Closed league structure
- Generate 36 team names from TEAM_NAMES.firstContinent
- Assign random colors (sci-fi themed)
- Create stadiums with 60K capacity
- Each team: 40-55 players, 150M-250M salary cap

**Second Continent (40 teams):**
- Closed league structure
- Generate 40 team names from TEAM_NAMES.secondContinent
- Similar structure to First Continent
- Each team: 40-55 players, 150M-250M salary cap

**Origin Continent (3 leagues × 12 teams = 36 teams):**
- Pyramid structure
- 3 parallel leagues (Alpha, Beta, Gamma divisions)
- Each league: 12 teams
- 6-stage competition: Regular → Championship Group → Relegation Group
- No salary cap (open market)

**Mining Island (4-level pyramid):**
- Super League: 20 teams
- Championship League: 16 teams
- A-League: 12 teams
- B-League: 10 teams
- 3 promotion/relegation spots each level
- No salary cap (transfer fees)

#### Roster Management

**Roster Structure:**
- `depth`: Map<Position, Player[]>` - Players at each position
- `players`: Array of all team players
- `watch`: Players to watch (track development)

**Depth Chart Priorities:**
- QB: Top 3 players
- RB: Top 4 players
- WR: Top 6 players
- TE: Top 3 players
- OL: Top 5 players
- DL: Top 6 players
- LB: Top 6 players
- CB: Top 6 players
- S: Top 4 players
- K: Top 1 player
- P: Top 1 player
- KR: Top 2 players
- PR: Top 2 players

**Budget System:**
```typescript
Team {
  tid: number;
  region: Region;
  cid: number;                  // Conference ID
  did: number;                  // Division ID
  name: string;
  abbrev: string;               // 3-letter code
  colors: [string, string, string]; // Primary, secondary, accent
  pop: string;                  // Market size (Small/Medium/Large)
  srID: string;                 // Random seed
  cash: number;                  // Current cash (thousands)
  salaryPaid: number;            // Total salary paid
  season: number;                // Current season
  won: number;
  lost: number;
  tied?: number;
  otl?: number;
  streak: number;                // Current win/loss streak
  players: Player[];
  depth: Record<Position, Player[]>;
  stats: TeamStats;
  budget: number;                 // Season budget
}
```

---

## Task 4: Rating Calculation System

### Files to Create
1. `src/common/ratings.ts` - Rating calculation utilities
2. `src/worker/core/player/ovr.ts` - Overall rating calculator
3. `src/worker/core/player/ovrByPos.ts` - Position-specific ovr

### Implementation Details

**Rating Update Functions:**
- `calculateOvr(player)` - Compute overall from individual ratings
- `calculateCompositeRatings(player)` - Compute all 14 composite ratings
- `updateOvrAll()` - Update all players' ovr values
- `updateOvrByPos()` - Update position-specific ovrs

**Formulas:**
- Position-weighted formulas (as documented in Task 2)
- Fatigue adjustment factor (0-1 based on energy)
- Injury rating reduction (50% of normal when injured)

---

## Implementation Order & Dependencies

```
Task 4 (Rating Calc) START
  ↓
Task 2 (Player Gen) START (needs rating calculation)
  ↓ depends on Task 4
Task 3 (Team Gen) START (needs player generation)
  ↓ depends on Task 2
Task 1 (DB) START (needs all data models)
  ↓ depends on Tasks 2,3,4
ALL TASKS COMPLETE
```

---

## Success Criteria

### Task 1: Database & Cache
- [ ] All object stores created with proper indexes
- [ ] Cache class with get/add/put/delete operations
- [ ] Auto-flush mechanism working
- [ ] loadGame() can load saved state
- [ ] saveGame() can persist current state

### Task 2: Player Generation
- [ ] generate() creates players with realistic distributions
- [ ] develop() properly updates ratings based on age
- [ ] ovr calculations produce sensible results (40-90 range)
- [ ] Position-specific ratings differ appropriately
- [ ] Sci-fi names generated correctly

### Task 3: Team Generation
- [ ] All 4 regions generate correct number of teams
- [ ] Each region has proper league structure
- [ ] Rosters filled with generated players
- [ ] Depth charts properly populated
- [ ] Budget system tracks cash/salary

### Task 4: Rating Calculations
- [ ] calculateOvr() produces position-weighted results
- [ ] Composite ratings all compute correctly
- [ ] Update functions work on batches of players
- [ ] Fatigue and injury adjustments applied

---

## Testing Strategy

### Unit Tests (Vitest)
1. Test rating calculations with known inputs
2. Test player generation produces valid ranges
3. Test team generation produces correct counts
4. Test cache get/add/put/delete operations

### Integration Tests
1. Database round-trip (save → load → verify)
2. Player generation → ratings calculation flow
3. Team → roster → depth chart population

---

## Risk Mitigation

**Potential Issues & Solutions:**
1. **IndexedDB Complexity**: Use transaction batching for performance
2. **Attribute Balance**: Tune Gaussian parameters if ratings too high/low
3. **Team Distribution**: Ensure player talent spread evenly across regions
4. **Memory Usage**: Cache only active players + teams, not entire DB

---

## Estimated Timeline
- Task 1 (DB): 3-4 days
- Task 2 (Player Gen): 2-3 days  
- Task 3 (Team Gen): 2-3 days
- Task 4 (Rating Calc): 2 days
- Testing & Refinement: 2-3 days

**Total Phase 2: 11-15 days**
