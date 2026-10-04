import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SidebarProvider, useSidebar } from '../../src/components/ui/sidebar';

vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => false }));
const originalWidth = window.innerWidth;
function resize(width: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  window.dispatchEvent(new Event('resize'));
}
afterEach(() => {
  cleanup();
  resize(originalWidth);
  document.cookie = 'primary-nav:state=; path=/; max-age=0';
  document.cookie = 'details-panel:state=; path=/; max-age=0';
});

describe('narrow navigation rail', () => {
  it('starts compact even with an expanded desktop preference and restores that preference', () => {
    document.cookie = 'primary-nav:state=true; path=/';
    resize(390);
    const { result } = renderHook(() => useSidebar('primary-nav'), { wrapper: SidebarProvider });
    expect(result.current.state).toBe('collapsed');
    act(() => result.current.toggleSidebar());
    expect(result.current.state).toBe('expanded');
    act(() => result.current.setOpen(false));
    expect(result.current.state).toBe('collapsed');
    expect(document.cookie).toContain('primary-nav:state=true');
    act(() => resize(1280));
    expect(result.current.state).toBe('expanded');
  });

  it('keeps other panels open while resizing to a narrow viewport', () => {
    resize(1280);
    const { result } = renderHook(() => useSidebar('details-panel', { defaultOpen: true }), { wrapper: SidebarProvider });
    expect(result.current.open).toBe(true);
    act(() => resize(390));
    expect(result.current.open).toBe(true);
  });
});
