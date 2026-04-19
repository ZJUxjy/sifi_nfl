/**
 * Player Retirement System
 * Handles player retirement decisions based on age, performance, and injuries
 */

import type { Player } from '@common/entities';

// Retirement thresholds
const RETIREMENT_CONFIG = {
  // Base retirement chance by age
  baseChanceByAge: {
    30: 0.02,  // 2% at age 30
    31: 0.05,  // 5% at age 31
    32: 0.10,  // 10% at age 32
    33: 0.20,  // 20% at age 33
    34: 0.35,  // 35% at age 34
    35: 0.50,  // 50% at age 35
    36: 0.70,  // 70% at age 36
    37: 0.85,  // 85% at age 37
    38: 0.95,  // 95% at age 38
    39: 1.00,  // 100% at age 39+
  },
  // OVR modifiers (higher OVR = lower retirement chance)
  ovrModifiers: {
    elite: -0.30,      // OVR 85+ : 30% less likely to retire
    strong: -0.15,     // OVR 75-84: 15% less likely
    average: 0,        // OVR 60-74: no modifier
    weak: 0.20,        // OVR < 60: 20% more likely
  },
  // Injury history modifier
  injuryModifier: 0.05, // 5% more likely per serious injury
  // Forced retirement at age
  maxAge: 45,
};

/**
 * Calculate retirement chance for a player
 */
export function calculateRetirementChance(player: Player): number {
  const age = player.age;

  // Players under 30 rarely retire
  if (age < 30) {
    return 0;
  }

  // Force retirement at max age
  if (age >= RETIREMENT_CONFIG.maxAge) {
    return 1;
  }

  // Get base chance from age
  let baseChance = 0;
  const ageThresholds = Object.keys(RETIREMENT_CONFIG.baseChanceByAge)
    .map(Number)
    .sort((a, b) => a - b);

  for (const threshold of ageThresholds) {
    if (age >= threshold) {
      baseChance = RETIREMENT_CONFIG.baseChanceByAge[threshold as keyof typeof RETIREMENT_CONFIG.baseChanceByAge];
    }
  }

  // Apply OVR modifier
  const ovr = player.ovr || 50;
  let ovrModifier = 0;
  if (ovr >= 85) {
    ovrModifier = RETIREMENT_CONFIG.ovrModifiers.elite;
  } else if (ovr >= 75) {
    ovrModifier = RETIREMENT_CONFIG.ovrModifiers.strong;
  } else if (ovr >= 60) {
    ovrModifier = RETIREMENT_CONFIG.ovrModifiers.average;
  } else {
    ovrModifier = RETIREMENT_CONFIG.ovrModifiers.weak;
  }

  // Apply injury history modifier
  const injuryCount = player.injuryHistory?.length || 0;
  const injuryModifier = injuryCount * RETIREMENT_CONFIG.injuryModifier;

  // Calculate final chance
  const finalChance = Math.max(0, Math.min(1, baseChance + ovrModifier + injuryModifier));

  return finalChance;
}

/**
 * Check if a player should retire
 */
export function shouldRetire(player: Player): boolean {
  const chance = calculateRetirementChance(player);
  return Math.random() < chance;
}

/**
 * Process retirements for all players
 * Returns list of retired players
 */
export function processRetirements(
  players: Player[],
  season: number
): { retired: Player[]; active: Player[] } {
  const retired: Player[] = [];
  const active: Player[] = [];

  for (const player of players) {
    // Only process players on teams (free agents handled separately)
    if (player.tid === undefined || player.tid < 0) {
      active.push(player);
      continue;
    }

    if (shouldRetire(player)) {
      // Mark as retired
      player.retiredYear = season;
      player.tid = undefined; // Remove from team
      retired.push(player);
    } else {
      active.push(player);
    }
  }

  return { retired, active };
}

/**
 * Calculate Hall of Fame chance for a retired player
 * Based on career achievements, OVR, and longevity
 */
export function calculateHallOfFameChance(player: Player): number {
  // Must be retired
  if (!player.retiredYear) {
    return 0;
  }

  let chance = 0;

  // Peak OVR contribution
  const peakOvr = player.ovr || 50;
  if (peakOvr >= 90) chance += 0.50;
  else if (peakOvr >= 85) chance += 0.30;
  else if (peakOvr >= 80) chance += 0.15;
  else if (peakOvr >= 75) chance += 0.05;

  // Career length contribution
  const careerLength = player.retiredYear - (player.draft?.year || player.retiredYear);
  if (careerLength >= 15) chance += 0.30;
  else if (careerLength >= 12) chance += 0.20;
  else if (careerLength >= 10) chance += 0.10;
  else if (careerLength >= 8) chance += 0.05;

  // Age contribution (retiring at peak age is good)
  if (player.age >= 35) chance += 0.10;
  else if (player.age >= 32) chance += 0.05;

  // Potential contribution (high potential = better career trajectory)
  const pot = player.pot || 50;
  if (pot >= 80) chance += 0.10;
  else if (pot >= 70) chance += 0.05;

  return Math.min(1, chance);
}

/**
 * Check if player qualifies for Hall of Fame
 */
export function qualifiesForHallOfFame(player: Player): boolean {
  const chance = calculateHallOfFameChance(player);
  return Math.random() < chance;
}

/**
 * Get retirement reason text
 */
export function getRetirementReason(player: Player): string {
  const age = player.age;
  const ovr = player.ovr || 50;

  if (age >= 40) {
    return 'Age has caught up with them after a long career';
  } else if (age >= 35 && ovr < 70) {
    return 'Declining skills have led to retirement';
  } else if ((player.injuryHistory?.length || 0) > 3) {
    return 'Injury history has taken its toll';
  } else if (ovr < 60) {
    return 'No longer able to compete at this level';
  } else {
    return 'Decided to retire while still competitive';
  }
}

export { RETIREMENT_CONFIG };
