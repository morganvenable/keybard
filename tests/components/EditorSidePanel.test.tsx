import { beforeAll, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TooltipProvider } from '../../src/components/ui/tooltip';
import EditorSidePanel from '../../src/layout/SecondarySidebar/components/EditorSidePanel';

beforeAll(() => {
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
});

describe('Binding picker navigation', () => {
    it.each([false, true])('offers named explicit actions in horizontal=%s mode', async horizontal => {
        const onTabChange = vi.fn();
        render(<TooltipProvider><EditorSidePanel activeTab="keyboard" horizontal={horizontal} onTabChange={onTabChange} /></TooltipProvider>);
        expect(screen.getByRole('button', { name: 'Standard Keys' })).toHaveAttribute('aria-pressed', 'true');
        const pointing = screen.getByRole('button', { name: 'Pointing Devices' });
        expect(pointing).toHaveAttribute('aria-pressed', 'false');
        act(() => pointing.focus());
        expect(onTabChange).not.toHaveBeenCalled();
        await userEvent.keyboard('{Enter}');
        expect(onTabChange).toHaveBeenCalledExactlyOnceWith('pointing');
    });
    it('removes unavailable picker actions from the focus sequence', () => {
        render(<TooltipProvider><EditorSidePanel showMacros={false} /></TooltipProvider>);
        expect(screen.queryByRole('button', { name: 'Macros' })).not.toBeInTheDocument();
    });
});
