// IndexedDbPracticeStore over fake-indexeddb: the store contract, plus the
// connection rules a schema upgrade depends on (§8.6).
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { IndexedDbPracticeStore, openPracticeStore, PracticeDbBlockedError } from '@/features/practice/store/db';
import { MemoryPracticeStore } from '@/features/practice/store/memory';
import { DB_VERSION, STORES } from '@/features/practice/store/migrations';
import { record } from '../fixtures/records';
import { practiceStoreContract } from './storeContract';

let n = 0;
const freshName = () => `practice-test-${++n}`;

practiceStoreContract('IndexedDB store', () => new IndexedDbPracticeStore(freshName()));

function openRaw(name: string, version: number, onUpgrade?: (db: IDBDatabase) => void): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(name, version);
        req.onupgradeneeded = () => onUpgrade?.(req.result);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

describe('IndexedDB store connections', () => {
    it('creates the version-1 stores and indexes', async () => {
        const name = freshName();
        await new IndexedDbPracticeStore(name).listProfiles();
        const db = await openRaw(name, DB_VERSION);
        expect([...db.objectStoreNames].sort()).toEqual(Object.values(STORES).sort());
        const tx = db.transaction(STORES.results);
        expect([...tx.objectStore(STORES.results).indexNames].sort()).toEqual(['profileId', 'profileId_ts']);
        db.close();
    });

    it('closes for a newer version in another tab, then reopens on next use', async () => {
        const name = freshName();
        const store = new IndexedDbPracticeStore(name);
        await store.addResult(record(1));
        // A newer Keybard upgrades: without onversionchange this would wait forever.
        const newer = await openRaw(name, DB_VERSION + 1, (db) => db.createObjectStore('later'));
        expect([...newer.objectStoreNames]).toContain('later');
        newer.close();
        // The old store's connection closed; its next call opens the (now newer) database again and fails cleanly.
        await expect(store.countResults('me')).rejects.toBeTruthy();
    });

    it('fails, instead of waiting, while an older tab blocks its upgrade', async () => {
        const name = freshName();
        // An old tab that never closes when asked.
        const old = await openRaw(name, 1, (db) => db.createObjectStore('legacy'));
        old.onversionchange = () => {};
        const store = new IndexedDbPracticeStore(name, () => ({
            open: (dbName: string) => indexedDB.open(dbName, DB_VERSION + 1),
        }) as unknown as IDBFactory);
        await expect(store.listProfiles()).rejects.toBeInstanceOf(PracticeDbBlockedError);
        old.close();
    });

    it('falls back to the memory twin when storage is blocked or stuck', async () => {
        const name = freshName();
        const old = await openRaw(name, 1);
        old.onversionchange = () => {};
        const blocked = await openPracticeStore(() => new MemoryPracticeStore(), {
            name,
            factory: () => ({ open: (dbName: string) => indexedDB.open(dbName, 2) }) as unknown as IDBFactory,
        });
        expect(blocked.persistent).toBe(false);
        expect(blocked.store).toBeInstanceOf(MemoryPracticeStore);
        old.close();

        const stuck = await openPracticeStore(() => new MemoryPracticeStore(), {
            factory: () => ({ open: () => ({}) }) as unknown as IDBFactory,
            timeoutMs: 20,
        });
        expect(stuck.persistent).toBe(false);

        const ok = await openPracticeStore(() => new MemoryPracticeStore(), { name: freshName() });
        expect(ok.persistent).toBe(true);
        expect(ok.store).toBeInstanceOf(IndexedDbPracticeStore);
    });
});
