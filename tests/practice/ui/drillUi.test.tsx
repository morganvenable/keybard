import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToggleChipGroup } from '@/components/shared/ToggleChipGroup';
import { TooltipProvider } from '@/components/ui/tooltip';
import { characterStats } from '@/features/practice/state/progressView';
import { DEFAULT_DRILL, type PracticeSettings } from '@/features/practice/state/settings';
import { CustomTextDialog } from '@/features/practice/ui/CustomTextDialog';
import { KeyDetails } from '@/features/practice/ui/KeyPopover';
import LessonPanel from '@/features/practice/ui/LessonPanel';
import LessonsPage from '@/features/practice/ui/LessonsPage';
import ProgressPage from '@/features/practice/ui/progress/ProgressPage';
import { type HarnessOptions, practice, Providers, resetHarness, startController } from './harness';

// M3 on screen (docs/practice/spec.md §5.2, §5.3, §5.5, §5.7, §5.10): the four lesson types on the type
// row with their scope text, the Drill, Words and Custom panel sections, P6, Nothing to drill, the
// At target metric and Drill this key.

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

const cp = (s: string) => s.codePointAt(0)!;
const textarea = () => screen.queryByLabelText('Practice text') as HTMLTextAreaElement | null;
const typeGroup = () => screen.getByRole('radiogroup', { name: 'Lesson type' });
const drill = (patch: Partial<typeof DEFAULT_DRILL>): Partial<PracticeSettings> => ({ type: 'drill', drill: { ...DEFAULT_DRILL, ...patch } });

/** A controller past Start (whose Learn preset sets Guided), then on these settings. */
async function startWith(settings: Partial<PracticeSettings>, options: HarnessOptions = {}) {
    const c = await startController(options);
    act(() => c.update(settings));
    await vi.waitFor(() => expect(c.session?.settings).toMatchObject(settings));
    return c;
}

/** Types the whole current lesson through the controller and waits for it to be saved. */
async function completeLesson(c: Awaited<ReturnType<typeof startController>>) {
    act(() => { c.setFocused(true); c.resume(); });
    const run = c.run!;
    let t = 1000;
    act(() => {
        while (!run.textInput.completed) {
            c.onInput({ type: 'input', timeStamp: t, inputType: 'appendChar', codePoint: run.expected!, timeToType: 0 });
            t += 150;
        }
    });
    await vi.waitFor(() => expect(c.session!.records.length).toBe(1));
}

beforeEach(() => {
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1440 });
    Element.prototype.hasPointerCapture ??= () => false;
    Element.prototype.scrollIntoView ??= () => undefined;
    resetHarness();
});

afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    resetHarness();
    for (const name of ['primary-nav', 'details-panel']) document.cookie = `${name}:state=; path=/; max-age=0`;
});

