import type { IDBPDatabase, IDBPTransaction } from '@dumbmatter/idb';
import type { LeagueDB } from './connectLeague';
import type { DraftPick } from '../../common/types';
import type {
  Player,
  Team,
  Game,
  ScheduleGame,
  Event,
  PlayoffSeries,
  TeamSeason,
  TeamStats,
  SeasonLeaders,
  Negotiation,
  ReleasedPlayer,
  SavedTrade,
  AllStars,
  Awards,
  HeadToHead,
  PlayerFeat,
  SavedTradingBlock,
  ScheduledEvent,
} from '../../common/entities';

export type Store =
  | 'players'
  | 'teams'
  | 'games'
  | 'schedule'
  | 'draftPicks'
  | 'draftLotteryResults'
  | 'events'
  | 'gameAttributes'
  | 'playoffSeries'
  | 'teamSeasons'
  | 'teamStats'
  | 'seasonLeaders'
  | 'negotiations'
  | 'releasedPlayers'
  | 'savedTrades'
  | 'savedTradingBlock'
  | 'allStars'
  | 'awards'
  | 'headToHeads'
  | 'playerFeats'
  | 'scheduledEvents';

export type Index =
  | 'players.byTid'
  | 'players.byDraftYearRetiredYear'
  | 'games.bySeason'
  | 'schedule.bySeason'
  | 'schedule.byTid'
  | 'draftPicks.bySeason'
  | 'draftPicks.byTid'
  | 'events.bySeason'
  | 'playoffSeries.bySeason'
  | 'teamSeasons.bySeasonTid'
  | 'teamSeasons.byTidSeason'
  | 'teamStats.byPlayoffsTid'
  | 'releasedPlayers.byTid'
  | 'headToHeads.bySeason'
  | 'scheduledEvents.bySeason';

const STORES: Store[] = [
  'players',
  'teams',
  'games',
  'schedule',
  'draftPicks',
  'draftLotteryResults',
  'events',
  'gameAttributes',
  'playoffSeries',
  'teamSeasons',
  'teamStats',
  'seasonLeaders',
  'negotiations',
  'releasedPlayers',
  'savedTrades',
  'savedTradingBlock',
  'allStars',
  'awards',
  'headToHeads',
  'playerFeats',
  'scheduledEvents',
];

const AUTO_FLUSH_INTERVAL = 4000;

export class Cache {
  private _data: Record<Store, Map<number | string, any>> = {} as any;
  private _dirty: boolean = false;
  private _dirtyRecords: Record<Store, Set<number | string>> = {} as any;
  private _deletes: Record<Store, Set<number | string>> = {} as any;
  private _maxIds: Record<Store, number> = {} as any;
  private _autoFlushIntervalId: number | undefined;
  private _stopAutoFlush: boolean = false;
  private _db: IDBPDatabase<LeagueDB> | undefined;

  constructor() {
    for (const store of STORES) {
      this._data[store] = new Map();
      this._dirtyRecords[store] = new Set();
      this._deletes[store] = new Set();
      this._maxIds[store] = 0;
    }
  }

  async fill(lid: number): Promise<void> {
    const { connectLeague } = await import('./connectLeague');
    this._db = await connectLeague(lid);

    const tx = this._db.transaction(STORES, 'readonly');

    for (const store of STORES) {
      const allRecords = await tx.objectStore(store).getAll();
      for (const record of allRecords) {
        const pk = this._getPrimaryKey(store, record);
        this._data[store].set(pk, record);
        if (typeof pk === 'number' && pk > this._maxIds[store]) {
          this._maxIds[store] = pk;
        }
      }
    }

    await tx.done;
    this._startAutoFlush();
  }

  private _getPrimaryKey(store: Store, record: any): number | string {
    switch (store) {
      case 'players':
        return record.pid;
      case 'teams':
        return record.tid;
      case 'games':
      case 'schedule':
        return record.gid;
      case 'draftPicks':
        return record.dpid;
      case 'draftLotteryResults':
      case 'playoffSeries':
      case 'allStars':
      case 'awards':
      case 'headToHeads':
      case 'seasonLeaders':
        return record.season;
      case 'events':
        return record.eid;
      case 'playerFeats':
        return record.fid;
      case 'negotiations':
        return record.pid;
      case 'releasedPlayers':
      case 'savedTradingBlock':
      case 'teamSeasons':
      case 'teamStats':
        return record.rid;
      case 'savedTrades':
        return record.hash;
      case 'gameAttributes':
        return record.key;
      case 'scheduledEvents':
        return record.id;
      default:
        return record.id ?? 0;
    }
  }

