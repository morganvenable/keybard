import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OWNER_Q11_CAPS_LOCK_OUTRANKS_STORAGE } from '@/constants/owner-decisions';
import {
    type ControllerDeps,
    type KeymapInput,
    NOTICE_TEXT,
    PracticeController,
    resetPracticePageSession,
    SPEC_STATUS_PRIORITY,
    STATUS_PRIORITY,
} from '@/features/practice/state/controller';
import { Progress } from '@/features/practice/state/progress';
import { DEFAULT_SETTINGS, type PracticeSettings } from '@/features/practice/state/settings';
import { MemoryPracticeStore } from '@/features/practice/store/memory';
import type { ResultRecord } from '@/features/practice/types';
import { Lesson } from '@/features/practice/vendor/keybr/lesson/index.ts';
import { LCG } from '@/features/practice/vendor/keybr/rand/index.ts';
import { keyService } from '@/services/key.service';
import { rebind, svalDefault } from '../fixtures/boards';
import { englishModel, englishWords } from '../fixtures/content';
import { record } from '../fixtures/records';

// The controller's session rebuilds (spec §6.8, §9.7) and the saving rules (§5.3): a long history
// replays in chunks that yield, a rebuild on the same keymap and history reuses the key stats, a
// rebuild asked for during a save waits for it, and a failed save shows Storage off.

const keymapInput = (overrides: Partial<KeymapInput> = {}): KeymapInput => ({
    board: svalDefault(), source: 'example', sourceLabel: 'QWERTY example (demo)', layoutId: 'us', defaultLayer: 0,
    connected: false, unsentChanges: false, hidSupported: true, ...overrides,
});

/** A store whose result writes wait for `release()`, or fail. */
class TestStore extends MemoryPracticeStore {
    gate: Promise<void> | null = null;
    release = () => {};
    fail = false;
    hold() {
        this.gate = new Promise((resolve) => { this.release = () => { this.gate = null; resolve(); }; });
    }
    override async addResult(result: ResultRecord) {
        if (this.gate) await this.gate;
        if (this.fail) throw new Error('quota');
        return super.addResult(result);
    }
}

function controller(store: MemoryPracticeStore, deps: Partial<ControllerDeps> = {}, settings: Partial<PracticeSettings> = {}, persistent = true) {
    return new PracticeController({
        loadSettings: () => ({ ...DEFAULT_SETTINGS, ...settings }),
        saveSettings: () => true,
        openStore: async () => ({ store, persistent }),
        loadContent: async () => ({ model: englishModel(), words: englishWords() }),
        ...deps,
    });
}

async function ready(c: PracticeController) {
    c.setKeymap(keymapInput());
    await c.start();
    await vi.waitFor(() => expect(c.session).not.toBeNull());
}

async function withHistory(n: number) {
    const store = new TestStore();
    const base = Date.now() - n * 60_000;
    for (let i = 0; i < n; i++) await store.addResult(record(base + i * 60_000));
    return store;
}

/** Types the rest of the controller's lesson. */
function finishLesson(c: PracticeController) {
    const run = c.run!;
    let t = 1000;
    for (let guard = 0; guard < 3000 && !run.textInput.completed; guard++) {
        c.onInput({ type: 'input', timeStamp: (t += 120), inputType: 'appendChar', codePoint: run.expected!, timeToType: 0 });
    }
    return run;
}

async function typing(c: PracticeController) {
    await c.startPractice('learn', 75);
    c.setActive(true);
    c.setFocused(true);
    c.resume();
}

beforeEach(() => {
    Lesson.rng = LCG(13);
    resetPracticePageSession();
});
afterEach(() => vi.restoreAllMocks());

