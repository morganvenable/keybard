/**
 * Keymap Test Helpers
 *
 * Utilities for testing keymap data integrity through save/load cycles
 * and fragment transformations.
 */

import { expect } from 'vitest';
import type { KeyboardInfo, FragmentState } from '../../src/types/keyboard.types';
import { createTestKeyboardInfo } from '../fixtures/keyboard-info.fixture';
import { createTestFragments, createSelectableInstance, createFragmentState, FRAGMENT_NAMES, FRAGMENT_IDS } from '../fixtures/fragments.fixture';

/**
 * Generate a complex keymap with varied key types for thorough testing
 *
 * @param rows - Number of matrix rows
 * @param cols - Number of matrix columns
 * @param layers - Number of layers
 * @returns Keymap array where keymap[layer][row * cols + col] = keycode
 */
export function generateComplexKeymap(rows: number, cols: number, layers: number): number[][] {
    const keymap: number[][] = [];
    const totalKeys = rows * cols;

    for (let layer = 0; layer < layers; layer++) {
        const layerKeys: number[] = [];
        for (let pos = 0; pos < totalKeys; pos++) {
            // Generate a variety of keycode types based on position
            const type = (layer * totalKeys + pos) % 12;
            let keycode: number;

            switch (type) {
                case 0:
                    keycode = 0x0000; // KC_NO
                    break;
                case 1:
                    keycode = 0x0001; // KC_TRNS
                    break;
                case 2:
                    keycode = 0x04 + (pos % 26); // Basic letters KC_A-KC_Z
                    break;
                case 3:
                    keycode = 0x1E + (pos % 10); // Numbers KC_1-KC_0
                    break;
                case 4:
                    keycode = 0x5700 + (pos % 128); // Macro M0-M127
                    break;
                case 5:
                    keycode = 0x5740 + (pos % 255); // Tap dance TD0-TD254
                    break;
                case 6:
                    keycode = 0x5100 + (pos % 32); // MO(layer)
                    break;
                case 7:
                    keycode = 0x5200 + (pos % 32); // TO(layer)
                    break;
                case 8:
                    keycode = 0x5300 + (pos % 32); // TG(layer)
                    break;
                case 9:
                    keycode = 0x5400 + (pos % 32); // DF(layer)
                    break;
                case 10:
                    keycode = 0x0100 + (0x04 + (pos % 26)); // LCTL(KC_A-KC_Z)
                    break;
                case 11:
                    keycode = 0x7E40 + (pos % 64); // USER00-USER63
                    break;
                default:
                    keycode = 0x3A + (pos % 12); // Function keys F1-F12
                    break;
            }
            layerKeys.push(keycode);
        }
        keymap.push(layerKeys);
    }

    return keymap;
}

/**
 * Assert two keymaps are equal with detailed error messages
 *
 * @param expected - Expected keymap
 * @param actual - Actual keymap
 * @param message - Optional prefix message for errors
 */
export function assertKeymapsEqual(
    expected: number[][],
    actual: number[][],
    message?: string
): void {
    const prefix = message ? `${message}: ` : '';

    expect(actual.length).toBe(
        expected.length,
        `${prefix}Layer count mismatch: expected ${expected.length}, got ${actual.length}`
    );

    for (let layer = 0; layer < expected.length; layer++) {
        expect(actual[layer].length).toBe(
            expected[layer].length,
            `${prefix}Layer ${layer} key count mismatch: expected ${expected[layer].length}, got ${actual[layer].length}`
        );

        for (let pos = 0; pos < expected[layer].length; pos++) {
            expect(actual[layer][pos]).toBe(
                expected[layer][pos],
                `${prefix}Keycode mismatch at layer ${layer}, position ${pos}: ` +
                `expected 0x${expected[layer][pos].toString(16)}, ` +
                `got 0x${actual[layer][pos].toString(16)}`
            );
        }
    }
}

/**
 * Assert keymap preserves all keys through a transformation
 * Allows for different layout sizes by checking common positions
 *
 * @param original - Original keymap
 * @param transformed - Transformed keymap
 * @param originalCols - Columns in original matrix
 * @param transformedCols - Columns in transformed matrix
 */
