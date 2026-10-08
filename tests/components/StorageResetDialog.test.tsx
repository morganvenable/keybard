import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { StorageResetDialog } from '../../src/components/StorageResetDialog';

const keyboardContext = vi.hoisted(() => ({ isConnected: true, keyboard: { kbid: 'abc', storage_reset: true } as Record<string, unknown> }));
vi.mock('@/contexts/KeyboardContext', () => ({ useKeyboard: () => keyboardContext }));
const svc = vi.hoisted(() => ({ clearStorageReset: vi.fn() }));
vi.mock('@/services/keyboard.service', () => ({ keyboardService: svc }));

describe('StorageResetDialog', () => {
    beforeEach(() => {
        svc.clearStorageReset.mockReset().mockResolvedValue(undefined);
        keyboardContext.isConnected = true;
        keyboardContext.keyboard = { kbid: 'abc', storage_reset: true };
    });

    it('tells the user to reload their layout file, and clears the board notice on OK', async () => {
        render(<StorageResetDialog />);
        expect(screen.getByText("Your keyboard's settings were reset")).toBeTruthy();
        expect(screen.getByText(/Load your layout file/)).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: 'OK' }));
        await waitFor(() => expect(svc.clearStorageReset).toHaveBeenCalledTimes(1));
        await waitFor(() => expect(screen.queryByText("Your keyboard's settings were reset")).toBeNull());
    });

    it('stays hidden when the board reports no reset or is disconnected', () => {
        keyboardContext.keyboard = { kbid: 'abc', storage_reset: false };
        const { rerender } = render(<StorageResetDialog />);
        expect(screen.queryByText("Your keyboard's settings were reset")).toBeNull();
        keyboardContext.keyboard = { kbid: 'abc', storage_reset: true };
        keyboardContext.isConnected = false;
        rerender(<StorageResetDialog />);
        expect(screen.queryByText("Your keyboard's settings were reset")).toBeNull();
        expect(svc.clearStorageReset).not.toHaveBeenCalled();
    });

    it('warns that changes are not being saved, and dismisses without telling the board', async () => {
        keyboardContext.keyboard = { kbid: 'abc', storage_write_failed: true };
        render(<StorageResetDialog />);
        expect(screen.getByText("Your keyboard can't save changes")).toBeTruthy();
        expect(screen.getByText(/lost when it restarts/)).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: 'OK' }));
        await waitFor(() => expect(screen.queryByText("Your keyboard can't save changes")).toBeNull());
        expect(svc.clearStorageReset).not.toHaveBeenCalled();
    });

    it('shows the save warning first, then the reset notice', async () => {
        keyboardContext.keyboard = { kbid: 'abc', storage_reset: true, storage_write_failed: true };
        render(<StorageResetDialog />);
        expect(screen.getByText("Your keyboard can't save changes")).toBeTruthy();
        expect(screen.queryByText("Your keyboard's settings were reset")).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: 'OK' }));
        await waitFor(() => expect(screen.getByText("Your keyboard's settings were reset")).toBeTruthy());
        fireEvent.click(screen.getByRole('button', { name: 'OK' }));
        await waitFor(() => expect(svc.clearStorageReset).toHaveBeenCalledTimes(1));
    });
});