describe('Session rebuilds (§6.8, §9.7)', () => {
    it('replays a long history in chunks that yield', async () => {
        const store = await withHistory(250);
        const yieldToBrowser = vi.fn(async () => {});
        const c = controller(store, { yieldToBrowser });
        await ready(c);
        // 250 results: chunks of 100, 100 and 50, each followed by a yield.
        expect(yieldToBrowser).toHaveBeenCalledTimes(3);
        expect(c.session!.results).toHaveLength(250);
        expect(c.session!.progress.resultCount).toBe(250);
        expect(c.building).toBe(false);
        expect(c.run).not.toBeNull();
    });

    it('a lesson-shaping change on the same keymap starts from the current key stats, without a replay', async () => {
        const store = await withHistory(250);
        const yieldToBrowser = vi.fn(async () => {});
        const c = controller(store, { yieldToBrowser });
        await ready(c);
        const first = c.session!;
        const stats = JSON.stringify(first.progress.snapshot('me', first.fingerprint, 0).keyStats);
        const seed = vi.spyOn(Progress.prototype, 'seed');
        const seedAsync = vi.spyOn(Progress.prototype, 'seedAsync');
        c.update({ naturalWords: false });
        // Synchronous: the new session and lesson are there at once.
        expect(c.session).not.toBe(first);
        expect(c.session!.seeded).toBe(true);
        expect(seed).not.toHaveBeenCalled();
        expect(seedAsync).not.toHaveBeenCalled();
        expect(yieldToBrowser).toHaveBeenCalledTimes(3);
        expect(JSON.stringify(c.session!.progress.snapshot('me', first.fingerprint, 0).keyStats)).toBe(stats);
        expect(c.session!.progress.summaryStats.count).toBe(first.progress.summaryStats.count);
    });

    it('a keymap change replays in chunks; the old session stays, paused, until the replay ends', async () => {
        const store = await withHistory(250);
        let hold = false;
        const waiting: (() => void)[] = [];
        const c = controller(store, { yieldToBrowser: () => (hold ? new Promise<void>((resolve) => waiting.push(resolve)) : Promise.resolve()) });
        await ready(c);
        c.setActive(true);
        c.setFocused(true);
        c.resume();
        expect(c.paused).toBe(false);
        const old = c.session!;
        hold = true;
        c.setKeymap(keymapInput({ board: rebind(svalDefault(), 0, 15, keyService.parse('KC_Z')) }));
        await vi.waitFor(() => expect(c.building).toBe(true));
        expect(c.session).toBe(old);
        expect(c.paused).toBe(true);
        expect(waiting).toHaveLength(1);
        await vi.waitFor(() => {
            waiting.splice(0).forEach((resolve) => resolve());
            expect(c.building).toBe(false);
        });
        expect(c.session).not.toBe(old);
        expect(c.session!.fingerprint).not.toBe(old.fingerprint);
        expect(c.session!.results).toHaveLength(250);
        expect(c.status?.id).toBe('keymap-changed');
    });

    it('a newer rebuild stops a replay that is still running', async () => {
        const store = await withHistory(250);
        let hold = false;
        const waiting: (() => void)[] = [];
        const c = controller(store, { yieldToBrowser: () => (hold ? new Promise<void>((resolve) => waiting.push(resolve)) : Promise.resolve()) });
        await ready(c);
        hold = true;
        c.setKeymap(keymapInput({ board: rebind(svalDefault(), 0, 15, keyService.parse('KC_Z')) }));
        await vi.waitFor(() => expect(c.building).toBe(true));
        const z = c.session!;
        c.setKeymap(keymapInput({ board: rebind(svalDefault(), 0, 15, keyService.parse('KC_Q')) }));
        await vi.waitFor(() => expect(waiting.length).toBeGreaterThanOrEqual(2));
        await vi.waitFor(() => {
            waiting.splice(0).forEach((resolve) => resolve());
            expect(c.building).toBe(false);
        });
        const q = await import('@/features/practice/state/session').then((m) => m.resolvePracticeKeymap({ board: rebind(svalDefault(), 0, 15, keyService.parse('KC_Q')), layoutId: 'us', defaultLayer: 0 }));
        expect(c.session).not.toBe(z);
        expect(c.session!.fingerprint).toBe(q.fingerprint);
    });
});

describe('Saving a lesson (§5.3)', () => {
    it('a rebuild asked for while the lesson is being saved waits for the save, and keeps the lesson', async () => {
        const store = new TestStore();
        const c = controller(store, {}, { targetSpeed: 75 });
        await ready(c);
        await typing(c);
        const before = c.session!;
        store.hold();
        finishLesson(c);
        c.update({ naturalWords: false });
        // Deferred: the session doing the save stays until the save is done.
        expect(c.session).toBe(before);
        store.release();
        await vi.waitFor(() => expect(c.session).not.toBe(before));
        const s = c.session!;
        expect(s.settings.naturalWords).toBe(false);
        expect(s.records).toHaveLength(1);
        expect(s.results).toHaveLength(1);
        expect(s.progress.resultCount).toBe(1);
        expect(s.lastLesson()).not.toBeNull();
        expect(c.run).not.toBeNull();
    });

    it('a failed write shows Progress isn\'t being saved until a later write succeeds', async () => {
        const store = new TestStore();
        store.fail = true;
        const c = controller(store, {}, { targetSpeed: 75 });
        await ready(c);
        await typing(c);
        const run = finishLesson(c);
        await vi.waitFor(() => expect(c.run).not.toBe(run));
        expect(c.storageError).toBe(true);
        expect(c.storageOff).toBe(true);
        expect(c.status).toMatchObject({ id: 'storage-off', text: NOTICE_TEXT['storage-off'] });

        store.fail = false;
        c.setFocused(true);
        c.resume();
        const next = finishLesson(c);
        await vi.waitFor(() => expect(c.run).not.toBe(next));
        expect(c.storageOff).toBe(false);
        expect(c.status?.id).not.toBe('storage-off');
    });
});

describe('Status priority (§5.2, OWNER_Q11)', () => {
    it('keeps the spec order, with Caps Lock first while OWNER_Q11 is on', () => {
        expect(SPEC_STATUS_PRIORITY[0]).toBe('storage-off');
        if (OWNER_Q11_CAPS_LOCK_OUTRANKS_STORAGE) {
            expect(STATUS_PRIORITY).toEqual(['caps-lock', ...SPEC_STATUS_PRIORITY.filter((id) => id !== 'caps-lock')]);
        } else {
            expect(STATUS_PRIORITY).toEqual(SPEC_STATUS_PRIORITY);
        }
    });

    it.runIf(OWNER_Q11_CAPS_LOCK_OUTRANKS_STORAGE)('Caps Lock is on shows over Storage off', async () => {
        const c = controller(new MemoryPracticeStore(), {}, {}, false);
        await ready(c);
        await typing(c);
        expect(c.status?.id).toBe('storage-off');
        c.onKey({ type: 'keydown', timeStamp: 1, code: 'KeyA', key: 'A', modifiers: ['CapsLock'] });
        expect(c.status).toMatchObject({ id: 'caps-lock', text: NOTICE_TEXT['caps-lock'] });
        c.onKey({ type: 'keydown', timeStamp: 2, code: 'KeyA', key: 'a', modifiers: [] });
        expect(c.status?.id).toBe('storage-off');
    });
});
