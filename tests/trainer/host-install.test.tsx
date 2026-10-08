import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { HostInstall, HostVersion, HOST_DOWNLOAD, HOST_RELEASE, HOST_RELEASE_TAG } from '@/features/trainer/HostInstall';
it('offers a versioned download, setup steps and a path for an already-running app', () => {
    render(<HostInstall />);
    expect(screen.getByRole('link', { name: 'Download for Windows' })).toHaveAttribute('href', HOST_DOWNLOAD);
    expect(HOST_DOWNLOAD).toBe(`https://github.com/svalboard/keybard/releases/download/${HOST_RELEASE_TAG}/KeybardHost-Windows.zip`);
    expect(screen.getByText('Start-Windows.cmd')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Already running/ })).toHaveAttribute('href', 'http://127.0.0.1:5178/');
    expect(screen.getByRole('link', { name: 'Release notes' })).toHaveAttribute('href', HOST_RELEASE);
});

it('offers to connect a hosted page to a running Keybard Host only when asked to', () => {
    const { unmount } = render(<HostInstall />);
    expect(screen.queryByRole('button', { name: /Connect to Keybard Host/ })).toBeNull();
    unmount();
    const onConnect = vi.fn();
    render(<HostInstall onConnect={onConnect} />);
    fireEvent.click(screen.getByRole('button', { name: /Connect to Keybard Host/ }));
    expect(onConnect).toHaveBeenCalledOnce();
});

it('says which Keybard Host is connected and points older ones at the current release', () => {
    const { rerender } = render(<HostVersion build={{ version: HOST_RELEASE_TAG, keybardCommit: '5954334' }} />);
    expect(screen.getByText(new RegExp(`Connected to Keybard Host ${HOST_RELEASE_TAG} · Keybard 5954334`))).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'download it' })).toBeNull();
    rerender(<HostVersion build={{ version: 'unknown', keybardCommit: null }} />);
    expect(screen.getByText(/Connected to an older Keybard Host\./)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'download it' })).toHaveAttribute('href', HOST_RELEASE);
    rerender(<HostVersion build={{ version: 'dev', keybardCommit: 'abc1234' }} />);
    expect(screen.getByText(/Keybard Host dev · Keybard abc1234/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'download it' })).toBeNull();
});
