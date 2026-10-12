import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import FirmwareStatus from '@/svalbr/FirmwareStatus';
import type { KeyboardInfo } from '@/types/keyboard.types';

const board = (flags = 0x60, version = '0.0.9') => ({ feature_flags: flags, keycode_version: version }) as KeyboardInfo;
afterEach(cleanup);
it('does not warn for compatible live boards or offline keymaps', () => {
    const view = render(<FirmwareStatus keyboard={board()} isConnected />);
    expect(screen.queryByRole('alert')).toBeNull();
    view.rerender(<FirmwareStatus keyboard={board(0)} isConnected={false} />);
    expect(screen.queryByRole('alert')).toBeNull();
});
it.each([0, 0x20, 0x40])('warns when layer reporting is incomplete (%s)', flags => {
    render(<FirmwareStatus keyboard={board(flags)} isConnected />);
    expect(screen.getByRole('alert')).toHaveTextContent('On-screen keys and hints may be incorrect');
    expect(screen.getByRole('link')).toHaveAttribute('href', 'https://github.com/svalboard/qmk/releases/latest');
});
it('asks for an app update for unknown keycodes, not a firmware update', () => {
    render(<FirmwareStatus keyboard={board(0x60, '99.0.0')} isConnected />);
    expect(screen.getByRole('alert')).toHaveTextContent('Update svalbr');
    expect(screen.queryByRole('link')).toBeNull();
});
it('explains old Vial firmware and preserving the layout', () => {
    render(<FirmwareStatus keyboard={null} isConnected={false} failure={{ kind: 'svalboard-vial', reportedVersion: 'v25.02' }} />);
    expect(screen.getByRole('alert')).toHaveTextContent('v25.02');
    expect(screen.getByRole('alert')).toHaveTextContent('Save your layout in Vial first');
    expect(screen.getByRole('link')).toBeInTheDocument();
});
it('explains unsupported protocol versions', () => {
    render(<FirmwareStatus keyboard={null} isConnected={false} failure={{ kind: 'outdated-sval', svilProto: 2 }} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Sval protocol 2');
    expect(screen.getByRole('link')).toBeInTheDocument();
});
it.each(['no-response', 'unknown', 'other-qmk'] as const)('does not diagnose %s as outdated firmware', kind => {
    render(<FirmwareStatus keyboard={null} isConnected={false} failure={{ kind }} error="generic connection error" />);
    expect(screen.getByRole('alert')).not.toHaveTextContent('generic connection error');
    expect(screen.queryByRole('link')).toBeNull();
});
