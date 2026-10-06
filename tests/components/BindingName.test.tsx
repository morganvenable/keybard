import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BindingName } from '../../src/layout/SecondarySidebar/components/BindingName';

const { renameBinding } = vi.hoisted(() => ({ renameBinding: vi.fn() }));
vi.mock('@/hooks/useBindingNames', () => ({ useBindingNames: () => ({ renameBinding, nameError: 'Name is too long' }) }));
beforeEach(() => { vi.clearAllMocks(); renameBinding.mockResolvedValue(true); });

describe('Binding names', () => {
    it.each(['macro', 'tapdance'] as const)('renames %s without opening the action editor', async kind => {
        const openEditor = vi.fn();
        const user = userEvent.setup();
        render(<div onClick={openEditor}><BindingName kind={kind} index={2} name="Copy" /><span>Action preview</span></div>);
        await user.click(screen.getByRole('button', { name: /Rename/ }));
        const input = screen.getByRole('textbox');
        await user.clear(input);
        await user.type(input, 'Paste{Enter}');
        await waitFor(() => expect(screen.getByRole('button')).toHaveFocus());
        expect(renameBinding).toHaveBeenCalledExactlyOnceWith(kind, 2, 'Paste');
        expect(openEditor).not.toHaveBeenCalled();
        expect(screen.getByText('Action preview')).toBeVisible();
    });
    it('cancels with Escape, and saves an empty name on blur', async () => {
        const user = userEvent.setup();
        render(<><BindingName kind="macro" index={0} name="Copy" /><button>Outside</button></>);
        await user.click(screen.getByRole('button', { name: /Rename/ }));
        await user.type(screen.getByRole('textbox'), 'discard{Escape}');
        expect(renameBinding).not.toHaveBeenCalled();
        await user.click(screen.getByRole('button', { name: /Rename/ }));
        await user.clear(screen.getByRole('textbox'));
        await user.click(screen.getByRole('button', { name: 'Outside' }));
        expect(renameBinding).toHaveBeenCalledExactlyOnceWith('macro', 0, '');
        await waitFor(() => expect(screen.queryByRole('textbox')).not.toBeInTheDocument());
        expect(screen.getByRole('button', { name: 'Outside' })).toHaveFocus();
    });
    it('keeps invalid input editable and shows the validation error', async () => {
        renameBinding.mockResolvedValue(false);
        const user = userEvent.setup();
        render(<BindingName kind="macro" index={0} />);
        await user.click(screen.getByRole('button', { name: /Rename/ }));
        await user.type(screen.getByRole('textbox'), 'invalid{Enter}');
        expect(screen.getByRole('textbox')).toHaveValue('invalid');
        expect(screen.getByRole('alert')).toHaveTextContent('Name is too long');
    });
    it('shows names in a picker without enabling edits', () => {
        render(<BindingName kind="tapdance" index={1} name="Navigation" readOnly />);
        expect(screen.getByText('Navigation')).toBeVisible();
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
});
