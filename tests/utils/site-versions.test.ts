import { describe, expect, it, vi } from 'vitest';
import {
    fetchSiteVersion, ownSite, parseVersionFile, releaseNotesUrl, resetSiteVersions, siteForTag, siteVersion, sitesToRead, versionRows,
} from '../../src/utils/site-versions';
import { versionFile, type FirmwareReleasePin } from '../../src/constants/firmware-releases';

const json = (body: unknown, ok = true) => vi.fn(async () => ({ ok, json: async () => body }) as unknown as Response);

describe('site versions', () => {
    it('pairs v releases with keybard.svalboard.com and x releases with next', () => {
        expect(siteForTag('v4.3.6')).toBe('production');
        expect(siteForTag('x4.4')).toBe('next');
        expect(siteForTag('')).toBeNull();
        expect(siteForTag('vLaunch2.3')).toBeNull();
    });

    it('on next: this release first, then keybard.svalboard.com with its fetched versions', () => {
        const rows = versionRows({ tag: 'x4.4', label: 'x4.4', buildSite: 'next', fetched: { production: { tag: 'v4.3.6', firmware: 'v4.3.5' } } });
        expect(rows).toEqual([
            { version: 'x4.4', firmware: 'x4.4', site: 'next', thisOne: true },
            { version: 'v4.3.6', firmware: 'v4.3.5', site: 'production', thisOne: false },
        ]);
    });

    it('on keybard.svalboard.com: this release first, then next', () => {
        const rows = versionRows({ tag: 'v4.3.6', label: 'v4.3.6', buildSite: 'production', fetched: { next: { tag: 'x4.4', firmware: 'x4.4' } } });
        expect(rows.map(r => [r.version, r.site, r.thisOne])).toEqual([
            ['v4.3.6', 'production', true],
            ['x4.4', 'next', false],
        ]);
    });

    it('a failed read shows the other site with no version', () => {
        const rows = versionRows({ tag: 'x4.4', label: 'x4.4', buildSite: 'next', fetched: { production: null } });
        expect(rows[1]).toEqual({ version: null, firmware: null, site: 'production', thisOne: false });
    });

    it('a build with no tag shows its commit, then both public sites', () => {
        const rows = versionRows({ tag: '', label: 'build 1a2b3c4', buildSite: 'dev', fetched: { next: { tag: 'x4.4', firmware: null } } });
        expect(rows.map(r => [r.version, r.site, r.thisOne])).toEqual([
            ['build 1a2b3c4', null, true],
            [null, 'production', false],
            ['x4.4', 'next', false],
        ]);
        expect(sitesToRead('', false, 'dev')).toEqual(['production', 'next']);
    });

    it('Paranoid reads nothing and shows only its own version', () => {
        expect(sitesToRead('v4.3.6', true, 'production')).toEqual([]);
        expect(versionRows({ tag: 'v4.3.6', label: 'v4.3.6', paranoid: true, buildSite: 'production', fetched: {} }))
            .toEqual([{ version: 'v4.3.6', firmware: null, site: 'production', thisOne: true }]);
    });

    it('a release built for another site (Keybard Overlay builds x tags for production) is no public site', () => {
        expect(ownSite('x4.4', 'production')).toBeNull();
        expect(ownSite('x4.4', 'next')).toBe('next');
        expect(ownSite('v4.3.6', 'dev')).toBeNull();
        const rows = versionRows({ tag: 'x4.4', label: 'x4.4', buildSite: 'production', fetched: {} });
        expect(rows.map(r => [r.version, r.firmware, r.site, r.thisOne])).toEqual([
            ['x4.4', null, null, true],
            [null, null, 'production', false],
            [null, null, 'next', false],
        ]);
    });

    it('accepts only a tag that site serves', () => {
        expect(parseVersionFile({ tag: 'v4.3.6', firmware: 'v4.3.5' }, 'production')).toEqual({ tag: 'v4.3.6', firmware: 'v4.3.5' });
        expect(parseVersionFile({ tag: 'x4.4' }, 'production')).toBeNull();
        expect(parseVersionFile({ tag: 'v4.3.6', firmware: 'latest' }, 'production')).toEqual({ tag: 'v4.3.6', firmware: null });
        // keybard.svalboard.com carries only v firmware; next carries both.
        expect(parseVersionFile({ tag: 'v4.3.6', firmware: 'x4.4' }, 'production')).toEqual({ tag: 'v4.3.6', firmware: null });
        expect(parseVersionFile({ tag: 'x4.5', firmware: 'v4.5' }, 'next')).toEqual({ tag: 'x4.5', firmware: 'v4.5' });
        expect(parseVersionFile(null, 'next')).toBeNull();
        expect(parseVersionFile('x4.4', 'next')).toBeNull();
    });

    it('reads version.json from the site root and gives null on any failure', async () => {
        const ok = json({ tag: 'x4.4', firmware: 'x4.4' });
        expect(await fetchSiteVersion('next', ok)).toEqual({ tag: 'x4.4', firmware: 'x4.4' });
        expect(ok).toHaveBeenCalledWith('https://next.keybard.svalboard.com/version.json', expect.objectContaining({ cache: 'no-store' }));
        expect(await fetchSiteVersion('production', json({}, false))).toBeNull();
        expect(await fetchSiteVersion('production', vi.fn(async () => { throw new TypeError('Failed to fetch'); }))).toBeNull();
        const badJson = vi.fn(async () => ({ ok: true, json: async () => { throw new SyntaxError('bad'); } }) as unknown as Response);
        expect(await fetchSiteVersion('production', badJson)).toBeNull();
    });

    it('links to this release notes, or the list for an untagged build', () => {
        expect(releaseNotesUrl('x4.4')).toBe('https://github.com/svalboard/keybard/releases/tag/x4.4');
        expect(releaseNotesUrl('')).toBe('https://github.com/svalboard/keybard/releases');
    });
});

