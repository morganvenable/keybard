import { beforeEach, describe, expect, it } from 'vitest';
import { OWNER_Q5_EVENT_RETENTION_LESSONS } from '@/constants/owner-decisions';
import { practiceDbName } from '@/features/practice/store/db';
import { loadEvents, pruneEvents, saveEvents } from '@/features/practice/store/events';
import { exportProfile, ImportError, importIntoProfile, parseExport } from '@/features/practice/store/export';
import { MemoryPracticeStore } from '@/features/practice/store/memory';
import { DB_VERSION, isNewerSchema, migrate, STORES } from '@/features/practice/store/migrations';
import {
    activeProfile,
    boardIdentity,
    DEFAULT_PROFILE_ID,
    newProfile,
    normalizeUid,
    profileIdFor,
} from '@/features/practice/store/profiles';
import {
    buildResultRecord,
    isValidResult,
    PracticeResult,
    resultRecordFromJson,
    sampleKey,
    selectByPaths,
} from '@/features/practice/store/results';
import { resolveKeymap } from '@/features/practice/keymap/resolver';
import type { KeystrokeEvent, ResultRecord } from '@/features/practice/types';
import { svalDefault } from '../fixtures/boards';

function hit(t: number, expected: number, path: string, ttt: number | null, extra: Partial<KeystrokeEvent> = {}): KeystrokeEvent {
    const [layer, index] = path.split(':').map(Number);
    return {
        t, expected, typed: expected, kind: 'hit', raw: ttt ?? 0, ttt, path, prereq: [],
        phys: { index, layer, confidence: 'inferred', skew: null, reach: null, target: null }, ...extra,
    };
}

function record(ts: number, profileId = 'me', h: ResultRecord['h'] = {
    [sampleKey(0x61, '0:26:n')]: { h: 5, m: 0, t: 200 },
    [sampleKey(0x73, '0:20:n')]: { h: 5, m: 1, t: 250 },
    [sampleKey(0x64, '0:14:n')]: { h: 5, m: 0, t: 300 },
}): ResultRecord {
    return {
        schema: 1, profileId, l: 'custom', m: 'generated', ts, n: 15, t: 4000, e: 1, h, k: {}, r: {},
        x: { type: 'guided', scope: { layer: null, group: null, dirs: null, hands: null, thumbs: true }, target: 175, src: 'keymap', obs: 0, inf: 15, board: 'example', os: 'us', km: 'abcd' },
    };
}

