import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { ChangesProvider, useChanges } from '../../src/contexts/ChangesContext';

const settings = vi.hoisted(() => ({ getSetting: () => false, updateSetting: vi.fn() }));
vi.mock('@/contexts/SettingsContext', () => ({ useSettings: () => settings }));

describe('ChangesProvider', () => {
    it('Manual writes only on Apply and exposes failure for Retry', async () => {
        const onPush = vi.fn();
        const { result } = renderHook(useChanges, { wrapper: ({ children }) => <ChangesProvider onPush={onPush}>{children}</ChangesProvider> });
        const write = vi.fn().mockRejectedValueOnce(new Error('Write failed')).mockResolvedValue(undefined);
        await act(() => result.current.queue('Test binding', write));
        expect(write).not.toHaveBeenCalled();
        await act(async () => { expect(await result.current.commit()).toBe(false); });
        expect(result.current.error).toBe('Write failed');
        expect(result.current.getPendingCount()).toBe(1);
        expect(onPush).not.toHaveBeenCalled();
        await act(async () => { expect(await result.current.commit()).toBe(true); });
        expect(result.current.getPendingCount()).toBe(0);
        expect(onPush).toHaveBeenCalledOnce();
    });
    it('does not switch to Live when pending writes fail', async () => {
        const { result } = renderHook(useChanges, { wrapper: ({ children }) => <ChangesProvider>{children}</ChangesProvider> });
        await act(() => result.current.queue('Test', async () => { throw new Error('No device'); }));
        await act(async () => { expect(await result.current.setInstant(true)).toBe(false); });
        expect(result.current.isInstant).toBe(false);
        expect(result.current.getPendingCount()).toBe(1);
    });
    it('never stages hardware callbacks for an offline draft', async () => {
        const { result } = renderHook(useChanges, { wrapper: ({ children }) => <ChangesProvider canWrite={false}>{children}</ChangesProvider> });
        const write = vi.fn(async () => {});
        await act(() => result.current.queue('Offline binding', write));
        await act(async () => { await result.current.commit(); });
        expect(write).not.toHaveBeenCalled();
        expect(result.current.getPendingCount()).toBe(0);
    });
    it('drops previous session callbacks on a target change', async () => {
        const { result, rerender } = renderHook(({ session }: { session: number }) => {
            return session;
        }, { initialProps: { session: 1 } });
        // Provider props are mutable here to model selecting another board.
        let sessionKey = result.current;
        const hook = renderHook(useChanges, { wrapper: ({ children }: { children: ReactNode }) => <ChangesProvider sessionKey={sessionKey}>{children}</ChangesProvider> });
        const write = vi.fn(async () => {});
        await act(() => hook.result.current.queue('Old board', write));
        rerender({ session: 2 }); sessionKey = result.current;
        hook.rerender();
        await act(async () => { await hook.result.current.commit(); });
        expect(write).not.toHaveBeenCalled();
    });
    it('undo executes once and does not recursively register itself', async () => {
        const { result } = renderHook(useChanges, { wrapper: ({ children }) => <ChangesProvider>{children}</ChangesProvider> });
        const restore = vi.fn(async () => {
            result.current.registerUndo('recursive undo', async () => {});
        });
        act(() => result.current.registerUndo('clear combo', restore));
        expect(result.current.undoLabel).toBe('clear combo');
        await act(() => result.current.undo());
        expect(restore).toHaveBeenCalledOnce();
        expect(result.current.undoLabel).toBeNull();
        await act(() => result.current.undo());
        expect(restore).toHaveBeenCalledOnce();
    });

});
