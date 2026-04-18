/**
 * Seedable PRNG (mulberry32).
 *
 * Goal: every random helper in this module pulls from a single seedable
 * stream so the simulation can be made reproducible (e.g. for tests
 * and replays). Production callers don't need to do anything new -
 * the module seeds itself from Math.random() at import time, so default
 * behaviour stays "random". Tests and the replay layer call setSeed(n)
 * to pin the stream.
 *
 * Note: this only seeds the helpers exported from this file. There are
 * still a number of bare Math.random() call sites in business code
 * (GameSim, draft pool, ...). Migrating them is tracked separately
 * in the P2 phase.
 */

let _state = (Math.random() * 0xffffffff) >>> 0;

function next(): number {
  _state = (_state + 0x6d2b79f5) >>> 0;
  let t = _state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function setSeed(seed: number): void {
  _state = seed >>> 0;
}

export function rand(): number {
  return next();
}

export function random(num: number): number {
  return Math.floor(next() * num);
}

export function randInt(min: number, max: number): number {
  return Math.floor(next() * (max - min + 1)) + min;
}

export function bound(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function coinFlip(): boolean {
  return next() < 0.5;
}

export function truncGauss(mean: number, sd: number, min?: number, max?: number): number {
  const u1 = 1 - next();
  const u2 = 1 - next();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  let result = z * sd + mean;

  if (min !== undefined) {
    result = Math.max(result, min);
  }
  if (max !== undefined) {
    result = Math.min(result, max);
  }

  return Math.round(result);
}

export function sample<T>(array: T[], num?: number): T[] {
  if (!num || num >= array.length) {
    return [...array];
  }
  const shuffled = shuffle(array);
  return shuffled.slice(0, num);
}

export function choice<T>(array: T[]): T {
  return array[Math.floor(next() * array.length)];
}

export function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function unique<T>(array: T[]): T[] {
  return Array.from(new Set(array));
}

export function deepCopy<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

export function merge<T extends object>(target: T, source: Partial<T>): T {
  return { ...target, ...source };
}
