import { describe, it, expect, vi } from 'vitest';
import { act, fireEvent, renderHook } from '@testing-library/react';
import { DragProvider, useDrag, type DragItem } from '../../src/contexts/DragContext';
const item: DragItem = {keycode: 'KC_A', label: 'A', type: 'key', sourceId: 'key-0'};
describe('drag cancellation', () => {
    it.each(['Escape', 'blur'])('%s cancels without invoking an unhandled drop', (action) => {
        const onDrop = vi.fn();
        const wrapper = ({children}: {children: React.ReactNode}) => <DragProvider onUnhandledDrop={onDrop}>{children}</DragProvider>;
        const {result} = renderHook(() => useDrag(), {wrapper});
        act(() => result.current.startDrag(item, new MouseEvent('mousedown', {clientX: 10, clientY: 20})));
        expect(result.current.isDragging).toBe(true);
        if (action === 'Escape') fireEvent.keyDown(window, {key: 'Escape'}); else fireEvent.blur(window);
        fireEvent.mouseUp(window);
        expect(result.current.isDragging).toBe(false);
        expect(result.current.draggedItem).toBeNull();
        expect(onDrop).not.toHaveBeenCalled();
    });
    it('an unhandled drop without a destructive handler just clears drag state', () => {
        const wrapper = ({children}: {children: React.ReactNode}) => <DragProvider>{children}</DragProvider>;
        const {result} = renderHook(() => useDrag(), {wrapper});
        act(() => result.current.startDrag(item, new MouseEvent('mousedown')));
        fireEvent.mouseUp(window);
        expect(result.current.isDragging).toBe(false);
        expect(result.current.draggedItem).toBeNull();
    });
});
