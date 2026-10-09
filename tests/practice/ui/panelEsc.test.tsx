import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SecondarySidebar from '@/layout/SecondarySidebar/SecondarySidebar';
import LessonsPage from '@/features/practice/ui/LessonsPage';
import { practice, Providers, resetHarness, startController, typeChar } from './harness';

// The Lesson panel and the lesson together (docs/practice/spec.md §4.1, §5.11, §9.9): the real detail
// panel beside the Lessons page. Opening the panel pauses the lesson; Esc in the panel closes it and
// returns focus to the still-paused typing surface; Enter there resumes.

vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => false }));
vi.mock('@/contexts/KeyboardContext', async () => { const h = await import('./harness'); return { useKeyboard: () => h.keyboardState }; });
vi.mock('@/contexts/LayoutSettingsContext', async () => { const h = await import('./harness'); return { useLayoutSettings: () => h.layoutState }; });
vi.mock('@/hooks/useKeyDrag', () => ({
    useKeyDrag: () => ({
        isDragHover: false, isDragSource: false, currentUnitSize: 45,
        handleMouseEnter: () => {}, handleMouseLeave: () => {}, handleMouseDown: () => {}, handleMouseUp: () => {},
    }),
}));
vi.mock('@/features/practice/PracticeProvider', async () => { const h = await import('./harness'); return { usePractice: h.useHarnessPractice }; });
// The panel's contents don't matter here: a stand-in with one control, as the workspace nav tests use.
vi.mock('@/layout/PanelContent', () => ({
    getPanelTitle: (panel: string | null) => (panel === 'practice' ? 'Lesson' : panel ?? 'Details'),
    PanelContent: ({ panel }: { panel: string | null }) => <button type="button">{`${panel} control`}</button>,
}));
vi.mock('@/layout/SecondarySidebar/components/BindingEditor/BindingEditorContainer', () => ({ default: () => null }));
vi.mock('@/layout/SecondarySidebar/components/EditorSidePanel', () => ({ default: () => null }));
vi.mock('@/layout/SecondarySidebar/Panels/BasicKeyboards', () => ({ default: () => null }));
vi.mock('@/layout/SecondarySidebar/Panels/LayersPanel', () => ({ default: () => null }));
vi.mock('@/layout/SecondarySidebar/Panels/MacrosPanel', () => ({ default: () => null }));
vi.mock('@/layout/SecondarySidebar/Panels/QmkKeysPanel', () => ({ default: () => null }));
vi.mock('@/layout/SecondarySidebar/Panels/OneShotComposerPanel', () => ({ default: () => null }));
vi.mock('@/layout/SecondarySidebar/Panels/PointingPanel', () => ({ default: () => null }));
vi.mock('@/layout/SecondarySidebar/Panels/MousePanel', () => ({ default: () => null }));
vi.mock('@/layout/SecondarySidebar/Panels/SpecialKeysPanel/SpecialKeysPanel', () => ({ default: () => null }));

const textarea = () => screen.getByLabelText('Practice text') as HTMLTextAreaElement;
const paused = () => !!document.querySelector('[data-practice-paused]');
const panel = () => document.querySelector('aside.detail-panel') as HTMLElement;
const panelOpen = () => panel().getAttribute('aria-hidden') === 'false';

beforeEach(() => {
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1440 });
    resetHarness();
});

afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    resetHarness();
    for (const name of ['primary-nav', 'details-panel']) document.cookie = `${name}:state=; path=/; max-age=0`;
});

describe('Lesson panel and lesson (§4.1, §5.11)', () => {
    it('Esc in the panel closes it, focus returns to the paused surface, and Enter resumes', async () => {
        const c = await startController();
        render(<Providers><LessonsPage /><SecondarySidebar /></Providers>);
        act(() => { fireEvent.mouseDown(document.querySelector('[data-practice-text-card]')!); });
        for (let i = 0; i < 2; i++) act(() => typeChar(textarea(), String.fromCodePoint(c.run!.expected!)));
        expect(c.run!.textInput.pos).toBe(2);
        expect(paused()).toBe(false);

        // The scope button opens the panel; focus moves into it, so the lesson pauses.
        act(() => { fireEvent.click(screen.getByRole('button', { name: /Center first/ })); });
        expect(panelOpen()).toBe(true);
        act(() => { screen.getByRole('button', { name: 'practice control' }).focus(); });
        expect(paused()).toBe(true);

        act(() => { fireEvent.keyDown(screen.getByRole('button', { name: 'practice control' }), { key: 'Escape' }); });
        expect(panelOpen()).toBe(false);
        await vi.waitFor(() => expect(document.activeElement).toBe(textarea()));
        // Focus alone does not resume (§4.1).
        expect(paused()).toBe(true);
        expect(practice.controller!.run!.textInput.pos).toBe(2);

        act(() => { fireEvent.keyDown(textarea(), { key: 'Enter' }); });
        expect(paused()).toBe(false);
        act(() => typeChar(textarea(), String.fromCodePoint(c.run!.expected!)));
        expect(c.run!.textInput.pos).toBe(3);
    });
});
