// D39: a firmware update resets the board's settings, and Keybard puts the layout it
// saved before the update back afterwards. Combo names ride in that .svil: on firmware
// that stores them they are written back to the board; on older firmware they stay in
// Keybard (the draft, then this browser and backups).
import { describe, expect, it, vi } from 'vitest';
import { fileService } from '../../src/services/file.service';
import { restoreLayoutToBoard } from '../../src/features/firmware/restore';
import { usbInstance, SvilUSB } from '../../src/services/usb.service';
import { ComboOptions, type ComboEntry, type KeyboardInfo } from '../../src/types/keyboard.types';

vi.mock('@/services/keyboard.service', () => ({ keyboardService: { updateCombo: vi.fn(async () => {}), saveSvil: vi.fn(async () => {}) } }));

const ON = ComboOptions.ENABLED;
const combo = (keys: string[], output: string, options = ON): ComboEntry => ({ cmbid: 0, keys: [...keys, 'KC_NO', 'KC_NO', 'KC_NO', 'KC_NO'].slice(0, 4), output, options });
const blank = () => combo([], 'KC_NO', 0);
const board = (overrides: Partial<KeyboardInfo> = {}): KeyboardInfo => ({
    rows: 1, cols: 2, layers: 1, keymap: [[4, 5]], svil_proto: 3,
    macros: [], macro_count: 0, macros_size: 64,
    combos: [blank(), blank(), blank()].map((c, cmbid) => ({ ...c, cmbid })),
    combo_count: 3, tapdances: [], tapdance_count: 0, key_overrides: [], key_override_count: 0,
    cosmetic: {},
    ...overrides,
});

// The layout saved before the update: two named combos.
const saved = board({
    combos: [combo(['KC_J', 'KC_K'], 'KC_ESC'), combo(['KC_D', 'KC_F'], 'KC_ENTER'), blank()].map((c, cmbid) => ({ ...c, cmbid })),
    cosmetic: { combos: { '0': 'Dictation', '1': 'Zoom mute' } },
});

async function restoreOnto(reset: KeyboardInfo) {
    const svil = fileService.kbinfoToSvil(structuredClone(saved), true);
    usbInstance.svilProtocolVersion = 3; // what connecting to this board set
    const writes: Array<[number, number[]]> = [];
    const send = vi.spyOn(usbInstance, 'sendSvil').mockImplementation(async (cmd: number, args: number[]) => {
        writes.push([cmd, args]);
        return Uint8Array.of(cmd, 0) as never;
    });
    const queued: Array<() => Promise<void>> = [];
    let shown: KeyboardInfo | null = null;
    let markedSaved: KeyboardInfo | null = null;
    await restoreLayoutToBoard(svil, {
        keyboard: reset,
        setKeyboard: kb => { shown = kb; },
        queue: async (_desc, cb) => { queued.push(cb); },
        commit: async () => { for (const cb of queued) await cb(); return true; },
        markSaved: kb => { markedSaved = kb; },
    });
    send.mockRestore();
    const labelSets = writes.filter(([cmd, args]) => cmd === SvilUSB.CMD_SVIL_LABEL_SET && args[0] === SvilUSB.SVIL_LABEL_TYPE_COMBO)
        .map(([, args]) => [args[1] | (args[2] << 8), new TextDecoder().decode(Uint8Array.from(args.slice(3)).filter(Boolean))]);
    return { labelSets, shown: shown as KeyboardInfo | null, markedSaved: markedSaved as KeyboardInfo | null };
}

describe("the update's layout restore carries combo names", () => {
    it('writes them back to a board that stores combo names', async () => {
        const { labelSets, markedSaved } = await restoreOnto(board({ feature_flags2: 0x80 }));
        expect(labelSets).toEqual([[0, 'Dictation'], [1, 'Zoom mute']]);
        expect(markedSaved?.cosmetic?.combos).toEqual({ '0': 'Dictation', '1': 'Zoom mute' });
    });

    it('keeps them in Keybard on firmware that does not store them, with no combo label writes', async () => {
        const { labelSets, shown, markedSaved } = await restoreOnto(board({ feature_flags2: 0x01 }));
        expect(labelSets).toEqual([]);
        expect(shown?.cosmetic?.combos).toEqual({ '0': 'Dictation', '1': 'Zoom mute' });
        expect(markedSaved?.cosmetic?.combos).toEqual({ '0': 'Dictation', '1': 'Zoom mute' });
    });
});
