// Test harness for Practice's pages and panels: a real PracticeController on the default keymap
// (memory store, the bundled English content), the real PanelsProvider, and stand-ins for the editor
// contexts. Test files mock the modules (vi.mock is hoisted per file) and use these helpers.
import { useSyncExternalStore, type ReactNode } from 'react';
import { vi } from 'vitest';
import { SidebarProvider } from '@/components/ui/sidebar';
import { PanelsProvider, usePanels } from '@/contexts/PanelsContext';
import { type KeymapInput, PracticeController, resetPracticePageSession } from '@/features/practice/state/controller';
import { DEFAULT_SETTINGS, type PracticeSettings } from '@/features/practice/state/settings';
import { MemoryPracticeStore } from '@/features/practice/store/memory';
import { Lesson } from '@/features/practice/vendor/keybr/lesson/index.ts';
import { LCG } from '@/features/practice/vendor/keybr/rand/index.ts';
import type { KeyboardInfo } from '@/types/keyboard.types';
import { svalDefault } from '../fixtures/boards';
import { englishModel, englishWords } from '../fixtures/content';

export const practice = { controller: null as PracticeController | null };

/** The usePractice stand-in: the harness controller, re-rendering on every change. */
export function useHarnessPractice(): PracticeController | null {
    const c = practice.controller;
    useSyncExternalStore(c?.subscribe ?? (() => () => {}), c?.getVersion ?? (() => 0));
    return c;
}

export const keyboardState = {
    keyboard: null as KeyboardInfo | null,
    originalKeyboard: null as KeyboardInfo | null,
    isConnected: false,
    hasUnsavedChanges: false,
    loadedFrom: 'QWERTY example (demo)',
    defaultLayerIndex: null as number | null,
    isWebHIDSupported: true,
    connect: vi.fn(async () => true),
    loadFromFile: vi.fn(async () => true),
};

export const layoutState = {
    internationalLayout: 'us', keyVariant: 'default', layoutMode: 'sidebar' as 'sidebar' | 'bottombar',
    setInternationalLayout: vi.fn((id: string) => { layoutState.internationalLayout = id; }),
};

export function keymapInput(overrides: Partial<KeymapInput> = {}): KeymapInput {
    return {
        board: keyboardState.keyboard ?? svalDefault(), source: 'example', sourceLabel: 'QWERTY example (demo)', layoutId: 'us',
        defaultLayer: 0, connected: false, unsentChanges: false, hidSupported: true, ...overrides,
    };
}

export interface HarnessOptions {
    settings?: Partial<PracticeSettings>;
    store?: MemoryPracticeStore;
    persistent?: boolean;
    keymap?: Partial<KeymapInput>;
    /** Leave first run (Start) for the test. */
    firstRun?: boolean;
    contentFails?: boolean;
}

/** Builds and starts a controller; resolves once its session exists (or content failed). */
export async function startController(options: HarnessOptions = {}): Promise<PracticeController> {
    Lesson.rng = LCG(21);
    resetPracticePageSession();
    keyboardState.keyboard ??= svalDefault();
    const store = options.store ?? new MemoryPracticeStore();
    const c = new PracticeController({
        loadSettings: () => ({ ...DEFAULT_SETTINGS, ...options.settings }),
        saveSettings: () => true,
        openStore: async () => ({ store, persistent: options.persistent ?? true }),
        loadContent: async () => {
            if (options.contentFails) throw new Error('offline');
            return { model: englishModel(), words: englishWords() };
        },
    });
    practice.controller = c;
    c.setKeymap(keymapInput(options.keymap));
    await c.start();
    if (!options.contentFails) await vi.waitFor(() => { if (!c.session) throw new Error('no session'); });
    if (!options.firstRun && c.session?.firstRun) await c.startPractice('learn', 125);
    // The Lessons page is showing (PracticeEngineHost reports it in the app).
    c.setActive(true);
    return c;
}

/** Shows the routing state. */
export function PanelsProbe() {
    const panels = usePanels();
    return (
        <div>
            <output data-testid="active">{String(panels.activePanel)}</output>
            <output data-testid="open">{String(panels.open)}</output>
            <output data-testid="page">{panels.practicePage}</output>
            <output data-testid="workspace">{panels.workspace}</output>
        </div>
    );
}

export function Providers({ children }: { children: ReactNode }) {
    return (
        <SidebarProvider defaultOpen={false}>
            <PanelsProvider>
                {children}
                <PanelsProbe />
            </PanelsProvider>
        </SidebarProvider>
    );
}

export function resetHarness() {
    practice.controller?.dispose();
    practice.controller = null;
    keyboardState.keyboard = svalDefault();
    keyboardState.originalKeyboard = null;
    keyboardState.isConnected = false;
    keyboardState.hasUnsavedChanges = false;
    keyboardState.isWebHIDSupported = true;
    keyboardState.connect.mockClear();
    layoutState.layoutMode = 'sidebar';
    window.history.replaceState(null, '', '/#practice');
}

/** An `input` event as the browser fires it for a typed character. */
export function typeChar(textarea: HTMLTextAreaElement, data: string) {
    const event = new InputEvent('input', { inputType: 'insertText', data, bubbles: true });
    textarea.dispatchEvent(event);
}
