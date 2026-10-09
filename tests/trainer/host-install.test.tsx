import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { DesktopOverlayWell, HostOutdatedNotice, HostStatusPill, HostVersion, ParanoidWell, HOST_DOWNLOAD, HOST_RELEASE, HOST_RELEASE_TAG, OVERLAY_MANUAL } from '@/features/trainer/HostInstall';

// Rewritten for the Overlay restyle (docs/practice/spec.md §5.14, §5.16, §9.9): the Desktop overlay
// well replaces the install paragraphs, and the status pill and facts line replace "Connected to …".
// The behaviors are today's: a versioned download, a path for an already-running Host, release notes,
// Connect only where the page isn't served by Host, and older Hosts pointed at the current release.

it('offers a versioned download, the install steps, and a path for an already-running app', () => {
    render(<DesktopOverlayWell />);
    expect(screen.getByRole('heading', { name: 'Desktop overlay' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Download for Windows' })).toHaveAttribute('href', HOST_DOWNLOAD);
    expect(HOST_DOWNLOAD).toBe(`https://github.com/svalboard/keybard/releases/download/${HOST_RELEASE_TAG}/KeybardHost-Windows.zip`);
    expect(screen.getByRole('link', { name: /Open local Keybard/ })).toHaveAttribute('href', 'http://127.0.0.1:5178/');
    expect(screen.getByRole('link', { name: /Release notes/ })).toHaveAttribute('href', HOST_RELEASE);
    expect(screen.getByRole('link', { name: /Install steps/ })).toHaveAttribute('href', OVERLAY_MANUAL);
    expect(OVERLAY_MANUAL).toMatch(/manual\/#overlay$/);
    // No paragraphs: the steps live in the manual.
    expect(document.querySelector('p')).toBeNull();
});

it('offers to connect a hosted page to a running Keybard Host only when asked to', () => {
    const { unmount } = render(<DesktopOverlayWell />);
    expect(screen.queryByRole('button', { name: /Connect to Keybard Host/ })).toBeNull();
    unmount();
    const onConnect = vi.fn();
    render(<DesktopOverlayWell onConnect={onConnect} />);
    fireEvent.click(screen.getByRole('button', { name: /Connect to Keybard Host/ }));
    expect(onConnect).toHaveBeenCalledOnce();
});

it('names only the command to run in Keybard Paranoid, with no actions', () => {
    render(<ParanoidWell />);
    expect(screen.getByRole('heading', { name: 'Start Keybard Host in paranoid mode' })).toBeInTheDocument();
    expect(screen.getByText('Start-Paranoid.cmd')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
});

it('says which Keybard Host is connected and points older ones at the current release', () => {
    const { rerender } = render(<><HostVersion build={{ version: HOST_RELEASE_TAG, keybardCommit: '5954334' }} /><HostOutdatedNotice build={{ version: HOST_RELEASE_TAG, keybardCommit: '5954334' }} /></>);
    expect(screen.getByText(`Keybard Host ${HOST_RELEASE_TAG} · Keybard 5954334`)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Download' })).toBeNull();
    rerender(<><HostVersion build={{ version: 'unknown', keybardCommit: null }} /><HostOutdatedNotice build={{ version: 'unknown', keybardCommit: null }} /></>);
    expect(screen.getByText('Keybard Host (older)')).toBeInTheDocument();
    expect(screen.getByText(`Keybard Host ${HOST_RELEASE_TAG} is available`)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Download' })).toHaveAttribute('href', HOST_RELEASE);
    rerender(<><HostVersion build={{ version: 'dev', keybardCommit: 'abc1234' }} /><HostOutdatedNotice build={{ version: 'dev', keybardCommit: 'abc1234' }} /></>);
    expect(screen.getByText('Keybard Host dev · Keybard abc1234')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Download' })).toBeNull();
});

it.each([
    ['connected', `Keybard Host ${HOST_RELEASE_TAG}`],
    ['off', 'Keybard Host not connected'],
    ['lost', 'Keybard Host connection lost'],
] as const)('shows the %s status pill as a non-interactive status', (status, text) => {
    render(<HostStatusPill status={status} build={{ version: HOST_RELEASE_TAG, keybardCommit: null }} />);
    const pill = screen.getByRole('status');
    expect(pill).toHaveTextContent(text);
    expect(pill.tagName).not.toBe('BUTTON');
});