describe('reading a site', () => {
    it('reads again after a failed read, but only once after a good one', async () => {
        resetSiteVersions();
        const fetchMock = vi.fn()
            .mockRejectedValueOnce(new TypeError('offline'))
            .mockResolvedValue({ ok: true, json: async () => ({ tag: 'x4.4' }) });
        vi.stubGlobal('fetch', fetchMock);
        try {
            expect(await siteVersion('next')).toBeNull();
            await Promise.resolve();
            expect(await siteVersion('next')).toEqual({ tag: 'x4.4', firmware: null });
            expect(await siteVersion('next')).toEqual({ tag: 'x4.4', firmware: null });
            expect(fetchMock).toHaveBeenCalledTimes(2);
        } finally {
            vi.unstubAllGlobals();
            resetSiteVersions();
        }
    });
});

describe('version.json', () => {
    const pin = (tag: string, kind: 'v' | 'x', fwVersion: number): FirmwareReleasePin => ({
        tag, kind, fwVersion, updaterProtocol: 4, file: { uf2: `${tag}.uf2`, sha256: '0', size: 1 }, notesUrl: '',
    });
    const carried = [pin('v4.3.5', 'v', 18), pin('x4.4', 'x', 19)];

    it('names the Keybard release and the newest firmware that site carries', () => {
        // A Keybard-only v release carries older firmware: the two tags differ.
        expect(versionFile('v4.3.6', 'production', carried)).toEqual({ tag: 'v4.3.6', firmware: 'v4.3.5' });
        expect(versionFile('x4.4', 'next', carried)).toEqual({ tag: 'x4.4', firmware: 'x4.4' });
    });

    it('leaves out firmware the site does not carry, and is absent for untagged builds', () => {
        expect(versionFile('v4.4', 'production', [pin('x4.4', 'x', 19)])).toEqual({ tag: 'v4.4' });
        expect(versionFile('', 'dev', carried)).toBeNull();
    });

    it('is absent for a release built for another site', () => {
        expect(versionFile('x4.4', 'production', carried)).toBeNull();
        expect(versionFile('v4.3.6', 'next', carried)).toBeNull();
    });
});
