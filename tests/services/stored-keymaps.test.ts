import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LayerLibraryService } from '../../src/services/layer-library.service';
import { keymapFromStored, keymapToNames } from '../../src/utils/stored-keymap';
import { keyService } from '../../src/services/key.service';
import type { KeyboardInfo } from '../../src/types/keyboard.types';
import type { LayerEntry } from '../../src/types/layer-library';

// Saved keymaps hold keycode names, never numbers: a number means something
// only in the firmware numbering that produced it, and QMK renumbers.

const STORAGE_KEY = 'keybard-layer-library';
const IMPORTED_LAYOUTS_KEY = 'keybard-imported-layouts';

const KC_A = keyService.parse('KC_A');
const LSFT_T_A = keyService.parse('LSFT_T(KC_A)');
const MO_1 = keyService.parse('MO(1)');

global.fetch = vi.fn().mockResolvedValue({ ok: false }) as any;

function layer(overrides: Partial<LayerEntry> = {}): LayerEntry {
    return {
        id: 'abc123', name: 'Home row', description: '', author: 'tester', tags: [],
        keyboardType: 'svalboard', keyCount: 3, keymap: [KC_A, LSFT_T_A, MO_1],
        createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
        ...overrides,
    };
}

function stored(key: string) {
    return JSON.parse(localStorage.getItem(key) || 'null');
}

describe('stored keymap conversion', () => {
    it('round-trips every keycode through its saved form', () => {
        const all = Array.from({ length: 0x10000 }, (_, code) => code);
        expect(keymapFromStored(keymapToNames(all))).toEqual(all);
    });

    it('reads names and the numbers older saves hold', () => {
        expect(keymapFromStored(['KC_A', 'LSFT_T(KC_A)', MO_1])).toEqual([KC_A, LSFT_T_A, MO_1]);
    });

    it('rejects names it does not know instead of guessing', () => {
        expect(() => keymapFromStored(['KC_A', 'NOT_A_KEYCODE'])).toThrow('NOT_A_KEYCODE');
        expect(() => keymapFromStored([70000])).toThrow();
    });
});

describe('layer library storage', () => {
    let service: LayerLibraryService;

    beforeEach(() => {
        localStorage.clear();
        service = new LayerLibraryService();
    });

    it('saves user layers by keycode name and reads them back as keycodes', async () => {
        await service.addLayer(layer());
        expect(stored(STORAGE_KEY)[0].keymap).toEqual(['KC_A', 'LSFT_T(KC_A)', 'MO(1)']);
        expect((await service.getLayerById('abc123'))?.keymap).toEqual([KC_A, LSFT_T_A, MO_1]);
    });

    it('rewrites numeric layers from older saves as names', async () => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([layer()]));
        expect((await service.loadLayers())[0].keymap).toEqual([KC_A, LSFT_T_A, MO_1]);
        expect(stored(STORAGE_KEY)[0].keymap).toEqual(['KC_A', 'LSFT_T(KC_A)', 'MO(1)']);
    });

    it('exports a version 2 library with keycode names', async () => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([layer()]));
        await service.loadLayers();
        const exported = JSON.parse(service.exportUserLayers());
        expect(exported.version).toBe(2);
        expect(exported.layers[0].keymap).toEqual(['KC_A', 'LSFT_T(KC_A)', 'MO(1)']);
    });

    it('keeps a layer whose names do not resolve yet, without showing it', async () => {
        // A board's custom keycode name only resolves once that board is connected.
        const pending = { ...layer({ id: 'custom' }), keymap: ['KC_A', 'SV_NOT_CONNECTED', 'MO(1)'] };
        localStorage.setItem(STORAGE_KEY, JSON.stringify([pending]));
        expect(await service.loadLayers()).toEqual([]);
        await service.addLayer(layer());
        expect(stored(STORAGE_KEY).map((l: LayerEntry) => l.id)).toEqual(['abc123', 'custom']);
    });

    it('saves imported layouts by keycode name', () => {
        const kbinfo = { keymap: [[KC_A, LSFT_T_A], [MO_1, KC_A]], cosmetic: {} } as unknown as KeyboardInfo;
        const group = service.importLayoutFromKeyboardInfo(kbinfo, 'test');
        expect(stored(IMPORTED_LAYOUTS_KEY).layouts[0].layers.map((l: { keymap: string[] }) => l.keymap))
            .toEqual([['KC_A', 'LSFT_T(KC_A)'], ['MO(1)', 'KC_A']]);
        expect(service.getImportedLayouts()[0].layers[0].keymap).toEqual([KC_A, LSFT_T_A]);
        expect(service.deleteImportedLayer(group.id, 0)).toBe(true);
        expect(service.getImportedLayouts()[0].layers.map(l => l.index)).toEqual([1]);
    });

    it('does not drop unresolved imported layers when another layer is deleted', () => {
        localStorage.setItem(IMPORTED_LAYOUTS_KEY, JSON.stringify({ layouts: [{
            id: 'g', name: 'old', source: 'imported',
            layers: [{ index: 0, name: 'L0', keymap: [KC_A] }, { index: 1, name: 'L1', keymap: ['SV_NOT_CONNECTED'] }, { index: 2, name: 'L2', keymap: [MO_1] }],
        }] }));
        expect(service.getImportedLayouts()[0].layers.map(l => l.index)).toEqual([0, 2]);
        expect(service.deleteImportedLayer('g', 0)).toBe(true);
        expect(stored(IMPORTED_LAYOUTS_KEY).layouts[0].layers.map((l: { keymap: string[] }) => l.keymap))
            .toEqual([['SV_NOT_CONNECTED'], ['MO(1)']]);
    });
});

describe('layer clipboard', () => {
    beforeEach(() => {
        vi.resetModules();
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn().mockResolvedValue(undefined), readText: vi.fn() } });
    });

    it('copies keycode names and pastes names or numbers', async () => {
        const { writeLayerClipboard, readLayerClipboard } = await import('../../src/utils/layer-clipboard');
        await writeLayerClipboard({ keymap: [KC_A, LSFT_T_A] });
        const text = vi.mocked(navigator.clipboard.writeText).mock.calls[0][0];
        expect(JSON.parse(text).keymap).toEqual(['KC_A', 'LSFT_T(KC_A)']);
        vi.mocked(navigator.clipboard.readText).mockResolvedValue(text);
        expect((await readLayerClipboard()).keymap).toEqual([KC_A, LSFT_T_A]);
        vi.mocked(navigator.clipboard.readText).mockResolvedValue(JSON.stringify([MO_1]));
        expect((await readLayerClipboard()).keymap).toEqual([MO_1]);
    });
});
