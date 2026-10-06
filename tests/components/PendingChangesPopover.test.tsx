import { act, render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ChangesProvider, useChanges } from '../../src/contexts/ChangesContext';
import PendingChangesPopover from '../../src/components/PendingChangesPopover';

vi.mock('@/contexts/SettingsContext', () => ({
    useSettings: () => ({ getSetting: () => false, updateSetting: vi.fn() }),
}));

function setup() {
    let changes!: ReturnType<typeof useChanges>;
    function Toolbar() {
        changes = useChanges();
        return <div data-testid="toolbar" style={{ overflowX: 'auto' }}><PendingChangesPopover /></div>;
    }
    render(<ChangesProvider><Toolbar /></ChangesProvider>);
    return { changes: () => changes, user: userEvent.setup() };
}

describe('PendingChangesPopover with the real change queue', () => {
    it('lists the actual distinct edits and replaces superseded edits without a stale description or count', async () => {
        const { changes, user } = setup();
        const write = vi.fn().mockResolvedValue(undefined);
        await act(() => changes().queue('Layer 0 · Q → A', write, { writeKey: 'key:0:0:1' }));
        await act(() => changes().queue('Tapping Term: 200 → 210 ms', write, { writeKey: 'qmk:7' }));
        await user.click(screen.getByRole('button', { name: 'Pending (2)' }));
        const review = screen.getByRole('dialog', { name: 'Pending changes' });
        expect(within(review).getAllByRole('listitem').map(item => item.textContent)).toEqual([
            'Layer 0 · Q → A', 'Tapping Term: 200 → 210 ms',
        ]);
        expect(screen.getByTestId('toolbar').contains(review)).toBe(false);
        expect(write).not.toHaveBeenCalled();

        await act(() => changes().queue('Layer 0 · Q → B', write, { writeKey: 'key:0:0:1' }));
        expect(screen.getByRole('button', { name: 'Pending (2)' })).toBeTruthy();
        expect(within(review).queryByText('Layer 0 · Q → A')).toBeNull();
        expect(within(review).getByText('Layer 0 · Q → B')).toBeTruthy();
        expect(within(review).getByText('Tapping Term: 200 → 210 ms')).toBeTruthy();

        await user.keyboard('{Escape}');
        expect(screen.queryByRole('dialog')).toBeNull();
        expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Pending (2)' }));
        await user.click(screen.getByRole('button', { name: 'Pending (2)' }));
        await act(() => changes().clearAll());
        expect(screen.queryByRole('dialog')).toBeNull();
        expect(screen.queryByRole('button', { name: /Pending/ })).toBeNull();
    });

    it('keeps only failed and unattempted changes visible after a partial apply', async () => {
        const { changes, user } = setup();
        await act(() => changes().queue('Saved key edit', async () => {}, { writeKey: 'key:1' }));
        await act(() => changes().queue('Failed timing edit', async () => { throw Error('Disconnected'); }, { writeKey: 'qmk:7' }));
        await act(() => changes().queue('Waiting macro edit', async () => {}, { writeKey: 'macro:0' }));
        await user.click(screen.getByRole('button', { name: 'Pending (3)' }));
        await act(() => changes().commit());
        await waitFor(() => expect(screen.getByRole('button', { name: 'Pending (2)' })).toBeTruthy());
        const review = screen.getByRole('dialog', { name: 'Pending changes' });
        expect(within(review).getAllByRole('listitem').map(item => item.textContent)).toEqual([
            'Failed timing edit', 'Waiting macro edit',
        ]);
        expect(within(review).queryByText('Saved key edit')).toBeNull();
    });
});
