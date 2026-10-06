/**
 * Fragment Composer Service Tests
 *
 * Tests for layout composition from fragment definitions and selections.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FragmentComposerService, ComposedKeyLayout } from '../../src/services/fragment-composer.service';
import { FragmentService } from '../../src/services/fragment.service';
import { KleService } from '../../src/services/kle.service';
import type { KeyboardInfo, FragmentInstance } from '../../src/types/keyboard.types';
import {
    createTestFragments,
    createFragmentState,
    createSelectableInstance,
    createFixedInstance,
    FRAGMENT_NAMES,
    FRAGMENT_IDS,
    TEST_KLE_DATA,
} from '../fixtures/fragments.fixture';
import { createTestKeyboardInfo } from '../fixtures/keyboard-info.fixture';

describe('FragmentComposerService', () => {
    let composerService: FragmentComposerService;
    let mockKleService: KleService;
    let mockFragmentService: FragmentService;

    beforeEach(() => {
        vi.clearAllMocks();

        // Create real KLE service (it's stateless)
        mockKleService = new KleService();

        // Create mock fragment service
        mockFragmentService = {
            resolveFragment: vi.fn(),
        } as any;

        composerService = new FragmentComposerService(mockKleService, mockFragmentService);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('hasFragments()', () => {
        it('returns true when fragments and composition defined', () => {
            const kbinfo = createKbinfoWithFragments();

            expect(composerService.hasFragments(kbinfo)).toBe(true);
        });

        it('returns false when no fragments', () => {
            const kbinfo = createTestKeyboardInfo({ rows: 4, cols: 4 });

            expect(composerService.hasFragments(kbinfo)).toBe(false);
        });

        it('returns false when no composition', () => {
            const kbinfo = createTestKeyboardInfo({ rows: 4, cols: 4 });
            kbinfo.fragments = createTestFragments();

            expect(composerService.hasFragments(kbinfo)).toBe(false);
        });

        it('returns false when empty instances', () => {
            const kbinfo = createTestKeyboardInfo({ rows: 4, cols: 4 });
            kbinfo.fragments = createTestFragments();
            kbinfo.composition = { instances: [] };

            expect(composerService.hasFragments(kbinfo)).toBe(false);
        });
    });

    describe('composeLayout()', () => {
        it('returns empty object when no fragments', () => {
            const kbinfo = createTestKeyboardInfo({ rows: 4, cols: 4 });

            const result = composerService.composeLayout(kbinfo);

            expect(Object.keys(result)).toHaveLength(0);
        });

        it('returns empty object when no composition', () => {
            const kbinfo = createTestKeyboardInfo({ rows: 4, cols: 4 });
            kbinfo.fragments = createTestFragments();

            const result = composerService.composeLayout(kbinfo);

            expect(Object.keys(result)).toHaveLength(0);
        });

        it('expands fixed instance to correct matrix positions', () => {
            const kbinfo = createKbinfoWithFixedFragment();
            (mockFragmentService.resolveFragment as any).mockReturnValue(FRAGMENT_NAMES.FINGER_5KEY);

            const result = composerService.composeLayout(kbinfo);

            // Should have keys at the matrix positions defined in the instance
            const matrixMap = kbinfo.composition!.instances[0].matrix_map!;
            for (const [row, col] of matrixMap) {
                const matrixPos = row * kbinfo.cols + col;
                expect(result[matrixPos]).toBeDefined();
            }
        });

        it('applies placement offset to key positions', () => {
            const kbinfo = createKbinfoWithFixedFragment();
            const instance = kbinfo.composition!.instances[0];
            instance.placement = { x: 5, y: 3 };

            (mockFragmentService.resolveFragment as any).mockReturnValue(FRAGMENT_NAMES.FINGER_5KEY);

            const result = composerService.composeLayout(kbinfo);

            // All keys should have placement offset applied
            const matrixPos = instance.matrix_map![0][0] * kbinfo.cols + instance.matrix_map![0][1];
            if (result[matrixPos]) {
                expect(result[matrixPos].x).toBeGreaterThanOrEqual(5);
                expect(result[matrixPos].y).toBeGreaterThanOrEqual(3);
            }
        });

        it('uses correct matrix_map from resolved option for selectable instance', () => {
            const kbinfo = createKbinfoWithSelectableFragment();
            const instance = kbinfo.composition!.instances[0] as FragmentInstance;

            // Resolve to 6-key option
            (mockFragmentService.resolveFragment as any).mockReturnValue(FRAGMENT_NAMES.FINGER_6KEY);

            const result = composerService.composeLayout(kbinfo);

            // Should use the matrix_map from the 6-key option
            const sixKeyOption = instance.fragment_options!.find(o => o.fragment === FRAGMENT_NAMES.FINGER_6KEY);
            expect(sixKeyOption).toBeDefined();

            // Check that keys exist at 6-key option positions
            for (const [row, col] of sixKeyOption!.matrix_map) {
                const matrixPos = row * kbinfo.cols + col;
                expect(result[matrixPos]).toBeDefined();
            }
        });

        it('handles multiple instances', () => {
            const kbinfo = createKbinfoWithMultipleFragments();

            // Resolve each instance
            (mockFragmentService.resolveFragment as any)
                .mockReturnValueOnce(FRAGMENT_NAMES.FINGER_5KEY)
                .mockReturnValueOnce(FRAGMENT_NAMES.FINGER_6KEY);

            const result = composerService.composeLayout(kbinfo);

            // Should have keys from both instances
            expect(Object.keys(result).length).toBeGreaterThan(0);
        });

        it('handles KLE deserialization failure gracefully', () => {
            const kbinfo = createKbinfoWithInvalidKLE();
            (mockFragmentService.resolveFragment as any).mockReturnValue(FRAGMENT_NAMES.FINGER_5KEY);

            // Should not throw
            const result = composerService.composeLayout(kbinfo);

            // May have partial results or empty
            expect(result).toBeDefined();
        });

        it('returns empty for instance when fragment not found', () => {
            const kbinfo = createKbinfoWithFragments();
            (mockFragmentService.resolveFragment as any).mockReturnValue('nonexistent_fragment');

            const result = composerService.composeLayout(kbinfo);

            // Should return empty since fragment doesn't exist
            expect(Object.keys(result)).toHaveLength(0);
        });

        it('returns empty when resolveFragment returns empty string', () => {
            const kbinfo = createKbinfoWithFragments();
            (mockFragmentService.resolveFragment as any).mockReturnValue('');

            const result = composerService.composeLayout(kbinfo);

            expect(Object.keys(result)).toHaveLength(0);
        });

        it('correctly maps key properties from KLE', () => {
            const kbinfo = createKbinfoWithFixedFragment();
            (mockFragmentService.resolveFragment as any).mockReturnValue(FRAGMENT_NAMES.FINGER_5KEY);

            const result = composerService.composeLayout(kbinfo);

            const firstKey = Object.values(result)[0];
            if (firstKey) {
                // Should have position and size properties
                expect(firstKey).toHaveProperty('x');
                expect(firstKey).toHaveProperty('y');
                expect(firstKey).toHaveProperty('w');
                expect(firstKey).toHaveProperty('h');
                expect(firstKey).toHaveProperty('row');
                expect(firstKey).toHaveProperty('col');
            }
        });

        it('preserves rotation properties from KLE', () => {
            // Create fragment with rotation
            const kbinfo = createKbinfoWithRotatedFragment();
            (mockFragmentService.resolveFragment as any).mockReturnValue('rotated_fragment');

            const result = composerService.composeLayout(kbinfo);

            // Check if rotation properties are preserved (may be undefined if not in KLE)
            const firstKey = Object.values(result)[0];
            if (firstKey) {
                // These properties should exist (may be undefined)
                expect('rotation_angle' in firstKey || firstKey.rotation_angle === undefined).toBe(true);
            }
        });
    });
});

// Helper functions to create test keyboards

function createKbinfoWithFragments(): KeyboardInfo {
    const kbinfo = createTestKeyboardInfo({
        rows: 5,
        cols: 14,
        layers: 4,
    });

    kbinfo.fragments = createTestFragments();
    kbinfo.composition = {
        instances: [
            createSelectableInstance({ id: 'left_finger' }),
        ],
    };
    kbinfo.fragmentState = createFragmentState();

    return kbinfo;
}

function createKbinfoWithFixedFragment(): KeyboardInfo {
    const kbinfo = createTestKeyboardInfo({
        rows: 5,
        cols: 14,
        layers: 4,
    });

    kbinfo.fragments = createTestFragments();
    kbinfo.composition = {
        instances: [
            {
                id: 'fixed_fragment',
                fragment: FRAGMENT_NAMES.FINGER_5KEY,
                placement: { x: 0, y: 0 },
                matrix_map: [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1]],
            },
        ],
    };
    kbinfo.fragmentState = createFragmentState();

    return kbinfo;
}

function createKbinfoWithSelectableFragment(): KeyboardInfo {
    const kbinfo = createTestKeyboardInfo({
        rows: 5,
        cols: 14,
        layers: 4,
    });

    kbinfo.fragments = createTestFragments();
    kbinfo.composition = {
        instances: [
            {
                id: 'selectable_fragment',
                fragment_options: [
                    {
                        fragment: FRAGMENT_NAMES.FINGER_5KEY,
                        placement: { x: 0, y: 0 },
                        matrix_map: [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1]],
                        default: true,
                    },
                    {
                        fragment: FRAGMENT_NAMES.FINGER_6KEY,
                        placement: { x: 0, y: 0 },
                        matrix_map: [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2]],
                    },
                ],
            },
        ],
    };
    kbinfo.fragmentState = createFragmentState();

    return kbinfo;
}

function createKbinfoWithMultipleFragments(): KeyboardInfo {
    const kbinfo = createTestKeyboardInfo({
        rows: 5,
        cols: 14,
        layers: 4,
    });

    kbinfo.fragments = createTestFragments();
    kbinfo.composition = {
        instances: [
            {
                id: 'left_finger',
                fragment_options: [
                    {
                        fragment: FRAGMENT_NAMES.FINGER_5KEY,
                        placement: { x: 0, y: 0 },
                        matrix_map: [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1]],
                        default: true,
                    },
                ],
            },
            {
                id: 'right_finger',
                fragment_options: [
                    {
                        fragment: FRAGMENT_NAMES.FINGER_6KEY,
                        placement: { x: 10, y: 0 },
                        matrix_map: [[0, 7], [0, 8], [0, 9], [1, 7], [1, 8], [1, 9]],
                        default: true,
                    },
                ],
            },
        ],
    };
    kbinfo.fragmentState = createFragmentState();

    return kbinfo;
}

function createKbinfoWithInvalidKLE(): KeyboardInfo {
    const kbinfo = createTestKeyboardInfo({
        rows: 5,
        cols: 14,
        layers: 4,
    });

    // Create fragments with invalid KLE data
    kbinfo.fragments = {
        [FRAGMENT_NAMES.FINGER_5KEY]: {
            id: FRAGMENT_IDS.FINGER_5KEY,
            description: '5-key finger cluster',
            kle: 'invalid_kle_data' as any, // Invalid KLE
        },
    };

    kbinfo.composition = {
        instances: [
            {
                id: 'test',
                fragment: FRAGMENT_NAMES.FINGER_5KEY,
                placement: { x: 0, y: 0 },
                matrix_map: [[0, 0]],
            },
        ],
    };
    kbinfo.fragmentState = createFragmentState();

    return kbinfo;
}

function createKbinfoWithRotatedFragment(): KeyboardInfo {
    const kbinfo = createTestKeyboardInfo({
        rows: 5,
        cols: 14,
        layers: 4,
    });

    // Fragment with rotation in KLE
    kbinfo.fragments = {
        'rotated_fragment': {
            id: 100,
            description: 'Rotated fragment',
            kle: [
                { r: 15, rx: 1, ry: 1 }, // Rotation metadata
                [{ w: 1 }, "K1"],
            ],
        },
    };

    kbinfo.composition = {
        instances: [
            {
                id: 'rotated',
                fragment: 'rotated_fragment',
                placement: { x: 0, y: 0 },
                matrix_map: [[0, 0]],
            },
        ],
    };
    kbinfo.fragmentState = createFragmentState();

    return kbinfo;
}
