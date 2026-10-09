import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createWorkspaceStore } from '@/layout/workspace-store';
import type { PracticeEngineState } from '@/features/practice/PracticeProvider';
import PracticeEngineHost from '@/features/practice/state/PracticeEngineHost';
import { resetPracticePageSession } from '@/features/practice/state/controller';
import type { KeyboardInfo } from '@/types/keyboard.types';
import { svalDefault } from '../fixtures/boards';

// PracticeEngineHost wires Live · USB to the board (spec §9.3): the reader calls keyboardService
// directly, never KeyboardContext's pollMatrix (which sets a heartbeat state on every poll), and only
// while the practice text has focus.

const ctx = vi.hoisted(() => ({
    keyboard: {
        keyboard: null as KeyboardInfo | null,
        originalKeyboard: null as KeyboardInfo | null,
        isConnected: true,
        hasUnsavedChanges: false,
        loadedFrom: 'Svalboard' as string | null,
        defaultLayerIndex: 0 as number | null,
        isWebHIDSupported: true,
        pollMatrix: null as unknown as () => Promise<boolean[][]>,
    },
    layout: { internationalLayout: 'us' },
    panels: { workspace: 'practice', practicePage: 'lessons' },
}));

const service = vi.hoisted(() => ({
    pollMatrix: null as unknown as (kb: unknown) => Promise<boolean[][]>,
    getLayerStateMasks: null as unknown as (kb: unknown) => Promise<{ active: number; default: number | null }>,
}));

vi.mock('@/contexts/KeyboardContext', () => ({ useKeyboard: () => ctx.keyboard }));
vi.mock('@/contexts/LayoutSettingsContext', () => ({ useLayoutSettings: () => ctx.layout }));
vi.mock('@/contexts/PanelsContext', () => ({ usePanels: () => ctx.panels }));
vi.mock('@/services/keyboard.service', async (importActual) => {
    const actual = await importActual<typeof import('@/services/keyboard.service')>();
    return {
        ...actual,
        keyboardService: new Proxy(actual.keyboardService, {
            get: (target, prop, receiver) => (prop in service && (service as Record<string | symbol, unknown>)[prop]
                ? (service as Record<string | symbol, unknown>)[prop]
                : Reflect.get(target, prop, receiver)),
        }),
    };
});
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

afterEach(() => {
    cleanup();
    resetPracticePageSession();
});

describe('PracticeEngineHost and Live · USB', () => {
    it('reads through keyboardService while the text has focus, never through the context', async () => {
        const board = svalDefault();
        ctx.keyboard.keyboard = board;
        ctx.keyboard.originalKeyboard = board;
        ctx.keyboard.pollMatrix = vi.fn(async () => []);
        const empty = Array.from({ length: 10 }, () => Array<boolean>(6).fill(false));
        service.pollMatrix = vi.fn(async () => { await new Promise((r) => setTimeout(r, 2)); return empty; });
        service.getLayerStateMasks = vi.fn(async () => ({ active: 1, default: 1 }));

        const store = createWorkspaceStore<PracticeEngineState>({ running: true, controller: null });
        render(<PracticeEngineHost store={store} />);
        await vi.waitFor(() => expect(store.get().controller?.session).toBeTruthy());
        const c = store.get().controller!;
        if (c.session!.firstRun) await act(async () => { await c.startPractice('qwerty', 75); });
        expect(c.live).not.toBeNull();
        expect(service.pollMatrix).not.toHaveBeenCalled();

        act(() => { c.setFocused(true); c.resume(); });
        expect(c.inputMode).toBe('usb');
        await vi.waitFor(() => expect(vi.mocked(service.pollMatrix).mock.calls.length).toBeGreaterThan(3));
        expect(vi.mocked(service.pollMatrix).mock.calls[0][0]).toBe(board);
        expect(service.getLayerStateMasks).toHaveBeenCalled();
        expect(ctx.keyboard.pollMatrix).not.toHaveBeenCalled();

        act(() => c.setFocused(false));
        await new Promise((r) => setTimeout(r, 20));
        const calls = vi.mocked(service.pollMatrix).mock.calls.length;
        await new Promise((r) => setTimeout(r, 50));
        expect(vi.mocked(service.pollMatrix).mock.calls.length).toBe(calls);
    });
});
