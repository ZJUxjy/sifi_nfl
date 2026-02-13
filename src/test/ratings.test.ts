import { describe, it, expect, beforeEach, vi } from 'vitest';
import { calculateOvr, calculateAllOvrs, calculateCompositeRatings } from '../worker/core/player/ovr';
import type { Player, Position } from '../common/types';

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
      expect(ovr).toBe(79);
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
      expect(ovr).toBe(32);
    });

    it('should calculate P overall rating correctly', () => {
      const ovr = calculateOvr(mockPlayerRatings as any, 'P');
      expect(ovr).toBe(30);
    });
  });

  describe('calculateAllOvrs', () => {
    it('should calculate ovr for all positions', () => {
      const ovrs = calculateAllOvrs(mockPlayerRatings as any);
      
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
      expect(ovrs.KR).toBeDefined();
      expect(ovrs.PR).toBeDefined();
      
      Object.values(ovrs).forEach(ovr => {
        expect(ovr).toBeGreaterThanOrEqual(0);
        expect(ovr).toBeLessThanOrEqual(100);
      });
    });
  });

  describe('calculateCompositeRatings', () => {
    it('should calculate all composite ratings', () => {
      const composite = calculateCompositeRatings(mockPlayerRatings as any);
      
      expect(composite.passingAccuracy).toBe(83.5);
      expect(composite.passingDeep).toBe(82.5);
      expect(composite.passingVision).toBe(85);
      expect(composite.athleticism).toBe(78.33333333333333);
      expect(composite.rushing).toBe(74.25);
      expect(composite.catching).toBe(77.66666666666667);
      expect(composite.gettingOpen).toBe(77.5);
      expect(composite.passBlocking).toBe(59.333333333333336);
      expect(composite.runBlocking).toBe(59.333333333333336);
      expect(composite.passRushing).toBe(58);
      expect(composite.runStopping).toBe(61.666666666666664);
      expect(composite.passCoverage).toBe(63.333333333333336);
      expect(composite.tackling).toBe(68);
      expect(composite.avoidingSacks).toBe(77.5);
      expect(composite.ballSecurity).toBe(74);
      expect(composite.endurance).toBe(75);
    });
  });
});
