import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ProgressPage from '@/features/practice/ui/progress/ProgressPage';
import { NOTICE_TEXT, type PracticeController } from '@/features/practice/state/controller';
import { MemoryPracticeStore } from '@/features/practice/store/memory';
import { Providers, resetHarness, startController } from './harness';

// G1 Progress (docs/practice/spec.md §5.8) as M1b ships it: Summary, Speed and Characters for the
// period, the empty and storage-off states, and P5 from a Characters row.

vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => false }));
vi.mock('@/contexts/KeyboardContext', async () => { const h = await import('./harness'); return { useKeyboard: () => h.keyboardState }; });
vi.mock('@/contexts/LayoutSettingsContext', async () => { const h = await import('./harness'); return { useLayoutSettings: () => h.layoutState }; });
vi.mock('@/hooks/useKeyDrag', () => ({
    useKeyDrag: () => ({
        isDragHover: false, isDragSource: false, currentUnitSize: 30,
        handleMouseEnter: () => {}, handleMouseLeave: () => {}, handleMouseDown: () => {}, handleMouseUp: () => {},
    }),
}));
vi.mock('@/features/practice/PracticeProvider', async () => { const h = await import('./harness'); return { usePractice: h.useHarnessPractice }; });

beforeEach(() => {
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
    resetHarness();
    window.history.replaceState(null, '', '/#practice/progress');
});

afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    resetHarness();
});

/** Types whole lessons through the controller. */
async function completeLessons(c: PracticeController, n: number) {
    c.setFocused(true);
    for (let i = 0; i < n; i++) {
        c.resume();
        const run = c.run!;
        let t = 1000 + i * 100_000;
        await act(async () => {
            for (let guard = 0; guard < 3000 && !run.textInput.completed; guard++) c.onInput({ type: 'input', timeStamp: (t += 140), inputType: 'appendChar', codePoint: run.expected!, timeToType: 0 });
        });
        await vi.waitFor(() => expect(c.run).not.toBe(run));
    }
}

describe('Progress page (§5.8)', () => {
    it('Empty: No lessons yet, and Start practicing goes to Lessons', async () => {
        await startController();
        render(<Providers><ProgressPage /></Providers>);
        expect(screen.getByRole('heading', { name: 'No lessons yet' })).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Start practicing' }));
        expect(screen.getByTestId('page').textContent).toBe('lessons');
    });

    it('Loading: five StatCell skeletons and a chart block', () => {
        render(<Providers><ProgressPage /></Providers>);
        expect(document.querySelectorAll('[data-stat-skeleton]')).toHaveLength(5);
    });

    it('Storage off: the notice under the header', async () => {
        await startController({ persistent: false });
        render(<Providers><ProgressPage /></Providers>);
        expect(screen.getByText(NOTICE_TEXT['storage-off'])).toBeInTheDocument();
    });

    it('Summary, Speed and Characters for the period, echoed in the header', async () => {
        const store = new MemoryPracticeStore();
        const c = await startController({ store, settings: { targetSpeed: 75 } });
        await completeLessons(c, 2);
        render(<Providers><ProgressPage /></Providers>);
        expect(screen.getByText('Me · Last 30 days')).toBeInTheDocument();
        const summary = document.querySelector('[data-progress-section="Summary"]') as HTMLElement;
        expect(within(summary).getByText('Lessons').nextElementSibling).toHaveTextContent('2');
        expect(within(summary).getByText('Keys at target')).toBeInTheDocument();
        const chart = document.querySelector('[data-practice-speed-chart] svg') as SVGElement;
        expect(chart.querySelector('[data-chart-line="speed"]')?.getAttribute('class')).toContain('stroke-kb-blue');
        expect(chart.querySelector('[data-chart-line="accuracy"]')?.getAttribute('stroke-dasharray')).toBe('6 4');
        expect(chart.querySelector('[data-chart-line="target"]')?.getAttribute('stroke-dasharray')).toBe('2 3');
        expect(within(chart as unknown as HTMLElement).getByText('Speed')).toBeInTheDocument();
        expect(within(chart as unknown as HTMLElement).getByText('Accuracy')).toBeInTheDocument();
        act(() => c.update({ period: '7' }));
        expect(screen.getByText('Me · Last 7 days')).toBeInTheDocument();
    });

    it('Characters: sorted by confidence ascending, sortable, and a row opens P5', async () => {
        const c = await startController({ settings: { targetSpeed: 75 } });
        await completeLessons(c, 1);
        render(<Providers><ProgressPage /></Providers>);
        const table = document.querySelector('[data-practice-chars]') as HTMLTableElement;
        const rows = () => [...table.querySelectorAll('tbody tr')].map((r) => r.getAttribute('data-char-row'));
        expect(rows()).toHaveLength(c.session!.lesson.letters.length);
        // Unpracticed letters (no confidence) come first in ascending order.
        expect(rows()[0]).not.toBe('a');
        expect(screen.getByRole('columnheader', { name: /Confidence/ })).toHaveAttribute('aria-sort', 'ascending');
        fireEvent.click(screen.getByRole('button', { name: /^Samples/ }));
        expect(screen.getByRole('columnheader', { name: /Samples/ })).toHaveAttribute('aria-sort', 'ascending');
        fireEvent.click(screen.getByRole('button', { name: /^Samples/ }));
        expect(['a', 's', 'd', 'f', 'k', 'l']).toContain(rows()[0]);
        const row = table.querySelector('tr[data-char-row="a"]') as HTMLElement;
        fireEvent.click(within(row).getByRole('button'));
        const pop = await screen.findByRole('dialog', { name: 'Key a' });
        expect(within(pop).getByText('L-pinky C')).toBeInTheDocument();
        expect(within(pop).getByText('Samples')).toBeInTheDocument();
    });

    it('Lessons · Days switches the chart axis and is remembered', async () => {
        const c = await startController({ settings: { targetSpeed: 75 } });
        await completeLessons(c, 1);
        render(<Providers><ProgressPage /></Providers>);
        fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Speed chart by' })).getByRole('radio', { name: 'Days' }));
        expect(c.settings.chartAxis).toBe('days');
        expect(screen.getByRole('img', { name: /over 1 days/ })).toBeInTheDocument();
    });
});