  private _startAutoFlush(): void {
    if (this._autoFlushIntervalId) {
      window.clearInterval(this._autoFlushIntervalId);
    }
    this._autoFlushIntervalId = window.setInterval(() => {
      if (!this._stopAutoFlush && this._dirty) {
        this.flush();
      }
    }, AUTO_FLUSH_INTERVAL);
  }

  async stopAutoFlush(): Promise<void> {
    this._stopAutoFlush = true;
    if (this._autoFlushIntervalId) {
      window.clearInterval(this._autoFlushIntervalId);
      this._autoFlushIntervalId = undefined;
    }
    if (this._dirty) {
      await this.flush();
    }
  }

  async flush(): Promise<void> {
    if (!this._db || !this._dirty) {
      return;
    }

    const tx = this._db.transaction(STORES, 'readwrite');

    for (const store of STORES) {
      const deletes = this._deletes[store];
      for (const pk of deletes) {
        await tx.objectStore(store).delete(pk);
      }
      deletes.clear();

      const dirtyRecords = this._dirtyRecords[store];
      for (const pk of dirtyRecords) {
        const record = this._data[store].get(pk);
        if (record) {
          await tx.objectStore(store).put(record);
        }
      }
      dirtyRecords.clear();
    }

    await tx.done;
    this._dirty = false;
  }

  private _markDirty(store: Store, pk: number | string): void {
    this._dirty = true;
    this._dirtyRecords[store].add(pk);
  }

  async get<T>(store: Store, pk: number | string): Promise<T | undefined> {
    return this._data[store].get(pk) as T | undefined;
  }

  async getAll<T>(store: Store): Promise<T[]> {
    return Array.from(this._data[store].values()) as T[];
  }

  async indexGet<T>(
    indexName: Index,
    key: number | string | [number, number] | [boolean, number]
  ): Promise<T | undefined> {
    const [storeName, indexKey] = indexName.split('.') as [Store, string];
    const store = this._data[storeName];

    for (const record of store.values()) {
      const recordKey = this._getIndexValue(record, indexKey);
      if (this._keysMatch(recordKey, key)) {
        return record as T;
      }
    }

    return undefined;
  }

  async indexGetAll<T>(
    indexName: Index,
    key: number | string | [number, number] | [boolean, number]
  ): Promise<T[]> {
    const [storeName, indexKey] = indexName.split('.') as [Store, string];
    const store = this._data[storeName];
    const results: T[] = [];

    for (const record of store.values()) {
      const recordKey = this._getIndexValue(record, indexKey);
      if (this._keysMatch(recordKey, key)) {
        results.push(record as T);
      }
    }

    return results;
  }

  private _getIndexValue(record: any, indexKey: string): any {
    if (indexKey === 'byTid') return record.tid;
    if (indexKey === 'bySeason') return record.season;
    if (indexKey === 'byDraftYearRetiredYear') return [record.draft?.year, record.retiredYear];
    if (indexKey === 'bySeasonTid') return [record.season, record.tid];
    if (indexKey === 'byTidSeason') return [record.tid, record.season];
    if (indexKey === 'byPlayoffsTid') return [record.playoffs, record.tid];
    return record[indexKey];
  }

  private _keysMatch(a: any, b: any): boolean {
    if (Array.isArray(a) && Array.isArray(b)) {
      return a.length === b.length && a.every((val, i) => val === b[i]);
    }
    return a === b;
  }

  async add<T extends { id?: number }>(store: Store, obj: Omit<T, 'id'> & Partial<{ id: number }>): Promise<number> {
    const pk = ++this._maxIds[store];
    const record = { ...obj, [this._getIdField(store)]: pk } as T;
    this._data[store].set(pk, record);
    this._markDirty(store, pk);
    return pk;
  }

