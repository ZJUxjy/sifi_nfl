import { describe, it, expect } from 'vitest';
import { ageOnePlayer } from '../worker/core/season/offseason';

describe('player aging in offseason', () => {
  it('keeps bornYear stable; age is derived from newSeason - bornYear', () => {
    const p = { age: 25, bornYear: 2001 };
    const after = ageOnePlayer(p, 2027);
    expect(after.bornYear).toBe(2001);
    expect(after.age).toBe(26);
  });

  it('does not double-shift across multiple seasons', () => {
    let p: { age: number; bornYear: number } = { age: 22, bornYear: 2004 };
    for (let s = 2027; s <= 2030; s++) {
      p = ageOnePlayer(p, s);
    }
    // bornYear must be untouched
    expect(p.bornYear).toBe(2004);
    // 2030 - 2004 = 26
    expect(p.age).toBe(26);
  });

  it('returns a new object and leaves the input untouched', () => {
    const p = { age: 30, bornYear: 1996 };
    const after = ageOnePlayer(p, 2027);
    expect(p.age).toBe(30);
    expect(p.bornYear).toBe(1996);
    expect(after).not.toBe(p);
    expect(after.age).toBe(31);
  });

  it('preserves other fields untouched', () => {
    const p = { age: 25, bornYear: 2001, ovr: 75, name: 'X' };
    const after = ageOnePlayer(p, 2027);
    expect(after.ovr).toBe(75);
    expect(after.name).toBe('X');
  });
});
