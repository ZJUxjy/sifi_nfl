import { describe, it, expect } from 'vitest';
import { randomName, randomFirstName, randomLastName } from '../common/names';

describe('Name Generation', () => {
  describe('randomName', () => {
    it('should generate a name with first and last', () => {
      const name = randomName();
      const parts = name.split(' ');
      expect(parts).toHaveLength(2);
      expect(parts[0].length).toBeGreaterThan(0);
      expect(parts[1].length).toBeGreaterThan(0);
    });

    it('should generate varied names', () => {
      const names = new Set();
      for (let i = 0; i < 20; i++) {
        names.add(randomName());
      }
      expect(names.size).toBeGreaterThan(10);
    });
  });

  describe('randomFirstName', () => {
    it('should generate a first name', () => {
      const name = randomFirstName();
      expect(name.length).toBeGreaterThan(0);
    });
  });

  describe('randomLastName', () => {
    it('should generate a last name', () => {
      const name = randomLastName();
      expect(name.length).toBeGreaterThan(0);
    });
  });
});
