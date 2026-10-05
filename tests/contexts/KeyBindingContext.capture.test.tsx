import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, renderHook } from '@testing-library/react';
import { KeyBindingProvider, useKeyBinding } from '../../src/contexts/KeyBindingContext';
const mocks = vi.hoisted(() => ({setKeyboard: vi.fn(), updateKey: vi.fn(), queue: vi.fn(), enabled: true}));
vi.mock('@/contexts/VialContext', () => ({useVial: () => ({keyboard: {rows: 1, cols: 1, layers: 1, keymap: [[0]]}, ...mocks})}));
vi.mock('@/contexts/ChangesContext', () => ({useChanges: () => ({queue: mocks.queue})}));
vi.mock('@/contexts/SettingsContext', () => ({useSettings: () => ({getSetting: (key: string) => key === 'typing-binds-key' ? mocks.enabled : 'none'})}));
const wrapper = ({children}: {children: React.ReactNode}) => <KeyBindingProvider>{children}</KeyBindingProvider>;
describe('type to assign', () => {
    beforeEach(() => { vi.clearAllMocks(); mocks.enabled = true; });
    it.each([['a', 'KeyA', 4], ['Tab', 'Tab', 43], ['Escape', 'Escape', 41]])('assigns %s immediately after selecting a key', (key, code, expected) => {
        const {result} = renderHook(() => useKeyBinding(), {wrapper});
        act(() => result.current.selectKeyboardKey(0, 0, 0));
        fireEvent.keyDown(window, {key, code});
        expect(mocks.setKeyboard).toHaveBeenCalledOnce();
        expect(mocks.setKeyboard.mock.calls[0][0].keymap[0][0]).toBe(expected);
        expect(mocks.queue).toHaveBeenCalledOnce();
    });
    it('needs no recording action when selecting another key', () => {
        const {result} = renderHook(() => useKeyBinding(), {wrapper});
        act(() => result.current.selectKeyboardKey(0, 0, 0));
        fireEvent.keyDown(window, {key: 'a', code: 'KeyA'});
        act(() => result.current.selectKeyboardKey(0, 0, 0));
        fireEvent.keyDown(window, {key: 'b', code: 'KeyB'});
        expect(mocks.setKeyboard).toHaveBeenCalledTimes(2);
        expect(mocks.setKeyboard.mock.calls[1][0].keymap[0][0]).toBe(5);
    });
    it('respects the existing disabled setting', () => {
        mocks.enabled = false;
        const {result} = renderHook(() => useKeyBinding(), {wrapper});
        act(() => result.current.selectKeyboardKey(0, 0, 0));
        fireEvent.keyDown(window, {key: 'a', code: 'KeyA'});
        expect(mocks.queue).not.toHaveBeenCalled();
    });
    it.each(['input', 'textarea', 'select', 'button'])('does not assign typing in a %s', tag => {
        const {result} = renderHook(() => useKeyBinding(), {wrapper});
        act(() => result.current.selectKeyboardKey(0, 0, 0));
        const control = document.createElement(tag);
        document.body.append(control);
        fireEvent.keyDown(control, {key: 'a', code: 'KeyA'});
        control.remove();
        expect(mocks.queue).not.toHaveBeenCalled();
    });
    it('does not assign keystrokes inside dialogs', () => {
        const {result} = renderHook(() => useKeyBinding(), {wrapper});
        act(() => result.current.selectKeyboardKey(0, 0, 0));
        const dialog = document.createElement('div');
        dialog.setAttribute('role', 'dialog');
        document.body.append(dialog);
        fireEvent.keyDown(dialog, {key: 'Escape', code: 'Escape'});
        dialog.remove();
        expect(mocks.queue).not.toHaveBeenCalled();
    });
});
