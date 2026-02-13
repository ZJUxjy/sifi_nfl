import fs from 'fs';
import path from 'path';

const SAVES_DIR = path.join(process.cwd(), 'data', 'saves');

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
