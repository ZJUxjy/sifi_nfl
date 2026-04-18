// Barrel for the season module.
//
// Until task 14 this re-exported the legacy seasonManager.ts (v1), which
// had its own schedule / standings / playoff helpers. Nothing actually
// imported through this barrel anymore - GameEngine wires the real
// season flow up directly via seasonManagerV2.ts - so v1 was deleted in
// the same commit. This barrel is kept so future consumers can import
// `SeasonManager` from `@worker/core/season` without coupling to the V2
// filename.
//
// `league/index.ts` still defines a parallel UnifiedSeasonManager / its
// own schedule algorithm (deferred to a P2 refactor that gives V2 a
// stable `generateRegularSeasonSchedule(region, teams, season)` entry
// point so league can delegate instead of reimplementing).

export { SeasonManager, PHASE, ORIGIN_PHASE } from './seasonManagerV2';
