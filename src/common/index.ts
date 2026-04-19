// Barrel for @common.
//
// IMPORTANT: types / types.football / entities / constants.football all
// historically defined overlapping symbols (Player, Team, Contract, GamePlayer,
// POSITIONS, ...). Re-exporting them from a single barrel produced TS2308
// ambiguity errors and made it impossible to know which "Player" you got.
//
// In this codebase nothing actually imports from `@common` (everything uses
// the explicit subpath, e.g. `@common/types` or `@common/entities`). So this
// barrel is intentionally minimal: it only re-exports modules that are
// guaranteed conflict-free. For domain types please import from the specific
// module:
//   - business entities       -> '@common/entities'
//   - core/league types       -> '@common/types'
//   - football sim types      -> '@common/types.football'
//   - football constants      -> '@common/constants.football'

export * from './utils';
export * from './random';
export * from './names';
export * from './constants';
