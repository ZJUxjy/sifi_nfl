#!/usr/bin/env tsx
/**
 * Generate initial game data and save to JSON files
 * Run this script with: tsx scripts/generateInitialData.ts
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import from worker core
import { generateAllTeams } from '../src/worker/core/team/generate';

const DATA_DIR = path.join(__dirname, '../src/data');

async function generate() {
  console.log('🏈 Generating SIFI NFL initial data...');

  // Generate all teams and players
  const { teams, players } = generateAllTeams(2025);

  console.log(`✓ Generated ${teams.length} teams`);
  console.log(`✓ Generated ${players.length} players`);

  // Create data directory if it doesn't exist
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  // Save teams data
  const teamsPath = path.join(DATA_DIR, 'initial-teams.json');
  fs.writeFileSync(teamsPath, JSON.stringify(teams, null, 2));
  console.log(`✓ Saved teams to ${teamsPath}`);

  // Save players data
  const playersPath = path.join(DATA_DIR, 'initial-players.json');
  fs.writeFileSync(playersPath, JSON.stringify(players, null, 2));
  console.log(`✓ Saved players to ${playersPath}`);

  // Save metadata
  const metadataPath = path.join(DATA_DIR, 'metadata.json');
  fs.writeFileSync(
    metadataPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        season: 2025,
        teamsCount: teams.length,
        playersCount: players.length,
      },
      null,
      2
    )
  );
  console.log(`✓ Saved metadata to ${metadataPath}`);

  console.log('\n✅ Done! Initial data generated successfully.');
  console.log('\nYou can now start the game and it will load from these files.');
}

generate().catch(console.error);
