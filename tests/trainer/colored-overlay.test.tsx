import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { surfaceKeys } from '@/features/trainer/useSurfaceKeys';
import { keyService } from '@/services/key.service';
import { ColoredSurface, coloredPosition, darkerHex } from '@/features/trainer/ColoredSurface';
import { COLORED_DEFAULTS, COLORED_LOOKS, coloredPreferences, keyLayerColor, topLayer, type ColoredLook } from '@/features/trainer/core';
import { hostBoardUid, notifyHostLayerColors, resetHostRefreshForTests } from '@/features/trainer/host';
import { appStorage } from '@/utils/app-storage';

const code = (key: string) => keyService.parse(key)!;
// Two keys: A over a transparent layer 1, and MO(2) with a layer 2 binding above it.
const board = {
    rows: 10, cols: 6,
    keymap: [[code('KC_A'), code('MO(1)')], [1, code('KC_B')], [1, 1]],
    keylayout: { 0: { row: 0, col: 0, x: 0, y: 0, w: 1, h: 1 }, 1: { row: 0, col: 1, x: 1, y: 6, w: 1, h: 1 } },
};
const COLORS = { '0': 'green', '1': 'blue', '2': '#450770' };

function surface(active: number, props: Partial<Parameters<typeof ColoredSurface>[0]> = {}) {
    const keys = surfaceKeys(board, active, 1, 'Both', 'us', null);
    return render(<ColoredSurface keys={keys} layerColors={COLORS} colorBy="source" look="flat" opacity={100} active={active} defaults={1}
        held={new Set()} changed={new Set()} effect="Short fade" duration={150} changedColor="#8ce4d3" hidden={new Set()} layoutId="us" {...props} />).container;
}
const keyColor = (container: HTMLElement, id: number) => container.querySelector(`[data-key-id="${id}"]`)?.getAttribute('data-layer-color');

describe('colored overlay settings', () => {
    it('defaults to the see-through style, source coloring, full opacity and flat keys', () => {
        expect(coloredPreferences(undefined)).toEqual(COLORED_DEFAULTS);
        expect(COLORED_DEFAULTS).toEqual({ style: 'see-through', colorBy: 'source', coloredOpacity: 100, coloredLook: 'flat' });
    });
    it('reads valid fields and drops invalid ones (older Hosts send none)', () => {
        expect(coloredPreferences({ style: 'colored', colorBy: 'active', coloredOpacity: 140, coloredLook: 'raised' }))
            .toEqual({ style: 'colored', colorBy: 'active', coloredOpacity: 100, coloredLook: 'raised' });
        expect(coloredPreferences({ style: 'neon', colorBy: 1, coloredOpacity: NaN, coloredLook: '3d' })).toEqual(COLORED_DEFAULTS);
        expect(coloredPreferences({ coloredOpacity: -5 }).coloredOpacity).toBe(0);
    });
});

describe('which color a key takes', () => {
    it('finds the highest layer that is on', () => {
        expect(topLayer(0, 1)).toBe(0);
        expect(topLayer(0b110, 1)).toBe(2);
        expect(topLayer(0x80000000, 0)).toBe(31);
        expect(topLayer(0, 0)).toBe(0);
    });
    it('uses the source layer in source mode and the top layer in active mode', () => {
        expect(keyLayerColor(COLORS, 'source', 0, 0b10, 1)).toBe('green');
        expect(keyLayerColor(COLORS, 'active', 0, 0b10, 1)).toBe('blue');
        expect(keyLayerColor(COLORS, 'active', 0, 0b100, 1)).toBe('#450770');
    });
    it('falls back to the default color for a layer without a known color', () => {
        expect(keyLayerColor(undefined, 'source', 3, 0, 1)).toBe('primary');
        expect(keyLayerColor({ '3': 'javascript:x' }, 'source', 3, 0, 1)).toBe('primary');
        expect(keyLayerColor({ '3': '#zzzzzz' }, 'source', 3, 0, 1)).toBe('primary');
    });
});

