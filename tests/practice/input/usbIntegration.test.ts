import { afterEach, describe, expect, it, vi } from 'vitest';
import { boardReader } from '@/features/practice/input/boardReader';
import { LiveInput } from '@/features/practice/input/liveInput';
import { resolveKeymap } from '@/features/practice/keymap/resolver';
import { LessonRun } from '@/features/practice/state/lessonRun';
import { SvilUSB } from '@/services/usb.service';
import type { IInputEvent } from '@/features/practice/vendor/keybr/textinput-events/index.ts';
import { svalDefault } from '../fixtures/boards';

// Live · USB across the real USB boundary (spec §9.9 E2E): the USB mock answers the VIA switch-matrix
// read (0x02 0x03) and the Sval layer-state read with raw bytes; the real keyboardService decodes them
// (pollMatrix's per-row bytes, reversed within a row) and boardReader, the sampler and the correlator do
// the rest. A row or column mix-up between Keybard's matrix report and the keymap's row * cols + col
// index fails here, not only on the Mule.

const usb = vi.hoisted(() => ({ control: null as unknown as import('../../mocks/usb.mock').MockUSBControl }));

vi.mock('@/services/keyboard.service', async (importActual) => {
    const actual = await importActual<typeof import('@/services/keyboard.service')>();
    const { createMockUSB: create } = await import('../../mocks/usb.mock');
    const { mock, control } = create();
    usb.control = control;
    return { ...actual, keyboardService: new actual.KeyboardService(mock) };
});

const board = svalDefault();
const resolution = resolveKeymap({ keymap: board.keymap!, rows: board.rows, cols: board.cols });
const cp = (s: string) => s.codePointAt(0)!;

/** Matrix positions held on the mock board, as [row, col]. */
let held: [number, number][] = [];
const commands: number[][] = [];

/** The board's reply bytes: a VIA switch-matrix report, or a Sval layer-state report (layer 0 on). */
function reply(sent: Uint8Array): Uint8Array {
    commands.push([...sent.slice(0, 2)]);
    const response = new Uint8Array(32);
    if (sent[0] === 0xdf && sent[1] === SvilUSB.CMD_SVIL_LAYER_STATE_GET) {
        response[1] = 1; // active mask, little endian at byte 1
        return response;
    }
    if (sent[0] === SvilUSB.CMD_VIA_GET_KEYBOARD_VALUE && sent[1] === SvilUSB.VIA_SWITCH_MATRIX_STATE) {
        response[0] = SvilUSB.CMD_VIA_GET_KEYBOARD_VALUE;
        response[1] = SvilUSB.VIA_SWITCH_MATRIX_STATE;
        const rowBytes = Math.ceil(board.cols / 8);
        for (const [row, col] of held) {
            // Bytes from offset 3, rowBytes per row, the last byte holding columns 0–7.
            response[3 + row * rowBytes + (rowBytes - 1 - Math.floor(col / 8))] |= 1 << (col % 8);
        }
    }
    return response;
}

let live: LiveInput | null = null;
afterEach(() => {
    live?.dispose();
    live = null;
    held = [];
    commands.length = 0;
});

describe('Live · USB through the USB mock and the real keyboardService', () => {
    it('a single matrix bit becomes the right key on the board and an observed keystroke', async () => {
        expect(board.rows).toBe(10);
        expect(board.cols).toBe(6);
        usb.control.setConnected(true);
        usb.control.setResponseData((sent) => reply(sent));
        const reader = boardReader(() => board);
        // Each matrix read takes a couple of milliseconds, like a real round trip.
        const slow = { ...reader, pollMatrix: async () => { await new Promise((r) => setTimeout(r, 2)); return reader.pollMatrix(); } };
        live = new LiveInput(slow);
        live.setKeymap({ resolution, keymap: board.keymap!, rows: board.rows, cols: board.cols });
        const run = new LessonRun({ text: 'as', textInput: { stopOnError: true, forgiveErrors: true, spaceSkipsWords: false }, resolution, cols: board.cols });
        live.bindRun(run);
        live.setWanted(true);
        await vi.waitFor(() => expect(live!.getBoard().layer).toBe(0), { timeout: 5000 });
        expect(commands).toContainEqual([SvilUSB.CMD_VIA_GET_KEYBOARD_VALUE, SvilUSB.VIA_SWITCH_MATRIX_STATE]);
        expect(commands).toContainEqual([0xdf, SvilUSB.CMD_SVIL_LAYER_STATE_GET]);

        // Left pinky C: row 4, column 2, matrix index 4 * 6 + 2 = 26, where the keymap has a.
        expect(resolution.primary(cp('a'))!.index).toBe(26);
        held = [[4, 2]];
        await vi.waitFor(() => expect([...live!.getBoard().pressed]).toEqual([26]), { timeout: 5000 });
        const tInput = performance.now();
        const event: IInputEvent = { type: 'input', timeStamp: tInput, inputType: 'appendChar', codePoint: cp('a'), timeToType: 0 };
        const outcome = run.onInput(event);
        live.enqueue(outcome.keystroke!);
        await live.settle(2000);
        expect(run.events[0].phys).toMatchObject({ confidence: 'observed', index: 26, layer: 0 });
        expect(live.getBoard().wrong.size).toBe(0);

        // A right-half key: row 5, column 2 is MO(1); the board follows it to layer 1.
        held = [[5, 2]];
        await vi.waitFor(() => expect(live!.getBoard()).toMatchObject({ pressed: new Set([32]), layer: 1 }), { timeout: 5000 });
    });
});
