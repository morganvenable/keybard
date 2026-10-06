import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { HostInstall, HOST_DOWNLOAD, HOST_RELEASE } from '@/features/trainer/HostInstall';
it('offers a versioned download, setup steps and a path for an already-running app', () => {
    render(<HostInstall />);
    expect(screen.getByRole('link', { name: 'Download for Windows' })).toHaveAttribute('href', HOST_DOWNLOAD);
    expect(HOST_DOWNLOAD).toContain('/releases/download/keybard-host-v');
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
