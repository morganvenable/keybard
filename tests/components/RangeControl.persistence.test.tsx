import { beforeAll, describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { RangeControl } from '../../src/components/CustomUI/controls/RangeControl';
beforeAll(() => { vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} }); });
const item = { label: 'Sensitivity', type: 'range', options: [0, 100] };
describe('range control persistence boundary', () => {
    it('keeps typing local and saves the completed number on blur', () => {
        const onChange = vi.fn();
        render(<RangeControl item={item} value={20} onChange={onChange} />);
        const input = screen.getByRole('spinbutton');
        fireEvent.change(input, {target:{value:'8'}});
        fireEvent.change(input, {target:{value:'80'}});
        expect(onChange).not.toHaveBeenCalled();
        fireEvent.blur(input);
        expect(onChange).toHaveBeenCalledExactlyOnceWith(80);
    });
    it('clamps values and does not send an empty draft', () => {
        const onChange = vi.fn();
        render(<RangeControl item={item} value={20} onChange={onChange} />);
        const input = screen.getByRole('spinbutton');
        fireEvent.change(input,{target:{value:''}}); fireEvent.blur(input);
        expect(onChange).not.toHaveBeenCalled();
        fireEvent.change(input,{target:{value:'999'}}); fireEvent.blur(input);
        expect(onChange).toHaveBeenCalledExactlyOnceWith(100);
    });
    it('Escape cancels the numeric edit without a device mutation', () => {
        const onChange = vi.fn();
        render(<RangeControl item={item} value={20} onChange={onChange} />);
        const input = screen.getByRole('spinbutton'); input.focus();
        fireEvent.change(input,{target:{value:'80'}});fireEvent.keyDown(input,{key:'Escape'});
        expect(onChange).not.toHaveBeenCalled();
        expect(input).toHaveValue(20);
    });
});
