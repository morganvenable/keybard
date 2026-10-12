import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { IDBFactory } from 'fake-indexeddb';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import SvalbrApp from '@/svalbr/SvalbrApp';
import { resetPracticePageSession } from '@/features/practice/state/controller';

// Real shell, providers, import parser, engine, keyboard renderer, and IndexedDB.
// Only browser geometry and HTTP asset reads are supplied by the test environment.
beforeEach(() => {
    localStorage.clear();
    resetPracticePageSession();
    window.history.replaceState(null, '', '/?demo');
    vi.stubGlobal('indexedDB', new IDBFactory());
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
    window.matchMedia = vi.fn().mockImplementation(query => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} }));
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
        if (String(url).includes('sval-default')) return { ok: true, blob: async () => new Blob([readFileSync(resolve('src/default-layouts/sval-default.svil'), 'utf8')]) };
        if (String(url).includes('model-en')) {
            const bytes = readFileSync(resolve('src/features/practice/content/assets/model-en.data'));
            return { ok: true, arrayBuffer: async () => Uint8Array.from(bytes).buffer };
        }
        throw new Error(`Unexpected fetch: ${url}`);
    }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

async function start() {
    render(<SvalbrApp />);
    fireEvent.click(screen.getByRole('button', { name: /Try QWERTY example/ }));
    await screen.findByRole('heading', { name: 'Start practicing' }, { timeout: 10000 });
    fireEvent.click(screen.getByRole('button', { name: 'Learn from the center keys' }));
    fireEvent.click(screen.getByRole('button', { name: 'Start', exact: true }));
    await screen.findByLabelText('Practice text');
    expect(screen.queryByText(/Board disconnected/)).toBeNull();
}

it('starts from the example, types, switches modes, opens settings and shows progress without editor providers', async () => {
    await start();
    expect(screen.queryByRole('navigation', { name: 'Practice pages' })).not.toBeInTheDocument();
    expect(screen.queryByRole('radiogroup', { name: 'Lesson type' })).not.toBeInTheDocument();
    expect(document.querySelectorAll('[data-practice-key]').length).toBeGreaterThan(40);
    fireEvent.mouseDown(document.querySelector('[data-practice-text-card]')!);
    const textarea = screen.getByLabelText('Practice text');
    const character = document.querySelector('[data-cursor]')!.textContent!;
    fireEvent.input(textarea, { inputType: 'insertText', data: character });
    await waitFor(() => expect(document.querySelector('[data-glyph="typed"]')).not.toBeNull());
    const nav = within(screen.getByRole('navigation', { name: 'Training modes' }));
    for (const name of ['Drill', 'Words', 'Custom']) {
        fireEvent.click(nav.getByRole('button', { name, exact: true }));
        await screen.findByRole('heading', { name, exact: true });
    }
    fireEvent.click(screen.getByRole('button', { name: 'Lesson settings' }));
    const settings = await screen.findByRole('dialog', { name: 'Lesson settings' });
    fireEvent.click(await within(settings).findByRole('button', { name: /OS layout/ }));
    await screen.findByRole('dialog', { name: 'Keyboard & appearance' });
    fireEvent.change(screen.getByLabelText('OS keyboard layout'), { target: { value: 'uk' } });
    expect(screen.getByLabelText('OS keyboard layout')).toHaveValue('uk');
    fireEvent.click(screen.getByRole('button', { name: 'Close settings' }));
    fireEvent.click(nav.getByRole('button', { name: 'Progress', exact: true }));
    await screen.findByRole('heading', { name: 'Your progress' });
    fireEvent.click(screen.getByRole('button', { name: 'Progress & data' }));
    await screen.findByRole('dialog', { name: 'Progress & data' });
    expect(await screen.findByRole('button', { name: /Export/ }, { timeout: 10000 })).toBeInTheDocument();
}, 20000);

