import { beforeEach, describe, expect, it } from 'vitest';
import { BackupService } from '../../../src/services/backup/backup.service';
import { fingerprintSvil, gunzipText, gzipText } from '../../../src/services/backup/codec';
import { boardFolderName } from '../../../src/services/backup/folder';
import { summarizeSvilChange } from '../../../src/services/backup/diff-summary';
import { MemoryBackupStore } from '../../../src/services/backup/store';
import { fileService } from '../../../src/services/file.service';
import { importService } from '../../../src/services/import.service';
import { prepareImport } from '../../../src/services/import-preflight';
import type { KeyboardInfo } from '../../../src/types/keyboard.types';
import { FakeDirectory } from './fake-folder';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const START = new Date(2026, 9, 6, 12, 0, 0).getTime();

const board = (keys: number[] = [4, 5, 6, 7, 8, 9, 10, 11]): KeyboardInfo => ({
    rows: 2, cols: 2, layers: 2, via_proto: 12, kbid: 'abcdef0123456789', name: 'Test',
    keymap: [keys.slice(0, 4), keys.slice(4, 8)],
    macros: [], macro_count: 4, combos: [], combo_count: 4, tapdances: [], tapdance_count: 4,
    key_overrides: [], key_override_count: 4, settings: {},
} as KeyboardInfo);
const svilOf = (kb: KeyboardInfo) => fileService.kbinfoToSvil(structuredClone(kb), true);

const KEY = 'sval:E46498769F365934';
let store: MemoryBackupStore;
let now: number;
let service: BackupService;
let folder: FakeDirectory;

const save = (kb: KeyboardInfo, kind: 'connected' | 'edited' = 'edited', pendingCount = 0, boardName = 'Left desk') =>
    service.saveSnapshot({ boardKey: KEY, boardName, svil: svilOf(kb), kind, pendingCount });

beforeEach(() => {
    store = new MemoryBackupStore();
    now = START;
    folder = new FakeDirectory('Backups');
    service = new BackupService(store, { now: () => now, pickFolder: async () => folder });
});

describe('snapshot codec', () => {
    it('round-trips through gzip and fingerprints content', async () => {
        const svil = svilOf(board());
        expect(await gunzipText(await gzipText(svil))).toBe(svil);
        expect(await fingerprintSvil(svil)).toBe(await fingerprintSvil(svilOf(board())));
        expect(await fingerprintSvil(svil)).not.toBe(await fingerprintSvil(svilOf(board([5, 5, 6, 7, 8, 9, 10, 11]))));
    });
});

describe('BackupService snapshots', () => {
    it('skips a save whose fingerprint matches the board\'s latest snapshot', async () => {
        expect(await save(board(), 'connected')).not.toBeNull();
        now += 1000;
        expect(await save(board())).toBeNull();
        expect(await service.listSnapshots()).toHaveLength(1);
        now += 1000;
        expect(await save(board([1, 5, 6, 7, 8, 9, 10, 11]))).not.toBeNull();
        expect(await service.listSnapshots()).toHaveLength(2);
    });

    it('records unsent changes, and clears the marker once they are applied', async () => {
        await save(board(), 'connected');
        now += 1000;
        const edited = await save(board([1, 2, 6, 7, 8, 9, 10, 11]), 'edited', 2);
        expect(edited).toMatchObject({ includesPending: true, pendingCount: 2, kind: 'edited', summary: '2 keys' });
        now += 1000;
        // Same content, now applied to the board.
        expect(await save(board([1, 2, 6, 7, 8, 9, 10, 11]), 'edited', 0)).toBeNull();
        const [latest] = await service.listSnapshots();
        expect(latest).toMatchObject({ id: edited!.id, includesPending: false, pendingCount: 0 });
    });

    it('stores what a restore needs and keeps board history separate', async () => {
        const kb = board();
        const snap = await save(kb, 'connected');
        await service.saveSnapshot({ boardKey: 'uid:1234', boardName: 'Other', svil: svilOf(kb), kind: 'connected', pendingCount: 0 });
        expect(await service.listSnapshots()).toHaveLength(2);
        expect(await service.getSvil(snap!.id)).toBe(svilOf(kb));
        expect(snap).toMatchObject({ boardKey: KEY, boardName: 'Left desk', savedAt: START, kind: 'connected', size: svilOf(kb).length });
    });

    it('applies retention on save without dropping the last connected snapshot', async () => {
        await save(board(), 'connected');
        // An edit on each of the following 40 days.
        for (let d = 1; d <= 40; d++) {
            now = START + d * DAY;
            await save(board([d, 5, 6, 7, 8, 9, 10, 11]));
        }
        const snaps = await service.listSnapshots();
        expect(snaps.some((s) => s.kind === 'connected')).toBe(true);
        // ~30 daily + one per older month + the protected connected one.
        expect(snaps.length).toBeLessThanOrEqual(34);
        expect(snaps.length).toBeGreaterThanOrEqual(30);
    });

    it('deletes a snapshot on request', async () => {
        const snap = await save(board(), 'connected');
        await service.deleteSnapshot(snap!.id);
        expect(await service.listSnapshots()).toEqual([]);
    });
});

