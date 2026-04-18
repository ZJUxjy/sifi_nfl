import fs from 'fs';
import path from 'path';

const SAVES_DIR = path.join(process.cwd(), 'data', 'saves');

// Save ids are produced by saveGame() as `save_${Date.now()}`, so a
// strict `save_<digits>` whitelist exactly matches what we generate and
// rejects anything that could escape SAVES_DIR (`..`, slashes, NUL,
// backslashes on Windows, etc.). Validate at the public API boundary.
const SAVE_ID_RE = /^save_\d+$/;

function assertValidSaveId(id: string): void {
  if (typeof id !== 'string' || !SAVE_ID_RE.test(id)) {
    throw new Error(`invalid save id: ${JSON.stringify(id)}`);
  }
}

export type SaveGame = {
  id: string;
  name: string;
  timestamp: number;
  seasonYear: number;
  currentWeek: number;
  userTeamName: string;
  userTeamRegion: string;
  data: SaveData;
};

export type SaveData = {
  teams: any[];
  players: any[];
  freeAgents?: any[];
  seasonYear: number;
  currentWeek: number;
  schedule: any[];
  standings: any[];
  userTeamTid: number;
};

function ensureSavesDir(): void {
  if (!fs.existsSync(SAVES_DIR)) {
    fs.mkdirSync(SAVES_DIR, { recursive: true });
  }
}

export function listSaves(): SaveGame[] {
  ensureSavesDir();
  
  const files = fs.readdirSync(SAVES_DIR).filter(f => f.endsWith('.json'));
  const saves: SaveGame[] = [];
  
  for (const file of files) {
    try {
      const filePath = path.join(SAVES_DIR, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const save = JSON.parse(content) as SaveGame;
      saves.push(save);
    } catch (e) {
      console.error(`Error reading save file ${file}:`, e);
    }
  }
  
  return saves.sort((a, b) => b.timestamp - a.timestamp);
}

export function saveGame(name: string, data: SaveData): SaveGame {
  ensureSavesDir();
  
  const id = `save_${Date.now()}`;
  const save: SaveGame = {
    id,
    name,
    timestamp: Date.now(),
    seasonYear: data.seasonYear,
    currentWeek: data.currentWeek,
    userTeamName: data.teams.find(t => t.tid === data.userTeamTid)?.name || 'Unknown',
    userTeamRegion: data.teams.find(t => t.tid === data.userTeamTid)?.region || 'Unknown',
    data,
  };
  
  const filePath = path.join(SAVES_DIR, `${id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(save, null, 2));
  
  return save;
}

export function loadGame(id: string): SaveGame | null {
  assertValidSaveId(id);
  ensureSavesDir();

  const filePath = path.join(SAVES_DIR, `${id}.json`);
  
  if (!fs.existsSync(filePath)) {
    return null;
  }
  
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as SaveGame;
  } catch (e) {
    console.error(`Error loading save ${id}:`, e);
    return null;
  }
}

export function deleteSave(id: string): boolean {
  assertValidSaveId(id);
  ensureSavesDir();

  const filePath = path.join(SAVES_DIR, `${id}.json`);
  
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    return true;
  }
  
  return false;
}

export function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
