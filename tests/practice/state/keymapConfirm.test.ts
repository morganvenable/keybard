import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    KEYMAP_CONFIRM_MS,
    type KeymapInput,
    keymapChangeAffects,
    NOTICE_TEXT,
    PracticeController,
    resetPracticePageSession,
} from '@/features/practice/state/controller';
import { DEFAULT_SETTINGS } from '@/features/practice/state/settings';
import { MemoryPracticeStore } from '@/features/practice/store/memory';
import { Lesson } from '@/features/practice/vendor/keybr/lesson/index.ts';
import { LCG } from '@/features/practice/vendor/keybr/rand/index.ts';
import { keyService } from '@/services/key.service';
import type { KeyboardInfo } from '@/types/keyboard.types';
import { rebind, svalDefault } from '../fixtures/boards';
import { englishModel, englishWords } from '../fixtures/content';

// A keymap change restarts the lesson only once it is real (§5.4): it must hold KEYMAP_CONFIRM_MS
// while the page is visible and its window focused. A read that flickers (a stale board reply read as
// a new default layer, the window losing focus to a screenshot tool) leaves the lesson alone, and a
// real change waits for the lesson in progress to end instead of throwing it away.

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const cp = (s: string) => s.codePointAt(0)!;
const HOLD = KEYMAP_CONFIRM_MS + 300;

const BOARD = svalDefault();
const connected = (overrides: Partial<KeymapInput> = {}): KeymapInput => ({
    board: BOARD, source: 'connected', sourceLabel: 'Svalboard', layoutId: 'us', defaultLayer: 0,
    connected: true, unsentChanges: false, hidSupported: true, ...overrides,
});

async function ready() {
    const c = new PracticeController({
        loadSettings: () => ({ ...DEFAULT_SETTINGS }),
        saveSettings: () => true,
        openStore: async () => ({ store: new MemoryPracticeStore(), persistent: true }),
        loadContent: async () => ({ model: englishModel(), words: englishWords() }),
    });
    c.setKeymap(connected());
    await c.start();
    await vi.waitFor(() => expect(c.session).not.toBeNull());
    await c.startPractice('learn', 75);
    c.setActive(true);
    c.setFocused(true);
    c.resume();
    return c;
}

/** Types `n` characters of the lesson. */
function type(c: PracticeController, n: number) {
    let t = 1000;
    for (let i = 0; i < n; i++) c.onInput({ type: 'input', timeStamp: (t += 150), inputType: 'appendChar', codePoint: c.run!.expected!, timeToType: 0 });
}

function finish(c: PracticeController) {
    const run = c.run!;
    let t = 100_000;
    for (let i = 0; i < 3000 && !run.textInput.completed; i++) {
        c.onInput({ type: 'input', timeStamp: (t += 150), inputType: 'appendChar', codePoint: run.expected!, timeToType: 0 });
    }
    return run;
}

const lessonText = (c: PracticeController) =>
    new Set(Array.from({ length: c.run!.textInput.length }, (_, i) => c.run!.textInput.at(i).codePoint));

/** A board with one lowercase letter that the current lesson never types moved off layer 0. */
function untouchedLetterRemoved(c: PracticeController): KeyboardInfo {
    const text = lessonText(c);
    const letter = [...'qzxjkvbpygfwmucldrhsnioate'].find((ch) => !text.has(cp(ch)) && !text.has(cp(ch.toUpperCase())));
    if (!letter) throw new Error('every letter is in the lesson');
    const index = c.session!.resolution.primary(cp(letter))!.index;
    return rebind(BOARD, 0, index, keyService.parse('KC_NO'));
}

/** A board with a letter the current lesson types moved off layer 0. */
function lessonLetterRemoved(c: PracticeController): KeyboardInfo {
    const index = c.session!.resolution.primary(c.run!.textInput.at(0).codePoint)!.index;
    return rebind(BOARD, 0, index, keyService.parse('KC_NO'));
}

beforeEach(() => {
    Lesson.rng = LCG(13);
    resetPracticePageSession();
});
afterEach(() => vi.restoreAllMocks());

