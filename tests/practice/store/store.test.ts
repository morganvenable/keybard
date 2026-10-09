import { describe, expect, it } from 'vitest';
import { practiceDbName } from '@/features/practice/store/db';
import { ImportError, parseExport } from '@/features/practice/store/export';
import { MemoryPracticeStore } from '@/features/practice/store/memory';
import { DB_VERSION, isNewerSchema, migrate, STORES } from '@/features/practice/store/migrations';
import { boardIdentity, normalizeUid, profileIdFor } from '@/features/practice/store/profiles';
import {
    buildResultRecord,
    isValidResult,
    PracticeResult,
    type PracticeStep,
    resultRecordFromJson,
    selectByPaths,
} from '@/features/practice/store/results';
import { resolveKeymap } from '@/features/practice/keymap/resolver';
import type { KeystrokeEvent } from '@/features/practice/types';
import { svalDefault } from '../fixtures/boards';
import { hit, record, step } from '../fixtures/records';
import { practiceStoreContract } from './storeContract';

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
        const steps: PracticeStep[] = [
            step(0, 0x61, '0:26:n', 0),
            step(200, 0x61, '0:26:n', 200),
            step(450, 0x73, '0:20:n', 0, true),
            step(700, 0x73, '0:20:n', 250),
            step(1000, 0x21, '1:27:f', 150),
        ];
        const r = buildResultRecord({
            profileId: 'me', type: 'guided', textType: 'generated', ts: 1, steps,
            events, target: 175, src: 'usb', board: 'sval:E464', os: 'us', km: 'abcd',
        });
        // The trigger step (the first 'a') is ignored, as in keybr's makeStats.
        expect(r.h).toEqual({
            '97|0:26:n': { h: 1, m: 0, t: 200 },
            '115|0:20:n': { h: 2, m: 1, t: 250 },
            '33|1:27:f': { h: 1, m: 0, t: 150 },
        });
        expect([r.n, r.t, r.e]).toEqual([5, 1000, 1]);
        expect(r.k['20@0']).toEqual({ h: 2, m: 1, t: 250, s: 0 });
        expect(r.k['38@0']).toEqual({ h: 0, m: 0, t: 0, s: 1 });
        expect(r.k['27@1']).toEqual({ h: 1, m: 0, t: 180, s: 0 });
        expect(r.r).toEqual({ 32: { n: 1, t: 120 } });
        expect(r.x).toMatchObject({ obs: 1, inf: 4, src: 'usb', board: 'sval:E464' });
        expect(resultRecordFromJson(JSON.parse(JSON.stringify(r)))).toEqual(r);
    });

    it('drops samples outside keybr\'s 40–12,000 ms window', () => {
        const r = buildResultRecord({
            profileId: 'me', type: 'guided', textType: 'generated', ts: 1,
            steps: [step(0, 0x61, '0:26:n', 0), step(30, 0x61, '0:26:n', 30)],
            events: [hit(0, 0x61, '0:26:n', null), hit(30, 0x61, '0:26:n', 30)], target: 175, src: 'keymap', board: 'example', os: 'us', km: '',
        });
        expect(r.h).toEqual({});
    });

    it('leaves the step after a pause untimed, as makeStats does', () => {
        const r = buildResultRecord({
            profileId: 'me', type: 'guided', textType: 'generated', ts: 1,
            steps: [step(0, 0x61, '0:26:n', 0), step(200, 0x61, '0:26:n', 200), step(5200, 0x73, '0:20:n', 1000), step(5450, 0x73, '0:20:n', 250)],
            events: [], target: 175, src: 'keymap', board: 'example', os: 'us', km: '',
        });
        expect(r.h['115|0:20:n']).toEqual({ h: 2, m: 0, t: 250 });
        expect(r.t).toBe(450);
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

describe('practice database', () => {
    it('names the database per storage namespace (§8.1)', () => {
        expect(practiceDbName('')).toBe('keybard-practice');
        expect(practiceDbName('next')).toBe('next:keybard-practice');
    });
});

practiceStoreContract('memory store', () => new MemoryPracticeStore());

describe('profiles and board identity (§8.1, OWNER_Q6)', () => {
    it('normalizes board identity', () => {
        expect(boardIdentity({ kind: 'example' })).toBe('example');
        expect(boardIdentity({ kind: 'connected', serial: 'E46498769F365934' })).toBe('sval:E46498769F365934');
        expect(boardIdentity({ kind: 'connected', serial: 'sval:E46498769F365934' })).toBe('sval:E46498769F365934');
        expect(boardIdentity({ kind: 'connected', kbid: '47f55316c11a3d1b' })).toBe('uid:47F55316C11A3D1B');
        // An all-zero serial is not persistent (boardKeyFor): the UID decides.
        expect(boardIdentity({ kind: 'connected', serial: 'sval:0000000000000000', kbid: '47f55316c11a3d1b' })).toBe('uid:47F55316C11A3D1B');
        expect(boardIdentity({ kind: 'host', serial: '0000000000000000' })).toBe('unknown');
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

describe('export file format (§8.4)', () => {
    it('refuses other formats and newer versions', () => {
        expect(() => parseExport({ format: 'keybr' })).toThrow(ImportError);
        expect(() => parseExport({ format: 'keybard-practice', version: 2, results: [] })).toThrow(/newer Keybard/);
        expect(() => parseExport({ format: 'keybard-practice', version: 1 })).toThrow(/no results/);
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
