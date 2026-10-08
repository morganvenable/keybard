import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { KEYMAP } from '../../src/constants/keygen';
import { LayerReorderDialog } from '../../src/components/LayerReorderDialog';

const MO = (layer: number) => KEYMAP[`MO(${layer})`].code;

const mocks = vi.hoisted(() => ({
    keyboard: null as any,
    connected: true,
    instant: true,
    todo: {} as Record<string, unknown>,
    setKeyboard: vi.fn(),
    queue: vi.fn(),
    commit: vi.fn(),
    registerUndo: vi.fn(),
    sync: vi.fn(),
    keyboardService: {
        getLayerStateMasks: vi.fn(),
        setLayerStateMask: vi.fn(),
        getActiveLayerIndexFromMask: (mask: number) => (mask ? 31 - Math.clz32(mask) : 0),
    },
}));
vi.mock('@/contexts/KeyboardContext', () => ({ useKeyboard: () => ({ keyboard: mocks.keyboard, setKeyboard: mocks.setKeyboard, isConnected: mocks.connected }) }));
vi.mock('@/contexts/ChangesContext', () => ({ useChanges: () => ({ queue: mocks.queue, todo: mocks.todo, isInstant: mocks.instant, isSaving: false, commit: mocks.commit, registerUndo: mocks.registerUndo }) }));
vi.mock('@/services/import.service', () => ({ importService: { syncWithKeyboard: mocks.sync } }));
vi.mock('@/services/keyboard.service', () => ({ keyboardService: mocks.keyboardService }));

const board = () => ({
    name: 'Test', layers: 4, rows: 1, cols: 2, svil_proto: 3, feature_flags: 0x40,
    keymap: [[MO(1), MO(2)], [4, 5], [6, 7], [8, 9]],
    cosmetic: { layer: { '0': 'Base', '1': 'Nav', '2': 'Sym', '3': 'Mouse' } },
});

describe('LayerReorderDialog', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.keyboard = board();
        mocks.connected = true;
        mocks.instant = true;
        mocks.todo = {};
        mocks.commit.mockResolvedValue(true);
        mocks.keyboardService.getLayerStateMasks.mockResolvedValue({ active: 0b0011, default: 0b0001 });
    });

    it('summarises the move, writes it, keeps active layers on and registers undo', async () => {
        const onMoved = vi.fn();
        const onClose = vi.fn();
        render(<LayerReorderDialog request={{ from: 1, to: 2 }} onClose={onClose} onMoved={onMoved} />);
        expect(await screen.findByText('Nav: layer 1 → 2')).toBeTruthy();
        expect(screen.getByText('Sym: layer 2 → 1')).toBeTruthy();
        expect(screen.getByText(/Updates 2 layer keys/)).toBeTruthy();
        expect(screen.getByText(/Base \(layer 0\) stays the default/)).toBeTruthy();

        fireEvent.click(screen.getByRole('button', { name: 'Move layer' }));
        await waitFor(() => expect(onClose).toHaveBeenCalled());

        const next = mocks.setKeyboard.mock.calls[0][0];
        expect(next.keymap).toEqual([[MO(2), MO(1)], [6, 7], [4, 5], [8, 9]]);
        expect(next.cosmetic.layer).toEqual({ '0': 'Base', '1': 'Sym', '2': 'Nav', '3': 'Mouse' });
        expect(onMoved).toHaveBeenCalledWith([0, 2, 1, 3]);
        expect(mocks.sync).toHaveBeenCalledTimes(1);
        expect(mocks.commit).toHaveBeenCalled();

        const layerState = mocks.queue.mock.calls.find(([desc]) => desc === 'Keep active layers on');
        expect(layerState[2]).toMatchObject({ writeKey: 'layer-state', deferCommit: true });
        await layerState[1]();
        expect(mocks.keyboardService.setLayerStateMask).toHaveBeenCalledWith(0b0101);

        expect(mocks.registerUndo).toHaveBeenCalledWith('layer move', expect.any(Function));
    });

    it('blocks moving the default layer, and the last layer is not offered', async () => {
        render(<LayerReorderDialog request={{ from: 0, to: 1 }} onClose={vi.fn()} onMoved={vi.fn()} />);
        expect(await screen.findByText(/Base is the default layer and has to keep its number/)).toBeTruthy();
        expect((screen.getByRole('button', { name: 'Move layer' }) as HTMLButtonElement).disabled).toBe(true);
    });

    it('protects layer 0 and DF targets when the board does not report its default layer', async () => {
        mocks.keyboard.feature_flags = 0;
        mocks.keyboard.keymap[1][0] = KEYMAP['DF(2)'].code;
        mocks.keyboardService.getLayerStateMasks.mockResolvedValue({ active: 1, default: null });
        render(<LayerReorderDialog request={{ from: 1, to: 2 }} onClose={vi.fn()} onMoved={vi.fn()} />);
        expect(await screen.findByText(/doesn't report its default layer.*\(0, 2\)/)).toBeTruthy();
        expect(screen.getByText(/Sym is the default layer/)).toBeTruthy();
    });

    it('asks for pending changes to be applied first', async () => {
        mocks.todo = { a: {} };
        render(<LayerReorderDialog request={{ from: 1, to: 2 }} onClose={vi.fn()} onMoved={vi.fn()} />);
        expect(await screen.findByText(/Apply or discard your pending changes/)).toBeTruthy();
    });

    it('changes only the offline layout when no keyboard is connected', async () => {
        mocks.connected = false;
        const onClose = vi.fn();
        render(<LayerReorderDialog request={{ from: 1, to: 2 }} onClose={onClose} onMoved={vi.fn()} />);
        fireEvent.click(await screen.findByRole('button', { name: 'Move layer' }));
        await waitFor(() => expect(onClose).toHaveBeenCalled());
        expect(mocks.setKeyboard).toHaveBeenCalled();
        expect(mocks.sync).not.toHaveBeenCalled();
        expect(mocks.queue).not.toHaveBeenCalled();
    });
});