  async put<T>(store: Store, obj: T): Promise<void> {
    const pk = this._getPrimaryKey(store, obj);
    this._data[store].set(pk, obj);
    this._markDirty(store, pk);
  }

  async delete(store: Store, pk: number | string): Promise<void> {
    this._data[store].delete(pk);
    this._deletes[store].add(pk);
    this._markDirty(store, pk);
  }

  async clear(store: Store): Promise<void> {
    for (const pk of this._data[store].keys()) {
      this._deletes[store].add(pk);
    }
    this._data[store].clear();
    this._dirty = true;
  }

  private _getIdField(store: Store): string {
    switch (store) {
      case 'players':
        return 'pid';
      case 'teams':
        return 'tid';
      case 'games':
      case 'schedule':
        return 'gid';
      case 'draftPicks':
        return 'dpid';
      case 'draftLotteryResults':
      case 'playoffSeries':
      case 'allStars':
      case 'awards':
      case 'headToHeads':
      case 'seasonLeaders':
        return 'season';
      case 'events':
        return 'eid';
      case 'playerFeats':
        return 'fid';
      case 'negotiations':
        return 'pid';
      case 'releasedPlayers':
      case 'savedTradingBlock':
      case 'teamSeasons':
      case 'teamStats':
        return 'rid';
      case 'savedTrades':
        return 'hash';
      case 'gameAttributes':
        return 'key';
      case 'scheduledEvents':
        return 'id';
      default:
        return 'id';
    }
  }

  get players() {
    return {
      get: (pk: number) => this.get<Player>('players', pk),
      getAll: () => this.getAll<Player>('players'),
      indexGet: (index: 'players.byTid', key: number) => this.indexGet<Player>(index, key),
      indexGetAll: (index: 'players.byTid', key: number) => this.indexGetAll<Player>(index, key),
      add: (obj: Omit<Player, 'pid'>) => this.add<Player>('players', obj),
      put: (obj: Player) => this.put('players', obj),
      delete: (pk: number) => this.delete('players', pk),
      clear: () => this.clear('players'),
    };
  }

  get teams() {
    return {
      get: (pk: number) => this.get<Team>('teams', pk),
      getAll: () => this.getAll<Team>('teams'),
      add: (obj: Omit<Team, 'tid'>) => this.add<Team>('teams', obj),
      put: (obj: Team) => this.put('teams', obj),
      delete: (pk: number) => this.delete('teams', pk),
      clear: () => this.clear('teams'),
    };
  }

  get games() {
    return {
      get: (pk: number) => this.get<Game>('games', pk),
      getAll: () => this.getAll<Game>('games'),
      indexGetAll: (index: 'games.bySeason', key: number) => this.indexGetAll<Game>(index, key),
      add: (obj: Omit<Game, 'gid'>) => this.add<Game>('games', obj),
      put: (obj: Game) => this.put('games', obj),
      delete: (pk: number) => this.delete('games', pk),
      clear: () => this.clear('games'),
    };
  }

  get schedule() {
    return {
      get: (pk: number) => this.get<ScheduleGame>('schedule', pk),
      getAll: () => this.getAll<ScheduleGame>('schedule'),
      indexGetAll: (index: 'schedule.bySeason' | 'schedule.byTid', key: number) => this.indexGetAll<ScheduleGame>(index, key),
      add: (obj: Omit<ScheduleGame, 'gid'>) => this.add<ScheduleGame>('schedule', obj),
      put: (obj: ScheduleGame) => this.put('schedule', obj),
      delete: (pk: number) => this.delete('schedule', pk),
      clear: () => this.clear('schedule'),
    };
  }

  get draftPicks() {
    return {
      get: (pk: number) => this.get<DraftPick>('draftPicks', pk),
      getAll: () => this.getAll<DraftPick>('draftPicks'),
      indexGetAll: (index: 'draftPicks.bySeason' | 'draftPicks.byTid', key: number | 'originDraft') => this.indexGetAll<DraftPick>(index, key),
      add: (obj: Omit<DraftPick, 'dpid'>) => this.add<DraftPick>('draftPicks', obj),
      put: (obj: DraftPick) => this.put('draftPicks', obj),
      delete: (pk: number) => this.delete('draftPicks', pk),
      clear: () => this.clear('draftPicks'),
    };
  }
}
