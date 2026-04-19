/**
 * P2 D2 — `storage.ts` must not hardcode `store.get(2025)`.
 *
 * Background: `loadWorldData()` originally read the 'world' object store
 * with a literal `store.get(2025)`. Once the in-game year advanced past
 * 2025, the cache lookup missed the season entry actually saved (which
 * uses `keyPath: 'season'`), so a brand-new GameEngine on season 2026
 * would never re-hydrate from IndexedDB even though the data was there.
 *
 * Contract under test: `loadWorldData(season)` requests the same `season`
 * key from the underlying object store. Any other key (notably the legacy
 * literal 2025) is a regression.
 *
 * Strategy: stub `window.indexedDB` with a minimal fake that captures the
 * key passed to `store.get(...)`. We do not exercise the real IDB engine —
 * jsdom does not ship one — but we *do* exercise the production code path
 * inside `storage.ts` that was previously hardcoded.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadWorldData } from '../worker/api/storage';

describe('storage.loadWorldData: season is parameterized (P2 D2)', () => {
  let lastGetKey: number | string | undefined;

  beforeEach(() => {
    lastGetKey = undefined;

    const fakeStore = {
      get: vi.fn((key: number | string) => {
        lastGetKey = key;
        const req: any = { result: null };
        Promise.resolve().then(() => {
          if (typeof req.onsuccess === 'function') req.onsuccess();
        });
        return req;
      }),
    };

    const fakeTx = {
      objectStore: vi.fn(() => fakeStore),
    };

    const fakeDB = {
      transaction: vi.fn(() => fakeTx),
      objectStoreNames: { contains: () => true },
    };

    // setup.ts defined window.indexedDB as { open: vi.fn(), ... } where the
    // inner properties are writable plain-object fields, so we can swap the
    // open mock implementation per-test without redefining the whole getter.
    const openMock = (window as any).indexedDB.open as ReturnType<typeof vi.fn>;
    openMock.mockReset();
    openMock.mockImplementation(() => {
      const req: any = { result: fakeDB };
      Promise.resolve().then(() => {
        if (typeof req.onsuccess === 'function') req.onsuccess();
      });
      return req;
    });
  });

  it('reads the world store using the supplied season (2026), not the legacy literal 2025', async () => {
    // Cast to `any` because RED-phase signature has no `season` arg yet —
    // GREEN phase makes this a typed `(season: number)` parameter.
    await (loadWorldData as any)(2026);

    expect(lastGetKey).toBe(2026);
  });

  it('reads the world store using the supplied season for an arbitrary future year', async () => {
    await (loadWorldData as any)(2030);

    expect(lastGetKey).toBe(2030);
  });
});