describe('Type row with Drill, Words and Custom (§5.2)', () => {
    it('choosing Drill with the pointer regenerates the lesson and returns focus to the surface', async () => {
        const c = await startController();
        render(<Providers><LessonsPage /></Providers>);
        const before = c.run;
        fireEvent.click(within(typeGroup()).getByRole('radio', { name: 'Drill' }));
        await vi.waitFor(() => expect(c.session?.type).toBe('drill'));
        expect(c.run).not.toBe(before);
        await vi.waitFor(() => expect(document.activeElement).toBe(textarea()));
        expect(screen.getByRole('button', { name: /All keys/ })).toBeInTheDocument();
    });

    it('names each type\'s scope: Drill, Words and Custom', async () => {
        await startWith(drill({ layer: 1, group: 'symbols', dirs: ['N', 'S'] }));
        const { unmount } = render(<Providers><LessonsPage /></Providers>);
        expect(screen.getByRole('button', { name: /Layer 1 · Symbols · N S/ })).toBeInTheDocument();
        // At target / scope size in Drill (§5.2).
        expect(screen.getByText('At target')).toBeInTheDocument();
        expect(document.querySelectorAll('[data-strip-key]')).toHaveLength(8);
        unmount();
        resetHarness();
        await startWith({ type: 'words', words: { size: 200, longOnly: false } });
        const words = render(<Providers><LessonsPage /></Providers>);
        expect(screen.getByRole('button', { name: /200 words/ })).toBeInTheDocument();
        words.unmount();
        resetHarness();
        await startWith({ type: 'custom', customText: { content: 'function résumé(items) { return items; }', lowercase: false, lettersOnly: false, randomize: false } });
        render(<Providers><LessonsPage /></Providers>);
        expect(screen.getByRole('button', { name: /function résumé\(items\) \{…/ })).toBeInTheDocument();
    });

    it('the scope button opens the Lesson panel at the type\'s section', async () => {
        const c = await startWith(drill({ layer: 1 }));
        render(<Providers><LessonsPage /></Providers>);
        fireEvent.click(screen.getByRole('button', { name: /Layer 1/ }));
        expect(screen.getByTestId('active').textContent).toBe('practice');
        expect(c.panelSection).toBe('drill');
    });
});

describe('Nothing to drill (§5.3)', () => {
    it('shows the well with Change scope, keeps the type row, and draws the board without a lesson', async () => {
        const c = await startWith(drill({ layer: 1, group: 'letters' }));
        render(<Providers><LessonsPage /></Providers>);
        expect(screen.getByRole('heading', { name: 'Nothing to drill in this scope' })).toBeInTheDocument();
        expect(textarea()).toBeNull();
        expect(typeGroup()).toBeInTheDocument();
        expect(document.querySelectorAll('[data-practice-key][data-state="included"]')).toHaveLength(0);
        fireEvent.click(screen.getByRole('button', { name: 'Change scope' }));
        expect(screen.getByTestId('active').textContent).toBe('practice');
        expect(c.panelSection).toBe('drill');
    });

    it('a Custom text with nothing typeable shows its well with Edit text', async () => {
        await startWith({ type: 'custom', customText: { content: 'ééé', lowercase: true, lettersOnly: true, randomize: false } });
        render(<Providers><LessonsPage /></Providers>);
        expect(screen.getByRole('heading', { name: 'Nothing to type in this text' })).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Edit text' }));
        expect(screen.getByRole('dialog', { name: 'Custom text' })).toBeInTheDocument();
    });
});

describe('Lesson panel: Drill, Words and Custom sections (§5.5)', () => {
    const groups = () => [...document.querySelectorAll('h3')].map((h) => h.textContent);

    it('Drill: layer pills, group tiles, direction chips without 2S, hands, thumbs and In scope', async () => {
        const c = await startWith(drill({ layer: 1, group: 'symbols', dirs: ['N', 'S'] }));
        render(<Providers><LessonPanel /></Providers>);
        expect(groups()[0]).toBe('Drill');
        expect(groups()).not.toContain('Guided');
        const layers = screen.getByRole('group', { name: 'Layer' });
        expect(within(layers).getByRole('button', { name: /Layer 1|1/, pressed: true })).toBeInTheDocument();
        expect(within(layers).getByRole('button', { name: 'All' })).toBeInTheDocument();
        expect(within(screen.getByRole('group', { name: 'Group' })).getByRole('button', { name: 'Symbols', pressed: true })).toBeInTheDocument();
        const dirs = screen.getByRole('group', { name: 'Directions' });
        expect(within(dirs).getAllByRole('button').map((b) => b.textContent)).toEqual(['C', 'N', 'S', 'E', 'W']);
        expect(within(dirs).getByRole('button', { name: 'North' })).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByRole('radiogroup', { name: 'Hands' })).toBeInTheDocument();
        expect(screen.queryByText('Number format')).toBeNull();
        expect(document.querySelector('[data-drill-in-scope]')?.getAttribute('data-drill-in-scope')).toBe('8');

        // A chip change narrows the scope and rebuilds the lesson.
        fireEvent.click(within(dirs).getByRole('button', { name: 'South' }));
        expect(c.settings.drill.dirs).toEqual(['N']);
        fireEvent.click(within(screen.getByRole('group', { name: 'Group' })).getByRole('button', { name: 'Numbers' }));
        expect(c.settings.drill.group).toBe('numbers');
        expect(await screen.findByText('Number format')).toBeInTheDocument();
    });

    it('Drill: below 3 characters In scope reads Too few characters in the error color', async () => {
        await startWith(drill({ layer: 1, group: 'letters' }));
        render(<Providers><LessonPanel /></Providers>);
        const few = document.querySelector('[data-drill-too-few]')!;
        expect(few).toHaveTextContent('Too few characters (0 of 3)');
        expect(few.className).toContain('text-red-700');
    });

    it('Words: word list size and Long words only', async () => {
        const c = await startWith({ type: 'words' });
        render(<Providers><LessonPanel /></Providers>);
        expect(groups()[0]).toBe('Words');
        expect(screen.getByRole('slider', { name: 'Word list size' })).toBeInTheDocument();
        fireEvent.click(within(screen.getByRole('group', { name: 'Long words only' })).getByRole('button', { name: 'ON' }));
        expect(c.settings.words.longOnly).toBe(true);
    });

    it('Custom: the Text row opens P6; Use text saves the text', async () => {
        const c = await startWith({ type: 'custom' });
        render(<Providers><LessonPanel /></Providers>);
        expect(groups()[0]).toBe('Custom');
        expect(screen.getByRole('group', { name: 'Lowercase' })).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: /^Text/ }));
        const dialog = screen.getByRole('dialog', { name: 'Custom text' });
        fireEvent.change(within(dialog).getByRole('textbox', { name: 'Custom text' }), { target: { value: 'hello world' } });
        fireEvent.click(within(dialog).getByRole('button', { name: 'Use text' }));
        expect(c.settings.customText.content).toBe('hello world');
    });

    it('Typing: Layer underlines follows the type (on in Drill by default)', async () => {
        const c = await startWith(drill({}));
        render(<Providers><LessonPanel /></Providers>);
        expect(c.settings.drillLayerUnderlines).toBe(true);
        expect(c.settings.layerUnderlines).toBe(false);
        fireEvent.click(within(screen.getByRole('group', { name: 'Layer underlines' })).getByRole('button', { name: 'OFF' }));
        expect(c.settings.drillLayerUnderlines).toBe(false);
        expect(c.settings.layerUnderlines).toBe(false);
    });
});

