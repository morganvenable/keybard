import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { Profiler } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LiveInput } from '@/features/practice/input/liveInput';
import { resolveKeymap } from '@/features/practice/keymap/resolver';
import { boardView } from '@/features/practice/ui/boardModel';
import LessonsPage from '@/features/practice/ui/LessonsPage';
import { LiveBoard } from '@/features/practice/ui/PracticeKeyboard';
import { svalDefault } from '../fixtures/boards';
import { FakeBoard } from '../input/fakeBoard';
import { practice, Providers, resetHarness, startController } from './harness';

// Live · USB on the Lessons page (spec §5.2, §5.6, §9.9): the Live · USB pill and its P4 rows, held keys
// on the pressed face, wrong keys with the red border and × badge, the board following the live layer,
// and no board re-render while the sampler runs and nothing changes.

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

const board = svalDefault();
const resolution = resolveKeymap({ keymap: board.keymap!, rows: board.rows, cols: board.cols });
const cp = (s: string) => s.codePointAt(0)!;
const MO1 = 32;

let fake: FakeBoard;
let live: LiveInput;

async function startLive() {
    fake = new FakeBoard();
    live = new LiveInput({ pollMatrix: fake.pollMatrix, getLayerMasks: fake.getLayerMasks, clock: fake.clock, sleep: fake.sleep });
    const c = await startController({ keymap: { source: 'connected', connected: true, sourceLabel: 'Svalboard' } });
    c.attachLive(live);
    render(<Providers><LessonsPage /></Providers>);
    act(() => { fireEvent.mouseDown(document.querySelector('[data-practice-text-card]')!); });
    expect(live.running).toBe(true);
    return c;
}

const key = (index: number) => document.querySelector(`[data-practice-key="${index}"]`) as HTMLElement;

beforeEach(() => {
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1440 });
    resetHarness();
});

afterEach(() => {
    cleanup();
    live?.dispose();
    vi.unstubAllGlobals();
    resetHarness();
});

describe('Live · USB on Lessons', () => {
    it('the pill reads Live · USB and P4 says Shown, Live, with the sample rate in the tooltip', async () => {
        await startLive();
        for (let t = 10; t <= 100; t += 10) await act(() => fake.reply([], t));
        const pill = screen.getByRole('button', { name: /Live · USB/ });
        expect(pill.getAttribute('data-practice-input-pill')).toBe('usb');
        fireEvent.click(pill);
        const dialog = await screen.findByRole('dialog', { name: 'Input' });
        const shown = within(dialog).getByText('Shown');
        expect(shown.getAttribute('data-diagnostic')).toMatch(/samples\/s · round trip/);
        expect(within(dialog).getByText('Live')).toBeInTheDocument();
        expect(within(dialog).getByText('Connected board')).toBeInTheDocument();
        // The ink pill turns reading off: Keymap only, and reading stops.
        fireEvent.click(within(dialog).getByRole('button', { name: 'Stop reading keys' }));
        expect(live.running).toBe(false);
        expect(within(dialog).getByText('Not shown · reading is off')).toBeInTheDocument();
    });

    it('held keys take the pressed face; the board follows the live layer', async () => {
        await startLive();
        await act(() => fake.reply([], 10));
        const A = resolution.primary(practice.controller!.run!.expected!)!.index;
        await act(() => fake.reply([A], 20));
        expect(key(A).getAttribute('data-pressed')).toBe('true');
        expect(key(A).className).toContain('bg-kb-pressed');
        expect(document.querySelector('[data-practice-board]')!.getAttribute('data-layer')).toBe('0');
        await act(() => fake.reply([MO1], 30));
        expect(key(A).getAttribute('data-pressed')).toBeNull();
        expect(document.querySelector('[data-practice-board]')!.getAttribute('data-layer')).toBe('1');
    });

    it('a wrong key gets the red border and the × badge on its press', async () => {
        const c = await startLive();
        await act(() => fake.reply([], 10));
        const text = c.run!.textInput;
        const near = new Set([text.at(text.pos).codePoint, text.at(text.pos + 1).codePoint]);
        const wrong = [...'qwertyuiopasdfghjklzxcvbnm'].map(cp).find((ch) => !near.has(ch))!;
        const index = resolution.primary(wrong)!.index;
        await act(() => fake.reply([index], 20));
        expect(key(index).getAttribute('data-wrong')).toBe('true');
        expect(key(index).className).toContain('border-kb-red');
        expect(document.querySelectorAll('[data-wrong-badge]').length).toBe(1);
    });
});

describe('LiveBoard re-renders (§9.3, §9.9)', () => {
    it('a running sampler causes no board render while no key changes', async () => {
        fake = new FakeBoard();
        live = new LiveInput({ pollMatrix: fake.pollMatrix, getLayerMasks: fake.getLayerMasks, clock: fake.clock, sleep: fake.sleep });
        live.setKeymap({ resolution, keymap: board.keymap!, rows: board.rows, cols: board.cols });
        const viewFor = (layer: number | null) => boardView({
            keyboard: board, resolution, layoutId: 'us', defaultLayer: 0, displayedLayer: layer ?? 0,
            included: new Set(), locked: new Set(), next: null, hints: 'off', legends: true,
        });
        const renders = vi.fn();
        render(
            <Profiler id="board" onRender={renders}>
                <LiveBoard live={live} viewFor={viewFor} fit={{ unit: 45, scale: 1, variant: 'medium', hidden: false }} />
            </Profiler>,
        );
        live.setWanted(true);
        await act(() => fake.reply([], 10)); // the first sample sets the live layer
        const before = renders.mock.calls.length;
        // 100 samples at 100 Hz with nothing pressed.
        for (let t = 20; t <= 1010; t += 10) await act(() => fake.reply([], t));
        expect(fake.pollMatrix.mock.calls.length).toBeGreaterThan(100);
        expect(renders.mock.calls.length).toBe(before);
        await act(() => fake.reply([26], 1020));
        expect(renders.mock.calls.length).toBe(before + 1);
    });
});
