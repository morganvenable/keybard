import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PracticeController } from '@/features/practice/state/controller';
import { MemoryPracticeStore } from '@/features/practice/store/memory';
import ProgressPanel from '@/features/practice/ui/progress/ProgressPanel';
import { Providers, resetHarness, startController } from './harness';

// G2 Data rows (docs/practice/spec.md §5.9, §8.4, §12 M4): Export with Include keystrokes, Import with Merge
// or Replace (and its confirm), Reset with its confirm, the Storage off values, and the round trip.

vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => false }));
vi.mock('@/contexts/KeyboardContext', async () => { const h = await import('./harness'); return { useKeyboard: () => h.keyboardState }; });
vi.mock('@/contexts/LayoutSettingsContext', async () => { const h = await import('./harness'); return { useLayoutSettings: () => h.layoutState }; });
vi.mock('@/features/practice/PracticeProvider', async () => { const h = await import('./harness'); return { usePractice: h.useHarnessPractice }; });

beforeEach(() => {
    Element.prototype.scrollIntoView ??= () => undefined;
    resetHarness();
});

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    resetHarness();
});

async function completeLessons(c: PracticeController, n: number) {
    c.setFocused(true);
    for (let i = 0; i < n; i++) {
        c.resume();
        const run = c.run!;
        let t = 1000 + i * 100_000;
        for (let guard = 0; guard < 3000 && !run.textInput.completed; guard++) {
            // One wrong character now and then, so the events carry misses too.
            if (guard % 11 === 5) c.onInput({ type: 'input', timeStamp: (t += 150), inputType: 'appendChar', codePoint: 0x7a, timeToType: 0 });
            c.onInput({ type: 'input', timeStamp: (t += 150 + (guard % 5) * 30), inputType: 'appendChar', codePoint: run.expected!, timeToType: 0 });
        }
        await vi.waitFor(() => expect(c.run).not.toBe(run));
    }
}

/** Results as stored, without their store ids. */
async function stored(store: MemoryPracticeStore, profileId: string) {
    const results = await store.listResults(profileId);
    const events = await Promise.all(results.map((r) => store.getEvents(r.id)));
    return {
        results: JSON.stringify(results.map(({ id: _id, ...r }) => r)),
        events: events.map((e) => (e ? [e.layout, [...new Uint8Array(e.packed)].join(',')] : null)),
    };
}

describe('Export → reset → import (§8.4, §12 M4)', () => {
    it('round-trips byte-identical results and events', async () => {
        const store = new MemoryPracticeStore();
        const c = await startController({ store, settings: { targetSpeed: 75 } });
        await completeLessons(c, 3);
        const profileId = c.session!.profile.id;
        const before = await stored(store, profileId);
        expect(JSON.parse(before.results)).toHaveLength(3);
        expect(before.events.every((e) => e != null)).toBe(true);

        const { filename, text } = await c.exportData(true);
        expect(filename).toMatch(/^keybard-practice-me-\d{4}-\d{2}-\d{2}\.json$/);
        await c.resetProgress();
        await vi.waitFor(() => expect(c.session!.records.length).toBe(0));
        expect(await store.listResults(profileId)).toEqual([]);
        expect(await store.listEventIds(profileId)).toEqual([]);
        expect(await store.getSnapshot(profileId)).toBeUndefined();

        const summary = await c.importData(JSON.parse(text), 'merge');
        expect(summary).toMatchObject({ added: 3, duplicates: 0, invalid: 0, events: 3 });
        await vi.waitFor(() => expect(c.session!.records.length).toBe(3));
        const after = await stored(store, profileId);
        expect(after.results).toBe(before.results);
        expect(after.events).toEqual(before.events);
        // The replayed history gives the same key stats.
        expect(c.session!.lessonKeys.findIncludedKeys().length).toBeGreaterThanOrEqual(6);
    });

    it('without keystrokes the file has no events; Replace keeps only the file', async () => {
        const store = new MemoryPracticeStore();
        const c = await startController({ store, settings: { targetSpeed: 75 } });
        await completeLessons(c, 2);
        const { text } = await c.exportData(false);
        expect(JSON.parse(text).events).toBeUndefined();
        await completeLessons(c, 1);
        expect(c.lessonCount).toBe(3);
        await c.importData(JSON.parse(text), 'replace');
        await vi.waitFor(() => expect(c.session!.records.length).toBe(2));
    });
});

function file(text: string) {
    return new File([text], 'practice.json', { type: 'application/json' });
}

async function chooseFile(text: string) {
    const input = document.querySelector('[data-progress-import-file]') as HTMLInputElement;
    await act(async () => { fireEvent.change(input, { target: { files: [file(text)] } }); });
}

