import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BackupProvider, EDIT_SETTLE_MS, boardKeyFor } from '../../src/contexts/BackupContext';
import { BackupService } from '../../src/services/backup/backup.service';
import { MemoryBackupStore } from '../../src/services/backup/store';
import { SerialSource } from '../../src/services/identity.service';
import type { KeyboardInfo } from '../../src/types/keyboard.types';

const state = vi.hoisted(() => ({
    keyboard: null as KeyboardInfo | null,
    isConnected: false,
    session: 1,
    pending: 0,
}));
vi.mock('@/contexts/KeyboardContext', () => ({ useKeyboard: () => ({ keyboard: state.keyboard, isConnected: state.isConnected, connectionSessionId: state.session, loadedFrom: 'Svalboard' }) }));
vi.mock('@/contexts/ChangesContext', () => ({ useChanges: () => ({ getPendingCount: () => state.pending }) }));

const board = (k0 = 4): KeyboardInfo => ({
    rows: 1, cols: 2, layers: 1, kbid: 'abcdef', name: 'Svalboard', keymap: [[k0, 5]],
    macros: [], macro_count: 0, combos: [], tapdances: [], key_overrides: [], settings: {},
} as KeyboardInfo);
const identity = { available: true, name: 'Desk', nameMaxBytes: 32, serialSource: SerialSource.FlashId, serial: 'sval:E46498769F365934' };

let store: MemoryBackupStore;
let service: BackupService;
const readIdentity = vi.fn(async () => identity);
const ui = () => <BackupProvider service={service} readIdentity={readIdentity}><span /></BackupProvider>;
const realTimeout = globalThis.setTimeout;
// Hashing and compression finish outside the fake clock; give them real time.
const settle = async () => { await act(async () => { await new Promise((r) => realTimeout(r, 50)); }); };

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    vi.setSystemTime(new Date(2026, 9, 6, 12));
    store = new MemoryBackupStore();
    service = new BackupService(store);
    state.keyboard = null; state.isConnected = false; state.session = 1; state.pending = 0;
    readIdentity.mockClear();
});
afterEach(() => { vi.useRealTimers(); });

describe('BackupProvider triggers', () => {
    it('snapshots a board once it has connected and loaded, keyed by its serial', async () => {
        const view = render(ui());
        state.isConnected = true; state.keyboard = board(); state.session = 2;
        view.rerender(ui());
        await settle();
        const snaps = await service.listSnapshots();
        expect(snaps).toHaveLength(1);
        expect(snaps[0]).toMatchObject({ boardKey: 'sval:E46498769F365934', boardName: 'Desk', kind: 'connected', includesPending: false });
    });

    it('saves an edited snapshot after the state settles, flagging unsent changes', async () => {
        state.isConnected = true; state.keyboard = board();
        const view = render(ui());
        await settle();
        state.keyboard = board(9); state.pending = 1;
        view.rerender(ui());
        await act(async () => { await vi.advanceTimersByTimeAsync(EDIT_SETTLE_MS - 100); });
        expect(await service.listSnapshots()).toHaveLength(1);
        await act(async () => { await vi.advanceTimersByTimeAsync(200); });
        await settle();
        const [latest] = await service.listSnapshots();
        expect(latest).toMatchObject({ kind: 'edited', includesPending: true, pendingCount: 1, summary: '1 key' });
    });

    it('saves right away when the tab is hidden', async () => {
        state.isConnected = true; state.keyboard = board();
        const view = render(ui());
        await settle();
        state.keyboard = board(7);
        view.rerender(ui());
        Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
        await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
        await settle();
        Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
        expect(await service.listSnapshots()).toHaveLength(2);
    });

    it('does not back up a layout opened from a file', async () => {
        state.isConnected = true; state.keyboard = board();
        const view = render(ui());
        await settle();
        // loadFromFile: a new session, offline.
        state.isConnected = false; state.session = 3; state.keyboard = board(8);
        view.rerender(ui());
        await act(async () => { await vi.advanceTimersByTimeAsync(EDIT_SETTLE_MS * 2); });
        await settle();
        expect(await service.listSnapshots()).toHaveLength(1);
    });
});

describe('boardKeyFor', () => {
    it('prefers the persistent serial and falls back to the UID', () => {
        expect(boardKeyFor(identity, board())).toBe('sval:E46498769F365934');
        expect(boardKeyFor(null, board())).toBe('uid:ABCDEF');
        expect(boardKeyFor({ ...identity, serialSource: SerialSource.None, serial: 'sval:0000000000000000' }, board())).toBe('uid:ABCDEF');
    });
});