describe('result records (§8.3)', () => {
    it('builds per-path samples: hits, positions with a miss, mean clean time', () => {
        const events: KeystrokeEvent[] = [
            hit(0, 0x61, '0:26:n', null),
            hit(200, 0x61, '0:26:n', 200),
            { ...hit(300, 0x73, '0:20:n', null), kind: 'miss', typed: 0x64, errorClass: 'wrong-direction' },
            hit(450, 0x73, '0:20:n', 250),
            hit(700, 0x73, '0:20:n', 250),
            { ...hit(800, 0x20, '0:38:n', null), kind: 'stray', typed: 0x6a },
            hit(1000, 0x21, '1:27:f', 150, { prereq: [32], phys: { index: 27, layer: 1, confidence: 'observed', skew: 3, reach: 120, target: 180 } }),
        ];
        const r = buildResultRecord({
            profileId: 'me', type: 'guided', textType: 'generated', ts: 1, stats: { length: 6, time: 1000, errors: 1 },
            events, target: 175, src: 'usb', board: 'sval:E464', os: 'us', km: 'abcd',
        });
        expect(r.h).toEqual({
            '97|0:26:n': { h: 2, m: 0, t: 200 },
            '115|0:20:n': { h: 2, m: 1, t: 250 },
            '33|1:27:f': { h: 1, m: 0, t: 150 },
        });
        expect(r.k['20@0']).toEqual({ h: 2, m: 1, t: 250, s: 0 });
        expect(r.k['38@0']).toEqual({ h: 0, m: 0, t: 0, s: 1 });
        expect(r.k['27@1']).toEqual({ h: 1, m: 0, t: 180, s: 0 });
        expect(r.r).toEqual({ 32: { n: 1, t: 120 } });
        expect(r.x).toMatchObject({ obs: 1, inf: 4, src: 'usb', board: 'sval:E464' });
        expect(resultRecordFromJson(JSON.parse(JSON.stringify(r)))).toEqual(r);
    });

    it('drops samples outside keybr\'s 40–12,000 ms window', () => {
        const r = buildResultRecord({
            profileId: 'me', type: 'guided', textType: 'generated', ts: 1, stats: { length: 2, time: 30, errors: 0 },
            events: [hit(0, 0x61, '0:26:n', null), hit(30, 0x61, '0:26:n', 30)], target: 175, src: 'keymap', board: 'example', os: 'us', km: '',
        });
        expect(r.h).toEqual({});
    });

    it('validates records field by field', () => {
        const good = record(1);
        expect(resultRecordFromJson(good)).toEqual(good);
        expect(resultRecordFromJson({ ...good, schema: 2 })).toBeNull();
        expect(resultRecordFromJson({ ...good, n: -1 })).toBeNull();
        expect(resultRecordFromJson({ ...good, l: 'en-us' })).toBeNull();
        expect(resultRecordFromJson({ ...good, h: { 'x|0:1:n': { h: 1, m: 0, t: 1 } } })).toBeNull();
        expect(resultRecordFromJson({ ...good, h: { '97|0:1:z': { h: 1, m: 0, t: 1 } } })).toBeNull();
        expect(resultRecordFromJson({ ...good, x: { ...good.x, type: 'books' } })).toBeNull();
        expect(resultRecordFromJson(null)).toBeNull();
    });

    it('keeps keybr\'s validity rules (length ≥ 10, time ≥ 1 s, ≥ 3 characters)', () => {
        expect(isValidResult(record(1))).toBe(true);
        expect(isValidResult({ ...record(1), n: 9 })).toBe(false);
        expect(isValidResult({ ...record(1), t: 999 })).toBe(false);
        expect(isValidResult(record(1, 'me', { '97|0:26:n': { h: 5, m: 0, t: 200 } }))).toBe(false);
    });

    it('merges a character typed through two paths, and selects only current paths', () => {
        const board = svalDefault();
        const resolution = resolveKeymap({ keymap: board.keymap!, rows: board.rows, cols: board.cols });
        const two = record(1, 'me', {
            '32|0:33:n': { h: 4, m: 0, t: 100 },
            '32|0:3:n': { h: 4, m: 0, t: 200 },
            '97|0:26:n': { h: 2, m: 0, t: 300 },
        });
        expect(new PracticeResult(two).histogram.get(0x20)).toEqual({ codePoint: 0x20, hitCount: 8, missCount: 0, timeToType: 150 });
        // 0:3 types Enter, not space, on this keymap: only 0:33 counts.
        expect(selectByPaths(two, resolution).histogram.get(0x20)?.timeToType).toBe(100);
    });
});

describe('memory store, events and retention', () => {
    let store: MemoryPracticeStore;
    beforeEach(() => { store = new MemoryPracticeStore(); });

    it('names the database per storage namespace (§8.1)', () => {
        expect(practiceDbName('')).toBe('keybard-practice');
        expect(practiceDbName('next')).toBe('next:keybard-practice');
    });

    it('stores results per profile, oldest first', async () => {
        await store.addResult(record(30));
        await store.addResult(record(10));
        await store.addResult(record(20, 'other'));
        expect((await store.listResults('me')).map((r) => r.ts)).toEqual([10, 30]);
        expect(await store.countResults('me')).toBe(2);
        await store.deleteResults('me');
        expect(await store.countResults('me')).toBe(0);
        expect(await store.countResults('other')).toBe(1);
    });

    it('saves and loads events', async () => {
        const id = await store.addResult(record(1));
        const events = [hit(0, 0x61, '0:26:n', null), hit(200, 0x61, '0:26:n', 200)];
        await saveEvents(store, 'me', id, events);
        const loaded = await loadEvents(store, id);
        expect(loaded?.map((e) => [e.t, e.path, e.ttt])).toEqual([[0, '0:26:n', null], [200, '0:26:n', 200]]);
        expect(await loadEvents(store, 999)).toBeNull();
    });

    it('prunes events beyond the newest N lessons (OWNER_Q5), keeping results', async () => {
        expect(OWNER_Q5_EVENT_RETENTION_LESSONS).toBe(1000);
        const ids: number[] = [];
        for (let i = 0; i < 5; i++) {
            const id = await store.addResult(record(100 + i));
            ids.push(id);
            await saveEvents(store, 'me', id, [hit(0, 0x61, '0:26:n', null)]);
        }
        expect(await pruneEvents(store, 'me', 3)).toEqual(ids.slice(0, 2));
        expect(await store.listEventIds('me')).toEqual(ids.slice(2));
        expect(await store.countResults('me')).toBe(5);
        expect(await pruneEvents(store, 'me')).toEqual([]);
    });

    it('prunes by lesson time, not by id', async () => {
        const newer = await store.addResult(record(200));
        const older = await store.addResult(record(100));
        for (const id of [newer, older]) await saveEvents(store, 'me', id, []);
        expect(await pruneEvents(store, 'me', 1)).toEqual([older]);
    });
});

