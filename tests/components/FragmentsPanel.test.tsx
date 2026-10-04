import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import FragmentsPanel from '../../src/layout/SecondarySidebar/Panels/FragmentsPanel';

const mocks = vi.hoisted(() => ({
    queue: vi.fn(), setKeyboard: vi.fn(), update: vi.fn(), save: vi.fn(), connected: true,
    keyboard: { rows: 1, cols: 1, fragmentState: {hwDetection: new Map(), eepromSelections: new Map(), userSelections: new Map()} },
}));
vi.mock('@/contexts/VialContext', () => ({useVial: () => ({keyboard: mocks.keyboard, setKeyboard: mocks.setKeyboard, isConnected: mocks.connected, getKeyboardSnapshot: () => mocks.keyboard})}));
vi.mock('@/contexts/ChangesContext', () => ({useChanges: () => ({queue: mocks.queue})}));
vi.mock('@/contexts/LayoutSettingsContext', () => ({useLayoutSettings: () => ({layoutMode: 'sidebar'})}));
vi.mock('@/components/ui/select', () => ({
    Select: ({children, onValueChange}: any) => <div><button onClick={() => onValueChange('new')}>Choose hardware</button>{children}</div>,
    SelectContent: ({children}: any) => <div>{children}</div>, SelectItem: ({children}: any) => <div>{children}</div>,
    SelectTrigger: ({children}: any) => <div>{children}</div>, SelectValue: () => null,
}));
vi.mock('@/services/vial.service', () => ({vialService: {
    getFragmentService: () => ({hasFragments: () => true, getSelectableInstances: () => [{idx: 0, instance: {id: 'left-test'}}],
        getOptionIndex: () => 1, resolveFragment: () => 'old', getFragmentOptions: () => ['old', 'new'],
        getInstanceDisplayName: () => 'Test', getFragmentDisplayName: (_kb: unknown, name: string) => name}),
    getFragmentComposer: () => ({composeLayout: () => ({})}),
    updateFragmentSelection: mocks.update, saveSvil: mocks.save,
}}));

describe('hardware selections', () => {
    beforeEach(() => {vi.clearAllMocks(); mocks.connected = true; mocks.update.mockResolvedValue(true);});
    it('updates the draft but defers connected writes to the shared queue', async () => {
        render(<FragmentsPanel />);
        fireEvent.click(screen.getByRole('button', {name: 'Choose hardware'}));
        await waitFor(() => expect(mocks.queue).toHaveBeenCalled());
        expect(mocks.setKeyboard).toHaveBeenCalled();
        expect(mocks.update).not.toHaveBeenCalled();
        const callback = mocks.queue.mock.calls[0][1];
        await callback();
        expect(mocks.update).toHaveBeenCalledWith(mocks.keyboard, 0, 1);
        expect(mocks.save).toHaveBeenCalled();
        mocks.update.mockResolvedValue(false);
        await expect(callback()).rejects.toThrow('rejected');
    });
    it('keeps offline hardware selections local without USB or queued callbacks', async () => {
        mocks.connected = false;
        render(<FragmentsPanel />);
        fireEvent.click(screen.getByRole('button', {name: 'Choose hardware'}));
        await waitFor(() => expect(mocks.setKeyboard).toHaveBeenCalled());
        expect(mocks.queue).not.toHaveBeenCalled();
        expect(mocks.update).not.toHaveBeenCalled();
    });
});
