import { describe, it, expect, beforeEach } from 'vitest';
import { setSeed, randInt, choice, rand, truncGauss, shuffle } from '../common/random';

describe('seeded RNG', () => {
  beforeEach(() => setSeed(42));

  it('reproduces the same randInt sequence given the same seed', () => {
    const a = [randInt(0, 100), randInt(0, 100), randInt(0, 100)];
    setSeed(42);
    const b = [randInt(0, 100), randInt(0, 100), randInt(0, 100)];
    expect(a).toEqual(b);
  });

  it('reproduces choice() across re-seeds', () => {
    const arr = ['a', 'b', 'c', 'd', 'e'];
    setSeed(7);
    const first = [choice(arr), choice(arr), choice(arr)];
    setSeed(7);
    const second = [choice(arr), choice(arr), choice(arr)];
    expect(first).toEqual(second);
  });

  it('reproduces truncGauss + shuffle when seeded the same way', () => {
    setSeed(123);
    const tg1 = [truncGauss(10, 2), truncGauss(10, 2), truncGauss(10, 2)];
    const sh1 = shuffle([1, 2, 3, 4, 5]);
    setSeed(123);
    const tg2 = [truncGauss(10, 2), truncGauss(10, 2), truncGauss(10, 2)];
    const sh2 = shuffle([1, 2, 3, 4, 5]);
    expect(tg1).toEqual(tg2);
    expect(sh1).toEqual(sh2);
  });

  it('rand() returns a value in [0, 1)', () => {
    setSeed(1);
    for (let i = 0; i < 100; i++) {
      const r = rand();
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThan(1);
    }
  });

  it('different seeds produce different sequences', () => {
    setSeed(1);
    const a = [rand(), rand(), rand()];
    setSeed(2);
    const b = [rand(), rand(), rand()];
    expect(a).not.toEqual(b);
  });
});