describe('profiles and board identity (§8.1, OWNER_Q6)', () => {
    it('starts with one local profile, "Me", in user scope', async () => {
        const store = new MemoryPracticeStore();
        const me = await activeProfile(store, { scope: 'user', now: 5 });
        expect(me).toMatchObject({ id: DEFAULT_PROFILE_ID, name: 'Me', startDone: false, createdAt: 5 });
        expect(await store.listProfiles()).toHaveLength(1);
        await store.putProfile(newProfile('sam', 'Sam'));
        expect((await activeProfile(store, { scope: 'user', activeId: 'sam' })).id).toBe('sam');
        expect((await activeProfile(store, { scope: 'user', activeId: 'gone' })).id).toBe('me');
        // The board never decides the profile in user scope.
        expect((await activeProfile(store, { scope: 'user', board: 'sval:E464' })).id).toBe('me');
    });

    it('follows the board in per-board scope', async () => {
        const store = new MemoryPracticeStore();
        expect((await activeProfile(store, { scope: 'per-board', board: 'uid:47F55316C11A3D1B' })).id).toBe('board:uid:47F55316C11A3D1B');
        expect((await activeProfile(store, { scope: 'per-board', board: 'example' })).name).toBe('Example');
    });

    it('normalizes board identity', () => {
        expect(boardIdentity({ kind: 'example' })).toBe('example');
        expect(boardIdentity({ kind: 'connected', serial: 'E46498769F365934' })).toBe('sval:E46498769F365934');
        expect(boardIdentity({ kind: 'connected', serial: 'sval:E46498769F365934' })).toBe('sval:E46498769F365934');
        expect(boardIdentity({ kind: 'connected', kbid: '47f55316c11a3d1b' })).toBe('uid:47F55316C11A3D1B');
        // The same UID from a file, in hex (current loader) or decimal (raw .svil uid).
        expect(boardIdentity({ kind: 'file', kbid: '47f55316c11a3d1b' })).toBe('uid:47F55316C11A3D1B');
        expect(boardIdentity({ kind: 'file', kbid: '5199957870438586395', kbidRadix: 10 })).toBe('uid:4829F621F27D181B');
        expect(normalizeUid('ff')).toBe('00000000000000FF');
        expect(normalizeUid('xyz')).toBeNull();
        expect(boardIdentity({ kind: 'file' })).toBe('unknown');
    });

    it('the default svil UID normalizes like a connected board', () => {
        expect(boardIdentity({ kind: 'file', kbid: svalDefault().kbid })).toBe('uid:4829F621F27D181B');
    });

    it('makes unique profile ids', () => {
        expect(profileIdFor('Sam Smith', ['me'])).toBe('sam-smith');
        expect(profileIdFor('Me', ['me'])).toBe('me-2');
        expect(profileIdFor('!!!', [])).toBe('profile');
    });
});

