import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, renderHook } from '@testing-library/react';
import { KeyBindingProvider, useKeyBinding } from '../../src/contexts/KeyBindingContext';
const mocks = vi.hoisted(() => ({setKeyboard: vi.fn(), updateKey: vi.fn(), queue: vi.fn()}));
vi.mock('@/contexts/VialContext', () => ({useVial: () => ({keyboard: {rows: 1, cols: 1, layers: 1, keymap: [['KC_NO']]}, ...mocks})}));
vi.mock('@/contexts/ChangesContext', () => ({useChanges: () => ({queue: mocks.queue})}));
vi.mock('@/contexts/SettingsContext', () => ({useSettings: () => ({getSetting: (key: string) => key === 'typing-binds-key'})}));
const wrapper = ({children}: {children: React.ReactNode}) => <KeyBindingProvider>{children}</KeyBindingProvider>;
describe('explicit typing capture', () => {
    beforeEach(() => vi.clearAllMocks());
    it('selection alone never binds navigation or typed keys', () => {
        const {result} = renderHook(() => useKeyBinding(), {wrapper});
        act(() => result.current.selectKeyboardKey(0, 0, 0));
        fireEvent.keyDown(window, {key: 'Enter', code: 'Enter'});
        fireEvent.keyDown(window, {key: 'a', code: 'KeyA'});
        expect(mocks.setKeyboard).not.toHaveBeenCalled();
        expect(mocks.queue).not.toHaveBeenCalled();
    });
    it('explicit arming captures one key then disarms', () => {
        const {result} = renderHook(() => useKeyBinding(), {wrapper});
        act(() => result.current.selectKeyboardKey(0, 0, 0));
        act(() => result.current.setCapturing(true));
        fireEvent.keyDown(window, {key: 'a', code: 'KeyA'});
        expect(mocks.setKeyboard).toHaveBeenCalledOnce();
        expect(result.current.isCapturing).toBe(false);
        fireEvent.keyDown(window, {key: 'b', code: 'KeyB'});
        expect(mocks.setKeyboard).toHaveBeenCalledOnce();
    });
    it.each(['Escape', 'Tab'])('%s disarms without changing the layout', (key) => {
        const {result} = renderHook(() => useKeyBinding(), {wrapper});
        act(() => result.current.selectKeyboardKey(0, 0, 0));
        act(() => result.current.setCapturing(true));
        fireEvent.keyDown(window, {key, code: key});
        expect(result.current.isCapturing).toBe(false);
        expect(mocks.setKeyboard).not.toHaveBeenCalled();
    });
});
