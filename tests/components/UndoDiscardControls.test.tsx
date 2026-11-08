import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DiscardAllControl, UndoControl } from '../../src/components/UndoDiscardControls';
import { TooltipProvider } from '../../src/components/ui/tooltip';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const wrap = (ui: React.ReactElement) => render(<TooltipProvider>{ui}</TooltipProvider>);

describe('Undo', () => {
    it('is disabled with nothing to undo', () => {
        wrap(<UndoControl label={null} onUndo={vi.fn()} />);
        expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
    });
    it('undoes one step and shows an Undone toast', async () => {
        const onUndo = vi.fn();
        wrap(<UndoControl label="layer move" onUndo={onUndo} />);
        fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
        expect(onUndo).toHaveBeenCalledTimes(1);
        await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Undone'));
    });
});

describe('Discard all', () => {
    it('never uses window.confirm', () => {
        const confirm = vi.spyOn(window, 'confirm');
        wrap(<DiscardAllControl pendingCount={3} onDiscardAll={vi.fn()} />);
        fireEvent.click(screen.getByRole('button', { name: 'Discard all' }));
        expect(confirm).not.toHaveBeenCalled();
    });
    it('discards one pending change without asking', () => {
        const onDiscardAll = vi.fn();
        wrap(<DiscardAllControl pendingCount={1} onDiscardAll={onDiscardAll} />);
        fireEvent.click(screen.getByRole('button', { name: 'Discard all' }));
        expect(onDiscardAll).toHaveBeenCalledTimes(1);
        expect(screen.queryByRole('dialog')).toBeNull();
    });
    it('asks first for several changes, and Cancel keeps them', () => {
        const onDiscardAll = vi.fn();
        wrap(<DiscardAllControl pendingCount={3} onDiscardAll={onDiscardAll} />);
        fireEvent.click(screen.getByRole('button', { name: 'Discard all' }));
        expect(onDiscardAll).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
        expect(onDiscardAll).not.toHaveBeenCalled();
    });
    it('discards after confirming', () => {
        const onDiscardAll = vi.fn();
        wrap(<DiscardAllControl pendingCount={2} onDiscardAll={onDiscardAll} />);
        fireEvent.click(screen.getByRole('button', { name: 'Discard all' }));
        const dialog = screen.getByRole('dialog');
        fireEvent.click(Array.from(dialog.querySelectorAll('button')).find(b => b.textContent === 'Discard all')!);
        expect(onDiscardAll).toHaveBeenCalledTimes(1);
    });
    it('is disabled with nothing pending', () => {
        wrap(<DiscardAllControl pendingCount={0} onDiscardAll={vi.fn()} />);
        expect(screen.getByRole('button', { name: 'Discard all' })).toBeDisabled();
    });
});
