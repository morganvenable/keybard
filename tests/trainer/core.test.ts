import { describe, expect, it } from 'vitest';
import { geometry, preferences, resolveBinding, haloColor } from '@/features/trainer/core';
describe('trainer shared core', () => {
    it('resolves complete active/default masks and transparent fallthrough', () => {
        const map = [[4, 5], [6, 1], [1, 0], [9, 10]];
        expect(resolveBinding(map, 0, 4, 2)).toEqual({ code: 6, layer: 1 });
        expect(resolveBinding(map, 1, 4, 2)).toEqual({ code: 0, layer: 2 });
        expect(resolveBinding(map, 0, 0, 10)).toEqual({ code: 9, layer: 3 });
        expect(resolveBinding(map, 0, 0, 0)).toEqual({ code: 4, layer: 0 });
    });
    it('supports bit 31 and rejects unknown layers', () => {
        const map = Array.from({ length: 32 }, () => [1]); map[0] = [4]; map[31] = [44];
        expect(resolveBinding(map, 0, 0, 0x80000000).code).toBe(44);
        expect(() => resolveBinding([[4]], 0, 2, 1)).toThrow('Layer 1');
    });
    it('preserves board geometry and filters invalid matrix positions', () => {
        const keys = geometry({ rows: 10, cols: 6, keylayout: { 31: { row: 5, col: 1, x: 20, y: 3, w: 2, h: 1 }, 90: { row: 15, col: 0, x: 0, y: 0 } } });
        expect(keys).toHaveLength(1); expect(keys[0]).toMatchObject({ id: 31, hand: 'Right', w: 2 });
    });
    it('validates preferences without destroying zero opacity or disabled borders', () => {
        const p = preferences({ appearance: { fillAlpha: 0, width: 0, legend: 'javascript:bad', halo: 'true' }, duration: Infinity, scale: 999 });
        expect(p.appearance.fillAlpha).toBe(0); expect(p.appearance.width).toBe(0);
        expect(p.appearance.legend).toBe('#f0f5f7'); expect(p.duration).toBe(150); expect(p.scale).toBe(150);
        expect(haloColor('#ffffff')).toBe('#000000'); expect(haloColor('#000000')).toBe('#ffffff');
    });
});