describe('Keymap changes must be real to restart the lesson (§5.4)', () => {
    it('a default layer that flickers (a misread layer state) keeps the lesson and shows nothing', async () => {
        const c = await ready();
        type(c, 3);
        const run = c.run;
        const session = c.session;
        c.setKeymap(connected({ defaultLayer: 3 }));
        await sleep(150);
        c.setKeymap(connected({ defaultLayer: 0 }));
        await sleep(HOLD);
        expect(c.run).toBe(run);
        expect(c.session).toBe(session);
        expect(c.status).toBeNull();
        expect(c.run!.textInput.pos).toBe(3);
    });

    it('a change read while the window has lost focus waits; one gone by the time focus returns does nothing', async () => {
        const c = await ready();
        type(c, 2);
        const run = c.run;
        // A screenshot tool takes focus: the text blurs, the window blurs.
        c.setFocused(false);
        c.setWindowFocused(false);
        c.setKeymap(connected({ defaultLayer: 3 }));
        await sleep(HOLD);
        expect(c.session!.fingerprint).not.toBe('');
        expect(c.run).toBe(run);
        // Focus comes back; the next reads are right again.
        c.setWindowFocused(true);
        await sleep(100);
        c.setKeymap(connected({ defaultLayer: 0 }));
        await sleep(HOLD);
        expect(c.run).toBe(run);
        expect(c.status).toBeNull();
        c.setFocused(true);
        c.resume();
        expect(c.paused).toBe(false);
        expect(c.run!.textInput.pos).toBe(2);
    });

    it('a change read while the page is hidden waits, and is confirmed only after it is visible again', async () => {
        const c = await ready();
        const session = c.session!;
        c.setVisible(false);
        c.setKeymap(connected({ board: lessonLetterRemoved(c) }));
        await sleep(HOLD);
        expect(c.session).toBe(session);
        c.setVisible(true);
        await sleep(KEYMAP_CONFIRM_MS / 2);
        expect(c.session).toBe(session);
        await vi.waitFor(() => expect(c.session).not.toBe(session), { timeout: 2000 });
        expect(c.status).toMatchObject({ id: 'keymap-changed' });
    });

    it('a failed read leaves the input alone: no change, no restart', async () => {
        // KeyboardContext keeps the last default layer when a layer read throws, so Practice
        // gets the same input again; a reconnect hands it an equal board.
        const c = await ready();
        type(c, 2);
        const run = c.run;
        c.setKeymap(connected());
        c.setKeymap(connected({ board: structuredClone(BOARD) }));
        await sleep(HOLD);
        expect(c.run).toBe(run);
        expect(c.status).toBeNull();
    });

    it('a real change before the first keystroke restarts the lesson once it holds', async () => {
        const c = await ready();
        const run = c.run;
        c.setKeymap(connected({ board: lessonLetterRemoved(c) }));
        await sleep(KEYMAP_CONFIRM_MS / 2);
        expect(c.run).toBe(run);
        await vi.waitFor(() => expect(c.run).not.toBe(run), { timeout: 2000 });
        expect(c.status).toMatchObject({ id: 'keymap-changed', text: NOTICE_TEXT['keymap-changed'] });
    });

    it('a real change during a lesson keeps the lesson and says the next lesson uses it; Restart lesson applies it', async () => {
        const c = await ready();
        type(c, 4);
        const run = c.run;
        const before = c.session!.fingerprint;
        c.setKeymap(connected({ board: lessonLetterRemoved(c) }));
        await vi.waitFor(() => expect(c.status).toMatchObject({ id: 'keymap-pending', text: NOTICE_TEXT['keymap-pending'] }), { timeout: 2000 });
        expect(c.run).toBe(run);
        expect(c.run!.textInput.pos).toBe(4);
        expect(c.session!.fingerprint).toBe(before);
        c.regenerate();
        await vi.waitFor(() => expect(c.session!.fingerprint).not.toBe(before));
        expect(c.run).not.toBe(run);
        expect(c.status).toMatchObject({ id: 'keymap-changed' });
    });

    it('a real change during a lesson applies when the lesson ends', async () => {
        const c = await ready();
        type(c, 4);
        const before = c.session!.fingerprint;
        c.setKeymap(connected({ board: lessonLetterRemoved(c) }));
        await vi.waitFor(() => expect(c.status?.id).toBe('keymap-pending'), { timeout: 2000 });
        const run = finish(c);
        expect(run.textInput.completed).toBe(true);
        await vi.waitFor(() => expect(c.session!.fingerprint).not.toBe(before));
        expect(c.run).not.toBe(run);
        expect(c.session!.results.length).toBe(1);
    });

    it('a change the lesson never types keeps the lesson without a notice, and the next lesson uses it', async () => {
        const c = await ready();
        type(c, 4);
        const run = c.run;
        const before = c.session!.fingerprint;
        c.setKeymap(connected({ board: untouchedLetterRemoved(c) }));
        await sleep(HOLD);
        expect(c.run).toBe(run);
        expect(c.status).toBeNull();
        expect(c.session!.fingerprint).toBe(before);
        finish(c);
        await vi.waitFor(() => expect(c.session!.fingerprint).not.toBe(before));
    });

    it('a change that goes back before the lesson ends is dropped', async () => {
        const c = await ready();
        type(c, 4);
        const before = c.session!.fingerprint;
        c.setKeymap(connected({ board: lessonLetterRemoved(c) }));
        await vi.waitFor(() => expect(c.status?.id).toBe('keymap-pending'), { timeout: 2000 });
        c.setKeymap(connected());
        await vi.waitFor(() => expect(c.status).toBeNull());
        finish(c);
        await sleep(50);
        expect(c.session!.fingerprint).toBe(before);
    });

    it('choosing an OS layout applies at once', async () => {
        const c = await ready();
        type(c, 2);
        const run = c.run;
        c.setKeymap(connected({ layoutId: 'german' }));
        await vi.waitFor(() => expect(c.run).not.toBe(run), { timeout: KEYMAP_CONFIRM_MS - 100 });
        expect(c.session!.keymap.layoutId).toBe('german');
    });
});

describe('keymapChangeAffects', () => {
    it('compares only the characters the lesson types', async () => {
        const { resolveKeymap } = await import('@/features/practice/keymap/resolver');
        const resolve = (board: KeyboardInfo) => resolveKeymap({ keymap: board.keymap!, rows: BOARD.rows, cols: BOARD.cols });
        const current = resolve(BOARD);
        const qIndex = current.primary(cp('q'))!.index;
        const next = resolve(rebind(BOARD, 0, qIndex, keyService.parse('KC_NO')));
        expect(keymapChangeAffects([cp('a'), cp('s')], current, next)).toBe(false);
        expect(keymapChangeAffects([cp('a'), cp('q')], current, next)).toBe(true);
    });
});