it('reports a failed example load and lets the user retry', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Example unavailable'));
    render(<SvalbrApp />);
    fireEvent.click(screen.getByRole('button', { name: /Try QWERTY example/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Example unavailable');
    fireEvent.click(screen.getByRole('button', { name: /Try QWERTY example/ }));
    await screen.findByRole('heading', { name: 'Start practicing' }, { timeout: 10000 });
});

it('keeps standalone navigation in Practice for empty and editor/overlay hashes', async () => {
    await start();
    for (const hash of ['', '#overlay', '#editor']) {
        await act(async () => {
            window.location.hash = hash;
            window.dispatchEvent(new HashChangeEvent('hashchange'));
        });
        await waitFor(() => expect(window.location.hash).toBe('#practice'));
        expect(screen.getByLabelText('Practice text')).toBeInTheDocument();
    }
});

it('changes real content through the visible chooser and preserves selections across modes', async () => {
    await start();
    const nav = within(screen.getByRole('navigation', { name: 'Training modes' }));
    fireEvent.click(nav.getByRole('button', { name: 'Books', exact: true }));
    await screen.findByLabelText('Book', { exact: true });
    fireEvent.change(screen.getByLabelText('Book', { exact: true }), { target: { value: 'wild' } });
    fireEvent.change(screen.getByLabelText('Paragraph', { exact: true }), { target: { value: '2' } });
    await waitFor(() => expect(document.querySelector('[data-practice-text-card]')).toHaveTextContent('buck lived'));
    fireEvent.click(nav.getByRole('button', { name: 'Source code', exact: true }));
    fireEvent.change(await screen.findByLabelText('Language', { exact: true }), { target: { value: 'python' } });
    expect(screen.getByLabelText('Language', { exact: true })).toHaveValue('python');
    fireEvent.click(nav.getByRole('button', { name: 'Words', exact: true }));
    fireEvent.change(await screen.findByLabelText('Vocabulary size'), { target: { value: '500' } });
    await screen.findByText('Vocabulary: 500 words');
    fireEvent.click(nav.getByRole('button', { name: 'Custom', exact: true }));
    fireEvent.change(await screen.findByLabelText('Text example'), { target: { value: '0' } });
    await waitFor(() => expect(document.querySelector('[data-practice-text-card]')).toHaveTextContent('jabberwocky'));
    fireEvent.click(nav.getByRole('button', { name: 'Books', exact: true }));
    expect(await screen.findByLabelText('Book', { exact: true })).toHaveValue('wild');
    expect(screen.getByLabelText('Paragraph', { exact: true })).toHaveValue('2');
}, 20000);

it('shows a readable fresh lesson, then pauses only after typing starts', async () => {
    await start();
    const nav = within(screen.getByRole('navigation', { name: 'Training modes' }));
    act(() => { screen.getByLabelText('Practice text').blur(); });
    fireEvent.click(nav.getByRole('button', { name: 'Words', exact: true }));
    await screen.findByRole('button', { name: 'Start typing', exact: true });
    expect(screen.queryByRole('button', { name: 'Resume', exact: true })).not.toBeInTheDocument();
    expect(document.querySelector('[data-practice-paused]')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Start typing', exact: true }));
    const character = document.querySelector('[data-cursor]')!.textContent!;
    fireEvent.input(screen.getByLabelText('Practice text'), { inputType: 'insertText', data: character });
    await waitFor(() => expect(document.querySelector('[data-glyph="typed"]')).not.toBeNull());
    act(() => { screen.getByLabelText('Practice text').blur(); });
    await screen.findByRole('button', { name: 'Resume', exact: true });
});
it('offers only board connection on the normal landing page', () => {
    window.history.replaceState(null, '', '/');
    render(<SvalbrApp />);
    expect(screen.getByRole('button', { name: 'Connect Svalboard', exact: true })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Import keymap|Try QWERTY example/ })).toBeNull();
    expect(screen.getByRole('button', { name: /Connect your Svalboard/ })).toBeInTheDocument();
});

it('does not treat a retained offline keymap as a connected board', async () => {
    await start();
    window.history.replaceState(null, '', '/');
    // A state change re-evaluates the normal production flow while retaining the loaded board.
    fireEvent.click(screen.getByRole('button', { name: /Use dark theme|Use light theme/ }));
    await screen.findByRole('heading', { name: 'Typing practice for your Svalboard.' });
    expect(screen.queryByLabelText('Practice text')).toBeNull();
    expect(within(screen.getByRole('navigation', { name: 'Training modes' })).getByRole('button', { name: 'Words', exact: true })).toBeDisabled();
});

it('captures the first typed character from the workspace, but respects dialogs and keyboard controls', async () => {
    await start();
    const words = within(screen.getByRole('navigation', { name: 'Training modes' })).getByRole('button', { name: 'Words', exact: true });
    fireEvent.click(words);
    act(() => words.focus());
    const expected = document.querySelector('[data-cursor]')!.textContent!;
    fireEvent.keyDown(words, { key: expected });
    const textarea = screen.getByLabelText('Practice text');
    expect(textarea).toHaveFocus();
    fireEvent.input(textarea, { inputType: 'insertText', data: expected });
    await waitFor(() => expect(document.querySelectorAll('[data-glyph="typed"]')).toHaveLength(1));
    fireEvent.keyDown(textarea, { key: 'Escape' });
    await screen.findByRole('button', { name: 'Resume', exact: true });
    fireEvent.keyDown(textarea, { key: 'a' });
    expect(document.querySelector('[data-practice-paused]')).toBeNull();
    act(() => words.focus());
    fireEvent.keyDown(words, { key: ' ', code: 'Space' });
    expect(words).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: 'Lesson settings' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.keyDown(dialog, { key: 'a' });
    expect(textarea).not.toHaveFocus();
    expect(document.querySelectorAll('[data-glyph="typed"]')).toHaveLength(1);
});
it('applies content filters and keeps custom-text cancellation separate from saving', async () => {
    await start();
    const nav = within(screen.getByRole('navigation', { name: 'Training modes' }));
    fireEvent.click(nav.getByRole('button', { name: 'Words', exact: true }));
    const longWords = await screen.findByRole('checkbox', { name: 'Long words only' });
    fireEvent.click(longWords);
    expect(longWords).toBeChecked();
    fireEvent.click(nav.getByRole('button', { name: 'Numbers', exact: true }));
    const benford = await screen.findByRole('checkbox', { name: /Natural number frequency/ });
    fireEvent.click(benford);
    expect(benford).not.toBeChecked();
    fireEvent.click(nav.getByRole('button', { name: 'Books', exact: true }));
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Lowercase', exact: true }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Letters only', exact: true }));
    expect(screen.getByRole('checkbox', { name: 'Lowercase', exact: true })).not.toBeChecked();
    fireEvent.click(nav.getByRole('button', { name: 'Source code', exact: true }));
    const flag = (await screen.findAllByRole('checkbox'))[0];
    const previous = (flag as HTMLInputElement).checked;
    fireEvent.click(flag);
    expect((flag as HTMLInputElement).checked).toBe(!previous);
    fireEvent.click(nav.getByRole('button', { name: 'Drill', exact: true }));
    fireEvent.change(await screen.findByLabelText('Group'), { target: { value: 'numbers' } });
    fireEvent.change(screen.getByLabelText('Hand'), { target: { value: 'left' } });
    fireEvent.change(screen.getByLabelText('Layer', { exact: true }), { target: { value: '0' } });
    fireEvent.click(within(screen.getByRole('group', { name: 'Cluster directions' })).getByRole('button', { name: 'C', exact: true }));
    expect(screen.getByLabelText('Hand')).toHaveValue('left');
    fireEvent.click(nav.getByRole('button', { name: 'Custom', exact: true }));
    fireEvent.click(await screen.findByRole('button', { name: 'Paste or edit text' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Custom text', exact: true }), { target: { value: 'discard this draft' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel', exact: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Paste or edit text' }));
    expect(screen.getByRole('textbox', { name: 'Custom text', exact: true })).not.toHaveValue('discard this draft');
    fireEvent.change(screen.getByRole('textbox', { name: 'Custom text', exact: true }), { target: { value: 'hello practice' } });
    fireEvent.click(screen.getByRole('button', { name: 'Use text', exact: true }));
    await waitFor(() => expect(document.querySelector('[data-practice-text-card]')).toHaveTextContent('hello practice'));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Shuffle words' }));
    expect(screen.getByRole('checkbox', { name: 'Shuffle words' })).toBeChecked();
    fireEvent.click(nav.getByRole('button', { name: 'Words', exact: true }));
    expect(await screen.findByRole('checkbox', { name: 'Long words only' })).toBeChecked();
}, 20000);
