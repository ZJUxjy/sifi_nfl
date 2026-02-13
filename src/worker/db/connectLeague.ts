import { openDB, DBSchema, IDBPDatabase } from '@dumbmatter/idb';
import type {
  Player,
  Team,
  Game,
  ScheduleGame,
  DraftPick,
  Event,
  GameAttributesLeague,
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
} from '../../common/types';

export interface LeagueDB extends DBSchema {
  players: {
    key: number;
    value: Player;
    indexes: {
      'byTid': number;
      'byDraftYearRetiredYear': [number, number];
    };
  };
  teams: {
    key: number;
    value: Team;
  };
  games: {
    key: number;
    value: Game;
    indexes: {
      'bySeason': number;
    };
  };
  schedule: {
    key: number;
    value: ScheduleGame;
    indexes: {
      'bySeason': number;
      'byTid': number;
    };
  };
  draftPicks: {
    key: number;
    value: DraftPick;
    indexes: {
      'bySeason': number | 'originDraft';
      'byTid': number;
    };
  };
  draftLotteryResults: {
    key: number;
    value: { season: number; result: any[] };
  };
  events: {
    key: number;
    value: Event;
    indexes: {
      'bySeason': number;
    };
  };
  gameAttributes: {
    key: string;
    value: { key: string; value: any };
  };
  playoffSeries: {
    key: number;
    value: PlayoffSeries;
    indexes: {
      'bySeason': number;
    };
  };
  teamSeasons: {
    key: number;
    value: TeamSeason;
    indexes: {
      'bySeasonTid': [number, number];
      'byTidSeason': [number, number];
    };
  };
  teamStats: {
    key: number;
    value: TeamStats;
    indexes: {
      'byPlayoffsTid': [boolean, number];
    };
  };
  seasonLeaders: {
    key: number;
    value: SeasonLeaders;
  };
  negotiations: {
    key: number;
    value: Negotiation;
  };
  releasedPlayers: {
    key: number;
    value: ReleasedPlayer;
    indexes: {
      'byTid': number;
    };
  };
  savedTrades: {
    key: string;
    value: SavedTrade;
  };
  savedTradingBlock: {
    key: number;
    value: SavedTradingBlock;
  };
  allStars: {
    key: number;
    value: AllStars;
  };
  awards: {
    key: number;
    value: Awards;
  };
  headToHeads: {
    key: number;
    value: HeadToHead;
    indexes: {
      'bySeason': number;
    };
  };
  playerFeats: {
    key: number;
    value: PlayerFeat;
  };
  scheduledEvents: {
    key: number;
    value: ScheduledEvent;
    indexes: {
      'bySeason': number;
    };
  };
}

let db: IDBPDatabase<LeagueDB> | undefined;

export async function connectLeague(lid: number): Promise<IDBPDatabase<LeagueDB>> {
  if (db) {
    return db;
  }

  db = await openDB<LeagueDB>(`league${lid}`, 1, {
    upgrade(db, oldVersion, newVersion, transaction) {
      if (oldVersion === 0) {
        const playersStore = db.createObjectStore('players', {
          keyPath: 'pid',
          autoIncrement: true,
        });
        playersStore.createIndex('byTid', 'tid');
        playersStore.createIndex('byDraftYearRetiredYear', ['draft.year', 'retiredYear']);

        const teamsStore = db.createObjectStore('teams', {
          keyPath: 'tid',
          autoIncrement: true,
        });

        const gamesStore = db.createObjectStore('games', {
          keyPath: 'gid',
          autoIncrement: true,
        });
        gamesStore.createIndex('bySeason', 'season');

        const scheduleStore = db.createObjectStore('schedule', {
          keyPath: 'gid',
          autoIncrement: true,
        });
        scheduleStore.createIndex('bySeason', 'season');
        scheduleStore.createIndex('byTid', 'tid');

        const draftPicksStore = db.createObjectStore('draftPicks', {
          keyPath: 'dpid',
          autoIncrement: true,
        });
        draftPicksStore.createIndex('bySeason', 'season');
        draftPicksStore.createIndex('byTid', 'tid');

        db.createObjectStore('draftLotteryResults', {
          keyPath: 'season',
          autoIncrement: false,
        });

        const eventsStore = db.createObjectStore('events', {
          keyPath: 'eid',
          autoIncrement: true,
        });
        eventsStore.createIndex('bySeason', 'season');

        db.createObjectStore('gameAttributes', {
          keyPath: 'key',
          autoIncrement: false,
        });

        const playoffSeriesStore = db.createObjectStore('playoffSeries', {
          keyPath: 'season',
          autoIncrement: false,
        });
        playoffSeriesStore.createIndex('bySeason', 'season');

        const teamSeasonsStore = db.createObjectStore('teamSeasons', {
          keyPath: 'rid',
          autoIncrement: true,
        });
        teamSeasonsStore.createIndex('bySeasonTid', ['season', 'tid']);
        teamSeasonsStore.createIndex('byTidSeason', ['tid', 'season']);

        const teamStatsStore = db.createObjectStore('teamStats', {
          keyPath: 'rid',
          autoIncrement: true,
        });
        teamStatsStore.createIndex('byPlayoffsTid', ['playoffs', 'tid']);

        db.createObjectStore('seasonLeaders', {
          keyPath: 'season',
          autoIncrement: false,
        });

        db.createObjectStore('negotiations', {
          keyPath: 'pid',
          autoIncrement: false,
        });

        const releasedPlayersStore = db.createObjectStore('releasedPlayers', {
          keyPath: 'rid',
          autoIncrement: true,
        });
        releasedPlayersStore.createIndex('byTid', 'tid');

        db.createObjectStore('savedTrades', {
          keyPath: 'hash',
          autoIncrement: false,
        });

        db.createObjectStore('savedTradingBlock', {
          keyPath: 'rid',
          autoIncrement: false,
        });

        db.createObjectStore('allStars', {
          keyPath: 'season',
          autoIncrement: false,
        });

        db.createObjectStore('awards', {
          keyPath: 'season',
          autoIncrement: false,
        });

        const headToHeadsStore = db.createObjectStore('headToHeads', {
          keyPath: 'season',
          autoIncrement: false,
        });
        headToHeadsStore.createIndex('bySeason', 'season');

        db.createObjectStore('playerFeats', {
          keyPath: 'fid',
          autoIncrement: true,
        });

        const scheduledEventsStore = db.createObjectStore('scheduledEvents', {
          keyPath: 'id',
          autoIncrement: true,
        });
        scheduledEventsStore.createIndex('bySeason', 'season');
      }
    },
  });

  return db;
}

export function getDB(): IDBPDatabase<LeagueDB> | undefined {
  return db;
}

export async function resetDB(): Promise<void> {
  db = undefined;
}
