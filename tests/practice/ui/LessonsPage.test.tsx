import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LessonsPage from '@/features/practice/ui/LessonsPage';
import { NOTICE_TEXT } from '@/features/practice/state/controller';
import { keyService } from '@/services/key.service';
import { rebind, svalDefault } from '../fixtures/boards';
import { keyboardState, layoutState, practice, Providers, resetHarness, startController, typeChar } from './harness';

// P1 Lessons (docs/practice/spec.md §5.2, §5.3, §5.11, §9.9 UI): states, typing through the hidden
// textarea, pause and resume, the status slot, the board, and the panel focus rules of §4.1.

vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => false }));
vi.mock('@/contexts/KeyboardContext', async () => { const h = await import('./harness'); return { useKeyboard: () => h.keyboardState }; });
vi.mock('@/contexts/LayoutSettingsContext', async () => { const h = await import('./harness'); return { useLayoutSettings: () => h.layoutState }; });
vi.mock('@/hooks/useKeyDrag', () => ({
    useKeyDrag: ({ variant }: { variant: string }) => ({
        isDragHover: false, isDragSource: false, currentUnitSize: variant === 'small' ? 30 : variant === 'medium' ? 45 : 60,
        handleMouseEnter: () => {}, handleMouseLeave: () => {}, handleMouseDown: () => {}, handleMouseUp: () => {},
    }),
}));
vi.mock('@/features/practice/PracticeProvider', async () => { const h = await import('./harness'); return { usePractice: h.useHarnessPractice }; });

const textarea = () => screen.getByLabelText('Practice text') as HTMLTextAreaElement;
const card = () => document.querySelector('[data-practice-text-card]') as HTMLElement;
const typedCount = () => document.querySelectorAll('[data-glyph="typed"]').length;
const paused = () => !!document.querySelector('[data-practice-paused]');

function renderPage() {
    return render(<Providers><LessonsPage /></Providers>);
}

/** Focuses the surface and resumes, as a click on the text card does. */
function clickCard() {
    act(() => { fireEvent.mouseDown(card()); });
}

function typeNext(n = 1) {
    for (let i = 0; i < n; i++) {
        const c = practice.controller!.run!.expected!;
        act(() => typeChar(textarea(), String.fromCodePoint(c)));
    }
}

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

