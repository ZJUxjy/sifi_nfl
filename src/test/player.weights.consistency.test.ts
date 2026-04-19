import { describe, it, expect, beforeEach } from 'vitest';
import { generate } from '../worker/core/player/generate';
import {
  calculateOvr,
  POSITION_RATING_WEIGHTS,
  RATINGS_KEYS,
} from '../worker/core/player/ovr';
import { setSeed } from '../common/random';
import type { Position } from '../common/types';

// Long-term anti-drift sentinel for the per-position rating-weight system.
//
// The two "views" of per-position weighting live in different shapes:
//   - generate.ts uses POSITION_RATING_WEIGHTS (full table, 21 ratings each)
//     to bias rating distributions during player creation.
//   - ovr.ts uses inline switch formulas (subset of 4-6 ratings per position)
//     to compute a player's OVR.
//
// They cannot be unified into one literal table without losing information,
// but they MUST stay directionally aligned: positions whose OVR formula
// emphasizes a rating should also generate that rating with a higher mean.
// This test catches drift between the two by sampling enough players to make
// the per-position bias statistically clear.
//
// Threshold rationale: the current formula in generateRatings produces
//   adjustedMean = 50 + (weight - 1) * 5
// so for the strongest contrast (weight 2.0 vs 0.1) the expected per-rating
// mean gap is ~9.5. With n=1000 + truncation/rounding the realised gap lands
// in the 7-9 range, so a > 5 threshold is a robust sentinel: it stays green
// for current behaviour but flips to red if anyone halves the bias spread or
// inverts a position's weights.

const SAMPLE_SIZE = 1000;
const DRAFT_YEAR = 2026;
const AGE = 25;
const RATING_GAP_THRESHOLD = 5;
const OVR_DIRECTION_GAP_THRESHOLD = 2;

type RatingKey = (typeof RATINGS_KEYS)[number];

function meanRatings(pos: Position, n: number): Record<RatingKey, number> {
  const sums = {} as Record<RatingKey, number>;
  for (const k of RATINGS_KEYS) sums[k] = 0;

  for (let i = 0; i < n; i++) {
    const p = generate(0, AGE, DRAFT_YEAR, pos);
    for (const k of RATINGS_KEYS) sums[k] += (p as any)[k];
  }

  const out = {} as Record<RatingKey, number>;
  for (const k of RATINGS_KEYS) out[k] = sums[k] / n;
  return out;
}

function meanOvr(pos: Position, evalAs: Position, n: number): number {
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const p = generate(0, AGE, DRAFT_YEAR, pos);
    sum += calculateOvr(p as any, evalAs);
  }
  return sum / n;
}

describe('Player weight consistency (generate.ts ↔ ovr.ts)', () => {
  // Seed the PRNG so every assertion sees the same stream — eliminates the
  // sample-noise flakiness that would otherwise plague threshold checks on
  // an averaged-out signal like OVR. Verified that all assertions hold for
  // seeds 1, 42, 12345, 0xC0FFEE; this seed is just an arbitrary fixed value
  // for reproducibility.
  beforeEach(() => {
    setSeed(0xC0FFEE);
  });

  it('exposes a single POSITION_RATING_WEIGHTS table covering every position × every rating key', () => {
    const positions: Position[] = ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'CB', 'S', 'K', 'P', 'KR', 'PR'];
    for (const pos of positions) {
      const row = POSITION_RATING_WEIGHTS[pos];
      expect(row, `missing weight row for ${pos}`).toBeDefined();
      for (const k of RATINGS_KEYS) {
        expect(typeof row[k], `${pos}.${k} missing or non-numeric`).toBe('number');
        expect(row[k]).toBeGreaterThan(0);
      }
    }
  });

  it('QB generation biases passing ratings (thv/thp/tha) higher than OL', () => {
    const qbMeans = meanRatings('QB', SAMPLE_SIZE);
    const olMeans = meanRatings('OL', SAMPLE_SIZE);

    // OVR formula for QB leans on thv/thp/tha — generation MUST bias them up.
    expect(qbMeans.thv).toBeGreaterThan(olMeans.thv + RATING_GAP_THRESHOLD);
    expect(qbMeans.thp).toBeGreaterThan(olMeans.thp + RATING_GAP_THRESHOLD);
    expect(qbMeans.tha).toBeGreaterThan(olMeans.tha + RATING_GAP_THRESHOLD);
  });

  it('OL generation biases blocking & strength ratings (stre/rbk/pbk) higher than QB', () => {
    const qbMeans = meanRatings('QB', SAMPLE_SIZE);
    const olMeans = meanRatings('OL', SAMPLE_SIZE);

    // OVR formula for OL: (stre*2 + rbk + pbk) / 4 — generation MUST bias them up.
    expect(olMeans.stre).toBeGreaterThan(qbMeans.stre + RATING_GAP_THRESHOLD);
    expect(olMeans.rbk).toBeGreaterThan(qbMeans.rbk + RATING_GAP_THRESHOLD);
    expect(olMeans.pbk).toBeGreaterThan(qbMeans.pbk + RATING_GAP_THRESHOLD);
  });

  it('CB generation biases coverage rating (pcv) higher than DL', () => {
    const cbMeans = meanRatings('CB', SAMPLE_SIZE);
    const dlMeans = meanRatings('DL', SAMPLE_SIZE);

    expect(cbMeans.pcv).toBeGreaterThan(dlMeans.pcv + RATING_GAP_THRESHOLD);
    // And vice versa: DL prs (pass-rush) higher than CB
    expect(dlMeans.prs).toBeGreaterThan(cbMeans.prs + RATING_GAP_THRESHOLD);
  });

  it('K generation biases kicking ratings (kpw/kac) higher than QB', () => {
    const kMeans = meanRatings('K', SAMPLE_SIZE);
    const qbMeans = meanRatings('QB', SAMPLE_SIZE);

    expect(kMeans.kpw).toBeGreaterThan(qbMeans.kpw + RATING_GAP_THRESHOLD);
    expect(kMeans.kac).toBeGreaterThan(qbMeans.kac + RATING_GAP_THRESHOLD);
  });

  it('OVR formula confirms direction: QB-generated players score higher under QB formula than under OL formula', () => {
    // Catches the case where someone "fixes" the generate weights but forgets
    // the ovr formula (or vice versa). We only assert the direction with the
    // strongest signal — the QB OVR formula heavily weights thv (×2) which
    // generation biases up by 9.5 points for QBs, so the gap survives the
    // averaging across 6 components. The reverse direction (OL-generated
    // scoring higher under OL formula than QB formula) was deliberately not
    // asserted: the OL formula averages stre with rbk/pbk and the QB formula
    // averages 6 ratings, so the gap collapses to ~0.5-1.5 OVR points which
    // is below the noise floor at any practical sample size.
    const qbAsQb = meanOvr('QB', 'QB', SAMPLE_SIZE);
    const qbAsOl = meanOvr('QB', 'OL', SAMPLE_SIZE);
    expect(qbAsQb - qbAsOl).toBeGreaterThan(OVR_DIRECTION_GAP_THRESHOLD);
  });
});
