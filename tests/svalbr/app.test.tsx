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
    window.history.replaceState(null, '', '/');
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
    expect(await screen.findByRole('button', { name: /Export/ })).toBeInTheDocument();
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