describe('P6 Custom text (§5.10)', () => {
    it('counts characters and lists the ones the keymap can\'t type; spaces and newlines never', async () => {
        const c = await startController();
        const onUse = vi.fn();
        render(<Providers><CustomTextDialog open onOpenChange={() => {}} text={'Café — open\nlate'} resolution={c.session!.resolution} onUse={onUse} /></Providers>);
        const untypeable = document.querySelector('[data-practice-untypeable]')!;
        expect(untypeable).toHaveTextContent('Not on this keymap:');
        expect([...untypeable.querySelectorAll('span')].slice(1).map((s) => s.textContent)).toEqual(['é', '—']);
        expect(screen.getByText('16 / 10,000')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Use text' }));
        expect(onUse).toHaveBeenCalledWith('Café — open\nlate');
    });
});

describe('Drill this key (§5.7)', () => {
    it('P5 offers Drill this key, which starts Drill on the character and its cluster', async () => {
        const c = await startController();
        const onDrill = vi.fn();
        const session = c.session!;
        const letter = session.trackedLetters.find((l) => l.codePoint === cp('!'))!;
        const stats = characterStats(session.keyStatsMap.get(letter), session.target, session.resolution.primary(cp('!')));
        render(<TooltipProvider><KeyDetails stats={stats} resolution={session.resolution} cols={6} unit="wpm" layerColor="orange" inferred onDrill={onDrill} /></TooltipProvider>);
        fireEvent.click(screen.getByRole('button', { name: 'Drill this key' }));
        expect(onDrill).toHaveBeenCalled();
    });

    it('from the key strip: the lesson becomes a Drill focused on the key', async () => {
        const c = await startController();
        render(<Providers><LessonsPage /></Providers>);
        fireEvent.click(document.querySelector('[data-strip-key="j"]')!);
        fireEvent.click(await screen.findByRole('button', { name: 'Drill this key' }));
        await vi.waitFor(() => expect(c.session?.type).toBe('drill'));
        expect(c.settings.drill.focus).toBe(cp('j'));
        expect(c.session!.lessonKeys.findFocusedKey()?.letter.codePoint).toBe(cp('j'));
        expect(screen.getByRole('button', { name: /j and its cluster/ })).toBeInTheDocument();
    });

    it('from the Characters table: Drill, then the Lessons page', async () => {
        const c = await startController();
        await completeLesson(c);
        act(() => { c.setActive(false); });
        render(<Providers><ProgressPage /></Providers>);
        fireEvent.click(document.querySelector('[data-char-row="a"] button')!);
        fireEvent.click(await screen.findByRole('button', { name: 'Drill this key' }));
        await vi.waitFor(() => expect(c.session?.type).toBe('drill'));
        expect(screen.getByTestId('page').textContent).toBe('lessons');
        expect(practice.controller!.settings.drill.focus).toBe(cp('a'));
    });
});

describe('ToggleChipGroup (N-2)', () => {
    it('toggles chips with aria-pressed and keeps the options\' order', () => {
        const onChange = vi.fn();
        render(<ToggleChipGroup label="Directions" value={['S']} onChange={onChange} options={[{ value: 'N', label: 'N' }, { value: 'S', label: 'S' }]} />);
        expect(screen.getByRole('button', { name: 'S' })).toHaveAttribute('aria-pressed', 'true');
        fireEvent.click(screen.getByRole('button', { name: 'N' }));
        expect(onChange).toHaveBeenCalledWith(['N', 'S']);
        fireEvent.click(screen.getByRole('button', { name: 'S' }));
        expect(onChange).toHaveBeenLastCalledWith([]);
    });
});
