import type { NonEmptyArray, RegionInfo } from './types';

export const DEFAULT_REGIONS: RegionInfo[] = [
  {
    id: 'firstContinent',
    name: 'First Continent',
    population: 300000000,
    populationScale: '300M',
  },
  {
    id: 'secondContinent',
    name: 'Second Continent',
    population: 500000000,
    populationScale: '500M',
  },
  {
    id: 'originContinent',
    name: 'Origin Continent',
    population: 2000000000,
    capital: 'Metropolis',
    populationScale: '2B',
  },
  {
    id: 'miningIsland',
    name: 'Mining Island',
    population: 80000000,
    populationScale: '80M',
  },
];

export const POSITIONS = ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'CB', 'S', 'K', 'P'] as const;

export const OFFENSIVE_POSITIONS = ['QB', 'RB', 'WR', 'TE', 'OL'] as const;
export const DEFENSIVE_POSITIONS = ['DL', 'LB', 'CB', 'S'] as const;
export const SPECIAL_TEAMS_POSITIONS = ['K', 'P'] as const;
export const RETURN_POSITIONS = ['KR', 'PR'] as const;

export const PRIMARY_POSITIONS = ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'CB', 'S', 'K', 'P'] as const;

export const DIFFICULTY = [
  { name: 'Easy', factor: 0.75 },
  { name: 'Normal', factor: 1.0 },
  { name: 'Hard', factor: 1.25 },
  { name: 'Legendary', factor: 1.5 },
];

export const DEFAULT_STADIUM_CAPACITY = 60000;

export const DEFAULT_POINTS_FORMULA = '';

export const wrap = <T>(value: T): NonEmptyArray<{ start: number; value: T }> => [
  { start: -Infinity, value },
];
