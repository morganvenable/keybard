// The PracticeStore contract: every store (the IndexedDB store and its in-memory
// twin) must pass these. store.test.ts runs them on MemoryPracticeStore,
// indexedDb.test.ts on IndexedDbPracticeStore over fake-indexeddb.
import { beforeEach, describe, expect, it } from 'vitest';
import { OWNER_Q5_EVENT_RETENTION_LESSONS } from '@/constants/owner-decisions';
import type { PracticeStore } from '@/features/practice/store/db';
import { loadEvents, pruneEvents, saveEvents } from '@/features/practice/store/events';
import { exportProfile, ImportError, importIntoProfile } from '@/features/practice/store/export';
import { activeProfile, newProfile } from '@/features/practice/store/profiles';
import type { SnapshotRecord } from '@/features/practice/types';
import { hit, record } from '../fixtures/records';

const snapshot = (profileId: string): SnapshotRecord => ({
    schema: 1, profileId, engineVersion: 'x', resultCount: 1, keymapFingerprint: 'k', keyStats: [], updatedAt: 0,
});

export function practiceStoreContract(name: string, makeStore: () => PracticeStore) {
    describe(`${name}: results, events and retention`, () => {
        let store: PracticeStore;
        beforeEach(() => { store = makeStore(); });

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

        it('assigns ids and strips a stale id on add', async () => {
            const a = await store.addResult({ ...record(1), id: 77 });
            const b = await store.addResult(record(2));
            expect(a).not.toBe(77);
            expect(b).toBeGreaterThan(a);
            expect((await store.listResults('me')).map((r) => r.id)).toEqual([a, b]);
        });

        it('returns copies, not live records', async () => {
            await store.addResult(record(1));
            const [first] = await store.listResults('me');
            first.n = 999;
            expect((await store.listResults('me'))[0].n).toBe(15);
        });

        it('saves and loads events', async () => {
            const id = await store.addResult(record(1));
            const events = [hit(0, 0x61, '0:26:n', null), hit(200, 0x61, '0:26:n', 200)];
            await saveEvents(store, 'me', id, events);
            const loaded = await loadEvents(store, id);
            expect(loaded?.map((e) => [e.t, e.path, e.ttt])).toEqual([[0, '0:26:n', null], [200, '0:26:n', 200]]);
            expect(await loadEvents(store, 999)).toBeNull();
        });

        it('lists event ids per profile, ascending', async () => {
            const ids = [];
            for (const [ts, profile] of [[3, 'me'], [1, 'other'], [2, 'me']] as const) {
                const id = await store.addResult(record(ts, profile));
                await saveEvents(store, profile, id, []);
                ids.push(id);
            }
            expect(await store.listEventIds('me')).toEqual([ids[0], ids[2]]);
            await store.deleteEvents([ids[0]]);
            expect(await store.listEventIds('me')).toEqual([ids[2]]);
            expect(await store.listEventIds('other')).toEqual([ids[1]]);
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

        it('keeps one snapshot per profile', async () => {
            await store.putSnapshot(snapshot('me'));
            await store.putSnapshot({ ...snapshot('me'), resultCount: 2 });
            expect((await store.getSnapshot('me'))?.resultCount).toBe(2);
            await store.deleteSnapshot('me');
            expect(await store.getSnapshot('me')).toBeUndefined();
        });
    });

    describe(`${name}: profiles`, () => {
        it('starts with one local profile, "Me", in user scope', async () => {
            const store = makeStore();
            const me = await activeProfile(store, { scope: 'user', now: 5 });
            expect(me).toMatchObject({ id: 'me', name: 'Me', startDone: false, createdAt: 5 });
            expect(await store.listProfiles()).toHaveLength(1);
            await store.putProfile(newProfile('sam', 'Sam'));
            expect((await activeProfile(store, { scope: 'user', activeId: 'sam' })).id).toBe('sam');
            expect((await activeProfile(store, { scope: 'user', activeId: 'gone' })).id).toBe('me');
            // The board never decides the profile in user scope.
            expect((await activeProfile(store, { scope: 'user', board: 'sval:E464' })).id).toBe('me');
        });

        it('follows the board in per-board scope', async () => {
            const store = makeStore();
            expect((await activeProfile(store, { scope: 'per-board', board: 'uid:47F55316C11A3D1B' })).id).toBe('board:uid:47F55316C11A3D1B');
            expect((await activeProfile(store, { scope: 'per-board', board: 'example' })).name).toBe('Example');
        });
    });

    describe(`${name}: export and import (§8.4)`, () => {
        it('round-trips a profile with events (Merge into an empty profile)', async () => {
            const a = makeStore();
            await activeProfile(a, { scope: 'user' });
            for (const ts of [1, 2, 3]) {
                const id = await a.addResult(record(ts));
                await saveEvents(a, 'me', id, [hit(0, 0x61, '0:26:n', null), hit(ts * 100, 0x61, '0:26:n', 200)]);
            }
            const file = await exportProfile(a, 'me', { includeEvents: true, settings: { order: 'frequency' }, now: new Date(0), keybard: 'abc' });
            expect(file).toMatchObject({ format: 'keybard-practice', version: 1, exportedAt: '1970-01-01T00:00:00.000Z', keybard: 'abc' });
            const json = JSON.parse(JSON.stringify(file));

            const b = makeStore();
            const summary = await importIntoProfile(b, 'sam', json, 'merge');
            expect(summary).toEqual({ added: 3, duplicates: 0, invalid: 0, events: 3 });
            const imported = await b.listResults('sam');
            expect(imported.map(({ id: _id, profileId, ...rest }) => [profileId, rest])).toEqual(
                (await a.listResults('me')).map(({ id: _id, profileId: _p, ...rest }) => ['sam', rest]));
            expect((await loadEvents(b, imported[2].id))?.map((e) => e.t)).toEqual([0, 300]);
        });

        it('keeps layout-2 events (combo and double-tap hits) through save, export and import (M3)', async () => {
            const a = makeStore();
            await activeProfile(a, { scope: 'user' });
            const id = await a.addResult(record(1));
            const combo = { ...hit(100, 0x3d, '0:38+44:n', 100), phys: { ...hit(100, 0x3d, '0:38+44:n', 100).phys, index: 38 } };
            await saveEvents(a, 'me', id, [hit(0, 0x61, '0:26:n', null), combo, { ...hit(300, 0x62, '0:26*2:n', 200), phys: { ...hit(0, 0x61, '0:26:n', null).phys } }]);
            expect((await a.getEvents(id))?.layout).toBe(2);
            expect((await loadEvents(a, id))?.map((e) => e.path)).toEqual(['0:26:n', '0:38+44:n', '0:26*2:n']);
            const file = JSON.parse(JSON.stringify(await exportProfile(a, 'me', { includeEvents: true })));
            expect(file.events[0].layout).toBe(2);
            const b = makeStore();
            expect((await importIntoProfile(b, 'me', file, 'merge')).events).toBe(1);
            const [imported] = await b.listResults('me');
            expect((await b.getEvents(imported.id))?.layout).toBe(2);
            const out = await loadEvents(b, imported.id);
            expect(out?.map((e) => e.path)).toEqual(['0:26:n', '0:38+44:n', '0:26*2:n']);
            // The combo's extension word must not shift its time or the next event's.
            expect(out?.map((e) => e.t)).toEqual([0, 100, 300]);
            expect(out?.map((e) => e.raw)).toEqual([0, 100, 200]);
            expect(out?.map((e) => e.ttt)).toEqual([null, 100, 200]);
        });

        it('Merge skips results already present (same ts, n, t)', async () => {
            const store = makeStore();
            await store.addResult(record(1));
            const file = { format: 'keybard-practice', version: 1, results: [record(1), record(2), { bad: true }] };
            expect(await importIntoProfile(store, 'me', file, 'merge')).toEqual({ added: 1, duplicates: 1, invalid: 1, events: 0 });
            expect(await store.countResults('me')).toBe(2);
        });

        it('Replace clears the profile\'s results, events and snapshot first', async () => {
            const store = makeStore();
            const id = await store.addResult(record(9));
            await saveEvents(store, 'me', id, []);
            await store.putSnapshot(snapshot('me'));
            await store.addResult(record(5, 'other'));
            const file = { format: 'keybard-practice', version: 1, results: [record(1), record(9)] };
            // record(9) is in the file and was in the profile: Replace keeps the file's copy, no duplicate.
            expect(await importIntoProfile(store, 'me', file, 'replace')).toMatchObject({ added: 2, duplicates: 0 });
            expect((await store.listResults('me')).map((r) => r.ts)).toEqual([1, 9]);
            expect(await store.listEventIds('me')).toEqual([]);
            expect(await store.getSnapshot('me')).toBeUndefined();
            expect(await store.countResults('other')).toBe(1);
        });

        it('refuses a Replace with no valid result, leaving the profile as it was', async () => {
            const store = makeStore();
            const id = await store.addResult(record(9));
            await saveEvents(store, 'me', id, []);
            await store.putSnapshot(snapshot('me'));
            const file = { format: 'keybard-practice', version: 1, results: [{ bad: true }, { ...record(1), n: -1 }] };
            await expect(importIntoProfile(store, 'me', file, 'replace')).rejects.toThrow(ImportError);
            await expect(importIntoProfile(store, 'me', { ...file, results: [] }, 'replace')).rejects.toMatchObject({ reason: 'empty' });
            expect((await store.listResults('me')).map((r) => r.ts)).toEqual([9]);
            expect(await store.listEventIds('me')).toEqual([id]);
            expect(await store.getSnapshot('me')).toBeDefined();
        });

        it('writes nothing when a row of the import fails', async () => {
            const store = makeStore();
            const id = await store.addResult(record(9));
            await store.putSnapshot(snapshot('me'));
            // A function can't be stored (structured clone): the second row fails.
            const bad = { ...record(2), x: { ...record(2).x, km: (() => 'km') as unknown as string } };
            await expect(store.importResults('me', [{ result: record(1) }, { result: bad }], true)).rejects.toThrow();
            expect((await store.listResults('me')).map((r) => r.id)).toEqual([id]);
            expect(await store.getSnapshot('me')).toBeDefined();
            await expect(store.importResults('me', [{ result: record(1) }, { result: bad }], false)).rejects.toThrow();
            expect(await store.countResults('me')).toBe(1);
        });

        it('prunes events to the retention limit after an import', async () => {
            const a = makeStore();
            for (const ts of [1, 2, 3]) {
                const rid = await a.addResult(record(ts));
                await saveEvents(a, 'me', rid, [hit(0, 0x61, '0:26:n', null)]);
            }
            const file = JSON.parse(JSON.stringify(await exportProfile(a, 'me', { includeEvents: true })));
            const b = makeStore();
            for (const ts of [10, 11]) {
                const rid = await b.addResult(record(ts));
                await saveEvents(b, 'me', rid, []);
            }
            // The limit defaults to OWNER_Q5 (1,000 lessons); 2 here.
            await importIntoProfile(b, 'me', file, 'merge', { keepEvents: 2 });
            const kept = new Set(await b.listEventIds('me'));
            expect((await b.listResults('me')).filter((r) => kept.has(r.id)).map((r) => r.ts)).toEqual([10, 11]);
        });

        it('Reset clears one profile’s results, events and snapshot together, and nothing else', async () => {
            const store = makeStore();
            for (const ts of [1, 2]) await saveEvents(store, 'me', await store.addResult(record(ts)), []);
            await store.putSnapshot(snapshot('me'));
            const other = await store.addResult(record(5, 'other'));
            await saveEvents(store, 'other', other, []);
            await store.putSnapshot(snapshot('other'));
            await store.clearProgress('me');
            expect(await store.countResults('me')).toBe(0);
            expect(await store.listEventIds('me')).toEqual([]);
            expect(await store.getSnapshot('me')).toBeUndefined();
            expect(await store.countResults('other')).toBe(1);
            expect(await store.listEventIds('other')).toEqual([other]);
            expect(await store.getSnapshot('other')).toBeDefined();
            // An empty profile clears without error.
            await store.clearProgress('me');
        });

        it('export → reset → import round-trips byte-identical results', async () => {
            const store = makeStore();
            for (const ts of [3, 1, 2]) await store.addResult(record(ts));
            const before = JSON.stringify((await store.listResults('me')).map(({ id: _id, ...r }) => r));
            const file = JSON.parse(JSON.stringify(await exportProfile(store, 'me')));
            await store.clearProgress('me');
            await importIntoProfile(store, 'me', file, 'merge');
            expect(JSON.stringify((await store.listResults('me')).map(({ id: _id, ...r }) => r))).toBe(before);
        });
    });
}
