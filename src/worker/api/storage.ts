/**
 * SIFI NFL IndexedDB Storage
 * 世界数据缓存和游戏存档管理
 */

const DB_NAME = 'sifi-nfl-db';
const DB_VERSION = 1;
const STORE_WORLD = 'world';
const STORE_SAVES = 'saves';

// Open IndexedDB
export async function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create world store for caching teams/players
      if (!db.objectStoreNames.contains(STORE_WORLD)) {
        const worldStore = db.createObjectStore(STORE_WORLD, { keyPath: 'season' });
        worldStore.createIndex('timestamp', 'timestamp', { unique: false });
      }

      // Create saves store
      if (!db.objectStoreNames.contains(STORE_SAVES)) {
        const savesStore = db.createObjectStore(STORE_SAVES, { keyPath: 'name' });
        savesStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });
}

// === World Data Caching ===
interface WorldData {
  season: number;
  teams: any[];
  players: any[];
  freeAgents: any[];
  timestamp: number;
}

export async function saveWorldData(data: WorldData): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_WORLD], 'readwrite');
    const store = transaction.objectStore(STORE_WORLD);
    const request = store.put(data);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function loadWorldData(): Promise<WorldData | null> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_WORLD], 'readonly');
    const store = transaction.objectStore(STORE_WORLD);
    const request = store.get(2025); // Default season

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

export async function clearWorldData(): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_WORLD], 'readwrite');
    const store = transaction.objectStore(STORE_WORLD);
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// === Game Saves ===
export async function saveGame(name: string, saveData: any): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_SAVES], 'readwrite');
    const store = transaction.objectStore(STORE_SAVES);
    const request = store.put({ ...saveData, name });

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function loadGame(name: string): Promise<any> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_SAVES], 'readonly');
    const store = transaction.objectStore(STORE_SAVES);
    const request = store.get(name);

    request.onsuccess = () => {
      if (request.result) {
        resolve(request.result);
      } else {
        reject(new Error(`Save not found: ${name}`));
      }
    };
    request.onerror = () => reject(request.error);
  });
}

export async function deleteGame(name: string): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_SAVES], 'readwrite');
    const store = transaction.objectStore(STORE_SAVES);
    const request = store.delete(name);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function listSaves(): Promise<any[]> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_SAVES], 'readonly');
    const store = transaction.objectStore(STORE_SAVES);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}