describe('export and import (§8.4)', () => {
    it('round-trips a profile with events (Merge into an empty profile)', async () => {
        const a = new MemoryPracticeStore();
        await activeProfile(a, { scope: 'user' });
        for (const ts of [1, 2, 3]) {
            const id = await a.addResult(record(ts));
            await saveEvents(a, 'me', id, [hit(0, 0x61, '0:26:n', null), hit(ts * 100, 0x61, '0:26:n', 200)]);
        }
        const file = await exportProfile(a, 'me', { includeEvents: true, settings: { order: 'frequency' }, now: new Date(0), keybard: 'abc' });
        expect(file).toMatchObject({ format: 'keybard-practice', version: 1, exportedAt: '1970-01-01T00:00:00.000Z', keybard: 'abc' });
        const json = JSON.parse(JSON.stringify(file));

        const b = new MemoryPracticeStore();
        const summary = await importIntoProfile(b, 'sam', json, 'merge');
        expect(summary).toEqual({ added: 3, duplicates: 0, invalid: 0, events: 3 });
        const imported = await b.listResults('sam');
        expect(imported.map(({ id: _id, profileId, ...rest }) => [profileId, rest])).toEqual(
            (await a.listResults('me')).map(({ id: _id, profileId: _p, ...rest }) => ['sam', rest]));
        expect((await loadEvents(b, imported[2].id))?.map((e) => e.t)).toEqual([0, 300]);
    });

    it('Merge skips results already present (same ts, n, t)', async () => {
        const store = new MemoryPracticeStore();
        await store.addResult(record(1));
        const file = { format: 'keybard-practice', version: 1, results: [record(1), record(2), { bad: true }] };
        expect(await importIntoProfile(store, 'me', file, 'merge')).toEqual({ added: 1, duplicates: 1, invalid: 1, events: 0 });
        expect(await store.countResults('me')).toBe(2);
    });

    it('Replace clears the profile\'s results, events and snapshot first', async () => {
        const store = new MemoryPracticeStore();
        const id = await store.addResult(record(9));
        await saveEvents(store, 'me', id, []);
        await store.putSnapshot({ schema: 1, profileId: 'me', engineVersion: 'x', resultCount: 1, keymapFingerprint: 'k', keyStats: [], updatedAt: 0 });
        await store.addResult(record(5, 'other'));
        const file = { format: 'keybard-practice', version: 1, results: [record(1)] };
        expect(await importIntoProfile(store, 'me', file, 'replace')).toMatchObject({ added: 1 });
        expect((await store.listResults('me')).map((r) => r.ts)).toEqual([1]);
        expect(await store.listEventIds('me')).toEqual([]);
        expect(await store.getSnapshot('me')).toBeUndefined();
        expect(await store.countResults('other')).toBe(1);
    });

    it('refuses other formats and newer versions', () => {
        expect(() => parseExport({ format: 'keybr' })).toThrow(ImportError);
        expect(() => parseExport({ format: 'keybard-practice', version: 2, results: [] })).toThrow(/newer Keybard/);
        expect(() => parseExport({ format: 'keybard-practice', version: 1 })).toThrow(/no results/);
    });

    it('export → reset → import round-trips byte-identical results', async () => {
        const store = new MemoryPracticeStore();
        for (const ts of [3, 1, 2]) await store.addResult(record(ts));
        const before = JSON.stringify((await store.listResults('me')).map(({ id: _id, ...r }) => r));
        const file = JSON.parse(JSON.stringify(await exportProfile(store, 'me')));
        await store.deleteResults('me');
        await importIntoProfile(store, 'me', file, 'merge');
        expect(JSON.stringify((await store.listResults('me')).map(({ id: _id, ...r }) => r))).toBe(before);
    });
});

describe('migrations and schema versioning (§8.6)', () => {
    it('creates the version-1 stores and indexes', () => {
        const created: Record<string, { options: unknown; indexes: [string, unknown][] }> = {};
        const db = {
            createObjectStore(name: string, options: unknown) {
                created[name] = { options, indexes: [] };
                return { createIndex: (index: string, keyPath: unknown) => created[name].indexes.push([index, keyPath]) };
            },
        } as unknown as IDBDatabase;
        migrate(db, {} as IDBTransaction, 0);
        expect(DB_VERSION).toBe(1);
        expect(Object.keys(created)).toEqual([STORES.profiles, STORES.results, STORES.events, STORES.snapshots]);
        expect(created.results).toEqual({ options: { keyPath: 'id', autoIncrement: true }, indexes: [['profileId', 'profileId'], ['profileId_ts', ['profileId', 'ts']]] });
        expect(created.events.indexes).toEqual([['profileId', 'profileId']]);
        const again: string[] = [];
        migrate({ createObjectStore: (n: string) => { again.push(n); return { createIndex() {} }; } } as unknown as IDBDatabase, {} as IDBTransaction, 1);
        expect(again).toEqual([]);
    });

    it('flags records from a newer Keybard', () => {
        expect(isNewerSchema({ schema: 2 })).toBe(true);
        expect(isNewerSchema({ schema: 1 })).toBe(false);
        expect(isNewerSchema(null)).toBe(false);
    });
});
