import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import EditingTargetStatus from '../../src/components/EditingTargetStatus';
const state = vi.hoisted(() => ({keyboard: {name: 'Board'}, isConnected: false, loadedFrom: 'layout.svil', connectionState: 'offline', connectionError: null as string | null, isChangingTarget: false}));
vi.mock('@/contexts/VialContext', () => ({useVial: () => state}));
describe('editing target status', () => {
    beforeEach(() => {state.isConnected = false; state.connectionError = null; state.isChangingTarget = false;});
    it('identifies offline files and explains export without requiring the toolbar to be open', () => {
        render(<EditingTargetStatus />);
        expect(screen.getByRole('status')).toHaveTextContent('Offline draft: layout.svil');
        expect(screen.getByRole('status')).toHaveTextContent('Export to keep edits');
    });
    it('identifies a connected keyboard without claiming edits are saved', () => {
        state.isConnected = true;
        render(<EditingTargetStatus />);
        expect(screen.getByRole('status')).toHaveTextContent('Editing keyboard');
        expect(screen.queryByText(/No keyboard writes/)).not.toBeInTheDocument();
    });
    it('keeps connection errors and transition status visible', () => {
        state.isChangingTarget = true;
        state.connectionError = 'Connection interrupted';
        render(<EditingTargetStatus />);
        expect(screen.getByRole('status')).toHaveTextContent('Changing connection');
        expect(screen.getByRole('alert')).toHaveTextContent('Connection interrupted');
    });
});
