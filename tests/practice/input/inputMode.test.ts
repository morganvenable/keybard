import { describe, expect, it } from 'vitest';
import { type InputConditions, inputMode, liveAvailability, PRESSED_KEYS } from '@/features/practice/input/inputMode';

// The §3.2 mode machine and the P4 Pressed keys values (§5.6).

const live: InputConditions = {
    hidSupported: true, connected: true, connectedSource: true, readKeyPresses: true, paranoid: false, paranoidReads: true,
    sampler: true, failed: false, focused: true, visible: true, active: true,
};

describe('input mode (§3.2)', () => {
    it('is Live · USB only when every condition holds', () => {
        expect(inputMode(live)).toBe('usb');
        for (const key of ['hidSupported', 'connected', 'connectedSource', 'readKeyPresses', 'sampler', 'focused', 'visible', 'active'] as const) {
            expect(inputMode({ ...live, [key]: false }), key).toBe('keymap');
        }
        expect(inputMode({ ...live, failed: true })).toBe('keymap');
    });

    it('Paranoid reads only with OWNER_Q4, and then only while focused and visible', () => {
        expect(inputMode({ ...live, paranoid: true })).toBe('usb');
        expect(inputMode({ ...live, paranoid: true, focused: false })).toBe('keymap');
        expect(inputMode({ ...live, paranoid: true, paranoidReads: false })).toBe('keymap');
        expect(liveAvailability({ ...live, paranoid: true, paranoidReads: false }).pressedKeys).toBe(PRESSED_KEYS.paranoid);
    });

    it('says why pressed keys are not shown, whatever the focus', () => {
        expect(liveAvailability({ ...live, focused: false })).toEqual({ available: true, pressedKeys: 'Shown' });
        expect(liveAvailability({ ...live, hidSupported: false }).pressedKeys).toBe('Not shown · needs Chrome or Edge');
        expect(liveAvailability({ ...live, connected: false }).pressedKeys).toBe('Not shown · connect the board');
        expect(liveAvailability({ ...live, readKeyPresses: false }).pressedKeys).toBe('Not shown · reading is off');
        expect(liveAvailability({ ...live, failed: true }).pressedKeys).toBe("Not shown · the board isn't answering");
    });
});
