// Practice persistence (spec §8.1): IndexedDB `keybard-practice`, namespaced like
// appStorage so github.io previews keep their own data. store/memory.ts is the
// in-memory twin used in tests and when IndexedDB is unavailable (private windows).
import type { EventsRecord, ProfileRecord, ResultRecord, SnapshotRecord } from '../types';
import { DB_VERSION, migrate, STORES } from './migrations';

/** A stored result always has its id. */
export type StoredResult = ResultRecord & { id: number };

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

export class IndexedDbPracticeStore implements PracticeStore {
    private db: Promise<IDBDatabase> | null = null;

    constructor(readonly name: string = practiceDbName(), private readonly factory: () => IDBFactory = () => indexedDB) {}

    private open(): Promise<IDBDatabase> {
        if (!this.db) {
            this.db = new Promise((resolve, reject) => {
                const req = this.factory().open(this.name, DB_VERSION);
                req.onupgradeneeded = (event) => migrate(req.result, req.transaction!, event.oldVersion);
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            });
            this.db.catch(() => { this.db = null; });
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

    getSnapshot(profileId: string) { return this.read(STORES.snapshots, (s) => s.get(profileId) as IDBRequest<SnapshotRecord | undefined>); }
    putSnapshot(snapshot: SnapshotRecord) { return this.write(STORES.snapshots, (tx) => tx.objectStore(STORES.snapshots).put(snapshot)); }
    deleteSnapshot(profileId: string) { return this.write(STORES.snapshots, (tx) => tx.objectStore(STORES.snapshots).delete(profileId)); }
}

/**
 * The store for this browser: IndexedDB when it opens, otherwise the in-memory
 * twin (the caller shows a persistent notice; §13.1 "IndexedDB unavailable").
 */
export async function openPracticeStore(memory: () => PracticeStore): Promise<{ store: PracticeStore; persistent: boolean }> {
    try {
        if (typeof indexedDB === 'undefined') throw new Error('No IndexedDB');
        const store = new IndexedDbPracticeStore();
        await store.listProfiles();
        return { store, persistent: true };
    } catch {
        return { store: memory(), persistent: false };
    }
}