describe('ColoredSurface', () => {
    it('colors each key by the layer its binding comes from', () => {
        const container = surface(0b10);
        expect(keyColor(container, 0)).toBe('green'); // layer 1 is transparent here: A comes from layer 0
        expect(keyColor(container, 1)).toBe('blue');  // B comes from layer 1
    });
    it('colors every key by the top layer in active mode', () => {
        const container = surface(0b10, { colorBy: 'active' });
        expect(keyColor(container, 0)).toBe('blue');
        expect(keyColor(container, 1)).toBe('blue');
    });
    it('draws the editor key, with a custom hex color inline', () => {
        const container = surface(0b100, { colorBy: 'active' });
        const face = container.querySelector('[data-key-id="0"] .uppercase') as HTMLElement;
        expect(face.style.backgroundColor).toBe('rgb(69, 7, 112)');
        expect(face.className).toContain('text-white');
        expect(surface(0).querySelector('[data-key-id="0"] .uppercase')!.className).toContain('bg-kb-green');
    });
    it('shows held keys with the editor selected look', () => {
        const face = surface(0, { held: new Set([0]) }).querySelector('[data-key-id="0"] .uppercase')!;
        expect(face.className).toContain('bg-red-500');
        expect(face.className).toContain('ring-2');
    });
    it('fades changed keys and leaves them alone when the highlight is off', () => {
        expect(surface(0, { changed: new Set([1]) }).querySelector('[data-key-id="1"] .trainer-fade')).not.toBeNull();
        expect(surface(0, { changed: new Set([1]), effect: 'Off' }).querySelector('[data-key-id="1"] .trainer-fade')).toBeNull();
    });
    it('applies the surface opacity', () => {
        expect((surface(0, { opacity: 40 }).querySelector('.trainer-colored-surface') as HTMLElement).style.opacity).toBe('0.4');
    });
    it('moves the lower thumb row down by the editor thumb offset', () => {
        expect(coloredPosition({ x: 1, y: 6 })).toEqual({ x: 1, y: 6.3 });
        expect(coloredPosition({ x: 1, y: 5 })).toEqual({ x: 1, y: 5 });
    });
    it.each(COLORED_LOOKS)('draws the %s look', (look: ColoredLook) => {
        const container = surface(0, { look });
        expect(container.querySelector(`[data-look="${look}"]`)).not.toBeNull();
        expect(container.querySelectorAll('[data-board-panel]').length).toBe(look === 'panel' || look === 'tilted' ? 1 : 0);
    });
    it('darkens a layer color for the raised underlay', () => {
        expect(darkerHex('#ffffff')).toBe('#b3b3b3');
    });
});

describe('sending layer colors to Keybard Host', () => {
    let fetchMock: ReturnType<typeof vi.fn>;
    const json = (status: number, body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));
    const sent = () => fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/api/host/command')).map(([, init]) => JSON.parse(init.body));
    beforeEach(() => {
        vi.useFakeTimers();
        resetHostRefreshForTests();
        fetchMock = vi.fn((url: string) => String(url).endsWith('/bootstrap') ? json(200, { token: 't1', apiVersion: 1 }) : json(202, { accepted: true }));
        vi.stubGlobal('fetch', fetchMock);
        delete document.documentElement.dataset.keybardHost;
        try { appStorage.removeItem('keybard-host-remote'); } catch { /* ignore */ }
    });
    afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

    it('writes the board UID the way the Host does', () => {
        expect(hostBoardUid('1122334455667788')).toBe(String(0x1122334455667788n));
        expect(hostBoardUid('ff')).toBe('255');
        expect(hostBoardUid(undefined)).toBeNull();
        expect(hostBoardUid('not hex')).toBeNull();
    });
    it('stays quiet when the Host is not in use', async () => {
        notifyHostLayerColors('ff', COLORS);
        await vi.runAllTimersAsync();
        expect(fetchMock).not.toHaveBeenCalled();
    });
    it('sends the colors once, and again only when they change', async () => {
        appStorage.setItem('keybard-host-remote', '1');
        notifyHostLayerColors('ff', COLORS);
        await vi.runAllTimersAsync();
        notifyHostLayerColors('ff', { ...COLORS });
        await vi.runAllTimersAsync();
        notifyHostLayerColors('ff', { ...COLORS, '1': 'red' });
        await vi.runAllTimersAsync();
        expect(sent()).toEqual([
            { op: 'layerColors', uid: '255', colors: COLORS },
            { op: 'layerColors', uid: '255', colors: { ...COLORS, '1': 'red' } },
        ]);
    });
    it('leaves out entries that are not layers', async () => {
        document.documentElement.dataset.keybardHost = 'true';
        notifyHostLayerColors('ff', { '0': 'green', '40': 'blue', x: 'red' });
        await vi.runAllTimersAsync();
        expect(sent()).toEqual([{ op: 'layerColors', uid: '255', colors: { '0': 'green' } }]);
    });
});
