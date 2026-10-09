import { IDBFactory } from 'fake-indexeddb';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createWorkspaceStore } from '@/layout/workspace-store';
import type { PracticeEngineState } from '@/features/practice/PracticeProvider';
import PracticeEngineHost from '@/features/practice/state/PracticeEngineHost';
import { NOTICE_TEXT, resetPracticePageSession } from '@/features/practice/state/controller';
import { Lesson } from '@/features/practice/vendor/keybr/lesson/index.ts';
import { LCG } from '@/features/practice/vendor/keybr/rand/index.ts';
import { keyService } from '@/services/key.service';
import type { KeyboardInfo } from '@/types/keyboard.types';
import { rebind, svalDefault } from '../fixtures/boards';

// The keymap Practice follows (docs/practice/spec.md §5.4, §12 M1b acceptance "Keymap source rules"):
// a connected board's confirmed keymap (originalKeyboard), with unsent edits excluded until Apply;
// a loaded file's draft as it is edited. Remapping one letter restarts only that letter.

const ctx = vi.hoisted(() => ({
    keyboard: {
        keyboard: null as KeyboardInfo | null,
        originalKeyboard: null as KeyboardInfo | null,
        isConnected: false,
        hasUnsavedChanges: false,
        loadedFrom: 'sval-default.svil' as string | null,
        defaultLayerIndex: null as number | null,
        isWebHIDSupported: true,
    },
    layout: { internationalLayout: 'us' },
    panels: { workspace: 'practice', practicePage: 'lessons' },
}));

vi.mock('@/contexts/KeyboardContext', () => ({ useKeyboard: () => ctx.keyboard }));
vi.mock('@/contexts/LayoutSettingsContext', () => ({ useLayoutSettings: () => ctx.layout }));
vi.mock('@/contexts/PanelsContext', () => ({ usePanels: () => ctx.panels }));
// The fixtures import the real loader, so the stand-in builds the content from the actual module.
vi.mock('@/features/practice/content/loader', async (importActual) => {
    const actual = await importActual<typeof import('@/features/practice/content/loader')>();
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const assets = resolve(__dirname, '../../../src/features/practice/content/assets');
    const content = {
        model: actual.englishModelFromBytes(new Uint8Array(readFileSync(resolve(assets, 'model-en.data')))),
        words: JSON.parse(readFileSync(resolve(assets, 'words-en.json'), 'utf8')) as string[],
    };
    return { ...actual, loadEnglishContent: async () => content };
});

const cp = (s: string) => s.codePointAt(0)!;

function renderHost() {
    const store = createWorkspaceStore<PracticeEngineState>({ running: true, controller: null });
    const view = render(<PracticeEngineHost store={store} />);
    return { store, view, rerender: () => view.rerender(<PracticeEngineHost store={store} />) };
}

async function ready(store: ReturnType<typeof renderHost>['store']) {
    await vi.waitFor(() => expect(store.get().controller?.session).toBeTruthy());
    const c = store.get().controller!;
    if (c.session!.firstRun) await act(async () => { await c.startPractice('qwerty', 75); });
    return c;
}

/** Types a whole lesson, so every included letter gets samples. */
async function lesson(c: NonNullable<PracticeEngineState['controller']>) {
    c.setFocused(true);
    c.resume();
    const run = c.run!;
    let t = 1000;
    await act(async () => {
        for (let n = 0; n < 2000 && !run.textInput.completed; n++) c.onInput({ type: 'input', timeStamp: (t += 150), inputType: 'appendChar', codePoint: run.expected!, timeToType: 0 });
    });
    expect(run.textInput.completed).toBe(true);
    await vi.waitFor(() => expect(c.run).not.toBe(run));
}

const samples = (c: NonNullable<PracticeEngineState['controller']>, ch: string) =>
    c.session!.keyStatsMap.get(c.session!.lesson.letters.find((l) => l.codePoint === cp(ch))!).samples.length;

/** A board with `ch` moved to the free key 59 (and its old key cleared). */
function moved(board: KeyboardInfo, ch: string, from: number): KeyboardInfo {
    return rebind(rebind(board, 0, from, keyService.parse('KC_NO')), 0, 59, keyService.parse(`KC_${ch.toUpperCase()}`));
}

beforeEach(() => {
    // A fresh IndexedDB per test: the real store opens, so Storage off never shows.
    vi.stubGlobal('indexedDB', new IDBFactory());
    Lesson.rng = LCG(31);
    resetPracticePageSession();
    const board = svalDefault();
    Object.assign(ctx.keyboard, { keyboard: board, originalKeyboard: structuredClone(board), isConnected: false, hasUnsavedChanges: false, loadedFrom: 'sval-default.svil' });
});

afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
});

describe('Keymap source rules (§5.4)', () => {
    it('a loaded file: editing the draft restarts only the edited letter', async () => {
        const { store, rerender } = renderHost();
        const c = await ready(store);
        expect(c.sourceName).toBe('Loaded file');
        await lesson(c);
        const index = c.session!.resolution.primary(cp('a'))!.index;
        expect(samples(c, 'a')).toBe(1);
        ctx.keyboard.keyboard = moved(ctx.keyboard.keyboard!, 'a', index);
        rerender();
        await vi.waitFor(() => expect(samples(c, 'a')).toBe(0));
        expect(samples(c, 's')).toBe(1);
        expect(c.status).toMatchObject({ id: 'keymap-changed' });
    });

    it('a connected board with Live Updating off: the letter restarts only after Apply; Unsent changes shows meanwhile', async () => {
        Object.assign(ctx.keyboard, { isConnected: true, loadedFrom: 'Svalboard' });
        const { store, rerender } = renderHost();
        const c = await ready(store);
        expect(c.sourceName).toBe('Connected board');
        await lesson(c);
        const index = c.session!.resolution.primary(cp('a'))!.index;
        const session = c.session;

        // An unsent edit: the draft changes, the board (originalKeyboard) doesn't.
        ctx.keyboard.keyboard = moved(ctx.keyboard.keyboard!, 'a', index);
        ctx.keyboard.hasUnsavedChanges = true;
        rerender();
        expect(c.status).toMatchObject({ id: 'unsent-changes', text: NOTICE_TEXT['unsent-changes'] });
        await new Promise((r) => setTimeout(r, 20));
        expect(c.session).toBe(session);
        expect(samples(c, 'a')).toBe(1);

        // Apply: the board now runs the edit.
        ctx.keyboard.originalKeyboard = structuredClone(ctx.keyboard.keyboard);
        ctx.keyboard.hasUnsavedChanges = false;
        rerender();
        await vi.waitFor(() => expect(samples(c, 'a')).toBe(0));
        expect(samples(c, 's')).toBe(1);
        expect(c.status?.id).toBe('keymap-changed');
    });

    it('a connected board with Live Updating on: an edit reaches the board at once and restarts only that letter', async () => {
        Object.assign(ctx.keyboard, { isConnected: true, loadedFrom: 'Svalboard' });
        const { store, rerender } = renderHost();
        const c = await ready(store);
        await lesson(c);
        const index = c.session!.resolution.primary(cp('a'))!.index;
        const edited = moved(ctx.keyboard.keyboard!, 'a', index);
        ctx.keyboard.keyboard = edited;
        ctx.keyboard.originalKeyboard = structuredClone(edited);
        rerender();
        await vi.waitFor(() => expect(samples(c, 'a')).toBe(0));
        expect(samples(c, 'd')).toBe(1);
    });

    it('the OS layout is part of the keymap: changing it restarts the lesson', async () => {
        const { store, rerender } = renderHost();
        const c = await ready(store);
        const run = c.run;
        ctx.layout.internationalLayout = 'german';
        rerender();
        await vi.waitFor(() => expect(c.run).not.toBe(run));
        ctx.layout.internationalLayout = 'us';
    });

    it('leaving the Lessons page pauses; a hidden tab pauses', async () => {
        const { store, rerender } = renderHost();
        const c = await ready(store);
        c.setFocused(true);
        c.resume();
        expect(c.paused).toBe(false);
        ctx.panels.practicePage = 'progress';
        rerender();
        expect(c.paused).toBe(true);
        ctx.panels.practicePage = 'lessons';
        rerender();
        c.resume();
        Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
        act(() => { document.dispatchEvent(new Event('visibilitychange')); });
        expect(c.paused).toBe(true);
        Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    });

    it('Board connected · lesson restarted after a connect remounts Practice mid-lesson (§5.3)', async () => {
        const first = renderHost();
        const c = await ready(first.store);
        c.setFocused(true);
        c.resume();
        c.onInput({ type: 'input', timeStamp: 10, inputType: 'appendChar', codePoint: c.run!.expected!, timeToType: 0 });
        // A connect unmounts EditorLayout and Practice with it.
        first.view.unmount();
        Object.assign(ctx.keyboard, { isConnected: true, loadedFrom: 'Svalboard' });
        const second = renderHost();
        const d = await ready(second.store);
        expect(d).not.toBe(c);
        expect(d.status).toMatchObject({ id: 'board-connected', text: NOTICE_TEXT['board-connected'] });
    });
});
