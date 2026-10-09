import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PracticeController } from '@/features/practice/state/controller';
import { periodView } from '@/features/practice/state/progressView';
import { MemoryPracticeStore } from '@/features/practice/store/memory';
import { formatPercent, formatPercentDown } from '@/features/practice/ui/format';
import ProgressPage from '@/features/practice/ui/progress/ProgressPage';
import { Providers, resetHarness, startController } from './harness';

// G1 Progress depth (docs/practice/spec.md §5.0.2, §5.7, §5.8, §12 M4): the Keyboard heatmap, Fingers,
// Thumbs, Layers and History sections, their Inferred chips, and P5 in full from them.

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

beforeEach(() => {
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
    Element.prototype.scrollIntoView ??= () => undefined;
    resetHarness();
    window.history.replaceState(null, '', '/#practice/progress');
});

afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    resetHarness();
});

const cp = (s: string) => s.codePointAt(0)!;

/**
 * Types whole lessons through the controller (Keymap only). Steps alternate fast and slow so some keys reach
 * the target and some don't; `miss` types a wrong character before the expected one now and then.
 */
async function completeLessons(c: PracticeController, n: number, { miss = false }: { miss?: boolean } = {}) {
    c.setFocused(true);
    for (let i = 0; i < n; i++) {
        c.resume();
        const run = c.run!;
        let t = 1000 + i * 100_000;
        await act(async () => {
            for (let guard = 0; guard < 3000 && !run.textInput.completed; guard++) {
                const expected = run.expected!;
                if (miss && guard % 9 === 4 && expected !== cp(' ') && expected !== cp('q')) {
                    c.onInput({ type: 'input', timeStamp: (t += 150), inputType: 'appendChar', codePoint: cp('q'), timeToType: 0 });
                }
                const slow = expected % 3 === 0;
                c.onInput({ type: 'input', timeStamp: (t += slow ? 900 : 120), inputType: 'appendChar', codePoint: run.expected!, timeToType: 0 });
            }
        });
        await vi.waitFor(() => expect(c.run).not.toBe(run));
    }
}

const section = (title: string) => document.querySelector(`[data-progress-section="${title}"]`) as HTMLElement;
const heatKeys = () => [...document.querySelectorAll('[data-heat-key]')] as HTMLElement[];
const LAYER_FACE = /\bbg-kb-(primary|green|blue|purple|orange|yellow|red|brown|magenta|light-grey)\b|\bbg-white\b/;

