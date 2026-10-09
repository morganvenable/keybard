import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LessonPanel from '@/features/practice/ui/LessonPanel';
import ProgressPanel from '@/features/practice/ui/progress/ProgressPanel';
import { KeyDetails } from '@/features/practice/ui/KeyPopover';
import { characterStats } from '@/features/practice/state/progressView';
import { TooltipProvider } from '@/components/ui/tooltip';
import { practice, Providers, resetHarness, startController } from './harness';

// P3 Lesson panel and G2 Progress panel (docs/practice/spec.md §5.5, §5.9), and P5 key details (§5.7).

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

beforeEach(() => {
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
    // Radix Select measures and scrolls its options.
    Element.prototype.hasPointerCapture ??= () => false;
    Element.prototype.scrollIntoView ??= () => undefined;
    resetHarness();
});

afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    resetHarness();
});

const groups = () => [...document.querySelectorAll('h3')].map((h) => h.textContent);

describe('Lesson panel (§5.5)', () => {
    it('shows the Guided, Targets, Typing, Board, Input, Keymap and About sections; no Type tiles and no Data', async () => {
        await startController();
        render(<Providers><LessonPanel /></Providers>);
        expect(groups()).toEqual(['Guided', 'Targets', 'Typing', 'Board', 'Input', 'Keymap', 'About']);
        expect(screen.queryByRole('group', { name: 'Lesson type' })).toBeNull();
        expect(screen.queryByText('Export…')).toBeNull();
        expect(screen.getByRole('radiogroup', { name: 'Start order' })).toBeInTheDocument();
        expect(screen.getByRole('slider', { name: 'Included letters' })).toBeInTheDocument();
        expect(screen.getByRole('radiogroup', { name: 'Hints' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /OS layout/ })).toHaveTextContent('English (US)');
        expect(screen.getByRole('combobox', { name: 'Source' })).toHaveTextContent('QWERTY example');
    });

    it('the Input row follows the status pill: Paused while the lesson is paused', async () => {
        const c = await startController();
        render(<Providers><LessonPanel /></Providers>);
        expect(document.querySelector('[data-lesson-input]')).toHaveTextContent('Paused');
        act(() => { c.setFocused(true); c.resume(); });
        expect(document.querySelector('[data-lesson-input]')).toHaveTextContent('Keymap only');
    });

    it('a lesson-shaping toggle regenerates at once; a slider after 300 ms with Saving… meanwhile', async () => {
        const c = await startController();
        render(<Providers><LessonPanel /></Providers>);
        const first = c.run;
        fireEvent.click(within(screen.getByRole('group', { name: 'Real words' })).getByRole('button', { name: 'OFF' }));
        expect(c.settings.naturalWords).toBe(false);
        expect(c.run).not.toBe(first);
        vi.useFakeTimers();
        const second = c.run;
        act(() => c.update({ punctuators: 0.3 }, { debounce: true }));
        expect(screen.getByText('Saving…')).toBeInTheDocument();
        expect(c.run).toBe(second);
        act(() => { vi.advanceTimersByTime(300); });
        expect(c.run).not.toBe(second);
        expect(screen.queryByText('Saving…')).toBeNull();
    });

    it('display settings apply live and keep the lesson', async () => {
        const c = await startController();
        render(<Providers><LessonPanel /></Providers>);
        const run = c.run;
        fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Hints' })).getByRole('radio', { name: 'Off' }));
        fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Speed unit' })).getByRole('radio', { name: 'CPM' }));
        expect(c.settings).toMatchObject({ hints: 'off', speedUnit: 'cpm' });
        expect(c.run).toBe(run);
        expect(screen.getByText('125 cpm')).toBeInTheDocument();
    });

    it('OS layout opens Settings over Practice', async () => {
        await startController();
        render(<Providers><LessonPanel /></Providers>);
        fireEvent.click(screen.getByRole('button', { name: /OS layout/ }));
        expect(screen.getByTestId('active').textContent).toBe('settings');
    });

    it('the About row opens the credit popover with both sources and the license line', async () => {
        await startController();
        render(<Providers><LessonPanel /></Providers>);
        fireEvent.click(screen.getByRole('button', { name: /Based on keybr.com and River's svalbr/ }));
        const pop = await screen.findByRole('dialog', { name: 'Based on keybr.com' });
        expect(within(pop).getByRole('link', { name: /keybr.com source/ })).toHaveAttribute('href', 'https://github.com/aradzie/keybr.com');
        expect(within(pop).getByRole('link', { name: /svalbr by River/ })).toHaveAttribute('href', 'https://r-tae.github.io/keybr.com/');
        expect(within(pop).getByText('Practice is licensed AGPL-3.0')).toBeInTheDocument();
    });

    it('bottom-bar layout lays the rows out in a grid', async () => {
        await startController();
        render(<Providers><LessonPanel horizontal /></Providers>);
        expect(document.querySelector('[data-lesson-section="guided"] > div')?.className).toContain('grid');
    });

    it('shows the storage error footer when settings could not be written', async () => {
        const c = await startController();
        c.settingsError = true;
        render(<Providers><LessonPanel /></Providers>);
        expect(screen.getByText("Settings couldn't be saved")).toBeInTheDocument();
    });
});

describe('Progress panel (§5.9)', () => {
    it('Profile, Scope and About; the period updates the settings', async () => {
        const c = await startController();
        render(<Providers><ProgressPanel /></Providers>);
        expect(groups()).toEqual(['Profile', 'Scope', 'About']);
        fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Period' })).getByRole('radio', { name: '7 days' }));
        expect(c.settings.period).toBe('7');
    });

    it('New profile… creates and selects a profile', async () => {
        const c = await startController();
        render(<Providers><ProgressPanel /></Providers>);
        const trigger = screen.getByRole('combobox', { name: 'Profile' });
        trigger.focus();
        await act(async () => { fireEvent.keyDown(trigger, { key: 'ArrowDown' }); });
        await act(async () => { fireEvent.click(await screen.findByRole('option', { name: 'New profile…' })); });
        const dialog = await screen.findByRole('dialog', { name: 'New profile' });
        fireEvent.change(within(dialog).getByRole('textbox', { name: 'Profile name' }), { target: { value: 'Sam' } });
        await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Create' })); });
        await vi.waitFor(() => expect(c.session?.profile.id).toBe('sam'));
        expect(c.settings.activeProfileId).toBe('sam');
    });
});

describe('Key details (§5.7)', () => {
    it('names the path of a layered character with its alternative', async () => {
        const c = await startController();
        const s = c.session!;
        const letter = s.lesson.letters[0];
        const stats = { ...characterStats(s.keyStatsMap.get(letter), s.target, s.resolution.primary(0x21)), codePoint: 0x21, label: '!' };
        render(<TooltipProvider><KeyDetails stats={stats} resolution={s.resolution} cols={6} unit="wpm" layerColor="orange" inferred /></TooltipProvider>);
        for (const chip of ['Layer 1', 'hold R-thumb T5', 'L-pinky N']) expect(screen.getByText(chip)).toBeInTheDocument();
        expect(screen.getByText('or hold L-thumb T1')).toBeInTheDocument();
        expect(screen.getByText('No samples yet')).toBeInTheDocument();
    });

    it('shows the stats grid and the Inferred chip once there are samples', async () => {
        const c = await startController({ settings: { targetSpeed: 75 } });
        const run = c.run!;
        c.setFocused(true);
        c.resume();
        let t = 1000;
        await act(async () => {
            while (!run.textInput.completed) c.onInput({ type: 'input', timeStamp: (t += 150), inputType: 'appendChar', codePoint: run.expected!, timeToType: 0 });
        });
        await vi.waitFor(() => expect(c.session!.records.length).toBe(1));
        const s = c.session!;
        const a = s.lesson.letters.find((l) => l.codePoint === 0x61)!;
        const stats = characterStats(s.keyStatsMap.get(a), s.target, s.resolution.primary(0x61));
        render(<TooltipProvider><KeyDetails stats={stats} resolution={s.resolution} cols={6} unit="wpm" layerColor="green" inferred /></TooltipProvider>);
        expect(screen.getByRole('button', { name: 'Inferred' })).toHaveAttribute('aria-describedby');
        for (const label of ['Speed', 'Best', 'Accuracy', 'Samples', 'Confidence', 'To target']) expect(screen.getByText(label)).toBeInTheDocument();
        expect(practice.controller).toBe(c);
    });
});
