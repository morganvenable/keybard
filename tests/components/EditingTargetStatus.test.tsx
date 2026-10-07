import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import EditingTargetStatus from '../../src/components/EditingTargetStatus';
const state = vi.hoisted(() => ({keyboard: {name: 'Board'} as {name: string; keycode_version?: string}, isConnected: false, loadedFrom: 'layout.svil', connectionState: 'offline', connectionError: null as string | null, isChangingTarget: false}));
vi.mock('@/contexts/KeyboardContext', () => ({useKeyboard: () => state}));
describe('editing target status', () => {
    beforeEach(() => {state.keyboard = {name: 'Board'}; state.isConnected = false; state.connectionError = null; state.isChangingTarget = false;});
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
    it('warns when the keyboard uses a keycode numbering Keybard does not know', () => {
        state.isConnected = true;
        state.keyboard = {name: 'Board', keycode_version: '0.0.12'};
        render(<EditingTargetStatus />);
        expect(screen.getByRole('alert')).toHaveTextContent('numbers keycodes as QMK 0.0.12');
    });
    it('says nothing about a keycode numbering it knows', () => {
        state.isConnected = true;
        state.keyboard = {name: 'Board', keycode_version: '0.0.9'};
        render(<EditingTargetStatus />);
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
});
