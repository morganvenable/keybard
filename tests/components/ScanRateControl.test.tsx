import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CustomUIControl } from '../../src/components/CustomUI/controls/CustomUIControl';

function setup(period = 1000) {
    const change = vi.fn();
    render(<CustomUIControl item={{ type: 'range', label: 'Key scan rate limit',
        content: ['id_scan_period_us', 0, 20], options: [0, 20000] }}
        values={new Map([['id_scan_period_us', period]])} onValueChange={change} />);
    return change;
}
function custom(value: string) {
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'custom' } });
    const input = screen.getByLabelText('Custom key scan rate');
    fireEvent.change(input, { target: { value } });
    return input;
}
describe('Key scan rate', () => {
    it('displays Hz and writes microseconds through the existing firmware value ID', () => {
        const change = setup();
        expect(screen.getByRole('option', { name: '1000 Hz' })).toHaveProperty('selected', true);
        fireEvent.change(screen.getByRole('combobox'), { target: { value: '500' } });
        expect(change).toHaveBeenCalledWith('id_scan_period_us', 500);
        fireEvent.change(screen.getByRole('combobox'), { target: { value: '0' } });
        expect(change).toHaveBeenLastCalledWith('id_scan_period_us', 0);
    });
    it('preserves non-preset firmware values without writing on render', () => {
        const change = setup(1234);
        expect(screen.getByRole('combobox')).toHaveValue('1234');
        expect(screen.getByRole('option', { name: '810.37 Hz' })).toHaveProperty('selected', true);
        expect(change).not.toHaveBeenCalled();
    });
    it('converts a custom rate on blur', () => {
        const change = setup();
        fireEvent.blur(custom('400'));
        expect(change).toHaveBeenCalledExactlyOnceWith('id_scan_period_us', 2500);
    });
    it('rejects rates outside the firmware interval range', () => {
        const change = setup();
        fireEvent.blur(custom('1'));
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(change).not.toHaveBeenCalled();
    });
    it('cancels custom editing with Escape', () => {
        const change = setup();
        fireEvent.keyDown(custom('400'), { key: 'Escape' });
        expect(screen.getByRole('combobox')).toHaveValue('1000');
        expect(change).not.toHaveBeenCalled();
    });
});