describe('Progress sections (§5.8)', () => {
    it('shows every section in order, with Inferred on the physical ones for Keymap-only data', async () => {
        const c = await startController({ store: new MemoryPracticeStore(), settings: { targetSpeed: 75 } });
        await completeLessons(c, 2);
        render(<Providers><ProgressPage /></Providers>);
        const titles = [...document.querySelectorAll('[data-progress-section]')].map((s) => s.getAttribute('data-progress-section'));
        expect(titles).toEqual(['Summary', 'Speed', 'Keyboard', 'Fingers', 'Thumbs', 'Layers', 'Characters', 'History']);
        for (const title of ['Keyboard', 'Fingers', 'Thumbs', 'Layers']) {
            expect(within(section(title)).getByRole('button', { name: 'Inferred' })).toBeInTheDocument();
        }
        for (const title of ['Summary', 'Characters', 'History']) {
            expect(within(section(title)).queryByRole('button', { name: 'Inferred' })).toBeNull();
        }
    });

    it('heatmap faces: no layer color, a check on keys at target, a footer value on every key with samples', async () => {
        const c = await startController({ store: new MemoryPracticeStore(), settings: { targetSpeed: 75 } });
        await completeLessons(c, 3);
        render(<Providers><ProgressPage /></Providers>);
        const keys = heatKeys();
        expect(keys.length).toBeGreaterThan(40);
        for (const key of keys) expect(key.className).not.toMatch(LAYER_FACE);
        const levels = keys.map((k) => k.getAttribute('data-heat-level'));
        expect(levels).toContain('target');
        expect(levels.some((l) => l === 'far' || l === 'mid' || l === 'near')).toBe(true);
        for (const key of keys) {
            const level = key.getAttribute('data-heat-level');
            const footer = key.querySelector('[data-key-footer]');
            if (level === 'none') expect(footer).toBeNull();
            else expect(footer?.textContent).toMatch(/\d/);
            expect(!!key.querySelector('[data-heat-check]')).toBe(level === 'target');
        }
        // The scale line prints the Speed thresholds from the target (Start's 25 wpm), in whole numbers.
        expect(section('Keyboard').querySelector('[data-heat-scale]')!.textContent).toMatch(/^< 13·13–19·19–25·≥ 25 wpm·no data$/);
        expect(document.querySelector('[data-heat-toolbar] [role="group"]')!.textContent).toContain('Layer 0');
    });

    it('heatmap values match the Characters table, character for character (fractional values too)', async () => {
        const c = await startController({ store: new MemoryPracticeStore(), settings: { targetSpeed: 75 } });
        // Misses give fractional accuracies (41 of 42 is 97.6%): both views must round them the same way.
        await completeLessons(c, 2, { miss: true });
        render(<Providers><ProgressPage /></Providers>);
        const s = c.session!;
        const view = periodView(s.lesson, s.records, s.target, (ch) => s.resolution.primary(ch), '30', Date.now(), {
            tracked: s.trackedLetters, always: new Set(s.languageLetters.map((l) => l.codePoint)),
        });
        // The data must include a case where rounding to nearest and rounding down differ, or this test proves nothing.
        expect(view.characters.some((ch) => ch.accuracy != null && formatPercent(ch.accuracy) !== formatPercentDown(ch.accuracy))).toBe(true);
        const rows = () => [...document.querySelectorAll('[data-char-row]')].flatMap((row) => {
            const path = s.resolution.primary(cp(row.getAttribute('data-char-row')!));
            if (!path || path.layer !== 0) return [];
            const footer = document.querySelector(`[data-heat-key="${path.index}"]`)!.querySelector('[data-key-footer]')?.textContent ?? '—';
            return [{ cells: [...row.querySelectorAll('td')].map((td) => td.textContent!), footer }];
        });
        const radio = (name: string) => within(screen.getByRole('radiogroup', { name: 'Heatmap metric' })).getByRole('radio', { name });

        // Speed in WPM: the key prints the table's value without its decimal.
        let compared = 0;
        for (const { cells, footer } of rows()) {
            if (cells[3] === '—') { expect(footer).toBe('—'); continue; }
            expect(footer.trim()).toBe(cells[3].split('.')[0]);
            compared++;
        }
        expect(compared).toBeGreaterThanOrEqual(6);
        // Speed in CPM: the same string.
        await act(async () => { c.update({ speedUnit: 'cpm' }); });
        for (const { cells, footer } of rows()) if (cells[3] !== '—') expect(footer.trim()).toBe(cells[3]);
        // Accuracy: the same string.
        await act(async () => { fireEvent.click(radio('Accuracy')); });
        expect(c.settings.heatMetric).toBe('accuracy');
        compared = 0;
        for (const { cells, footer } of rows()) {
            if (cells[5] === '—') continue;
            expect(footer.trim()).toBe(cells[5]);
            compared++;
        }
        expect(compared).toBeGreaterThanOrEqual(6);
    });

    it('Usage colors every key with samples on the blue ramp, never red', async () => {
        const c = await startController({ store: new MemoryPracticeStore(), settings: { targetSpeed: 75, heatMetric: 'usage' } });
        await completeLessons(c, 2);
        render(<Providers><ProgressPage /></Providers>);
        const levels = heatKeys().map((k) => k.getAttribute('data-heat-level'));
        expect(levels.every((l) => l === 'none' || /^use-[1-4]$/.test(l!))).toBe(true);
        expect(new Set(levels.filter((l) => l !== 'none')).size).toBeGreaterThanOrEqual(3);
        expect(within(section('Keyboard')).getByText(/of keystrokes/)).toBeInTheDocument();
    });

    it('Fingers: 5 direction rows with glyphs and a Finger row; a cell opens P5 with Drill this group', async () => {
        const c = await startController({ store: new MemoryPracticeStore(), settings: { targetSpeed: 75 } });
        await completeLessons(c, 2);
        render(<Providers><ProgressPage /></Providers>);
        const grid = section('Fingers');
        expect([...grid.querySelectorAll('[data-direction-glyph]')].map((g) => g.getAttribute('data-direction-glyph'))).toEqual(['C', 'N', 'S', 'E', 'W']);
        expect(within(grid).getByText('Finger')).toBeInTheDocument();
        // The finger's total has every key of the finger: Drill this group drills them.
        const finger = grid.querySelector('[data-heat-cell="L-pinky"]') as HTMLElement;
        await act(async () => { fireEvent.click(finger); });
        const total = await screen.findByRole('dialog', { name: 'L-pinky' });
        expect(finger.className).toContain('ring-kb-select');
        await act(async () => { fireEvent.click(within(total).getByRole('button', { name: 'Drill this group' })); });
        expect(screen.getByTestId('page').textContent).toBe('lessons');
        expect(c.settings.type).toBe('drill');
        expect(c.settings.drill.name).toBe('L-pinky');
        expect(c.settings.drill.keys).toContain(cp('a'));
        expect(c.settings.drill.keys).toContain(cp('q'));
    });

    it('a cell with fewer than 3 characters to drill offers no Drill this group', async () => {
        const c = await startController({ store: new MemoryPracticeStore(), settings: { targetSpeed: 75 } });
        await completeLessons(c, 2);
        render(<Providers><ProgressPage /></Providers>);
        const cell = section('Fingers').querySelector('[data-heat-cell="L-pinky · C"]') as HTMLElement;
        await act(async () => { fireEvent.click(cell); });
        const pop = await screen.findByRole('dialog', { name: 'L-pinky · C' });
        expect(within(pop).getByText('a')).toBeInTheDocument();
        expect(within(pop).getByText('1')).toBeInTheDocument();
        expect(pop.querySelector('[data-practice-sparkline]')).not.toBeNull();
        expect(within(pop).queryByRole('button', { name: 'Drill this group' })).toBeNull();
    });

    it('Thumbs: what each key did, and Space with its value', async () => {
        const c = await startController({ store: new MemoryPracticeStore(), settings: { targetSpeed: 75 } });
        await completeLessons(c, 1);
        render(<Providers><ProgressPage /></Providers>);
        const thumbs = section('Thumbs');
        expect(within(thumbs).getByText('Left thumb')).toBeInTheDocument();
        expect(within(thumbs).getByText('Right thumb')).toBeInTheDocument();
        expect(within(thumbs).getAllByText('Space').length).toBeGreaterThanOrEqual(1);
        expect(within(thumbs).getByText('Shift')).toBeInTheDocument();
        expect(within(thumbs).getAllByText(/^Layer 1/).length).toBeGreaterThanOrEqual(1);
        const space = [...thumbs.querySelectorAll('[data-thumb]')].find((r) => r.textContent!.includes('Space') && r.querySelector('[data-heat-level]:not([data-heat-level="none"])'));
        expect(space).toBeDefined();
    });

    it('Layers and History', async () => {
        const c = await startController({ store: new MemoryPracticeStore(), settings: { targetSpeed: 75 } });
        await completeLessons(c, 2);
        render(<Providers><ProgressPage /></Providers>);
        const layers = section('Layers');
        expect(layers.querySelectorAll('[data-layer-row]').length).toBeGreaterThanOrEqual(1);
        expect(within(layers).getByRole('columnheader', { name: 'Reach' })).toBeInTheDocument();
        const history = section('History');
        expect(history.querySelectorAll('[data-history-row]').length).toBe(2);
        expect(within(history).getAllByText('Guided').length).toBe(2);
        expect(within(history).getAllByText('Keymap only').length).toBe(2);
        // One page only: no pagination pills.
        expect(within(history).queryByRole('button', { name: 'Older' })).toBeNull();
    });
});

