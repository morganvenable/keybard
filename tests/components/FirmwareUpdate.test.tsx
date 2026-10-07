import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { FirmwareUpdateNote, UnsupportedFirmwareCard } from '../../src/components/FirmwareUpdate';
import { SVALBOARD_FIRMWARE_URL, firmwareUpdateNotice } from '../../src/constants/firmware';

const mode = vi.hoisted(() => ({ paranoid: false }));
vi.mock('@/lib/paranoid', () => ({ get PARANOID() { return mode.paranoid; }, userIsLooking: () => true }));

describe('UnsupportedFirmwareCard', () => {
    beforeEach(() => { mode.paranoid = false; });

    it('tells a Vial Svalboard owner to save the layout and flash Svalboard QMK', () => {
        render(<UnsupportedFirmwareCard info={{ kind: 'svalboard-vial', reportedVersion: 'v2025-11-01' }} />);
        const card = screen.getByRole('alert');
        expect(card).toHaveTextContent('old Vial firmware (v2025-11-01)');
        expect(card).toHaveTextContent('File > Save current layout');
        expect(card).toHaveTextContent('flash both halves');
        const link = screen.getByRole('link');
        expect(link).toHaveAttribute('href', SVALBOARD_FIRMWARE_URL);
        expect(link).toHaveAttribute('target', '_blank');
    });

    it('sends other keyboards elsewhere without the Svalboard download', () => {
        render(<UnsupportedFirmwareCard info={{ kind: 'other-qmk' }} />);
        expect(screen.getByRole('alert')).toHaveTextContent("doesn't run Svalboard firmware");
        expect(screen.queryByRole('link')).not.toBeInTheDocument();
        expect(screen.queryByText(/Save current layout/)).not.toBeInTheDocument();
    });

    it('shows the download address as text in Keybard Paranoid', () => {
        mode.paranoid = true;
        render(<UnsupportedFirmwareCard info={{ kind: 'unknown' }} />);
        expect(screen.queryByRole('link')).not.toBeInTheDocument();
        expect(screen.getByRole('alert')).toHaveTextContent(SVALBOARD_FIRMWARE_URL);
    });
});

describe('firmware update notice', () => {
    beforeEach(() => { localStorage.clear(); });

    it('only asks release candidates on a live connection to update', () => {
        expect(firmwareUpdateNotice({ svil_proto: 3, feature_flags: 0x6f, keycode_version_reported: true })).toBeNull();
        expect(firmwareUpdateNotice({ svil_proto: 3, feature_flags: 0x60, keycode_version_reported: false })).toBe('rc');
        expect(firmwareUpdateNotice({ svil_proto: 3, feature_flags: 0x0f, keycode_version_reported: false })).toBe('rc0');
        expect(firmwareUpdateNotice({ svil_proto: 3, feature_flags: 0x60 })).toBeNull(); // loaded file
        expect(firmwareUpdateNotice({ svil_proto: 4, feature_flags: 0, keycode_version_reported: false })).toBeNull();
    });

    it('stays dismissed once dismissed', () => {
        const { unmount } = render(<FirmwareUpdateNote notice="rc" />);
        expect(screen.getByRole('note')).toHaveTextContent('Newer Svalboard firmware is available');
        fireEvent.click(screen.getByRole('button', { name: 'Dismiss firmware notice' }));
        expect(screen.queryByRole('note')).not.toBeInTheDocument();
        unmount();
        render(<FirmwareUpdateNote notice="rc" />);
        expect(screen.queryByRole('note')).not.toBeInTheDocument();
    });
});
