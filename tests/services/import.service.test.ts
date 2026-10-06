/**
 * Import Service Tests
 *
 * Tests for syncing keyboard configuration from file to connected device.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { importService, ImportService } from '../../src/services/import.service';
import type { KeyboardInfo } from '../../src/types/keyboard.types';
import { createTestKeyboardInfo } from '../fixtures/keyboard-info.fixture';
import { generateComplexKeymap } from '../utils/keymap-helpers';

describe('ImportService', () => {
    let service: ImportService;
    let mockQueue: ReturnType<typeof vi.fn>;
    let mockServices: {
        keyboardService: {
            saveSvil: ReturnType<typeof vi.fn>;
            updateKey: ReturnType<typeof vi.fn>;
            updateMacros: ReturnType<typeof vi.fn>;
            updateCombo: ReturnType<typeof vi.fn>;
            updateTapdance: ReturnType<typeof vi.fn>;
            updateKeyoverride: ReturnType<typeof vi.fn>;
            updateQMKSetting: ReturnType<typeof vi.fn>;
        };
    };

    beforeEach(() => {
        vi.clearAllMocks();

        service = new ImportService();

        // Create mock queue function that immediately executes the callback
        mockQueue = vi.fn().mockImplementation(async (desc, cb, metadata) => {
            await cb();
        });

        // Create mock services
        mockServices = {
            keyboardService: {
                saveSvil: vi.fn().mockResolvedValue(undefined),
                updateKey: vi.fn().mockResolvedValue(undefined),
                updateMacros: vi.fn().mockResolvedValue(undefined),
                updateCombo: vi.fn().mockResolvedValue(undefined),
                updateTapdance: vi.fn().mockResolvedValue(undefined),
                updateKeyoverride: vi.fn().mockResolvedValue(undefined),
                updateQMKSetting: vi.fn().mockResolvedValue(undefined),
            },
        };
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('stages the persistent save after all imported writes without executing before Apply', async () => {
        const currentKb = createTestKeyboardInfo({ rows: 1, cols: 1, layers: 1, keymap: [[4]] });
        const imported = { ...currentKb, keymap: [[5]] };
        const staged: Array<{ cb: () => Promise<void>; key: string }> = [];
        await service.syncWithKeyboard(imported, currentKb, async (_desc, cb, metadata) => { staged.push({ cb, key: metadata?.writeKey ?? '' }); }, mockServices);
        expect(mockServices.keyboardService.updateKey).not.toHaveBeenCalled();
        expect(mockServices.keyboardService.saveSvil).not.toHaveBeenCalled();
        expect(staged.map(write => write.key)).toEqual(['key:0:0:0', 'save-svil']);
        for (const write of staged) await write.cb();
        expect(mockServices.keyboardService.saveSvil).toHaveBeenCalledTimes(1);
        expect(mockServices.keyboardService.saveSvil.mock.invocationCallOrder[0]).toBeGreaterThan(mockServices.keyboardService.updateKey.mock.invocationCallOrder[0]);
    });

    it('propagates a refused persistent save so it remains retryable', async () => {
        const currentKb = createTestKeyboardInfo({ rows: 1, cols: 1, layers: 1, keymap: [[4]] });
        const imported = { ...currentKb, keymap: [[5]] };
        mockServices.keyboardService.saveSvil.mockRejectedValue(new Error('Flash save failed'));
        await expect(service.syncWithKeyboard(imported, currentKb, mockQueue, mockServices)).rejects.toThrow('Flash save failed');
    });

    describe('syncWithKeyboard()', () => {
        describe('Keymap Sync', () => {
            it('syncs keymap differences to device', async () => {
                const currentKb = createTestKeyboardInfo({
                    rows: 2,
                    cols: 2,
                    layers: 1,
                    keymap: [[0x04, 0x05, 0x06, 0x07]], // KC_A, KC_B, KC_C, KC_D
                });

                const newKb = createTestKeyboardInfo({
                    rows: 2,
                    cols: 2,
                    layers: 1,
                    keymap: [[0x08, 0x05, 0x06, 0x07]], // KC_E, KC_B, KC_C, KC_D (only first key changed)
                });

                await service.syncWithKeyboard(newKb, currentKb, mockQueue, mockServices);

                // Should queue one key update
                expect(mockQueue).toHaveBeenCalledWith(
                    expect.stringContaining('Update key'),
                    expect.any(Function),
                    expect.objectContaining({ type: 'key', layer: 0, row: 0, col: 0 })
                );

                // updateKey should be called once
                expect(mockServices.keyboardService.updateKey).toHaveBeenCalledTimes(1);
                expect(mockServices.keyboardService.updateKey).toHaveBeenCalledWith(0, 0, 0, 0x08);
            });

            it('uses hardware dimensions for iteration', async () => {
                // Hardware has 2x2 matrix
                const currentKb = createTestKeyboardInfo({
                    rows: 2,
                    cols: 2,
                    layers: 1,
                    keymap: [[0x04, 0x05, 0x06, 0x07]],
                });

                // File has 3x3 matrix (larger)
                const newKb = createTestKeyboardInfo({
                    rows: 3,
                    cols: 3,
                    layers: 1,
                    keymap: [[0x08, 0x09, 0x0A, 0x0B, 0x0C, 0x0D, 0x0E, 0x0F, 0x10]],
                });

                await service.syncWithKeyboard(newKb, currentKb, mockQueue, mockServices);

                // Should only iterate over hardware dimensions (2x2 = 4 keys)
                // Not the file dimensions (3x3 = 9 keys)
                const keyUpdateCalls = mockServices.keyboardService.updateKey.mock.calls;

                // All calls should have row < 2 and col < 2
                keyUpdateCalls.forEach(call => {
                    const [layer, row, col] = call;
                    expect(row).toBeLessThan(2);
                    expect(col).toBeLessThan(2);
                });
            });

            it('preserves macros_size from connected keyboard', async () => {
                const currentKb = createTestKeyboardInfo({
                    rows: 2,
                    cols: 2,
                    layers: 1,
                    keymap: [[0x04, 0x05, 0x06, 0x07]],
                    macros_size: 1024,
                });

                const newKb = createTestKeyboardInfo({
                    rows: 2,
                    cols: 2,
                    layers: 1,
                    keymap: [[0x04, 0x05, 0x06, 0x07]],
                    macros_size: 512, // File has different size
                });

                await service.syncWithKeyboard(newKb, currentKb, mockQueue, mockServices);

                // newKb should now have hardware's macros_size
                expect(newKb.macros_size).toBe(1024);
            });

            it('does not sync unchanged keys', async () => {
                const currentKb = createTestKeyboardInfo({
                    rows: 2,
                    cols: 2,
                    layers: 1,
                    keymap: [[0x04, 0x05, 0x06, 0x07]],
                });

                const newKb = createTestKeyboardInfo({
                    rows: 2,
                    cols: 2,
                    layers: 1,
                    keymap: [[0x04, 0x05, 0x06, 0x07]], // Same as current
                });

                await service.syncWithKeyboard(newKb, currentKb, mockQueue, mockServices);

                // No key updates should be queued
                expect(mockServices.keyboardService.updateKey).not.toHaveBeenCalled();
            });

            it('handles missing keymap in newKb', async () => {
                const currentKb = createTestKeyboardInfo({
                    rows: 2,
                    cols: 2,
                    layers: 1,
                    keymap: [[0x04, 0x05, 0x06, 0x07]],
                });

                const newKb = createTestKeyboardInfo({
                    rows: 2,
                    cols: 2,
                    layers: 1,
                });
                newKb.keymap = undefined;

                await service.syncWithKeyboard(newKb, currentKb, mockQueue, mockServices);

                // Should not throw, no key updates
                expect(mockServices.keyboardService.updateKey).not.toHaveBeenCalled();
            });
        });

        describe('Macro Sync', () => {
            it('syncs macros when they differ', async () => {
                const currentKb = createTestKeyboardInfo({
                    rows: 2,
                    cols: 2,
                    layers: 1,
                    keymap: [[0x04, 0x05, 0x06, 0x07]],
                    macros: [{ mid: 0, actions: [['text', 'hello']] }] as any,
                });

                const newKb = createTestKeyboardInfo({
                    rows: 2,
                    cols: 2,
                    layers: 1,
                    keymap: [[0x04, 0x05, 0x06, 0x07]],
                    macros: [{ mid: 0, actions: [['text', 'world']] }] as any, // Different
                });

                await service.syncWithKeyboard(newKb, currentKb, mockQueue, mockServices);

                expect(mockQueue).toHaveBeenCalledWith(
                    'Update All Macros',
                    expect.any(Function),
                    { type: 'macro', writeKey: 'macros' }
                );
                expect(mockServices.keyboardService.updateMacros).toHaveBeenCalledWith(newKb);
            });

            it('does not sync macros when unchanged', async () => {
                const macros = [{ mid: 0, actions: [['text', 'hello']] }] as any;

                const currentKb = createTestKeyboardInfo({
                    rows: 2,
                    cols: 2,
                    layers: 1,
                    keymap: [[0x04, 0x05, 0x06, 0x07]],
                    macros: JSON.parse(JSON.stringify(macros)),
                });

                const newKb = createTestKeyboardInfo({
                    rows: 2,
                    cols: 2,
                    layers: 1,
                    keymap: [[0x04, 0x05, 0x06, 0x07]],
                    macros: JSON.parse(JSON.stringify(macros)), // Same
                });

                await service.syncWithKeyboard(newKb, currentKb, mockQueue, mockServices);

                expect(mockServices.keyboardService.updateMacros).not.toHaveBeenCalled();
            });
        });

        describe('Combo Sync', () => {
            it('syncs individual combos that differ', async () => {
                const currentKb = createTestKeyboardInfo({
                    rows: 2,
                    cols: 2,
                    layers: 1,
                    keymap: [[0x04, 0x05, 0x06, 0x07]],
                    combos: [
                        { cmbid: 0, keys: ['KC_A', 'KC_B'], output: 'KC_C' },
                        { cmbid: 1, keys: ['KC_D', 'KC_E'], output: 'KC_F' },
                    ] as any,
                });

                const newKb = createTestKeyboardInfo({
                    rows: 2,
                    cols: 2,
                    layers: 1,
                    keymap: [[0x04, 0x05, 0x06, 0x07]],
                    combos: [
                        { cmbid: 0, keys: ['KC_A', 'KC_B'], output: 'KC_D' }, // Changed output
                        { cmbid: 1, keys: ['KC_D', 'KC_E'], output: 'KC_F' }, // Same
                    ] as any,
                });

                await service.syncWithKeyboard(newKb, currentKb, mockQueue, mockServices);

                expect(mockQueue).toHaveBeenCalledWith(
                    'Update Combo 0',
                    expect.any(Function),
                    { type: 'combo', comboId: 0, writeKey: 'combo:0' }
                );
            });
        });

        describe('Tapdance Sync', () => {
            it('syncs individual tapdances that differ', async () => {
                const currentKb = createTestKeyboardInfo({
                    rows: 2,
                    cols: 2,
                    layers: 1,
                    keymap: [[0x04, 0x05, 0x06, 0x07]],
                    tapdances: [
                        { idx: 0, tap: 'KC_A', hold: 'KC_B', doubletap: 'KC_C', taphold: 'KC_D', tapping_term: 200 },
                    ] as any,
                });

                const newKb = createTestKeyboardInfo({
                    rows: 2,
                    cols: 2,
                    layers: 1,
                    keymap: [[0x04, 0x05, 0x06, 0x07]],
                    tapdances: [
                        { idx: 0, tap: 'KC_E', hold: 'KC_B', doubletap: 'KC_C', taphold: 'KC_D', tapping_term: 200 }, // Changed tap
                    ] as any,
                });

                await service.syncWithKeyboard(newKb, currentKb, mockQueue, mockServices);

                expect(mockQueue).toHaveBeenCalledWith(
                    'Update Tapdance 0',
                    expect.any(Function),
                    { type: 'tapdance', tapdanceId: 0, writeKey: 'tapdance:0' }
                );
            });
        });

        describe('Key Override Sync', () => {
            it('syncs individual key overrides that differ', async () => {
                const currentKb = createTestKeyboardInfo({
                    rows: 2,
                    cols: 2,
                    layers: 1,
                    keymap: [[0x04, 0x05, 0x06, 0x07]],
                    key_overrides: [
                        { koid: 0, trigger: 'KC_A', replacement: 'KC_B', layers: 0xFFFF },
                    ] as any,
                });

                const newKb = createTestKeyboardInfo({
                    rows: 2,
                    cols: 2,
                    layers: 1,
                    keymap: [[0x04, 0x05, 0x06, 0x07]],
                    key_overrides: [
                        { koid: 0, trigger: 'KC_A', replacement: 'KC_C', layers: 0xFFFF }, // Changed replacement
                    ] as any,
                });

                await service.syncWithKeyboard(newKb, currentKb, mockQueue, mockServices);

                expect(mockQueue).toHaveBeenCalledWith(
                    'Update Key Override 0',
                    expect.any(Function),
                    { type: 'override', writeKey: 'override:0' }
                );
            });
        });

        describe('QMK Settings Sync', () => {
            it('syncs individual QMK settings that differ', async () => {
                const currentKb = createTestKeyboardInfo({
                    rows: 2,
                    cols: 2,
                    layers: 1,
                    keymap: [[0x04, 0x05, 0x06, 0x07]],
                    settings: { 0: 100, 1: 200 },
                });

                const newKb = createTestKeyboardInfo({
                    rows: 2,
                    cols: 2,
                    layers: 1,
                    keymap: [[0x04, 0x05, 0x06, 0x07]],
                    settings: { 0: 150, 1: 200 }, // Setting 0 changed
                });

                await service.syncWithKeyboard(newKb, currentKb, mockQueue, mockServices);

                expect(mockQueue).toHaveBeenCalledWith(
                    'Update QMK Setting 0',
                    expect.any(Function),
                    { type: 'key', writeKey: 'setting:0' }
                );
            });
        });

        describe('Edge Cases', () => {
            it('handles null currentKb', async () => {
                const newKb = createTestKeyboardInfo({
                    rows: 2,
                    cols: 2,
                    layers: 1,
                    keymap: [[0x04, 0x05, 0x06, 0x07]],
                });

                // Should not throw
                await service.syncWithKeyboard(newKb, null as any, mockQueue, mockServices);

                // No updates should be queued
                expect(mockQueue).not.toHaveBeenCalled();
            });

            it('handles multiple layers', async () => {
                const currentKb = createTestKeyboardInfo({
                    rows: 2,
                    cols: 2,
                    layers: 2,
                    keymap: [
                        [0x04, 0x05, 0x06, 0x07],
                        [0x08, 0x09, 0x0A, 0x0B],
                    ],
                });

                const newKb = createTestKeyboardInfo({
                    rows: 2,
                    cols: 2,
                    layers: 2,
                    keymap: [
                        [0x04, 0x05, 0x06, 0x07], // Layer 0 same
                        [0x0C, 0x09, 0x0A, 0x0B], // Layer 1 first key changed
                    ],
                });

                await service.syncWithKeyboard(newKb, currentKb, mockQueue, mockServices);

                // Should only update changed key in layer 1
                expect(mockServices.keyboardService.updateKey).toHaveBeenCalledTimes(1);
                expect(mockServices.keyboardService.updateKey).toHaveBeenCalledWith(1, 0, 0, 0x0C);
            });

            it('handles different layer counts (uses minimum)', async () => {
                const currentKb = createTestKeyboardInfo({
                    rows: 2,
                    cols: 2,
                    layers: 4,
                    keymap: [
                        [0x04, 0x05, 0x06, 0x07],
                        [0x08, 0x09, 0x0A, 0x0B],
                        [0x0C, 0x0D, 0x0E, 0x0F],
                        [0x10, 0x11, 0x12, 0x13],
                    ],
                });

                const newKb = createTestKeyboardInfo({
                    rows: 2,
                    cols: 2,
                    layers: 2, // File has fewer layers
                    keymap: [
                        [0xFF, 0xFF, 0xFF, 0xFF], // All different
                        [0xFF, 0xFF, 0xFF, 0xFF],
                    ],
                });

                await service.syncWithKeyboard(newKb, currentKb, mockQueue, mockServices);

                // Should only sync layers 0 and 1 (min of 2, 4)
                const calls = mockServices.keyboardService.updateKey.mock.calls;
                calls.forEach(call => {
                    expect(call[0]).toBeLessThan(2); // Layer should be 0 or 1
                });
            });
        });
    });
});