describe('Progress panel Data rows (§5.9)', () => {
    it('Export downloads the file; Include keystrokes is a toggle', async () => {
        const c = await startController({ store: new MemoryPracticeStore(), settings: { targetSpeed: 75 } });
        await completeLessons(c, 1);
        const create = vi.fn(() => 'blob:practice');
        Object.defineProperty(URL, 'createObjectURL', { value: create, configurable: true });
        Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true });
        const clicked: string[] = [];
        vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { clicked.push(this.download); });
        render(<Providers><ProgressPanel /></Providers>);
        const data = document.querySelector('[data-progress-data]') as HTMLElement;
        expect(within(data).getByRole('heading', { name: 'Data' })).toBeInTheDocument();
        await act(async () => { fireEvent.click(within(data).getByRole('button', { name: 'Export…' })); });
        await vi.waitFor(() => expect(clicked).toHaveLength(1));
        expect(clicked[0]).toMatch(/^keybard-practice-me-\d{4}-\d{2}-\d{2}\.json$/);
        const toggle = within(data).getByRole('group', { name: 'Include keystrokes' });
        fireEvent.click(within(toggle).getByRole('button', { name: /off/i }));
        expect(c.settings.exportKeystrokes).toBe(false);
    });

    it('Import: an invalid file shows the error line; a valid one its counts, then Merge imports', async () => {
        const store = new MemoryPracticeStore();
        const c = await startController({ store, settings: { targetSpeed: 75 } });
        await completeLessons(c, 2);
        const { text } = await c.exportData(true);
        render(<Providers><ProgressPanel /></Providers>);
        await chooseFile('{"format":"something-else"}');
        expect(await screen.findByRole('alert')).toHaveTextContent('Not a Keybard practice file');
        await chooseFile(text);
        await vi.waitFor(() => expect(document.querySelector('[data-import-counts]')).toHaveTextContent('2 lessons · 1 profile'));
        await chooseFile('not json');
        expect(await screen.findByRole('alert')).toHaveTextContent('Not a Keybard practice file');
        await chooseFile(text);
        await vi.waitFor(() => expect(document.querySelector('[data-import-counts]')).toHaveTextContent('2 lessons · 1 profile'));
        // Merge: the same lessons are already there.
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Import' })); });
        await vi.waitFor(() => expect(screen.getByText('0 lessons imported')).toBeInTheDocument());
        expect(c.lessonCount).toBe(2);
    });

    it('Replace takes two steps: Replace progress…, then the confirm with the count', async () => {
        const store = new MemoryPracticeStore();
        const c = await startController({ store, settings: { targetSpeed: 75 } });
        await completeLessons(c, 1);
        const { text } = await c.exportData(true);
        await completeLessons(c, 2);
        render(<Providers><ProgressPanel /></Providers>);
        await chooseFile(text);
        fireEvent.click(within(await screen.findByRole('radiogroup', { name: 'Import mode' })).getByRole('radio', { name: 'Replace' }));
        expect(screen.queryByRole('button', { name: 'Import' })).toBeNull();
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Replace progress…' })); });
        const dialog = await screen.findByRole('dialog', { name: 'Replace progress for Me?' });
        expect(within(dialog).getByText('3 lessons will be deleted')).toBeInTheDocument();
        await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Replace' })); });
        await vi.waitFor(() => expect(c.session!.records.length).toBe(1));
    });

    it('Reset asks first, then deletes the profile’s progress', async () => {
        const store = new MemoryPracticeStore();
        const c = await startController({ store, settings: { targetSpeed: 75 } });
        await completeLessons(c, 2);
        render(<Providers><ProgressPanel /></Providers>);
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Reset progress…' })); });
        const dialog = await screen.findByRole('dialog', { name: 'Delete progress for Me?' });
        await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' })); });
        expect(c.lessonCount).toBe(2);
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Reset progress…' })); });
        await act(async () => { fireEvent.click(within(await screen.findByRole('dialog', { name: 'Delete progress for Me?' })).getByRole('button', { name: 'Delete' })); });
        await vi.waitFor(() => expect(c.session!.records.length).toBe(0));
        expect(await store.listResults(c.session!.profile.id)).toEqual([]);
    });

    it('Storage off: Import and Reset say why instead of offering buttons; Export stays', async () => {
        await startController({ persistent: false });
        render(<Providers><ProgressPanel /></Providers>);
        const data = document.querySelector('[data-progress-data]') as HTMLElement;
        expect(within(data).getAllByText("Not available · progress isn't being saved")).toHaveLength(2);
        expect(within(data).queryByRole('button', { name: 'Import…' })).toBeNull();
        expect(within(data).queryByRole('button', { name: 'Reset progress…' })).toBeNull();
        expect(within(data).getByRole('button', { name: 'Export…' })).toBeInTheDocument();
    });

    it('renders the same rows docked in bottom-bar layout', async () => {
        await startController();
        render(<Providers><ProgressPanel horizontal /></Providers>);
        const data = document.querySelector('[data-progress-data]') as HTMLElement;
        expect(data.querySelector('.grid')).not.toBeNull();
        for (const name of ['Export…', 'Import…', 'Reset progress…']) expect(within(data).getByRole('button', { name })).toBeInTheDocument();
    });
});
