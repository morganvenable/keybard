import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { KEYMAP } from '../../src/constants/keygen';
import { LayerReorderDialog } from '../../src/components/LayerReorderDialog';
import { useLayerReorder, type LayerMoveConstraints, type LayerReorder } from '../../src/hooks/useLayerReorder';

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
        setDefaultLayer: vi.fn(),
        canSetDefaultLayer: (kb: any) => ((kb.feature_flags2 ?? 0) & 1) !== 0,
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

/** Stands in for the tab row: a drop asks for the board's constraints, then prepares the move. */
let hook: LayerReorder;
function Harness({ onMoved = vi.fn() }: { onMoved?: (newOf: number[]) => void }) {
    hook = useLayerReorder(onMoved);
    return <LayerReorderDialog reorder={hook} />;
}
async function drop(from: number, to: number, constraints?: LayerMoveConstraints) {
    const loaded = constraints ?? await hook.loadConstraints(mocks.keyboard);
    act(() => hook.prepare(from, to, loaded));
}

describe('layer reorder confirmation', () => {
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
        render(<Harness onMoved={onMoved} />);
        await drop(1, 2);
        expect(await screen.findByText('Move Nav to layer 2')).toBeTruthy();
        expect(screen.getByText('Nav: layer 1 → 2')).toBeTruthy();
        expect(screen.getByText('Sym: layer 2 → 1')).toBeTruthy();
        expect(screen.getByText(/Updates 2 layer keys/)).toBeTruthy();
        expect(screen.getByText(/Base \(layer 0\) stays the default/)).toBeTruthy();
        expect(screen.queryByRole('combobox')).toBeNull();

        fireEvent.click(screen.getByRole('button', { name: 'Move layer' }));
        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

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

    it('keeps the default layer fixed on firmware that cannot set it', async () => {
        render(<Harness />);
        expect(await hook.loadConstraints(mocks.keyboard)).toEqual({ fixed: [0], defaultLayer: 0, movable: false });
    });

    it('moves the default layer when the board can set it, and undo moves it back', async () => {
        mocks.keyboard.feature_flags2 = 1;
        render(<Harness />);
        expect(await hook.loadConstraints(mocks.keyboard)).toEqual({ fixed: [], defaultLayer: 0, movable: true });
        await drop(0, 2);
        expect(await screen.findByText(/Base becomes layer 2 and stays the default/)).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: 'Move layer' }));
        await waitFor(() => expect(mocks.registerUndo).toHaveBeenCalled());
        const write = mocks.queue.mock.calls.find(([, , metadata]) => metadata?.writeKey === 'default-layer');
        await write[1]();
        expect(mocks.keyboardService.setDefaultLayer).toHaveBeenCalledWith(2);

        mocks.queue.mockClear();
        mocks.keyboard = mocks.setKeyboard.mock.calls[0][0];
        await mocks.registerUndo.mock.calls[0][1]();
        const undoWrite = mocks.queue.mock.calls.find(([, , metadata]) => metadata?.writeKey === 'default-layer');
        await undoWrite[1]();
        expect(mocks.keyboardService.setDefaultLayer).toHaveBeenLastCalledWith(0);
    });

    it('treats layer 0 and DF targets as the default when the board does not report it', async () => {
        mocks.keyboard.feature_flags = 0;
        mocks.keyboard.keymap[1][0] = KEYMAP['DF(2)'].code;
        mocks.keyboardService.getLayerStateMasks.mockResolvedValue({ active: 1, default: null });
        render(<Harness />);
        const constraints = await hook.loadConstraints(mocks.keyboard);
        expect(constraints).toEqual({ fixed: [0, 2], defaultLayer: null, movable: false });
        expect(hook.guessConstraints(mocks.keyboard)).toEqual(constraints);
    });

    it('asks for pending changes to be applied first', async () => {
        mocks.todo = { a: {} };
        render(<Harness />);
        await drop(1, 2);
        expect(await screen.findByText(/Apply or discard your pending changes/)).toBeTruthy();
        expect(screen.queryByRole('button', { name: 'Move layer' })).toBeNull();
    });

    it('changes only the offline layout when no keyboard is connected', async () => {
        mocks.connected = false;
        render(<Harness />);
        await drop(1, 2);
        fireEvent.click(await screen.findByRole('button', { name: 'Move layer' }));
        await waitFor(() => expect(mocks.setKeyboard).toHaveBeenCalled());
        expect(mocks.sync).not.toHaveBeenCalled();
        expect(mocks.queue).not.toHaveBeenCalled();
    });
});
