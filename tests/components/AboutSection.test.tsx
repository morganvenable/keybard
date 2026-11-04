import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
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

const table = () => screen.getByRole('table', { name: 'Keybard releases' });
/** Each body row's cells joined with "|", with "*" before the current row. */
const rows = () => within(table()).getAllByRole('row').slice(1)
    .map(r => (r.hasAttribute('data-current') ? '*' : '') + [...r.children].map(c => c.textContent).join('|'));
const sentence = () => document.querySelector('[data-about-using]')!.textContent;

describe('About', () => {
    it('heads the table Release, Keybard, Firmware, Site', async () => {
        render(<AboutSection tag="x4.4" buildSite="next" boardTag={null} />);
        await act(async () => {});
        expect(within(table()).getAllByRole('columnheader').map(h => h.textContent)).toEqual(['Release', 'Keybard', 'Firmware', 'Site']);
    });

    it('on next: says Unstable Keybard x4.4, Stable from its version.json, the Unstable row bold', async () => {
        render(<AboutSection tag="x4.4" buildSite="next" boardTag={null} />);
        await waitFor(() => expect(rows()[0]).toContain('v4.3.6'));
        expect(sentence()).toBe("You're using Unstable Keybard x4.4.");
        expect(rows()).toEqual([
            'Stable|v4.3.6|v4.3.5|keybard.svalboard.com',
            '*Unstable|x4.4|x4.4|next.keybard.svalboard.com',
        ]);
        const current = within(table()).getAllByRole('row').find(r => r.hasAttribute('data-current'))!;
        expect(current.className).toContain('font-semibold');
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(screen.getByRole('link', { name: 'keybard.svalboard.com' })).toHaveAttribute('href', 'https://keybard.svalboard.com/');
        expect(screen.getByRole('link', { name: 'next.keybard.svalboard.com' })).toHaveAttribute('href', 'https://next.keybard.svalboard.com/');
        expect(screen.getByRole('link', { name: 'Release notes' })).toHaveAttribute('href', 'https://github.com/svalboard/keybard/releases/tag/x4.4');
    });

    it('on keybard.svalboard.com: the same table, the Stable row bold', async () => {
        render(<AboutSection tag="v4.3.6" buildSite="production" boardTag={null} />);
        await waitFor(() => expect(rows()[1]).toContain('x4.4'));
        expect(sentence()).toBe("You're using Stable Keybard v4.3.6.");
        // This build carries no v firmware today: blank, not guessed.
        expect(rows()).toEqual([
            '*Stable|v4.3.6||keybard.svalboard.com',
            'Unstable|x4.4|x4.4|next.keybard.svalboard.com',
        ]);
    });

    it('has no parentheticals anywhere', async () => {
        const { container } = render(<AboutSection tag="v4.3.6" buildSite="production" boardTag="x4.4" />);
        await waitFor(() => expect(rows()[1]).toContain('x4.4'));
        expect(container.textContent).not.toMatch(/[()]|this one/i);
    });

    it('leaves the other release blank when its version.json cannot be read', async () => {
        fetchMock.mockImplementation(async () => { throw new TypeError('Failed to fetch'); });
        render(<AboutSection tag="x4.4" buildSite="next" boardTag={null} />);
        await waitFor(() => expect(fetchMock).toHaveBeenCalled());
        // Wait for the read itself to finish, so this is the failed state, not the one while reading.
        await act(async () => { await fetchMock.mock.results[0].value.catch(() => {}); await new Promise(r => setTimeout(r, 0)); });
        expect(rows()[0]).toBe('Stable|||keybard.svalboard.com');
    });

    it('an untagged build: a development build with its commit, then both releases, neither bold', async () => {
        render(<AboutSection tag="" sha="1a2b3c4" buildSite="dev" boardTag={null} />);
        await waitFor(() => expect(rows()[1]).toContain('x4.4'));
        expect(sentence()).toBe("You're using a development build, commit 1a2b3c4.");
        expect(rows()).toEqual([
            'Stable|v4.3.6|v4.3.5|keybard.svalboard.com',
            'Unstable|x4.4|x4.4|next.keybard.svalboard.com',
        ]);
        expect(screen.getByRole('link', { name: 'Release notes' })).toHaveAttribute('href', 'https://github.com/svalboard/keybard/releases');
    });

    it('Paranoid lists only its own release and reads nothing', async () => {
        render(<AboutSection tag="v4.3.6" buildSite="production" paranoid boardTag={null} />);
        await new Promise(r => setTimeout(r, 0));
        expect(rows()).toEqual(['*Stable|v4.3.6||keybard.svalboard.com']);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('on keybard.svalboard.com, a keyboard on Unstable firmware gets a sentence under the table', async () => {
        render(<AboutSection tag="v4.3.6" buildSite="production" boardTag="x4.4" />);
        await act(async () => {});
        const line = screen.getByTestId('about-unstable-firmware');
        expect(line.textContent).toBe('Your keyboard runs Unstable firmware x4.4. Unstable Keybard at next.keybard.svalboard.com goes with it.');
        expect(within(line).getByRole('link', { name: 'next.keybard.svalboard.com' })).toHaveAttribute('href', 'https://next.keybard.svalboard.com/');
    });

    it('no such sentence on next, or for a keyboard on Stable firmware', async () => {
        const { unmount } = render(<AboutSection tag="x4.4" buildSite="next" boardTag="x4.4" />);
        await act(async () => {});
        expect(screen.queryByTestId('about-unstable-firmware')).toBeNull();
        unmount();
        render(<AboutSection tag="v4.3.6" buildSite="production" boardTag="v4.3.5" />);
        await act(async () => {});
        expect(screen.queryByTestId('about-unstable-firmware')).toBeNull();
    });

    it('links to the manual and community', async () => {
        render(<AboutSection />);
        await act(async () => {});
        expect(screen.getByRole('link', { name: 'Manual' })).toHaveAttribute('href', 'https://docs.svalboard.com/keybard/');
        expect(screen.getByRole('link', { name: 'Svalboard community' })).toHaveAttribute('href', 'https://svalboard.com/discord');
    });
});