describe('change summaries', () => {
    it('counts keys and sections', () => {
        const a = board();
        const b = board([1, 2, 3, 7, 8, 9, 10, 11]);
        b.macros = [{ mid: 0, actions: [['tap', 'KC_A']] }] as any;
        expect(summarizeSvilChange(svilOf(a), svilOf(b))).toBe('3 keys, 1 macro');
        expect(summarizeSvilChange(null, svilOf(b))).toBe('');
    });
});

describe('backup folder', () => {
    const dir = () => folder.dirs.get(boardFolderName('Left desk', KEY))!;

    it('writes latest.svil and a dated file per day as plain .svil', async () => {
        await service.chooseFolder();
        await save(board(), 'connected');
        now += HOUR;
        await save(board([1, 5, 6, 7, 8, 9, 10, 11]));
        now += DAY;
        await save(board([2, 5, 6, 7, 8, 9, 10, 11]));
        expect(boardFolderName('Left desk', KEY)).toBe('Left desk (sval-E46498769F365934)');
        const files = dir().files;
        expect([...files.keys()].sort()).toEqual(['2026-10-06.svil', '2026-10-07.svil', 'latest.svil']);
        // The day's file holds that day's latest state; it opens through the normal import parser.
        expect(files.get('2026-10-06.svil')).toBe(svilOf(board([1, 5, 6, 7, 8, 9, 10, 11])));
        expect(files.get('latest.svil')).toBe(svilOf(board([2, 5, 6, 7, 8, 9, 10, 11])));
        expect(fileService.parseContent(files.get('latest.svil')!).keymap?.[0][0]).toBe(2);
    });

    it('only prunes files listed in its manifest', async () => {
        await service.chooseFolder();
        await save(board(), 'connected');
        const d = dir();
        // Someone else's files, and a copy the user renamed.
        d.files.set('2026-08-01.svil', 'not ours');
        d.files.set('notes.txt', 'keep me');
        d.files.set('my favourite.svil', d.files.get('2026-10-06.svil')!);
        for (let i = 1; i <= 75; i++) {
            now = START + i * DAY;
            await save(board([i, 5, 6, 7, 8, 9, 10, 11]));
        }
        expect(d.files.get('2026-08-01.svil')).toBe('not ours');
        expect(d.files.get('notes.txt')).toBe('keep me');
        expect(d.files.has('my favourite.svil')).toBe(true);
        // Our own October 6 file aged out (October is represented by Oct 31).
        expect(d.files.has('2026-10-06.svil')).toBe(false);
        expect(d.files.has('2026-10-31.svil')).toBe(true);
        const ours = [...d.files.keys()].filter((n) => /^\d{4}-\d{2}-\d{2}\.svil$/.test(n) && n !== '2026-08-01.svil');
        expect(ours.length).toBeLessThanOrEqual(32);
    });

    it('survives a file the user already deleted', async () => {
        await service.chooseFolder();
        await save(board(), 'connected');
        dir().files.delete('2026-10-06.svil');
        for (let i = 1; i <= 40; i++) {
            now = START + i * DAY;
            await save(board([i, 5, 6, 7, 8, 9, 10, 11]));
        }
        expect(service.getFolderStatus().state).toBe('active');
    });

    it('pauses without prompting, keeps saving to IndexedDB, and writes what was missed on resume', async () => {
        await service.chooseFolder();
        await save(board(), 'connected');
        // A new visit: the browser has not re-granted access yet.
        folder.permission = 'prompt';
        const visit = new BackupService(store, { now: () => now, pickFolder: async () => folder });
        await visit.init();
        expect(visit.getFolderStatus().state).toBe('paused');
        expect(folder.requests).toBe(0);
        now += DAY;
        await visit.saveSnapshot({ boardKey: KEY, boardName: 'Left desk', svil: svilOf(board([3, 5, 6, 7, 8, 9, 10, 11])), kind: 'edited', pendingCount: 0 });
        expect(await visit.listSnapshots()).toHaveLength(2);
        expect(dir().files.has('2026-10-07.svil')).toBe(false);
        expect(await visit.resumeFolder()).toBe(true);
        expect(folder.requests).toBe(1);
        expect(visit.getFolderStatus().state).toBe('active');
        expect(dir().files.get('2026-10-07.svil')).toBe(svilOf(board([3, 5, 6, 7, 8, 9, 10, 11])));
        expect(dir().files.get('latest.svil')).toBe(svilOf(board([3, 5, 6, 7, 8, 9, 10, 11])));
    });

    it('stays paused when the user declines', async () => {
        await service.chooseFolder();
        folder.permission = 'prompt';
        folder.grantOnRequest = 'denied';
        const visit = new BackupService(store, { now: () => now, pickFolder: async () => folder });
        await visit.init();
        expect(await visit.resumeFolder()).toBe(false);
        expect(visit.getFolderStatus().state).toBe('paused');
    });

    it('forgets a folder that was moved or deleted', async () => {
        await service.chooseFolder();
        await save(board(), 'connected');
        folder.gone = true;
        now += HOUR;
        expect(await save(board([9, 5, 6, 7, 8, 9, 10, 11]))).not.toBeNull();
        expect(service.getFolderStatus().state).toBe('lost');
        expect(await store.getValue('folderHandle')).toBeUndefined();
        const visit = new BackupService(store, { now: () => now });
        await visit.init();
        expect(visit.getFolderStatus().state).toBe('none');
    });

    it('stops using the folder on request', async () => {
        await service.chooseFolder();
        await service.stopFolder();
        expect(service.getFolderStatus().state).toBe('none');
        now += HOUR;
        await save(board(), 'connected');
        expect(folder.dirs.size).toBe(0);
    });
});

describe('restoring a snapshot', () => {
    it('goes through the import path and only queues changes', async () => {
        const original = board();
        const snap = await save(original, 'connected');
        // The board was edited (or reset) since.
        const current = board([0, 0, 6, 7, 8, 9, 10, 11]);
        const restored = fileService.parseContent(await service.getSvil(snap!.id));
        const plan = prepareImport(restored, current);
        expect(plan.errors).toEqual([]);
        const queued: Array<{ desc: string; writeKey?: string; deferCommit?: boolean }> = [];
        const writes: string[] = [];
        const keyboardService = { updateKey: async (...args: number[]) => { writes.push(args.join(',')); }, saveSvil: async () => { writes.push('save'); } };
        await importService.syncWithKeyboard(plan.keyboard, current, async (desc, _cb, metadata) => { queued.push({ desc, ...metadata }); }, { keyboardService });
        expect(queued.map((q) => q.writeKey)).toEqual(['key:0:0:0', 'key:0:0:1', 'save-svil']);
        expect(plan.keyboard.keymap?.[0].slice(0, 2)).toEqual([4, 5]);
        // Nothing was written: the callbacks wait in the queue for Apply.
        expect(writes).toEqual([]);
    });
});
