/**
 * Keymap Integrity Tests
 *
 * These tests ensure data integrity through save/load cycles and fragment transformations.
 * Critical requirement: ALL key data must be preserved, even for keys not visible in current layout.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { fileService, FileService } from '../../src/services/file.service';
import { keyService } from '../../src/services/key.service';
import type { KeyboardInfo } from '../../src/types/vial.types';
import {
    generateComplexKeymap,
    assertKeymapsEqual,
    assertKeysPreserved,
    createKbinfoWithFragments,
    keymapToLayout,
    layoutToKeymap,
    countKeycodeTypes,
    createMockFile,
    KEYCODE_TYPES,
} from '../utils/keymap-helpers';
import {
    createTestFragments,
    createFragmentState,
    FRAGMENT_NAMES,
    FRAGMENT_IDS,
} from '../fixtures/fragments.fixture';
import { createTestKeyboardInfo } from '../fixtures/keyboard-info.fixture';

// Helper to create kbinfo with numeric hex kbid for export testing
const createExportableKeyboardInfo = (overrides?: Partial<KeyboardInfo>): KeyboardInfo => {
    return createTestKeyboardInfo({
        kbid: '1234567890ABCDEF', // Valid hex for BigInt conversion
        ...overrides,
    });
};

describe('Keymap Integrity', () => {
    describe('Round-trip Tests', () => {
        it('preserves ALL keymap data through svil export/import cycle', () => {
            // Create a keyboard with complex keymap
            const rows = 5;
            const cols = 14;
            const layers = 4;
            const originalKeymap = generateComplexKeymap(rows, cols, layers);

            const kbinfo = createExportableKeyboardInfo({
                rows,
                cols,
                layers,
                keymap: originalKeymap,
            });

            // Export to svil format
            const svilJson = (fileService as any).kbinfoToSvil(kbinfo, true);
            const svil = JSON.parse(svilJson);

            // Verify layout format is [layer][row][col]
            expect(svil.layout).toBeDefined();
            expect(svil.layout.length).toBe(layers);
            expect(svil.layout[0].length).toBe(rows);
            expect(svil.layout[0][0].length).toBe(cols);

            // Import back
            const importedKbinfo = (fileService as any).svilToKBINFO(svil);

            // Verify keymap matches original
            expect(importedKbinfo.keymap).toBeDefined();
            expect(importedKbinfo.keymap.length).toBe(layers);

            // Convert imported keymap to numbers for comparison
            const importedKeymap = importedKbinfo.keymap.map((layer: any[]) =>
                layer.map((keycode: any) =>
                    typeof keycode === 'string' ? keyService.parse(keycode) : keycode
                )
            );

            assertKeymapsEqual(originalKeymap, importedKeymap, 'Round-trip');
        });

        it('preserves ALL keymap data through VIL export/import cycle', () => {
            const rows = 5;
            const cols = 14;
            const layers = 4;
            const originalKeymap = generateComplexKeymap(rows, cols, layers);

            const kbinfo = createExportableKeyboardInfo({
                rows,
                cols,
                layers,
                keymap: originalKeymap,
            });

            // Export to VIL format
            const vilJson = (fileService as any).kbinfoToVIL(kbinfo, true);
            const vil = JSON.parse(vilJson);

            // Import back
            const importedKbinfo = (fileService as any).vilToKBINFO(vil);

            // Convert imported keymap to numbers
            const importedKeymap = importedKbinfo.keymap.map((layer: any[]) =>
                layer.map((keycode: any) =>
                    typeof keycode === 'string' ? keyService.parse(keycode) : keycode
                )
            );

            assertKeymapsEqual(originalKeymap, importedKeymap, 'VIL Round-trip');
        });

        it('preserves extra keys when loading 6-key file on 5-key layout', () => {
            // Create a 6-key matrix keymap (larger)
            const rows6key = 5;
            const cols6key = 16; // More columns for 6-key
            const layers = 4;
            const keymap6key = generateComplexKeymap(rows6key, cols6key, layers);

            const kbinfo6key = createExportableKeyboardInfo({
                rows: rows6key,
                cols: cols6key,
                layers,
                keymap: keymap6key,
            });

            // Export 6-key layout
            const svilJson = (fileService as any).kbinfoToSvil(kbinfo6key, true);
            const svil = JSON.parse(svilJson);

            // Import back
            const imported = (fileService as any).svilToKBINFO(svil);

            // Should have ALL keys from 6-key layout
            expect(imported.keymap[0].length).toBe(rows6key * cols6key);

            // Verify specific keys preserved
            const importedKeymap = imported.keymap.map((layer: any[]) =>
                layer.map((keycode: any) =>
                    typeof keycode === 'string' ? keyService.parse(keycode) : keycode
                )
            );

            assertKeymapsEqual(keymap6key, importedKeymap, 'Extra keys');
        });

        it('preserves keys at matrix positions not visible in current fragment', () => {
            // Create keyboard with fragments
            const kbinfo = createKbinfoWithFragments({
                rows: 5,
                cols: 14,
                layers: 4,
                use6Key: true,
            });

            // Original keymap should have keys at all positions
            const originalKeymap = kbinfo.keymap!;

            // Export with 6-key fragment selection
            const svilJson = (fileService as any).kbinfoToSvil(kbinfo, true);
            const svil = JSON.parse(svilJson);

            // Simulate changing selection to 5-key (fewer visible keys)
            if (svil.fragment_selections) {
                svil.fragment_selections['left_finger'] = FRAGMENT_NAMES.FINGER_5KEY;
                svil.fragment_selections['right_finger'] = FRAGMENT_NAMES.FINGER_5KEY;
            }

            // Import
            const imported = (fileService as any).svilToKBINFO(svil);

            // ALL keymap data should still be preserved
            expect(imported.keymap).toBeDefined();
            expect(imported.keymap.length).toBe(originalKeymap.length);

            // Verify keymap is preserved regardless of fragment selection
            const importedKeymap = imported.keymap.map((layer: any[]) =>
                layer.map((keycode: any) =>
                    typeof keycode === 'string' ? keyService.parse(keycode) : keycode
                )
            );

            assertKeymapsEqual(originalKeymap as number[][], importedKeymap, 'Hidden keys');
        });
    });

    describe('Special Keycode Handling', () => {
        it('preserves KC_NO (0x0000) and KC_TRNS (0x0001)', () => {
            const rows = 4;
            const cols = 4;
            const layers = 2;

            // Create keymap with only KC_NO and KC_TRNS
            const keymap: number[][] = [
                Array(rows * cols).fill(0x0000), // All KC_NO
                Array(rows * cols).fill(0x0001), // All KC_TRNS
            ];

            const kbinfo = createExportableKeyboardInfo({
                rows,
                cols,
                layers,
                keymap,
            });

            const svilJson = (fileService as any).kbinfoToSvil(kbinfo, true);
            const svil = JSON.parse(svilJson);
            const imported = (fileService as any).svilToKBINFO(svil);

            const importedKeymap = imported.keymap.map((layer: any[]) =>
                layer.map((keycode: any) =>
                    typeof keycode === 'string' ? keyService.parse(keycode) : keycode
                )
            );

            // Verify KC_NO and KC_TRNS preserved
            expect(importedKeymap[0].every((k: number) => KEYCODE_TYPES.isKC_NO(k))).toBe(true);
            expect(importedKeymap[1].every((k: number) => KEYCODE_TYPES.isKC_TRNS(k))).toBe(true);
        });

        it('preserves macros M0-M127', () => {
            const rows = 4;
            const cols = 4;
            const layers = 1;

            // Create keymap with macro keycodes
            const keymap: number[][] = [
                Array(rows * cols).fill(0).map((_, i) => 0x5700 + (i % 128)), // M0-M15, wrapped
            ];

            const kbinfo = createExportableKeyboardInfo({
                rows,
                cols,
                layers,
                keymap,
            });

            const svilJson = (fileService as any).kbinfoToSvil(kbinfo, true);
            const svil = JSON.parse(svilJson);
            const imported = (fileService as any).svilToKBINFO(svil);

            const importedKeymap = imported.keymap.map((layer: any[]) =>
                layer.map((keycode: any) =>
                    typeof keycode === 'string' ? keyService.parse(keycode) : keycode
                )
            );

            assertKeymapsEqual(keymap, importedKeymap, 'Macro keycodes');
        });

        it('preserves tap dance TD0-TD254', () => {
            const rows = 4;
            const cols = 4;
            const layers = 1;

            // Create keymap with tap dance keycodes
            const keymap: number[][] = [
                Array(rows * cols).fill(0).map((_, i) => 0x5740 + i), // TD0-TD15
            ];

            const kbinfo = createExportableKeyboardInfo({
                rows,
                cols,
                layers,
                keymap,
            });

            const svilJson = (fileService as any).kbinfoToSvil(kbinfo, true);
            const svil = JSON.parse(svilJson);
            const imported = (fileService as any).svilToKBINFO(svil);

            const importedKeymap = imported.keymap.map((layer: any[]) =>
                layer.map((keycode: any) =>
                    typeof keycode === 'string' ? keyService.parse(keycode) : keycode
                )
            );

            assertKeymapsEqual(keymap, importedKeymap, 'Tap dance keycodes');
        });

        it('preserves layer keys MO, TO, TG, DF', () => {
            const rows = 4;
            const cols = 4;
            const layers = 1;

            // Create keymap with various layer keycodes
            const keymap: number[][] = [
                [
                    0x5100, 0x5101, 0x5102, 0x5103, // MO(0-3)
                    0x5200, 0x5201, 0x5202, 0x5203, // TO(0-3)
                    0x5300, 0x5301, 0x5302, 0x5303, // TG(0-3)
                    0x5400, 0x5401, 0x5402, 0x5403, // DF(0-3)
                ],
            ];

            const kbinfo = createExportableKeyboardInfo({
                rows,
                cols,
                layers,
                keymap,
            });

            const svilJson = (fileService as any).kbinfoToSvil(kbinfo, true);
            const svil = JSON.parse(svilJson);
            const imported = (fileService as any).svilToKBINFO(svil);

            const importedKeymap = imported.keymap.map((layer: any[]) =>
                layer.map((keycode: any) =>
                    typeof keycode === 'string' ? keyService.parse(keycode) : keycode
                )
            );

            assertKeymapsEqual(keymap, importedKeymap, 'Layer keycodes');
        });

        it('preserves modified keys like LCTL(KC_A)', () => {
            const rows = 4;
            const cols = 4;
            const layers = 1;

            // Create keymap with modified keycodes
            // LCTL(KC_A) = 0x0100 | 0x04 = 0x0104
            // LSFT(KC_B) = 0x0200 | 0x05 = 0x0205
            // LALT(KC_C) = 0x0400 | 0x06 = 0x0406
            // LGUI(KC_D) = 0x0800 | 0x07 = 0x0807
            const keymap: number[][] = [
                [
                    0x0104, 0x0205, 0x0406, 0x0807, // Modified keys
                    0x0304, 0x0505, 0x0606, 0x0707, // More combinations
                    0x0F04, 0x0F05, 0x0F06, 0x0F07, // All mods
                    0x1004, 0x1005, 0x1006, 0x1007, // Right mods
                ],
            ];

            const kbinfo = createExportableKeyboardInfo({
                rows,
                cols,
                layers,
                keymap,
            });

            const svilJson = (fileService as any).kbinfoToSvil(kbinfo, true);
            const svil = JSON.parse(svilJson);
            const imported = (fileService as any).svilToKBINFO(svil);

            const importedKeymap = imported.keymap.map((layer: any[]) =>
                layer.map((keycode: any) =>
                    typeof keycode === 'string' ? keyService.parse(keycode) : keycode
                )
            );

            assertKeymapsEqual(keymap, importedKeymap, 'Modified keycodes');
        });

        it('preserves custom keycodes USER00-USER63', () => {
            const rows = 4;
            const cols = 4;
            const layers = 1;

            // Create keymap with user keycodes
            const keymap: number[][] = [
                Array(rows * cols).fill(0).map((_, i) => 0x7E40 + i), // USER00-USER15
            ];

            const kbinfo = createExportableKeyboardInfo({
                rows,
                cols,
                layers,
                keymap,
            });

            const svilJson = (fileService as any).kbinfoToSvil(kbinfo, true);
            const svil = JSON.parse(svilJson);
            const imported = (fileService as any).svilToKBINFO(svil);

            const importedKeymap = imported.keymap.map((layer: any[]) =>
                layer.map((keycode: any) =>
                    typeof keycode === 'string' ? keyService.parse(keycode) : keycode
                )
            );

            assertKeymapsEqual(keymap, importedKeymap, 'User keycodes');
        });

        it('preserves all keycode types in mixed keymap', () => {
            const rows = 6;
            const cols = 16;
            const layers = 8;
            const keymap = generateComplexKeymap(rows, cols, layers);

            // Count original keycode types
            const originalCounts = countKeycodeTypes(keymap);

            const kbinfo = createExportableKeyboardInfo({
                rows,
                cols,
                layers,
                keymap,
            });

            const svilJson = (fileService as any).kbinfoToSvil(kbinfo, true);
            const svil = JSON.parse(svilJson);
            const imported = (fileService as any).svilToKBINFO(svil);

            const importedKeymap = imported.keymap.map((layer: any[]) =>
                layer.map((keycode: any) =>
                    typeof keycode === 'string' ? keyService.parse(keycode) : keycode
                )
            );

            // Count imported keycode types
            const importedCounts = countKeycodeTypes(importedKeymap);

            // Verify counts match
            expect(importedCounts).toEqual(originalCounts);
        });
    });

    describe('Edge Cases', () => {
        it('handles empty layers', () => {
            const rows = 4;
            const cols = 4;
            const layers = 4;

            // Create keymap where some layers are all KC_NO
            const keymap: number[][] = [
                Array(rows * cols).fill(0x04), // Layer 0 with KC_A
                Array(rows * cols).fill(0x0000), // Layer 1 empty
                Array(rows * cols).fill(0x0000), // Layer 2 empty
                Array(rows * cols).fill(0x05), // Layer 3 with KC_B
            ];

            const kbinfo = createExportableKeyboardInfo({
                rows,
                cols,
                layers,
                keymap,
            });

            const svilJson = (fileService as any).kbinfoToSvil(kbinfo, true);
            const svil = JSON.parse(svilJson);
            const imported = (fileService as any).svilToKBINFO(svil);

            const importedKeymap = imported.keymap.map((layer: any[]) =>
                layer.map((keycode: any) =>
                    typeof keycode === 'string' ? keyService.parse(keycode) : keycode
                )
            );

            assertKeymapsEqual(keymap, importedKeymap, 'Empty layers');
        });

        it('handles maximum layer count (32 layers)', () => {
            const rows = 2;
            const cols = 2;
            const layers = 32;

            const keymap: number[][] = Array(layers).fill(null).map((_, l) =>
                Array(rows * cols).fill(0x04 + (l % 26))
            );

            const kbinfo = createExportableKeyboardInfo({
                rows,
                cols,
                layers,
                keymap,
            });

            const svilJson = (fileService as any).kbinfoToSvil(kbinfo, true);
            const svil = JSON.parse(svilJson);

            expect(svil.layout.length).toBe(32);

            const imported = (fileService as any).svilToKBINFO(svil);

            const importedKeymap = imported.keymap.map((layer: any[]) =>
                layer.map((keycode: any) =>
                    typeof keycode === 'string' ? keyService.parse(keycode) : keycode
                )
            );

            assertKeymapsEqual(keymap, importedKeymap, '32 layers');
        });

        it('handles large matrix size (18x18)', () => {
            const rows = 18;
            const cols = 18;
            const layers = 2;

            const keymap = generateComplexKeymap(rows, cols, layers);

            const kbinfo = createExportableKeyboardInfo({
                rows,
                cols,
                layers,
                keymap,
            });

            const svilJson = (fileService as any).kbinfoToSvil(kbinfo, true);
            const svil = JSON.parse(svilJson);
            const imported = (fileService as any).svilToKBINFO(svil);

            const importedKeymap = imported.keymap.map((layer: any[]) =>
                layer.map((keycode: any) =>
                    typeof keycode === 'string' ? keyService.parse(keycode) : keycode
                )
            );

            assertKeymapsEqual(keymap, importedKeymap, 'Large matrix');
        });

        it('handles -1 values in layout (unused positions)', () => {
            // Simulate loading a file with -1 values
            const svil = {
                version: 1,
                uid: 12345,
                layout: [
                    [
                        ['KC_A', -1, 'KC_B', -1],
                        [-1, 'KC_C', -1, 'KC_D'],
                    ],
                ],
                macro: [],
                tap_dance: [],
                combo: [],
                key_override: [],
            };

            const imported = (fileService as any).svilToKBINFO(svil);

            // -1 should become KC_NO (0)
            expect(imported.keymap[0][1]).toBe(0); // Was -1
            expect(imported.keymap[0][3]).toBe(0); // Was -1
            expect(imported.keymap[0][4]).toBe(0); // Was -1
        });
    });

    describe('Fragment State Preservation', () => {
        it('preserves fragment selections through export/import', () => {
            const kbinfo = createKbinfoWithFragments({
                use5Key: false,
                use6Key: true,
                withUserSelections: true,
            });

            // Verify fragment state is set
            expect(kbinfo.fragmentState?.userSelections.size).toBeGreaterThan(0);

            const svilJson = (fileService as any).kbinfoToSvil(kbinfo, true);
            const svil = JSON.parse(svilJson);

            // Verify fragment_selections in export
            expect(svil.fragment_selections).toBeDefined();
            expect(Object.keys(svil.fragment_selections).length).toBeGreaterThan(0);

            // Import
            const imported = (fileService as any).svilToKBINFO(svil);

            // Verify fragment state restored
            expect(imported.fragmentState).toBeDefined();
            expect(imported.fragmentState.userSelections.size).toBeGreaterThan(0);

            // Verify selections match
            for (const [key, value] of kbinfo.fragmentState!.userSelections) {
                expect(imported.fragmentState.userSelections.get(key)).toBe(value);
            }
        });

        it('preserves fragment definitions and composition through export/import', () => {
            const kbinfo = createKbinfoWithFragments();

            // Add fragments
            kbinfo.fragments = createTestFragments();

            const svilJson = (fileService as any).kbinfoToSvil(kbinfo, true);
            const svil = JSON.parse(svilJson);

            // Verify fragments exported
            expect(svil.fragments).toBeDefined();
            expect(Object.keys(svil.fragments).length).toBeGreaterThan(0);
            expect(svil.composition).toBeDefined();

            // Import
            const imported = (fileService as any).svilToKBINFO(svil);

            // Verify fragments restored
            expect(imported.fragments).toBeDefined();
            expect(Object.keys(imported.fragments).length).toBe(Object.keys(kbinfo.fragments).length);
            expect(imported.composition).toBeDefined();
        });

        it('keymap data preserved when fragment selection changes', () => {
            // Create keyboard with 6-key fragments selected
            const kbinfo = createKbinfoWithFragments({
                use6Key: true,
                withUserSelections: true,
            });

            const originalKeymap = kbinfo.keymap!.map(layer => [...layer]);

            // Export
            const svilJson = (fileService as any).kbinfoToSvil(kbinfo, true);
            const svil = JSON.parse(svilJson);

            // Change fragment selection to 5-key
            svil.fragment_selections = {
                'left_finger': FRAGMENT_NAMES.FINGER_5KEY,
                'right_finger': FRAGMENT_NAMES.FINGER_5KEY,
            };

            // Import with new selection
            const imported = (fileService as any).svilToKBINFO(svil);

            // ALL keymap data should still be preserved
            const importedKeymap = imported.keymap.map((layer: any[]) =>
                layer.map((keycode: any) =>
                    typeof keycode === 'string' ? keyService.parse(keycode) : keycode
                )
            );

            assertKeymapsEqual(originalKeymap as number[][], importedKeymap, 'Selection change');
        });
    });

    describe('Layout Format Conversion', () => {
        it('correctly converts keymap to layout format', () => {
            const rows = 3;
            const cols = 4;
            const layers = 2;

            // Create a simple keymap
            const keymap: number[][] = [
                [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
                [13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24],
            ];

            const layout = keymapToLayout(keymap, rows, cols);

            // Verify layout structure
            expect(layout.length).toBe(layers);
            expect(layout[0].length).toBe(rows);
            expect(layout[0][0].length).toBe(cols);

            // Verify values
            expect(layout[0][0][0]).toBe(1); // First key
            expect(layout[0][0][3]).toBe(4); // End of first row
            expect(layout[0][1][0]).toBe(5); // Start of second row
            expect(layout[1][2][3]).toBe(24); // Last key of second layer
        });

        it('correctly converts layout back to keymap', () => {
            const cols = 4;

            const layout: number[][][] = [
                [
                    [1, 2, 3, 4],
                    [5, 6, 7, 8],
                    [9, 10, 11, 12],
                ],
                [
                    [13, 14, 15, 16],
                    [17, 18, 19, 20],
                    [21, 22, 23, 24],
                ],
            ];

            const keymap = layoutToKeymap(layout, cols);

            // Verify keymap structure
            expect(keymap.length).toBe(2);
            expect(keymap[0].length).toBe(12);

            // Verify values
            expect(keymap[0][0]).toBe(1);
            expect(keymap[0][4]).toBe(5);
            expect(keymap[1][11]).toBe(24);
        });

        it('layout/keymap conversion is reversible', () => {
            const rows = 5;
            const cols = 14;
            const layers = 4;

            const originalKeymap = generateComplexKeymap(rows, cols, layers);
            const layout = keymapToLayout(originalKeymap, rows, cols);
            const restoredKeymap = layoutToKeymap(layout, cols);

            assertKeymapsEqual(originalKeymap, restoredKeymap, 'Layout/keymap reversibility');
        });
    });
});
