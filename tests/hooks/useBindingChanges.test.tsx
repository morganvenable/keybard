import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ChangesProvider, useChanges } from '@/contexts/ChangesContext';
import type { KeyboardInfo } from '@/types/keyboard.types';
import { useBindingChanges, type BindingKind } from '../../src/hooks/useBindingChanges';

const keyboardContext = vi.hoisted(() => ({ keyboard: { macros: [{ mid: 0, actions: [['tap', 'KC_A']] }], combos: [], tapdances: [], key_overrides: [] } as unknown, setKeyboard: vi.fn(), getKeyboardSnapshot: vi.fn() }));
vi.mock('@/contexts/KeyboardContext', () => ({ useKeyboard: () => keyboardContext }));
const service = vi.hoisted(() => ({
    updateCombo: vi.fn(async () => {}), updateTapdance: vi.fn(async () => {}), updateMacros: vi.fn(async () => {}),
    updateKeyoverride: vi.fn(async () => {}), updateAltRepeatKey: vi.fn(async () => {}), updateLeader: vi.fn(async () => {}), saveSvil: vi.fn(async () => {}),
}));
vi.mock('@/services/keyboard.service', () => ({ keyboardService: service }));
vi.mock('@/contexts/SettingsContext', () => ({ useSettings: () => ({ getSetting: () => false, updateSetting: vi.fn() }) }));
const board = (version: number) => ({ testVersion: version }) as unknown as KeyboardInfo;
const setup = () => renderHook(() => ({ persist: useBindingChanges(), changes: useChanges() }), { wrapper: ({ children }) => <ChangesProvider>{children}</ChangesProvider> });

describe('binding persistence through the actual changes provider', () => {
    beforeEach(() => vi.clearAllMocks());
    it.each([
        ['combo', 'updateCombo'], ['tapdance', 'updateTapdance'], ['macro', 'updateMacros'],
        ['override', 'updateKeyoverride'], ['altrepeat', 'updateAltRepeatKey'], ['leader', 'updateLeader'],
    ] as const)('stages %s edits without USB writes until Apply', async (kind, method) => {
        const { result } = setup();
        const draft = board(1);
        await act(() => result.current.persist(draft, kind, 0));
        expect(service[method]).not.toHaveBeenCalled();
        expect(service.saveSvil).not.toHaveBeenCalled();
        await act(async () => { expect(await result.current.changes.commit()).toBe(true); });
        expect(service[method]).toHaveBeenCalledOnce();
        if (kind === "macro") expect(service[method]).toHaveBeenCalledWith(draft);
        else expect(service[method]).toHaveBeenCalledWith(draft, 0);
        expect(service.saveSvil).toHaveBeenCalledOnce();
    });
    it('A → B → A macro edits write the newest whole macro set once', async () => {
        const { result } = setup();
        const latest = board(3);
        await act(async () => {
            await result.current.persist(board(1), 'macro', 0);
            await result.current.persist(board(2), 'macro', 1);
            await result.current.persist(latest, 'macro', 0);
        });
        expect(result.current.changes.getPendingCount()).toBe(1);
        await act(async () => { await result.current.changes.commit(); });
        expect(service.updateMacros).toHaveBeenCalledExactlyOnceWith(latest);
    });
    it.each(['combo', 'tapdance', 'override'] as BindingKind[])('coalesces repeated %s changes by index', async kind => {
        const { result } = setup();
        await act(async () => {
            await result.current.persist(board(1), kind, 0);
            await result.current.persist(board(2), kind, 1);
            await result.current.persist(board(3), kind, 0);
        });
        expect(result.current.changes.getPendingCount()).toBe(2);
    });
    it('retains a binding if firmware save fails after the write', async () => {
        const { result } = setup();
        service.saveSvil.mockRejectedValueOnce(new Error('EEPROM unavailable'));
        await act(() => result.current.persist(board(1), 'combo', 0));
        await act(async () => { expect(await result.current.changes.commit()).toBe(false); });
        expect(result.current.changes.getPendingCount()).toBe(1);
        expect(result.current.changes.error).toBe('EEPROM unavailable');
        await act(async () => { expect(await result.current.changes.commit()).toBe(true); });
        expect(service.updateCombo).toHaveBeenCalledTimes(2);
    });
    it('Undo restores one macro entry and preserves later unrelated edits', async () => {
        const original = { mid: 0, actions: [['tap', 'KC_A']] };
        keyboardContext.keyboard = { macros: [original, { mid: 1, actions: [['tap', 'KC_B']] }] };
        const { result } = setup();
        const edited = { macros: [{ mid: 0, actions: [] }, { mid: 1, actions: [['tap', 'KC_B']] }] } as unknown as KeyboardInfo;
        await act(() => result.current.persist(edited, 'macro', 0));
        const unrelated = { mid: 1, actions: [['tap', 'KC_C']] };
        keyboardContext.getKeyboardSnapshot.mockReturnValue({ macros: [edited.macros![0], unrelated] });
        await act(() => result.current.changes.undo());
        expect(keyboardContext.setKeyboard).toHaveBeenCalledWith({ macros: [original, unrelated] });
        expect(result.current.changes.undoLabel).toBeNull();
        expect(result.current.changes.getPendingCount()).toBe(1);
        await act(async () => { await result.current.changes.commit(); });
        expect(service.updateMacros).toHaveBeenCalledWith({ macros: [original, unrelated] });
    });

});