describe('P5 in full (§5.7)', () => {
    it('a heatmap key opens the character P5 with its sparkline, Pressed instead and Drill this key', async () => {
        const c = await startController({ store: new MemoryPracticeStore(), settings: { targetSpeed: 75 } });
        await completeLessons(c, 3, { miss: true });
        render(<Providers><ProgressPage /></Providers>);
        const s = c.session!;
        // A character that was missed (typed q instead).
        const events = await c.eventStats(s.records);
        const missedCode = [...events].find(([char, e]) => e.confusions.length > 0 && s.resolution.primary(char)?.layer === 0)?.[0];
        expect(missedCode).toBeDefined();
        const missed = String.fromCodePoint(missedCode!);
        const index = s.resolution.primary(cp(missed!))!.index;
        const key = document.querySelector(`[data-heat-key="${index}"]`)!.closest('button')!;
        await act(async () => { fireEvent.click(key); });
        const pop = await screen.findByRole('dialog', { name: `Key ${missed}` });
        expect(pop.querySelector('[data-practice-sparkline]')).not.toBeNull();
        expect(within(pop).getByRole('button', { name: 'Drill this key' })).toBeInTheDocument();
        // Keymap only: the header carries Inferred, and Layer reach never shows.
        expect(within(pop).getAllByRole('button', { name: 'Inferred' }).length).toBeGreaterThanOrEqual(1);
        expect(pop.querySelector('[data-layer-reach]')).toBeNull();
        await vi.waitFor(() => expect(document.querySelector('[data-pressed-instead]')).not.toBeNull(), { timeout: 3000 });
        const confusions = [...document.querySelectorAll('[data-confusion]')].map((e) => e.textContent);
        expect(confusions.some((t) => t!.includes('× '))).toBe(true);
    });
});
