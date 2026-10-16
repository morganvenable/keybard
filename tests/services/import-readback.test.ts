/**
 * Importing a layout file onto a connected board, checked at the byte level:
 * the board must end up holding exactly what the file says, reading it back must
 * give the file's entries, and only entries that differ are written.
 *
 * The two layouts differ in tap dance 0, combo 0 (key order) and the right DPI
 * custom value. Applying either one over the other must write those three
 * entries with that file's values, and nothing else.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fileService } from '../../src/services/file.service';
import { prepareImport } from '../../src/services/import-preflight';
import { ImportService, entryChanged } from '../../src/services/import.service';
import { TapdanceService } from '../../src/services/tapdance.service';
import { ComboService } from '../../src/services/combo.service';
import { customValueService } from '../../src/services/custom-value.service';
import { keyService } from '../../src/services/key.service';
import { usbInstance, type SvilUSB } from '../../src/services/usb.service';
import type { KeyboardInfo } from '../../src/types/keyboard.types';
import { ByteBoard } from '../mocks/byte-board';
import { readbackLayout, READBACK_MENUS, RAW, VALUES, POINT_KEYS, type Version } from '../fixtures/import-readback.fixture';

const parse = (version: Version) => fileService.parseContent(readbackLayout(version));

/** A fake SvilUSB that talks to the byte board. */
function boardUsb(board: ByteBoard) {
    return {
        svilProtocolVersion: 3,
        sendSvil: async (cmd: number, args: number[] = []) => new Uint8Array(board.sval(cmd, [...args])),
    } as unknown as SvilUSB;
}

/** Put one layout on the board as the firmware would hold it. */
function seed(board: ByteBoard, kb: KeyboardInfo) {
    const { rows, cols } = board.shape;
    kb.keymap!.forEach((layer, l) => layer.forEach((code, i) => { board.keymap[l * rows * cols + i] = code; }));
    kb.tapdances!.forEach((td, i) => {
        board.tables[0][i] = ByteBoard.tapdance(keyService.parse(td.tap), keyService.parse(td.hold), keyService.parse(td.doubletap), keyService.parse(td.taphold), td.tapping_term, td.enabled !== false);
    });
    kb.combos!.forEach((c, i) => { board.tables[1][i] = ByteBoard.combo(c.keys.map(k => keyService.parse(k)), keyService.parse(c.output), c.options ?? 0); });
    const refs = new Map(customValueService.extractAllItemsWithRefs(READBACK_MENUS as any).map(({ ref }) => [ref.key, ref]));
    for (const value of kb.custom_values ?? []) {
        const ref = refs.get(value.key)!;
        board.custom.set(`${ref.channel}:${ref.valueId}`, [...value.data]);
    }
    for (const [layer, color] of (kb.layer_colors ?? []).entries()) {
        if (color) board.custom.set(`0:${32 + layer}`, [color.hue, color.sat]);
    }
    board.writes = [];
}

/** The board as Keybard loads it on connect: tables and custom values read back over the protocol. */
async function load(board: ByteBoard, shapeFrom: KeyboardInfo): Promise<KeyboardInfo> {
    const usb = boardUsb(board);
    const { rows, cols, layers } = board.shape;
    const kb = structuredClone(shapeFrom);
    kb.keymap = Array.from({ length: layers }, (_, l) => board.keymap.slice(l * rows * cols, (l + 1) * rows * cols));
    kb.tapdance_count = board.shape.tapdances;
    kb.combo_count = board.shape.combos;
    await new TapdanceService(usb).get(kb);
    await new ComboService(usb).get(kb);
    kb.menus = READBACK_MENUS as any;
    kb.custom_values = await customValueService.loadAllMenuValues(kb.menus!);
    kb.layer_colors = Array.from({ length: layers }, (_, l) => { const [hue, sat] = board.custom.get(`0:${32 + l}`) ?? [0, 0]; return { hue, sat, val: 255 }; });
    kb.svil_proto = 3;
    // This board models no hardware positions (fragments); tests/services/import-restore.test.ts covers those.
    delete kb.fragmentState;
    kb.macros_size = 4096;
    return kb;
}