describe('Lessons states (§5.3)', () => {
    it('Loading: skeleton strip, metrics and text card', async () => {
        practice.controller = null;
        renderPage();
        expect(document.querySelector('[data-practice-skeleton]')).not.toBeNull();
        expect(document.querySelectorAll('[data-stat-skeleton]')).toHaveLength(5);
        expect(screen.getByRole('heading', { name: 'Practice' })).toBeInTheDocument();
    });

    it('First run: Start replaces strip, metrics and text card; the type row is hidden; Start starts a lesson', async () => {
        const c = await startController({ firstRun: true });
        c.setActive(true);
        renderPage();
        expect(screen.getByRole('heading', { name: 'Start practicing' })).toBeInTheDocument();
        expect(screen.queryByRole('radiogroup', { name: 'Lesson type' })).toBeNull();
        expect(screen.queryByLabelText('Practice text')).toBeNull();
        const start = screen.getByRole('button', { name: 'Start' });
        expect(start).toBeDisabled();
        fireEvent.click(screen.getByRole('button', { name: /Coming from QWERTY/ }));
        expect(screen.getByText('35 wpm')).toBeInTheDocument();
        // The board previews the preset: every letter lit for QWERTY.
        expect(document.querySelectorAll('[data-practice-key][data-state="locked"]')).toHaveLength(0);
        await act(async () => { fireEvent.click(start); });
        await vi.waitFor(() => expect(screen.getByLabelText('Practice text')).toBeInTheDocument());
        expect(c.settings).toMatchObject({ alphabetSize: 1, hints: 'next', targetSpeed: 175 });
        expect(screen.getByRole('radiogroup', { name: 'Lesson type' })).toBeInTheDocument();
    });

    it('Content error: the well with Retry, and the board in the no-lesson look', async () => {
        await startController({ contentFails: true });
        renderPage();
        expect(screen.getByRole('heading', { name: "Practice words didn't load" })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
        expect(document.querySelectorAll('[data-practice-key][data-state="included"]')).toHaveLength(0);
        expect(document.querySelector('[data-ring]')).toBeNull();
    });

    it('No letters: the well with QWERTY example and Layouts', async () => {
        let board = svalDefault();
        for (let layer = 0; layer < board.keymap!.length; layer++) {
            for (let i = 0; i < board.keymap![layer].length; i++) board = rebind(board, layer, i, keyService.parse('KC_NO'));
        }
        keyboardState.keyboard = board;
        await startController({ keymap: { board }, firstRun: true });
        renderPage();
        expect(screen.getByRole('heading', { name: 'No letters to practice on this keymap' })).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Layouts' }));
        expect(screen.getByTestId('workspace').textContent).toBe('editor');
        expect(screen.getByTestId('active').textContent).toBe('layouts');
    });

    it('Ready and Paused: the lesson starts paused until the card is clicked; Resume and Enter resume', async () => {
        const c = await startController();
        c.setActive(true);
        renderPage();
        expect(paused()).toBe(true);
        expect(screen.getByRole('button', { name: /Paused/ })).toBeInTheDocument();
        clickCard();
        expect(document.activeElement).toBe(textarea());
        expect(paused()).toBe(false);
        expect(screen.getByRole('button', { name: /Keymap only/ })).toBeInTheDocument();
        // Esc pauses, Enter resumes (and is not typed).
        act(() => { fireEvent.keyDown(textarea(), { key: 'Escape' }); });
        expect(paused()).toBe(true);
        act(() => { fireEvent.keyDown(textarea(), { key: 'Enter' }); });
        expect(paused()).toBe(false);
        expect(typedCount()).toBe(0);
    });
});

describe('Typing (§5.11)', () => {
    it('synthetic input events on the textarea advance the lesson', async () => {
        await startController();
        renderPage();
        clickCard();
        typeNext(5);
        expect(typedCount()).toBe(5);
        expect(practice.controller!.run!.textInput.pos).toBe(5);
    });

    it('a miss shows the wavy red style on the current character (stop on error)', async () => {
        await startController();
        renderPage();
        clickCard();
        const expected = practice.controller!.run!.expected!;
        act(() => typeChar(textarea(), expected === 0x71 ? 'z' : 'q'));
        const cursor = document.querySelector('[data-cursor]') as HTMLElement;
        expect(cursor.className).toContain('decoration-wavy');
        expect(cursor.className).toContain('bg-kb-red/15');
    });

    it('leaving the textarea (Tab) pauses, and keystrokes are ignored while paused', async () => {
        await startController();
        renderPage();
        clickCard();
        typeNext(2);
        act(() => { textarea().blur(); });
        expect(paused()).toBe(true);
        act(() => typeChar(textarea(), 'a'));
        expect(typedCount()).toBe(2);
    });

    it('a lesson-shaping setting regenerates the text at once; a display setting keeps it', async () => {
        const c = await startController();
        renderPage();
        const first = c.run;
        act(() => c.update({ showSpaces: true }));
        expect(c.run).toBe(first);
        expect(document.querySelector('[data-glyph="pending"]')?.parentElement?.textContent).toBeTruthy();
        act(() => c.update({ naturalWords: false }));
        expect(c.run).not.toBe(first);
    });

    it('Caps Lock: keystrokes are dropped and the notice shows in the status slot', async () => {
        await startController();
        renderPage();
        clickCard();
        act(() => { fireEvent.keyDown(textarea(), { key: 'A', code: 'KeyA', modifierCapsLock: true } as never); });
        // jsdom's getModifierState ignores the init flag; drive the controller with keybr's mapped event.
        act(() => practice.controller!.onKey({ type: 'keydown', timeStamp: 1, code: 'KeyA', key: 'A', modifiers: ['CapsLock'] }));
        act(() => typeChar(textarea(), 'A'));
        expect(typedCount()).toBe(0);
        expect(within(document.querySelector('[data-status-slot]') as HTMLElement).getByText(NOTICE_TEXT['caps-lock'])).toBeInTheDocument();
    });
});

describe('Status slot (§5.2, N-4)', () => {
    it('is always present, and the text card does not move or remount when a notice appears', async () => {
        const c = await startController();
        renderPage();
        const slot = document.querySelector('[data-status-slot]') as HTMLElement;
        const before = card();
        expect(slot.className).toContain('h-12');
        expect(slot.childElementCount).toBe(0);
        act(() => c.setKeymap({ ...c.keymap!, unsentChanges: true, connected: true, source: 'connected' }));
        expect(slot.textContent).toBe(NOTICE_TEXT['unsent-changes']);
        expect(document.querySelector('[data-status-slot]')).toBe(slot);
        expect(card()).toBe(before);
        expect(slot.className).toContain('h-12');
    });

    it('announces a completed lesson and shows the New key banner, cleared by the next keystroke', async () => {
        const c = await startController({ settings: { targetSpeed: 75 } });
        renderPage();
        clickCard();
        const run = c.run!;
        let t = performance.now();
        await act(async () => {
            while (!run.textInput.completed) {
                c.onInput({ type: 'input', timeStamp: (t += 100), inputType: 'appendChar', codePoint: run.expected!, timeToType: 0 });
            }
        });
        await vi.waitFor(() => expect(c.run).not.toBe(run));
        expect(document.querySelector('[data-practice-announce]')?.textContent).toMatch(/^Lesson complete\./);
        expect(document.querySelector('[data-status="new-key"]')).not.toBeNull();
        expect(screen.getByText('New key')).toBeInTheDocument();
        typeNext(1);
        expect(document.querySelector('[data-status="new-key"]')).toBeNull();
    });
});

describe('Board (§5.2, §5.11)', () => {
    it('is aria-hidden, has no focusable keys, and a click on it focuses the typing surface', async () => {
        await startController();
        renderPage();
        const board = document.querySelector('[data-practice-board]') as HTMLElement;
        expect(board).toHaveAttribute('aria-hidden', 'true');
        expect(board.querySelectorAll('button, [tabindex]')).toHaveLength(0);
        act(() => { fireEvent.mouseDown(board.querySelector('[data-practice-key]')!); });
        expect(document.activeElement).toBe(textarea());
        expect(paused()).toBe(false);
    });

    it('rings the next key', async () => {
        const c = await startController();
        renderPage();
        const index = c.session!.resolution.primary(c.run!.expected!)!.index;
        expect(document.querySelector(`[data-practice-key="${index}"]`)).toHaveAttribute('data-ring', 'true');
    });
});

describe('Type row (§5.2)', () => {
    it('offers Guided until M3; the scope button opens the Lesson panel; Enter moves focus to the surface', async () => {
        await startController();
        renderPage();
        const group = screen.getByRole('radiogroup', { name: 'Lesson type' });
        expect(within(group).getAllByRole('radio').map((r) => r.textContent)).toEqual(['Guided']);
        fireEvent.click(screen.getByRole('button', { name: /Center first/ }));
        expect(screen.getByTestId('active').textContent).toBe('practice');
        expect(practice.controller!.panelSection).toBe('guided');
        act(() => { fireEvent.keyDown(within(group).getByRole('radio'), { key: 'Enter' }); });
        expect(document.activeElement).toBe(textarea());
    });
});

describe('Panel focus rules (§4.1)', () => {
    it('points the panel\'s return focus at the typing surface', async () => {
        await startController();
        let captured: HTMLElement | null = null;
        const { usePanels } = await import('@/contexts/PanelsContext');
        function Capture() { const p = usePanels(); captured = p.returnFocusOverride.current; return null; }
        const { rerender } = render(<Providers><LessonsPage /><Capture /></Providers>);
        rerender(<Providers><LessonsPage /><Capture /></Providers>);
        expect(captured).toBe(textarea());
    });

    it('side layout at 900–1099 px: focusing the surface closes the panel', async () => {
        Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1000 });
        await startController();
        renderPage();
        fireEvent.click(screen.getByRole('button', { name: /Center first/ }));
        expect(screen.getByTestId('open').textContent).toBe('true');
        clickCard();
        expect(screen.getByTestId('open').textContent).toBe('false');
        expect(paused()).toBe(false);
    });

    it('at 1100 px and wider the panel stays open while typing continues', async () => {
        await startController();
        renderPage();
        fireEvent.click(screen.getByRole('button', { name: /Center first/ }));
        clickCard();
        expect(screen.getByTestId('open').textContent).toBe('true');
        typeNext(2);
        expect(typedCount()).toBe(2);
    });

    it('bottom-bar layout: focusing the surface scrolls the text card into view and keeps the panel', async () => {
        layoutState.layoutMode = 'bottombar';
        Object.defineProperty(window, 'innerWidth', { configurable: true, value: 860 });
        const scroll = vi.fn();
        Element.prototype.scrollIntoView = scroll;
        await startController();
        renderPage();
        fireEvent.click(screen.getByRole('button', { name: /Center first/ }));
        clickCard();
        expect(scroll).toHaveBeenCalledWith({ block: 'nearest' });
        expect(screen.getByTestId('open').textContent).toBe('true');
    });
});

describe('Input status (§5.6)', () => {
    it('Keymap only with Connect board when WebHID exists and nothing is connected', async () => {
        await startController();
        renderPage();
        fireEvent.click(screen.getByRole('button', { name: /Paused|Keymap only/ }));
        const dialog = await screen.findByRole('dialog', { name: 'Input' });
        expect(within(dialog).getByText('Not shown · connect the board')).toBeInTheDocument();
        expect(within(dialog).getByText('From keymap')).toBeInTheDocument();
        expect(within(dialog).getByText('QWERTY example')).toBeInTheDocument();
        fireEvent.click(within(dialog).getByRole('button', { name: /Connect board/ }));
        expect(keyboardState.connect).toHaveBeenCalled();
    });

    it('needs Chrome or Edge without WebHID, and draws no disabled button', async () => {
        await startController({ keymap: { hidSupported: false } });
        renderPage();
        fireEvent.click(screen.getByRole('button', { name: /Paused|Keymap only/ }));
        const dialog = await screen.findByRole('dialog', { name: 'Input' });
        expect(within(dialog).getByText('Not shown · needs Chrome or Edge')).toBeInTheDocument();
        expect(within(dialog).queryAllByRole('button')).toHaveLength(0);
    });
});
