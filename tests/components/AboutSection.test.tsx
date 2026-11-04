import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import AboutSection from '../../src/layout/SecondarySidebar/Panels/settings/AboutSection';
import { resetSiteVersions } from '../../src/utils/site-versions';

vi.mock('@/lib/paranoid', () => ({ PARANOID: false, userIsLooking: () => true }));

const files: Record<string, unknown> = {
    'https://keybard.svalboard.com/version.json': { tag: 'v4.3.6', firmware: 'v4.3.5' },
    'https://next.keybard.svalboard.com/version.json': { tag: 'x4.4', firmware: 'x4.4' },
};
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
    resetSiteVersions();
    fetchMock = vi.fn(async (url: string) => files[url]
        ? ({ ok: true, json: async () => files[url] }) as Response
        : ({ ok: false, json: async () => ({}) }) as Response);
    vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

const rowText = () => [...screen.getByRole('table', { name: 'Keybard' }).querySelectorAll('[role=row]')]
    .map(tr => [...tr.querySelectorAll(':scope > [role=cell]')].map(td => td.textContent).join('|'));

describe('About', () => {
    it('shows the Keybard build, never a made-up version', async () => {
        render(<AboutSection />);
        await act(async () => {});
        const facts = screen.getByLabelText('Keybard');
        expect(facts).not.toHaveTextContent('1.0.0');
        expect(facts.textContent).toMatch(/^(build [0-9a-f]+|development build|Stable[v]\d|Unstable[x]\d)/);
    });

    it('on next: x4.4 with next first and marked, then v4.3.6 with keybard.svalboard.com', async () => {
        render(<AboutSection tag="x4.4" label="x4.4" buildSite="next" />);
        await waitFor(() => expect(rowText()[1]).toContain('v4.3.6'));
        expect(rowText()).toEqual([
            'Unstable|x4.4|next.keybard.svalboard.com, firmware x4.4(this one)',
            'Stable|v4.3.6|keybard.svalboard.com, firmware v4.3.5',
        ]);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(screen.getByRole('link', { name: 'keybard.svalboard.com' })).toHaveAttribute('href', 'https://keybard.svalboard.com/');
        expect(screen.getByRole('link', { name: 'next.keybard.svalboard.com' })).toHaveAttribute('href', 'https://next.keybard.svalboard.com/');
        expect(screen.getByRole('link', { name: 'Release notes' })).toHaveAttribute('href', 'https://github.com/svalboard/keybard/releases/tag/x4.4');
        // The words appear only beside a version, in their own cell.
        const words = [...screen.getByRole('table', { name: 'Keybard' }).querySelectorAll('[role=row]')].map(tr => tr.querySelector('[role=cell]')?.textContent);
        expect(words).toEqual(['Unstable', 'Stable']);
        expect(screen.queryByRole('link', { name: /stable|unstable/i })).toBeNull();
    });

    it('on keybard.svalboard.com: v4.3.6 first and marked, then x4.4 with next', async () => {
        render(<AboutSection tag="v4.3.6" label="v4.3.6" buildSite="production" />);
        await waitFor(() => expect(rowText()[1]).toContain('x4.4'));
        expect(rowText()[0]).toMatch(/^Stable\|v4\.3\.6\|keybard\.svalboard\.com.*\(this one\)$/);
        expect(rowText()[1]).toBe('Unstable|x4.4|next.keybard.svalboard.com, firmware x4.4');
    });

    it('shows the other site with no version when its version.json cannot be read', async () => {
        fetchMock.mockImplementation(async () => { throw new TypeError('Failed to fetch'); });
        render(<AboutSection tag="x4.4" label="x4.4" buildSite="next" />);
        await waitFor(() => expect(fetchMock).toHaveBeenCalled());
        // Wait for the read itself to finish, so this is the failed state, not the one while reading.
        await act(async () => { await fetchMock.mock.results[0].value.catch(() => {}); await new Promise(r => setTimeout(r, 0)); });
        // No word without a version.
        expect(rowText()[1]).toBe('|version not known|keybard.svalboard.com');
    });

    it('an untagged build shows its commit, then both sites with their versions', async () => {
        render(<AboutSection tag="" label="build 1a2b3c4" buildSite="dev" />);
        await waitFor(() => expect(rowText()[2]).toContain('x4.4'));
        expect(rowText()).toEqual([
            '|build 1a2b3c4|(this one)',
            'Stable|v4.3.6|keybard.svalboard.com, firmware v4.3.5',
            'Unstable|x4.4|next.keybard.svalboard.com, firmware x4.4',
        ]);
        expect(screen.getByRole('link', { name: 'Release notes' })).toHaveAttribute('href', 'https://github.com/svalboard/keybard/releases');
    });

    it('Paranoid shows only its own version and reads nothing', async () => {
        render(<AboutSection tag="v4.3.6" label="v4.3.6" buildSite="production" paranoid />);
        await new Promise(r => setTimeout(r, 0));
        expect(rowText()).toEqual(['Stable|v4.3.6|keybard.svalboard.com(this one)']);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('links to the manual and community', async () => {
        render(<AboutSection />);
        await act(async () => {});
        expect(screen.getByRole('link', { name: 'Manual' })).toHaveAttribute('href', 'https://docs.svalboard.com/keybard/');
        expect(screen.getByRole('link', { name: 'Svalboard community' })).toHaveAttribute('href', 'https://svalboard.com/discord');
    });
});
