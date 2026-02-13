import { describe, it, expect, beforeEach, vi } from 'vitest';
import { truncGauss, randInt, choice, shuffle, bound, sample } from '../common/random';

describe('Random Utilities', () => {
  describe('truncGauss', () => {
    it('should return values within bounds', () => {
      for (let i = 0; i < 100; i++) {
        const val = truncGauss(50, 15, 0, 100);
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThanOrEqual(100);
      }
    });

    it('should return values near mean', () => {
      const values = [];
      for (let i = 0; i < 1000; i++) {
        values.push(truncGauss(50, 15, 0, 100));
      }
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      expect(avg).toBeGreaterThan(40);
      expect(avg).toBeLessThan(60);
    });
  });

  describe('randInt', () => {
    it('should return integer within range', () => {
      for (let i = 0; i < 100; i++) {
        const val = randInt(1, 10);
        expect(val).toBeGreaterThanOrEqual(1);
        expect(val).toBeLessThanOrEqual(10);
        expect(Number.isInteger(val)).toBe(true);
      }
    });
  });

  describe('choice', () => {
    it('should return an element from array', () => {
      const arr = [1, 2, 3, 4, 5];
      for (let i = 0; i < 50; i++) {
        const val = choice(arr);
        expect(arr).toContain(val);
      }
    });
  });

  describe('shuffle', () => {
    it('should return array of same length', () => {
      const arr = [1, 2, 3, 4, 5];
      const shuffled = shuffle(arr);
      expect(shuffled).toHaveLength(arr.length);
    });

    it('should contain same elements', () => {
      const arr = [1, 2, 3, 4, 5];
      const shuffled = shuffle(arr);
      expect(shuffled.sort()).toEqual(arr.sort());
    });
  });

  describe('bound', () => {
    it('should clamp values correctly', () => {
      expect(bound(50, 0, 100)).toBe(50);
      expect(bound(-10, 0, 100)).toBe(0);
      expect(bound(150, 0, 100)).toBe(100);
      expect(bound(0, 0, 100)).toBe(0);
      expect(bound(100, 0, 100)).toBe(100);
    });
  });

  describe('sample', () => {
    it('should return correct number of elements', () => {
      const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const sampled = sample(arr, 3);
      expect(sampled).toHaveLength(3);
    });

    it('should return all elements if num >= length', () => {
      const arr = [1, 2, 3];
      const sampled = sample(arr, 5);
      expect(sampled).toHaveLength(3);
    });
  });
});