export function assertKeysPreserved(
    original: number[][],
    transformed: number[][],
    originalCols: number,
    transformedCols: number
): void {
    // Check all layers exist
    expect(transformed.length).toBe(original.length, 'Layer count should be preserved');

    for (let layer = 0; layer < original.length; layer++) {
        const originalKeys = original[layer];
        const transformedKeys = transformed[layer];
        const originalRows = originalKeys.length / originalCols;
        const transformedRows = transformedKeys.length / transformedCols;

        // Check all positions that exist in both layouts
        const commonRows = Math.min(originalRows, transformedRows);
        const commonCols = Math.min(originalCols, transformedCols);

        for (let row = 0; row < commonRows; row++) {
            for (let col = 0; col < commonCols; col++) {
                const origPos = row * originalCols + col;
                const transPos = row * transformedCols + col;

                expect(transformedKeys[transPos]).toBe(
                    originalKeys[origPos],
                    `Key at layer ${layer}, row ${row}, col ${col} not preserved: ` +
                    `expected 0x${originalKeys[origPos].toString(16)}, ` +
                    `got 0x${transformedKeys[transPos].toString(16)}`
                );
            }
        }
    }
}

/**
 * Create a KeyboardInfo with fragments configured for testing
 */
export function createKbinfoWithFragments(options?: {
    rows?: number;
    cols?: number;
    layers?: number;
    use5Key?: boolean;
    use6Key?: boolean;
    withUserSelections?: boolean;
    customKeymap?: number[][];
}): KeyboardInfo {
    const {
        rows = 5,
        cols = 14,
        layers = 4,
        use5Key = true,
        use6Key = false,
        withUserSelections = false,
        customKeymap,
    } = options ?? {};

    const kbinfo = createTestKeyboardInfo({
        rows,
        cols,
        layers,
        kbid: 'ABCDEF1234567890', // Valid hex for BigInt conversion
    });

    // Add fragments
    kbinfo.fragments = createTestFragments();

    // Add composition with selectable instances
    kbinfo.composition = {
        instances: [
            createSelectableInstance({ id: 'left_finger' }),
            createSelectableInstance({ id: 'right_finger' }),
        ],
    };

    // Set up fragment state based on options
    const fragmentState: FragmentState = {
        hwDetection: new Map(),
        eepromSelections: new Map(),
        userSelections: new Map(),
    };

    if (use5Key) {
        fragmentState.hwDetection.set(0, FRAGMENT_IDS.FINGER_5KEY);
        fragmentState.hwDetection.set(1, FRAGMENT_IDS.FINGER_5KEY);
    }

    if (use6Key) {
        fragmentState.hwDetection.set(0, FRAGMENT_IDS.FINGER_6KEY);
        fragmentState.hwDetection.set(1, FRAGMENT_IDS.FINGER_6KEY);
    }

    if (withUserSelections) {
        fragmentState.userSelections.set('left_finger', use6Key ? FRAGMENT_NAMES.FINGER_6KEY : FRAGMENT_NAMES.FINGER_5KEY);
        fragmentState.userSelections.set('right_finger', use6Key ? FRAGMENT_NAMES.FINGER_6KEY : FRAGMENT_NAMES.FINGER_5KEY);
    }

    kbinfo.fragmentState = fragmentState;

    // Set keymap
    if (customKeymap) {
        kbinfo.keymap = customKeymap;
    } else {
        kbinfo.keymap = generateComplexKeymap(rows, cols, layers);
    }

    return kbinfo;
}

/**
 * Convert keymap to layout format (as stored in .svil files)
 * layout[layer][row][col] = keycode
 */
export function keymapToLayout(
    keymap: number[][],
    rows: number,
    cols: number
): number[][][] {
    const layout: number[][][] = [];

    for (const layerKeys of keymap) {
        const layer: number[][] = [];
        for (let row = 0; row < rows; row++) {
            const rowKeys: number[] = [];
            for (let col = 0; col < cols; col++) {
                const pos = row * cols + col;
                rowKeys.push(layerKeys[pos] ?? 0);
            }
            layer.push(rowKeys);
        }
        layout.push(layer);
    }

    return layout;
}

/**
 * Convert layout format back to keymap (flat array per layer)
 * keymap[layer][row * cols + col] = keycode
 */
export function layoutToKeymap(layout: number[][][], cols: number): number[][] {
    const keymap: number[][] = [];

    for (const layer of layout) {
        const layerKeys: number[] = [];
        for (const row of layer) {
            for (const keycode of row) {
                layerKeys.push(keycode);
            }
        }
        keymap.push(layerKeys);
    }

    return keymap;
}

