import { beforeAll, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CustomUIRenderer } from '../../src/components/CustomUI/CustomUIRenderer';
import type { CustomUIMenuItem } from '../../src/types/vial.types';

beforeAll(() => vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} }));
const items: CustomUIMenuItem[] = [
    { label: 'Sleep between scans', description: 'Requires a scan rate limit.', type: 'toggle', content: ['sleep', 0, 1] },
    { label: 'Settling time · µs', description: 'Wait before reading a row.', type: 'range', options: [0, 100], content: ['time', 0, 2] },
    { label: 'Processor speed', description: 'Speed during deep idle.', type: 'dropdown', options: ['48 MHz', '24 MHz'], content: ['speed', 0, 3] },
];

function setup() {
    const onValueChange = vi.fn();
    render(<CustomUIRenderer items={items} values={new Map([['sleep', 1], ['time', 20], ['speed', 0]])} onValueChange={onValueChange} />);
    return { onValueChange, user: userEvent.setup() };
}

describe('Firmware control access', () => {
    it('names the actual slider thumb, numeric input, dropdown, and toggle group', () => {
        setup();
        const group = screen.getByRole('group', { name: 'Sleep between scans' });
        expect(within(group).getByRole('button', { name: 'ON', pressed: true })).toBeInTheDocument();
        expect(within(group).getByRole('button', { name: 'OFF', pressed: false })).toBeInTheDocument();
        expect(group).toHaveAttribute('aria-description', 'Requires a scan rate limit.');
        expect(screen.getByRole('slider', { name: 'Settling time · µs' })).toHaveAttribute('aria-description', 'Wait before reading a row.');
        expect(screen.getByRole('spinbutton', { name: 'Settling time · µs' })).toHaveValue(20);
        expect(screen.getByRole('combobox', { name: 'Processor speed' })).toHaveAttribute('aria-description', 'Speed during deep idle.');
    });
    it('focus alone does not write; explicit keyboard activation changes only the targeted setting', async () => {
        const { user, onValueChange } = setup();
        await user.tab();
        expect(onValueChange).not.toHaveBeenCalled();
        await user.tab();
        expect(screen.getByRole('button', { name: 'OFF' })).toHaveFocus();
        await user.keyboard('{Enter}');
        expect(onValueChange).toHaveBeenCalledExactlyOnceWith('sleep', 0);
    });
});
