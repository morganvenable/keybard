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
    expect(result.current.keyVariant).toBe('small');
  });

  it('refits the board when a panel reduces the canvas, and restores its size on close', () => {
    resize(1600);
    const { result } = renderHook(useLayoutSettings, { wrapper: LayoutSettingsProvider });
    const dimensions = { containerWidth: 1500, containerHeight: 850,
      keyboardWidths: { default: 1400, medium: 1050, small: 700 },
      keyboardHeights: { default: 700, medium: 500, small: 300 } };
    act(() => result.current.setMeasuredDimensions(dimensions));
    expect(result.current.keyVariant).toBe('default');
    act(() => result.current.setMeasuredDimensions({...dimensions, containerWidth: 1000}));
    expect(result.current.keyVariant).toBe('small');
    expect(result.current.layoutMode).toBe('sidebar');
    act(() => result.current.setMeasuredDimensions(dimensions));
    expect(result.current.keyVariant).toBe('default');
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