/** Apply a layout to the board the way the import dialog does, running every write. */
async function apply(board: ByteBoard, fileText: string, current: KeyboardInfo) {
    const file = fileService.parseContent(fileText);
    const review = prepareImport(file, current);
    expect(review.errors).toEqual([]);
    const usb = boardUsb(board);
    const keyboardService = {
        updateKey: async (l: number, r: number, c: number, code: number) => { board.via(0x05, [l, r, c, code >> 8, code & 0xff]); },
        updateTapdance: (kb: KeyboardInfo, i: number) => new TapdanceService(usb).push(kb, i),
        updateCombo: (kb: KeyboardInfo, i: number) => new ComboService(usb).push(kb, i),
        updateMacros: vi.fn(), updateKeyoverride: vi.fn(), updateQMKSetting: vi.fn(), updateAltRepeatKey: vi.fn(), updateLeader: vi.fn(),
        updateFragmentSelection: vi.fn().mockResolvedValue(true),
        saveSvil: async () => { board.sval(0x0b, []); },
    };
    const writes: Array<{ key: string; cb: () => Promise<void> }> = [];
    await new ImportService().syncWithKeyboard(review.keyboard, current, async (_d, cb, meta) => { writes.push({ key: meta?.writeKey ?? '', cb }); }, { keyboardService, labelService: { saveName: vi.fn() } });
    for (const write of writes) await write.cb();
    return { file, planned: writes.map(w => w.key) };
}

describe('import read-back on a byte-level board', () => {
    let board: ByteBoard;
    beforeEach(() => {
        const shape = parse('newer');
        board = new ByteBoard({ tapdances: shape.tapdances!.length, combos: shape.combos!.length, layers: shape.layers!, rows: shape.rows!, cols: shape.cols! });
        vi.spyOn(usbInstance, 'customValueGet').mockImplementation(async (ch: number, id: number, size = 2) => new Uint8Array(board.via(0x08, [ch, id]).slice(3, 3 + size)));
        vi.spyOn(usbInstance, 'customValueSet').mockImplementation(async (ch: number, id: number, data: number[]) => { board.via(0x07, [ch, id, ...data]); });
        vi.spyOn(usbInstance, 'customValueSave').mockImplementation(async (ch: number) => { board.via(0x09, [ch]); });
    });
    afterEach(() => vi.restoreAllMocks());

    it('the fixture names parse to the codes the board stores', () => {
        const kb = parse('newer');
        expect(kb.tapdances![0]).toMatchObject({ tap: 'LCTL(KC_C)', hold: 'LCTL(KC_C)', tapping_term: 200, enabled: true });
        expect(keyService.parse('LCTL(KC_C)')).toBe(0x0106);
        expect(keyService.parse('KC_DQUO')).toBe(0x0234);
        expect(keyService.parse('KC_SPACE')).toBe(0x002c);
        // Pointing tool keys sit in the QK_KB block, never 0 or a fallback.
        for (const [r, c, name] of POINT_KEYS) expect(kb.keymap![14][r * kb.cols! + c]).toBe(keyService.parse(name));
        expect(POINT_KEYS.every(([r, c]) => kb.keymap![14][r * kb.cols! + c] >= 0x7e00 && kb.keymap![14][r * kb.cols! + c] <= 0x7e3f)).toBe(true);
    });

    for (const [from, to] of [['older', 'newer'], ['newer', 'older']] as const) {
        it(`applying the ${to} layout over the ${from} one writes exactly tap dance 0, combo 0 and the right DPI, byte for byte`, async () => {
            seed(board, parse(from));
            const current = await load(board, parse(from));
            const { file, planned } = await apply(board, readbackLayout(to), current);

            expect(planned).toEqual(['combo:0', 'tapdance:0', 'custom:id_right_dpi', 'custom-save:0', 'save-svil']);
            expect(board.writes).toEqual(['combo:0', 'td:0', 'custom:0:2', 'custom-save:0', 'save']);
            expect(board.tables[0][0]).toEqual(RAW[to].td0);
            expect(board.tables[1][0]).toEqual(RAW[to].combo0);
            expect(board.custom.get('0:2')).toEqual(RAW[to].rightDpi);
            // The layer colors, filed under channel 0 ids 0-15, never land on the pointing values there.
            expect(board.custom.get('0:0')).toEqual([4]);

            // Read back: what the board holds now equals the file, entry by entry.
            const after = await load(board, current);
            expect(after.tapdances![0]).toMatchObject({ tap: VALUES[to].td0[0], hold: VALUES[to].td0[1] });
            expect(after.combos![0].keys.slice(0, 2)).toEqual(VALUES[to].combo0);
            file.tapdances!.forEach((td, i) => expect(entryChanged('tapdances', td, after.tapdances![i]), `tap dance ${i}`).toBe(false));
            file.combos!.forEach((c, i) => expect(entryChanged('combos', c, after.combos![i]), `combo ${i}`).toBe(false));
            expect(after.keymap).toEqual(file.keymap);
            const wanted = new Map(file.custom_values!.map(v => [v.key, v.data]));
            for (const value of after.custom_values!.filter(v => !/^id_layer/.test(v.key))) expect(value.data, value.key).toEqual(wanted.get(value.key));

            // A second import of the same file has nothing left to write.
            board.writes = [];
            const again = await apply(board, readbackLayout(to), after);
            expect(again.planned).toEqual([]);
            expect(board.writes).toEqual([]);
        });
    }
});
