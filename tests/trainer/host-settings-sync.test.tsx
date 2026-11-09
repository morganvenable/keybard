import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { DEFAULTS } from '@/features/trainer/core';

const host = vi.hoisted(() => ({ state: null as unknown, busy: false, configure: vi.fn() }));
vi.mock('@/features/trainer/host', async (original) => ({
    ...(await original<typeof import('@/features/trainer/host')>()),
    useHost: () => ({ state: host.state, busy: host.busy, error: '', local: false, build: null, configure: host.configure, command: vi.fn(), connect: vi.fn() }),
}));
const settings = vi.hoisted(() => ({ lang: 'de', showShiftedLegends: true as boolean | undefined, showAltGrLegends: false }));
vi.mock('@/contexts/LayoutSettingsContext', () => ({ useOptionalLayoutSettings: () => ({ internationalLayout: settings.lang, showShiftedLegends: settings.showShiftedLegends, showAltGrLegends: settings.showAltGrLegends }) }));
import { HostSettingsSync } from '@/features/trainer/HostSettingsSync';

const connected = (layoutId = 'de', legends: { shiftedLegends?: boolean; altgrLegends?: boolean } = { shiftedLegends: true, altgrLegends: false }) => ({
    config: { ...DEFAULTS, layoutId, ...legends, highlightPressed: true, manualDefault: 1 }, revision: 1, session: 's', valid: true, status: 'Connected',
    devices: [], selectedDevice: null,
});
const update = () => host.configure.mock.calls[0][0] as (c: object) => object;

beforeEach(() => { settings.lang = 'de'; settings.showShiftedLegends = true; settings.showAltGrLegends = false; host.state = null; host.busy = false; vi.clearAllMocks(); });

describe('Host settings sync (no dialog involved)', () => {
    it('sends the language when a connected overlay differs, and nothing when it matches', () => {
        host.state = connected('us');
        const { unmount } = render(<HostSettingsSync />);
        expect(update()({ ...DEFAULTS, layoutId: 'us' })).toMatchObject({ layoutId: 'de' });
        unmount(); vi.clearAllMocks();
        host.state = connected('de');
        render(<HostSettingsSync />);
        expect(host.configure).not.toHaveBeenCalled();
    });

    it('sends the language, Shifted and AltGr settings in one write', () => {
        settings.showAltGrLegends = true; settings.showShiftedLegends = false;
        host.state = connected('us', { shiftedLegends: true, altgrLegends: false });
        render(<HostSettingsSync />);
        expect(host.configure).toHaveBeenCalledTimes(1);
        expect(update()({ ...DEFAULTS })).toMatchObject({ layoutId: 'de', altgrLegends: true, shiftedLegends: false });
    });

    it('sends again when a setting changes while connected', () => {
        host.state = connected('de');
        const { rerender } = render(<HostSettingsSync />);
        expect(host.configure).not.toHaveBeenCalled();
        settings.showAltGrLegends = true;
        rerender(<HostSettingsSync />);
        expect(update()({ ...DEFAULTS })).toMatchObject({ altgrLegends: true });
    });

    it('leaves an older overlay app alone: only fields it already has are sent', () => {
        settings.showAltGrLegends = true;
        host.state = { ...(connected('de') as object), config: { ...DEFAULTS, layoutId: 'de', highlightPressed: true, manualDefault: 1 } };
        render(<HostSettingsSync />);
        expect(host.configure).not.toHaveBeenCalled();
    });

    it('does nothing before the overlay connects, and waits while a write is in flight', () => {
        render(<HostSettingsSync />);
        expect(host.configure).not.toHaveBeenCalled();
        host.state = connected('us'); host.busy = true;
        const { rerender } = render(<HostSettingsSync />);
        expect(host.configure).not.toHaveBeenCalled();
        host.busy = false;
        rerender(<HostSettingsSync />);
        expect(host.configure).toHaveBeenCalledTimes(1);
    });

    it('tries a failed write once per connection, never in a loop', async () => {
        host.configure.mockResolvedValue(false);
        host.state = connected('us');
        const { rerender } = render(<HostSettingsSync />);
        await Promise.resolve(); await Promise.resolve();
        rerender(<HostSettingsSync />);
        expect(host.configure).toHaveBeenCalledTimes(1);
    });

    it('does not fight another Keybard tab with other settings: each sends its values once', async () => {
        host.configure.mockResolvedValue(true);
        host.state = connected('us');
        const { rerender } = render(<HostSettingsSync />);
        await Promise.resolve(); await Promise.resolve();
        expect(host.configure).toHaveBeenCalledTimes(1);
        // The other tab writes 'us' back, again and again: a new revision each time.
        for (const revision of [2, 3, 4]) {
            host.state = { ...(connected('us') as object), revision };
            rerender(<HostSettingsSync />);
            await Promise.resolve(); await Promise.resolve();
        }
        expect(host.configure).toHaveBeenCalledTimes(1);
        // A change in this tab's settings is sent.
        settings.lang = 'fr';
        rerender(<HostSettingsSync />);
        expect(host.configure).toHaveBeenCalledTimes(2);
    });
});
