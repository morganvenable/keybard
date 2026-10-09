import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '@/components/ui/tooltip';
import { StatusSlotItem } from '@/features/practice/ui/TypeRow';
import { layoutState } from './harness';

vi.mock('@/contexts/LayoutSettingsContext', async () => { const h = await import('./harness'); return { useLayoutSettings: () => h.layoutState }; });

// The OS layout mismatch notice (spec §5.3, M4): one line with an inline select of Keybard's OS layouts that
// writes internationalLayout.

beforeAll(() => {
    // Radix Select scrolls its options into view; jsdom has no layout.
    Element.prototype.scrollIntoView ??= () => {};
});

afterEach(() => {
    layoutState.internationalLayout = 'us';
    layoutState.setInternationalLayout.mockClear();
});

describe('OS layout mismatch notice (§5.3)', () => {
    it('shows the notice with the layout select, and a choice writes internationalLayout', async () => {
        render(
            <TooltipProvider>
                <StatusSlotItem item={{ id: 'os-mismatch', kind: 'notice', text: "Typed characters don't match US layout", layoutId: 'us' }}
                    resolution={null} cols={6} unit="wpm" layerColorOf={() => 'primary'} />
            </TooltipProvider>,
        );
        const notice = document.querySelector('[data-status="os-mismatch"]')!;
        expect(notice).toHaveTextContent("Typed characters don't match US layout");
        const trigger = screen.getByRole('combobox', { name: 'OS layout' });
        expect(trigger).toHaveTextContent('English (US)');
        trigger.focus();
        await act(async () => { fireEvent.keyDown(trigger, { key: 'ArrowDown' }); });
        await act(async () => { fireEvent.click(await screen.findByRole('option', { name: 'German' })); });
        expect(layoutState.setInternationalLayout).toHaveBeenCalledWith('german');
    });
});
