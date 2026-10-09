// IndexedDB schema versions for `keybard-practice` (spec §8.1, §8.6). Each entry
// upgrades the database from the previous version; they run in order inside
// `onupgradeneeded`. Add a new entry (never edit a shipped one) to change stores.

export const STORES = {
    profiles: 'profiles',
    results: 'results',
    events: 'events',
    snapshots: 'snapshots',
} as const;

/** The newest record schema this build understands (§8.6). */
export const RECORD_SCHEMA = 1;

export interface Migration {
    version: number;
    upgrade(db: IDBDatabase, tx: IDBTransaction): void;
}

export const MIGRATIONS: readonly Migration[] = [
    {
        version: 1,
        upgrade(db) {
            db.createObjectStore(STORES.profiles, { keyPath: 'id' });
            const results = db.createObjectStore(STORES.results, { keyPath: 'id', autoIncrement: true });
            results.createIndex('profileId', 'profileId');
            results.createIndex('profileId_ts', ['profileId', 'ts']);
            const events = db.createObjectStore(STORES.events, { keyPath: 'resultId' });
            events.createIndex('profileId', 'profileId');
            db.createObjectStore(STORES.snapshots, { keyPath: 'profileId' });
        },
    },
];

export const DB_VERSION = MIGRATIONS[MIGRATIONS.length - 1].version;

/** Runs the migrations between two versions, in order. */
export function migrate(db: IDBDatabase, tx: IDBTransaction, oldVersion: number, newVersion = DB_VERSION) {
    for (const migration of MIGRATIONS) {
        if (migration.version > oldVersion && migration.version <= newVersion) migration.upgrade(db, tx);
    }
}

/** A record written by a newer Keybard: Practice goes read-only (§8.6). */
export function isNewerSchema(record: { schema?: unknown } | null | undefined): boolean {
    return typeof record?.schema === 'number' && record.schema > RECORD_SCHEMA;
}
