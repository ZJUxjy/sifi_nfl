import { Cache } from './Cache';
import { connectLeague, getDB, resetDB, LeagueDB } from './connectLeague';

let cache: Cache | undefined;

export const idb = {
  league: {
    async create() {
    },
    async delete(lid: number) {
      const dbs = await window.indexedDB.databases();
      for (const db of dbs) {
        if (db.name === `league${lid}`) {
          await new Promise<void>((resolve, reject) => {
            const request = window.indexedDB.deleteDatabase(`league${lid}`);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
          });
        }
      }
    },
  },

  async connectLeague(lid: number) {
    if (cache) {
      await cache.stopAutoFlush();
    }
    await resetDB();
    await connectLeague(lid);
    cache = new Cache();
    await cache.fill(lid);
    return cache;
  },

  get cache() {
    return cache;
  },

  get db() {
    return getDB();
  },

  reset() {
    cache = undefined;
    resetDB();
  },
};

export { connectLeague, getDB, resetDB };
export type { LeagueDB };
