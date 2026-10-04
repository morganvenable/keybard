import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { LayoutSettingsProvider, useLayoutSettings } from '../../src/contexts/LayoutSettingsContext';

const originalWidth = window.innerWidth;
function resize(width: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  window.dispatchEvent(new Event('resize'));
}
afterEach(() => act(() => resize(originalWidth)));

describe('responsive editor placement', () => {
  it('keeps sidebar tools at laptop widths when a panel opens', () => {
    resize(1024);
    const { result } = renderHook(useLayoutSettings, { wrapper: LayoutSettingsProvider });
    expect(result.current.layoutMode).toBe('sidebar');
    act(() => result.current.setMeasuredDimensions({ containerWidth: 400, containerHeight: 600,
      keyboardWidths: { default: 1400, medium: 1000, small: 700 },
      keyboardHeights: { default: 700, medium: 500, small: 300 } }));
    expect(result.current.layoutMode).toBe('sidebar');
    expect(result.current.keyVariant).toBe('medium');
  });

  it('uses bottom placement in narrow auto mode but preserves explicit choices', () => {
    resize(640);
    const { result } = renderHook(useLayoutSettings, { wrapper: LayoutSettingsProvider });
    expect(result.current.layoutMode).toBe('bottombar');
    act(() => result.current.setLayoutMode('sidebar'));
    act(() => resize(390));
    expect(result.current.layoutMode).toBe('sidebar');
    act(() => result.current.setLayoutMode('bottombar'));
    act(() => resize(1280));
    expect(result.current.layoutMode).toBe('bottombar');
    act(() => result.current.setIsAutoLayoutMode(true));
    expect(result.current.layoutMode).toBe('sidebar');
  });

  it('retains manually selected small keys on a constrained viewport', () => {
    resize(640);
    const { result } = renderHook(useLayoutSettings, { wrapper: LayoutSettingsProvider });
    act(() => result.current.setKeyVariant('small'));
    act(() => resize(390));
    expect(result.current.keyVariant).toBe('small');
  });
});
