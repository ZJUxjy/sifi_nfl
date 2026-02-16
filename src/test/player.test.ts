import { describe, it, expect } from 'vitest';
import { generate, develop, generateRatings, generatePotential } from '../worker/core/player/generate';
import { calculateOvr } from '../worker/core/player/ovr';
import type { Position } from '../common/types';

describe('Player Generation', () => {
  describe('generate', () => {
    it('should generate a player with all required attributes', () => {
      const player = generate(1, 22, 2025, 'QB');
      
      expect(player.pid).toBe(0);
      expect(player.tid).toBe(1);
      expect(player.name).toBeDefined();
      expect(player.name.length).toBeGreaterThan(0);
      expect(player.age).toBe(22);
      expect(player.bornYear).toBe(2003);
      expect(player.pos).toBe('QB');
      
      expect(player.hgt).toBeGreaterThanOrEqual(0);
      expect(player.hgt).toBeLessThanOrEqual(100);
      expect(player.stre).toBeGreaterThanOrEqual(0);
      expect(player.stre).toBeLessThanOrEqual(100);
      expect(player.spd).toBeGreaterThanOrEqual(0);
      expect(player.spd).toBeLessThanOrEqual(100);
      expect(player.thv).toBeGreaterThanOrEqual(0);
      expect(player.thv).toBeLessThanOrEqual(100);
      
      expect(player.ovr).toBeGreaterThanOrEqual(0);
      expect(player.ovr).toBeLessThanOrEqual(100);
      expect(player.pot).toBeGreaterThanOrEqual(0);
      expect(player.pot).toBeLessThanOrEqual(100);
      
      expect(player.ovrs).toBeDefined();
      expect(player.pots).toBeDefined();
      expect(player.draft).toBeDefined();
      expect(player.draft.year).toBe(2025);
    });

    it('should generate different ratings for different positions', () => {
      const qb = generate(1, 22, 2025, 'QB');
      const rb = generate(1, 22, 2025, 'RB');
      const dl = generate(1, 22, 2025, 'DL');
      
      // Check that positions are correct
      expect(qb.pos).toBe('QB');
      expect(rb.pos).toBe('RB');
      expect(dl.pos).toBe('DL');
      
      // Check that OVRs are in valid range
      expect(qb.ovr).toBeGreaterThanOrEqual(0);
      expect(qb.ovr).toBeLessThanOrEqual(100);
      expect(rb.ovr).toBeGreaterThanOrEqual(0);
      expect(rb.ovr).toBeLessThanOrEqual(100);
      expect(dl.ovr).toBeGreaterThanOrEqual(0);
      expect(dl.ovr).toBeLessThanOrEqual(100);
    });

    it('should generate players with unique names', () => {
      const names = new Set();
      for (let i = 0; i < 10; i++) {
        const player = generate(1, 22, 2025);
        names.add(player.name);
      }
      expect(names.size).toBeGreaterThan(5);
    });
  });

  describe('develop', () => {
    it('should improve young players', () => {
      const player = generate(1, 21, 2025, 'QB');
      const initialOvr = player.ovr;
      const initialThv = player.thv;
      
      develop(player, 1);
      
      expect(player.age).toBe(22);
      expect(player.ovr).toBeGreaterThanOrEqual(initialOvr - 5);
    });

    it('should decline older players', () => {
      const player = generate(1, 35, 2025, 'QB');
      const initialOvr = player.ovr;
      
      develop(player, 1);
      
      expect(player.age).toBe(36);
    });
  });

  describe('generatePotential', () => {
    it('should generate potential within valid range', () => {
      for (let i = 0; i < 20; i++) {
        const pot = generatePotential();
        expect(pot).toBeGreaterThanOrEqual(0);
        expect(pot).toBeLessThanOrEqual(100);
      }
    });

    it('should generate varied potential values', () => {
      const pots = [];
      for (let i = 0; i < 50; i++) {
        pots.push(generatePotential());
      }
      const unique = new Set(pots);
      expect(unique.size).toBeGreaterThan(10);
    });
  });

  describe('generateRatings', () => {
    it('should generate position-appropriate ratings', () => {
      const qbRatings = generateRatings('QB');
      const rbRatings = generateRatings('RB');
      const kRatings = generateRatings('K');
      
      // Check that ratings are in valid range
      expect(qbRatings.thv).toBeGreaterThanOrEqual(0);
      expect(qbRatings.thv).toBeLessThanOrEqual(100);
      expect(rbRatings.spd).toBeGreaterThanOrEqual(0);
      expect(rbRatings.spd).toBeLessThanOrEqual(100);
      expect(kRatings.kpw).toBeGreaterThanOrEqual(0);
      expect(kRatings.kpw).toBeLessThanOrEqual(100);
    });
  });
});