describe('Progress page review fixes (M1b review R7, R9)', () => {
    it('Content error: the well with Retry, not an endless skeleton', async () => {
        const c = await startController({ contentFails: true });
        render(<Providers><ProgressPage /></Providers>);
        expect(screen.getByRole('heading', { name: "Practice words didn't load" })).toBeInTheDocument();
        expect(document.querySelectorAll('[data-stat-skeleton]')).toHaveLength(0);
        const retry = vi.spyOn(c, 'retry');
        fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
        expect(retry).toHaveBeenCalled();
    });
});

describe('Speed chart (§5.8, N-10)', () => {
    const points = [
        { x: 1, ts: new Date(2026, 9, 1).getTime(), speed: 150, accuracy: 0.95, count: 1, type: 'guided' },
        { x: 2, ts: new Date(2026, 9, 2).getTime(), speed: 175, accuracy: 0.97, count: 3, type: '' },
    ];

    it('scales through its viewBox, so a narrow container never clips the right-end labels', async () => {
        const { SpeedChart } = await import('@/features/practice/ui/progress/SpeedChart');
        render(<SpeedChart points={points} unit="wpm" target={175} axis="lessons" />);
        const svg = document.querySelector('[data-practice-speed-chart] svg') as SVGElement;
        expect(svg.getAttribute('viewBox')).toBe(`0 0 ${svg.getAttribute('width')} 240`);
        expect(svg.getAttribute('class')).toContain('h-auto');
    });

    it('tooltip: the lesson type by name, and "1 lesson" by Days', async () => {
        const { SpeedChart } = await import('@/features/practice/ui/progress/SpeedChart');
        const { rerender } = render(<SpeedChart points={points} unit="wpm" target={175} axis="lessons" />);
        const svg = () => document.querySelector('[data-practice-speed-chart] svg') as SVGElement;
        fireEvent.mouseMove(svg(), { clientX: 0 });
        expect(screen.getByText(/· Guided$/)).toBeInTheDocument();
        rerender(<SpeedChart points={[{ ...points[0], count: 1, type: '' }, points[1]]} unit="wpm" target={175} axis="days" />);
        fireEvent.mouseMove(svg(), { clientX: 0 });
        expect(screen.getByText(/· 1 lesson$/)).toBeInTheDocument();
        fireEvent.mouseMove(svg(), { clientX: 10_000 });
        expect(screen.getByText(/· 3 lessons$/)).toBeInTheDocument();
    });
});
