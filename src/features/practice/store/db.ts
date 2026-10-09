// Practice persistence (spec §8.1): IndexedDB `keybard-practice`, namespaced like
// appStorage so github.io previews keep their own data. store/memory.ts is the
// in-memory twin used in tests and when IndexedDB is unavailable (private windows).
import type { EventLayout, EventsRecord, ProfileRecord, ResultRecord, SnapshotRecord } from '../types';
import { DB_VERSION, migrate, RECORD_SCHEMA, STORES } from './migrations';
import { EVENT_LAYOUT } from './pack';

/** A stored result always has its id. */
export type StoredResult = ResultRecord & { id: number };

/** One imported result, with its packed events when the file had them. */
export interface ImportRow {
    result: ResultRecord;
    events?: ArrayBuffer;
    /** Layout of `events` (§8.2); 1 when absent. */
    eventsLayout?: EventLayout;
}

export interface PracticeStore {
    listProfiles(): Promise<ProfileRecord[]>;
    getProfile(id: string): Promise<ProfileRecord | undefined>;
    putProfile(profile: ProfileRecord): Promise<void>;

    /** Adds a result and returns its id. */
    addResult(result: ResultRecord): Promise<number>;
    /** A profile's results, oldest first. */
    listResults(profileId: string): Promise<StoredResult[]>;
    countResults(profileId: string): Promise<number>;
    deleteResults(profileId: string): Promise<void>;

    putEvents(row: EventsRecord): Promise<void>;
    getEvents(resultId: number): Promise<EventsRecord | undefined>;
    /** Result ids that still have events, ascending. */
    listEventIds(profileId: string): Promise<number[]>;
    deleteEvents(resultIds: readonly number[]): Promise<void>;

    /**
     * Adds imported results, with their events, to a profile in one transaction,
     * and drops the profile's snapshot. With `replace`, first clears the profile's
     * results, events and snapshot. Nothing is written when any write fails.
     * Returns the new ids in row order.
     */
    importResults(profileId: string, rows: readonly ImportRow[], replace: boolean): Promise<number[]>;

    /**
     * Deletes a profile's results, events and snapshot in one transaction (§5.9 Reset); the profile stays.
     * Nothing is deleted when any delete fails.
     */
    clearProgress(profileId: string): Promise<void>;

    getSnapshot(profileId: string): Promise<SnapshotRecord | undefined>;
    putSnapshot(snapshot: SnapshotRecord): Promise<void>;
    deleteSnapshot(profileId: string): Promise<void>;
}

/** `${VITE_STORAGE_NAMESPACE}:keybard-practice`, or `keybard-practice` (§8.1). */
export function practiceDbName(namespace: string = import.meta.env.VITE_STORAGE_NAMESPACE || ''): string {
    return `${namespace ? `${namespace}:` : ''}keybard-practice`;
}

function request<T>(req: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

function done(tx: IDBTransaction): Promise<void> {
    return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error ?? new Error('Practice transaction aborted'));
    });
}

/** Another tab holds an older version of the database open, so the upgrade waits (§8.6). */
export class PracticeDbBlockedError extends Error {
    constructor() {
        super('Practice storage is open in another Keybard tab with an older version');
        this.name = 'PracticeDbBlockedError';
    }
}

export class IndexedDbPracticeStore implements PracticeStore {
    private db: Promise<IDBDatabase> | null = null;

    constructor(readonly name: string = practiceDbName(), private readonly factory: () => IDBFactory = () => indexedDB) {}

    private open(): Promise<IDBDatabase> {
        if (!this.db) {
            const opening: Promise<IDBDatabase> = new Promise((resolve, reject) => {
                let settled = false;
                const req = this.factory().open(this.name, DB_VERSION);
                req.onupgradeneeded = (event) => migrate(req.result, req.transaction!, event.oldVersion);
                req.onsuccess = () => {
                    const db = req.result;
                    // Gave up while blocked: the late connection would block the next upgrade in turn.
                    if (settled) { db.close(); return; }
                    settled = true;
                    // A newer Keybard in another tab wants to upgrade: let it, and reopen on next use.
                    db.onversionchange = () => { db.close(); if (this.db === opening) this.db = null; };
                    db.onclose = () => { if (this.db === opening) this.db = null; };
                    resolve(db);
                };
                req.onerror = () => { settled = true; reject(req.error); };
                // An older tab has not closed: fail now (the caller falls back to memory) instead of waiting.
                req.onblocked = () => { if (!settled) { settled = true; reject(new PracticeDbBlockedError()); } };
            });
            this.db = opening;
            opening.catch(() => { if (this.db === opening) this.db = null; });
        }
        return this.db;
    }

    private async read<T>(store: string, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
        const db = await this.open();
        return request(run(db.transaction(store).objectStore(store)));
    }

    private async write(stores: string | string[], run: (tx: IDBTransaction) => void): Promise<void> {
        const db = await this.open();
        const tx = db.transaction(stores, 'readwrite');
        run(tx);
        await done(tx);
    }

    listProfiles() { return this.read(STORES.profiles, (s) => s.getAll() as IDBRequest<ProfileRecord[]>); }
    getProfile(id: string) { return this.read(STORES.profiles, (s) => s.get(id) as IDBRequest<ProfileRecord | undefined>); }
    putProfile(profile: ProfileRecord) { return this.write(STORES.profiles, (tx) => tx.objectStore(STORES.profiles).put(profile)); }

    async addResult(result: ResultRecord): Promise<number> {
        const db = await this.open();
        const tx = db.transaction(STORES.results, 'readwrite');
        const { id: _ignored, ...value } = result;
        const id = await request(tx.objectStore(STORES.results).add(value) as IDBRequest<number>);
        await done(tx);
        return id;
    }

