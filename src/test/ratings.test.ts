import { describe, it, expect, beforeEach, vi } from 'vitest';
import { calculateOvr, calculateAllOvrs, calculateCompositeRatings } from '../worker/core/player/ovr';
import type { Position } from '../common/types';
import type { Player } from '../common/entities';

const mockPlayerRatings = {
  hgt: 70,
  stre: 65,
  spd: 80,
  endu: 75,
  thv: 85,
  thp: 80,
  tha: 82,
  bsc: 70,
  elu: 75,
  rtr: 72,
  hnd: 78,
  rbk: 60,
  pbk: 58,
  pcv: 55,
  tck: 62,
  prs: 50,
  rns: 58,
  kpw: 30,
  kac: 35,
  ppw: 28,
  pac: 32,
  fuzz: 5,
  ovr: 75,
  pot: 80,
};

describe('Rating Calculations', () => {
  describe('calculateOvr', () => {
    it('should calculate QB overall rating correctly', () => {
      const ovr = calculateOvr(mockPlayerRatings as any, 'QB');
      expect(ovr).toBeGreaterThan(0);
      expect(ovr).toBeLessThanOrEqual(100);
      // QB OVR should be reasonable for these ratings
      expect(ovr).toBeGreaterThan(50);
      expect(ovr).toBeLessThan(100);
    });

    it('should calculate RB overall rating correctly', () => {
      const ovr = calculateOvr(mockPlayerRatings as any, 'RB');
      expect(ovr).toBeGreaterThan(0);
      expect(ovr).toBeLessThanOrEqual(100);
    });

    it('should calculate WR overall rating correctly', () => {
      const ovr = calculateOvr(mockPlayerRatings as any, 'WR');
      expect(ovr).toBeGreaterThan(0);
      expect(ovr).toBeLessThanOrEqual(100);
    });

    it('should calculate OL overall rating correctly', () => {
      const ovr = calculateOvr(mockPlayerRatings as any, 'OL');
      expect(ovr).toBeGreaterThan(0);
      expect(ovr).toBeLessThanOrEqual(100);
    });

    it('should calculate DL overall rating correctly', () => {
      const ovr = calculateOvr(mockPlayerRatings as any, 'DL');
      expect(ovr).toBeGreaterThan(0);
      expect(ovr).toBeLessThanOrEqual(100);
    });

    it('should calculate LB overall rating correctly', () => {
      const ovr = calculateOvr(mockPlayerRatings as any, 'LB');
      expect(ovr).toBeGreaterThan(0);
      expect(ovr).toBeLessThanOrEqual(100);
    });

    it('should calculate CB overall rating correctly', () => {
      const ovr = calculateOvr(mockPlayerRatings as any, 'CB');
      expect(ovr).toBeGreaterThan(0);
      expect(ovr).toBeLessThanOrEqual(100);
    });

    it('should calculate S overall rating correctly', () => {
      const ovr = calculateOvr(mockPlayerRatings as any, 'S');
      expect(ovr).toBeGreaterThan(0);
      expect(ovr).toBeLessThanOrEqual(100);
    });

    it('should calculate K overall rating correctly', () => {
      const ovr = calculateOvr(mockPlayerRatings as any, 'K');
      expect(ovr).toBeGreaterThan(0);
      expect(ovr).toBeLessThanOrEqual(100);
    });

    it('should calculate P overall rating correctly', () => {
      const ovr = calculateOvr(mockPlayerRatings as any, 'P');
      expect(ovr).toBeGreaterThan(0);
      expect(ovr).toBeLessThanOrEqual(100);
    });
  });

  describe('calculateAllOvrs', () => {
    it('should calculate ovr for all positions', () => {
      const ovrs = calculateAllOvrs(mockPlayerRatings as any);
      
      // Check core positions exist
      expect(ovrs.QB).toBeDefined();
      expect(ovrs.RB).toBeDefined();
      expect(ovrs.WR).toBeDefined();
      expect(ovrs.TE).toBeDefined();
      expect(ovrs.OL).toBeDefined();
      expect(ovrs.DL).toBeDefined();
      expect(ovrs.LB).toBeDefined();
      expect(ovrs.CB).toBeDefined();
      expect(ovrs.S).toBeDefined();
      expect(ovrs.K).toBeDefined();
      expect(ovrs.P).toBeDefined();
      
      // KR/PR may or may not exist depending on implementation
      Object.values(ovrs).forEach(ovr => {
        expect(ovr).toBeGreaterThanOrEqual(0);
        expect(ovr).toBeLessThanOrEqual(100);
      });
    });
  });

  describe('calculateCompositeRatings', () => {
    it('should calculate all composite ratings', () => {
      const composite = calculateCompositeRatings(mockPlayerRatings as any);
      
      // Check that all composite ratings exist and are in valid range
      expect(composite.passingAccuracy).toBeGreaterThanOrEqual(0);
      expect(composite.passingAccuracy).toBeLessThanOrEqual(100);
      expect(composite.passingDeep).toBeGreaterThanOrEqual(0);
      expect(composite.passingDeep).toBeLessThanOrEqual(100);
      expect(composite.passingVision).toBeGreaterThanOrEqual(0);
      expect(composite.passingVision).toBeLessThanOrEqual(100);
      expect(composite.athleticism).toBeGreaterThanOrEqual(0);
      expect(composite.athleticism).toBeLessThanOrEqual(100);
      expect(composite.rushing).toBeGreaterThanOrEqual(0);
      expect(composite.rushing).toBeLessThanOrEqual(100);
      expect(composite.catching).toBeGreaterThanOrEqual(0);
      expect(composite.catching).toBeLessThanOrEqual(100);
      expect(composite.gettingOpen).toBeGreaterThanOrEqual(0);
      expect(composite.gettingOpen).toBeLessThanOrEqual(100);
      expect(composite.passBlocking).toBeGreaterThanOrEqual(0);
      expect(composite.passBlocking).toBeLessThanOrEqual(100);
      expect(composite.runBlocking).toBeGreaterThanOrEqual(0);
      expect(composite.runBlocking).toBeLessThanOrEqual(100);
      expect(composite.passRushing).toBeGreaterThanOrEqual(0);
      expect(composite.passRushing).toBeLessThanOrEqual(100);
      expect(composite.runStopping).toBeGreaterThanOrEqual(0);
      expect(composite.runStopping).toBeLessThanOrEqual(100);
      expect(composite.passCoverage).toBeGreaterThanOrEqual(0);
      expect(composite.passCoverage).toBeLessThanOrEqual(100);
      expect(composite.tackling).toBeGreaterThanOrEqual(0);
      expect(composite.tackling).toBeLessThanOrEqual(100);
      expect(composite.avoidingSacks).toBeGreaterThanOrEqual(0);
      expect(composite.avoidingSacks).toBeLessThanOrEqual(100);
      expect(composite.ballSecurity).toBeGreaterThanOrEqual(0);
      expect(composite.ballSecurity).toBeLessThanOrEqual(100);
      expect(composite.endurance).toBeGreaterThanOrEqual(0);
      expect(composite.endurance).toBeLessThanOrEqual(100);
    });
  });
});