/**
 * Create a mock .svil file content
 */
export function createSvilFileContent(kbinfo: KeyboardInfo): Record<string, unknown> {
    const svil: Record<string, unknown> = {
        version: 1,
        uid: '0x' + (kbinfo.uid?.toString(16) ?? '0'),
        name: kbinfo.name ?? kbinfo.cosmetic?.name ?? 'Test Keyboard',
        vendorId: kbinfo.vendorId?.toString(16) ?? '0000',
        productId: kbinfo.productId?.toString(16) ?? '0000',
    };

    // Convert keymap to layout format
    if (kbinfo.keymap && kbinfo.rows && kbinfo.cols) {
        svil.layout = keymapToLayout(kbinfo.keymap as number[][], kbinfo.rows, kbinfo.cols);
    }

    // Include fragments if present
    if (kbinfo.fragments) {
        svil.fragments = kbinfo.fragments;
    }

    if (kbinfo.composition) {
        svil.composition = kbinfo.composition;
    }

    // Save resolved fragment selections
    if (kbinfo.fragmentState?.userSelections && kbinfo.fragmentState.userSelections.size > 0) {
        svil.fragment_selections = Object.fromEntries(kbinfo.fragmentState.userSelections);
    }

    return svil;
}

/**
 * Verify keycode type detection
 */
export const KEYCODE_TYPES = {
    isKC_NO: (code: number) => code === 0x0000,
    isKC_TRNS: (code: number) => code === 0x0001,
    isBasicKey: (code: number) => code >= 0x04 && code <= 0xFF,
    isMacro: (code: number) => code >= 0x5700 && code < 0x5740,
    isTapDance: (code: number) => code >= 0x5740 && code < 0x5800,
    isMO: (code: number) => code >= 0x5100 && code < 0x5120,
    isTO: (code: number) => code >= 0x5200 && code < 0x5220,
    isTG: (code: number) => code >= 0x5300 && code < 0x5320,
    isDF: (code: number) => code >= 0x5400 && code < 0x5420,
    isModifiedKey: (code: number) => (code & 0xFF00) >= 0x0100 && (code & 0xFF00) <= 0x1F00,
    isUserKey: (code: number) => code >= 0x7E40 && code < 0x7E80,
};

/**
 * Count keycodes by type in a keymap
 */
export function countKeycodeTypes(keymap: number[][]): Record<string, number> {
    const counts: Record<string, number> = {
        KC_NO: 0,
        KC_TRNS: 0,
        basic: 0,
        macro: 0,
        tapDance: 0,
        layerMO: 0,
        layerTO: 0,
        layerTG: 0,
        layerDF: 0,
        modified: 0,
        user: 0,
        other: 0,
    };

    for (const layer of keymap) {
        for (const code of layer) {
            if (KEYCODE_TYPES.isKC_NO(code)) counts.KC_NO++;
            else if (KEYCODE_TYPES.isKC_TRNS(code)) counts.KC_TRNS++;
            else if (KEYCODE_TYPES.isMacro(code)) counts.macro++;
            else if (KEYCODE_TYPES.isTapDance(code)) counts.tapDance++;
            else if (KEYCODE_TYPES.isMO(code)) counts.layerMO++;
            else if (KEYCODE_TYPES.isTO(code)) counts.layerTO++;
            else if (KEYCODE_TYPES.isTG(code)) counts.layerTG++;
            else if (KEYCODE_TYPES.isDF(code)) counts.layerDF++;
            else if (KEYCODE_TYPES.isModifiedKey(code)) counts.modified++;
            else if (KEYCODE_TYPES.isUserKey(code)) counts.user++;
            else if (KEYCODE_TYPES.isBasicKey(code)) counts.basic++;
            else counts.other++;
        }
    }

    return counts;
}

/**
 * Create mock File object for testing file imports
 */
export function createMockFile(content: string | object, filename = 'test.svil'): File {
    const text = typeof content === 'string' ? content : JSON.stringify(content);
    const blob = new Blob([text], { type: 'application/json' });
    return new File([blob], filename, { type: 'application/json' });
}

/**
 * Create a mock Uint8Array USB response
 */
export function createUsbResponse(...bytes: number[]): Uint8Array {
    return new Uint8Array(bytes);
}