    listResults(profileId: string) {
        const range = IDBKeyRange.bound([profileId, -Infinity], [profileId, Infinity]);
        return this.read(STORES.results, (s) => s.index('profileId_ts').getAll(range) as IDBRequest<StoredResult[]>);
    }

    countResults(profileId: string) {
        return this.read(STORES.results, (s) => s.index('profileId').count(profileId));
    }

    async deleteResults(profileId: string): Promise<void> {
        const ids = await this.read(STORES.results, (s) => s.index('profileId').getAllKeys(profileId) as IDBRequest<number[]>);
        if (!ids.length) return;
        await this.write(STORES.results, (tx) => { for (const id of ids) tx.objectStore(STORES.results).delete(id); });
    }

    putEvents(row: EventsRecord) { return this.write(STORES.events, (tx) => tx.objectStore(STORES.events).put(row)); }
    getEvents(resultId: number) { return this.read(STORES.events, (s) => s.get(resultId) as IDBRequest<EventsRecord | undefined>); }

    async listEventIds(profileId: string): Promise<number[]> {
        const ids = await this.read(STORES.events, (s) => s.index('profileId').getAllKeys(profileId) as IDBRequest<number[]>);
        return [...ids].sort((a, b) => a - b);
    }

    async deleteEvents(resultIds: readonly number[]): Promise<void> {
        if (!resultIds.length) return;
        await this.write(STORES.events, (tx) => { for (const id of resultIds) tx.objectStore(STORES.events).delete(id); });
    }

    async importResults(profileId: string, rows: readonly ImportRow[], replace: boolean): Promise<number[]> {
        const db = await this.open();
        const tx = db.transaction([STORES.results, STORES.events, STORES.snapshots], 'readwrite');
        const results = tx.objectStore(STORES.results);
        const events = tx.objectStore(STORES.events);
        const ids: number[] = [];
        const finished = done(tx);
        let failure: unknown = null;
        // Any exception aborts the whole transaction, so a failed import writes nothing.
        const guard = (run: () => void) => {
            try {
                run();
            } catch (err) {
                failure ??= err;
                try { tx.abort(); } catch { /* already finished */ }
            }
        };
        const add = () => {
            rows.forEach((row, i) => {
                const { id: _ignored, ...value } = row.result;
                const req = results.add({ ...value, profileId }) as IDBRequest<number>;
                req.onsuccess = () => guard(() => {
                    ids[i] = req.result;
                    if (row.events) {
                        const record: EventsRecord = { schema: RECORD_SCHEMA, resultId: req.result, profileId, layout: row.eventsLayout ?? EVENT_LAYOUT, packed: row.events };
                        events.put(record);
                    }
                });
            });
            if (replace || rows.length) tx.objectStore(STORES.snapshots).delete(profileId);
        };
        guard(() => {
            if (!replace) return add();
            const resultIds = results.index('profileId').getAllKeys(profileId);
            const eventIds = events.index('profileId').getAllKeys(profileId);
            // Requests run in order: both key lists are ready here.
            eventIds.onsuccess = () => guard(() => {
                for (const id of resultIds.result) results.delete(id);
                for (const id of eventIds.result) events.delete(id);
                add();
            });
        });
        try {
            await finished;
        } catch (err) {
            throw failure ?? err;
        }
        if (failure) throw failure;
        return ids;
    }

    async clearProgress(profileId: string): Promise<void> {
        const db = await this.open();
        const tx = db.transaction([STORES.results, STORES.events, STORES.snapshots], 'readwrite');
        const results = tx.objectStore(STORES.results);
        const events = tx.objectStore(STORES.events);
        const finished = done(tx);
        const resultIds = results.index('profileId').getAllKeys(profileId);
        const eventIds = events.index('profileId').getAllKeys(profileId);
        // Requests run in order: both key lists are ready here.
        eventIds.onsuccess = () => {
            for (const id of resultIds.result) results.delete(id);
            for (const id of eventIds.result) events.delete(id);
            tx.objectStore(STORES.snapshots).delete(profileId);
        };
        await finished;
    }

    getSnapshot(profileId: string) { return this.read(STORES.snapshots, (s) => s.get(profileId) as IDBRequest<SnapshotRecord | undefined>); }
    putSnapshot(snapshot: SnapshotRecord) { return this.write(STORES.snapshots, (tx) => tx.objectStore(STORES.snapshots).put(snapshot)); }
    deleteSnapshot(profileId: string) { return this.write(STORES.snapshots, (tx) => tx.objectStore(STORES.snapshots).delete(profileId)); }
}

/**
 * The store for this browser: IndexedDB when it opens, otherwise the in-memory
 * twin (the caller shows a persistent notice; §13.1 "IndexedDB unavailable").
 */
export async function openPracticeStore(
    memory: () => PracticeStore,
    { factory, name, timeoutMs = 5000 }: { factory?: () => IDBFactory; name?: string; timeoutMs?: number } = {},
): Promise<{ store: PracticeStore; persistent: boolean }> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
        if (!factory && typeof indexedDB === 'undefined') throw new Error('No IndexedDB');
        const store = new IndexedDbPracticeStore(name, factory);
        // An open that never settles (a stuck private window, say) must not hang Practice.
        const timeout = new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new Error('Practice storage timed out')), timeoutMs);
        });
        await Promise.race([store.listProfiles(), timeout]);
        return { store, persistent: true };
    } catch {
        return { store: memory(), persistent: false };
    } finally {
        clearTimeout(timer);
    }
}
