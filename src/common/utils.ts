import type { Position } from './types';

export function isPos<T>(pos: T | string, positions: readonly T[]): pos is T {
  return positions.includes(pos as T);
}

export function isQB(pos: Position): boolean {
  return pos === 'QB';
}

export function isRB(pos: Position): boolean {
  return pos === 'RB';
}

export function isWR(pos: Position): boolean {
  return pos === 'WR';
}

export function isTE(pos: Position): boolean {
  return pos === 'TE';
}

export function isOL(pos: Position): boolean {
  return pos === 'OL';
}

export function isDL(pos: Position): boolean {
  return pos === 'DL';
}

export function isLB(pos: Position): boolean {
  return pos === 'LB';
}

export function isCB(pos: Position): boolean {
  return pos === 'CB';
}

export function isS(pos: Position): boolean {
  return pos === 'S';
}

export function isK(pos: Position): boolean {
  return pos === 'K';
}

export function isP(pos: Position): boolean {
  return pos === 'P';
}

export function isKR(pos: Position): boolean {
  return pos === 'KR';
}

export function isPR(pos: Position): boolean {
  return pos === 'PR';
}

export function isOffensive(pos: Position): boolean {
  return ['QB', 'RB', 'WR', 'TE', 'OL'].includes(pos);
}

export function isDefensive(pos: Position): boolean {
  return ['DL', 'LB', 'CB', 'S'].includes(pos);
}

export function isSpecialTeams(pos: Position): boolean {
  return ['K', 'P', 'KR', 'PR'].includes(pos);
}

export function getPositions(pos: Position): readonly string[] {
  const POSITIONS = ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'CB', 'S', 'K', 'P', 'KR', 'PR'];
  const related: string[] = [];

  if (pos === 'QB') return ['QB'];
  if (pos === 'RB') return ['RB', 'KR'];
  if (pos === 'WR') return ['WR', 'PR', 'KR'];
  if (pos === 'TE') return ['TE'];
  if (pos === 'OL') return ['OL'];
  if (pos === 'DL') return ['DL'];
  if (pos === 'LB') return ['LB'];
  if (pos === 'CB') return ['CB', 'PR'];
  if (pos === 'S') return ['S', 'KR', 'PR'];
  if (pos === 'K') return ['K', 'P'];
  if (pos === 'P') return ['P', 'K'];
  if (pos === 'KR') return ['RB', 'WR', 'S', 'KR'];
  if (pos === 'PR') return ['WR', 'CB', 'S', 'PR'];

  return related.length > 0 ? related : [pos];
}

export function keys<T extends Record<string, any>>(obj: T): (keyof T)[] {
  return Object.keys(obj) as (keyof T)[];
}
