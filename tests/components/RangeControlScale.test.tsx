// The slider number box: wide enough for the field's longest value (at least
// 5 digits), and settings stored in seconds shown and typed in ms.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RangeControl, rangeInputWidth } from '@/components/CustomUI/controls/RangeControl';

// Radix's slider measures itself; jsdom has no ResizeObserver.
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;

afterEach(cleanup);

describe('RangeControl number box', () => {
    it('fits 5 digits at least, and the longest value of wider fields', () => {
        expect(rangeInputWidth(0, 500)).toBe('calc(5ch + 3.25rem)');
        expect(rangeInputWidth(0, 60000)).toBe('calc(5ch + 3.25rem)');
        expect(rangeInputWidth(0, 7200000)).toBe('calc(7ch + 3.25rem)');
    });

    it.each([false, true])('compact=%s: the box is sized from the field, not a fixed w-14 / w-20', (compact) => {
        render(<RangeControl item={{ label: 'Enter idle after · ms', type: 'range', options: [0, 60000], content: ['id_scan_idle_after_ms', 0, 22] }} value={2000} onChange={vi.fn()} compact={compact} />);
        const box = screen.getByRole('spinbutton', { name: 'Enter idle after · ms' });
        expect(box).toHaveValue(2000);
        expect(box.style.width).toBe('calc(5ch + 3.25rem)');
        expect(box.className).not.toMatch(/\bw-(14|20)\b/);
    });
});

describe('RangeControl with a display scale (stored seconds, shown ms)', () => {
    const deep = { label: 'Enter deep idle after · ms', type: 'range' as const, options: [0, 7200], content: ['id_scan_deep_after_s', 0, 23], displayScale: 1000 };

    it('shows ms and writes whole seconds', () => {
        const onChange = vi.fn();
        render(<RangeControl item={deep} value={600} onChange={onChange} />);
        const box = screen.getByRole('spinbutton', { name: deep.label });
        expect(box).toHaveValue(600000);
        expect(box).toHaveAttribute('max', '7200000');
        expect(box).toHaveAttribute('step', '1000');
        fireEvent.change(box, { target: { value: '30000' } });
        fireEvent.blur(box);
        expect(onChange).toHaveBeenLastCalledWith(30);
        expect(screen.queryByText(/Rounded to whole seconds/)).toBeNull();
    });

    it('rounds a value that is not a whole second and says so', () => {
        const onChange = vi.fn();
        render(<RangeControl item={deep} value={600} onChange={onChange} />);
        const box = screen.getByRole('spinbutton', { name: deep.label });
        fireEvent.change(box, { target: { value: '2500' } });
        fireEvent.blur(box);
        expect(onChange).toHaveBeenLastCalledWith(3);
        expect(box).toHaveValue(3000);
        expect(screen.getByText('Rounded to whole seconds: 3000 ms')).toBeInTheDocument();
    });

    it('clamps to the stored range', () => {
        const onChange = vi.fn();
        render(<RangeControl item={deep} value={600} onChange={onChange} />);
        const box = screen.getByRole('spinbutton', { name: deep.label });
        fireEvent.change(box, { target: { value: '99999999' } });
        fireEvent.blur(box);
        expect(onChange).toHaveBeenLastCalledWith(7200);
    });
});
