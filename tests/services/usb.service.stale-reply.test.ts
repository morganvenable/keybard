import { describe, expect, it, vi } from 'vitest';
import { keyboardService } from '../../src/services/keyboard.service';
import { SvilUSB } from '../../src/services/usb.service';

// A reply that arrives late (its command already timed out) must not be taken as the answer to
// the next command. Before, only the wrapper prefix and the client ID were checked, so a late
// matrix poll reply (VIA, 0xFE) could be read as the layer state (Sval 0x16): Practice saw a new
// default layer and restarted the lesson ("Keymap changed").

const WRAPPER = 0xdd;
const SVAL = 0xdf;
const VIA = 0xfe;

const frame = (clientId: number, protocol: number, payload: number[]) => {
    const f = new Uint8Array(32); f[0] = WRAPPER;
    f[1] = clientId & 0xff; f[2] = (clientId >> 8) & 0xff; f[3] = (clientId >> 16) & 0xff; f[4] = (clientId >> 24) & 0xff;
    f[5] = protocol; f.set(payload, 6); return f;
};

/** A fake board: bootstrap gives an ID; `respond` answers wrapped commands (it may send stray frames first). */
function makeDevice(respond: (clientId: number, protocol: number, payload: Uint8Array, reply: (f: Uint8Array) => void) => void) {
    const listeners = new Set<(ev: { data: DataView }) => void>();
    const deliver = (f: Uint8Array) => {
        const buf = new Uint8Array(32); buf.set(f.slice(0, 32));
        for (const l of Array.from(listeners)) l({ data: new DataView(buf.buffer) });
    };
    const device = {
        productName: 'Svalboard', vendorId: 0x303a, productId: 0x4044, opened: false,
        collections: [{ usagePage: 0xff61, usage: 0x62, inputReports: [], outputReports: [], featureReports: [] }],
        open: vi.fn(async () => { device.opened = true; }),
        close: vi.fn(async () => { device.opened = false; }),
        addEventListener: vi.fn((_t: string, l: (ev: { data: DataView }) => void) => { listeners.add(l); }),
        removeEventListener: vi.fn((_t: string, l: (ev: { data: DataView }) => void) => { listeners.delete(l); }),
        sendReport: vi.fn(async (_id: number, data: BufferSource) => {
            const msg = new Uint8Array(data as ArrayBuffer);
            const clientId = msg[1] | (msg[2] << 8) | (msg[3] << 16) | (msg[4] << 24);
            setTimeout(() => {
                if (clientId === 0) {
                    const f = new Uint8Array(32); f[0] = WRAPPER; f.set(msg.slice(5, 25), 5);
                    f[25] = 0x1d; f[26] = 0x03; f[27] = 0x05; f[28] = 0; f[29] = 120;
                    deliver(f);
                } else {
                    respond(clientId, msg[5], msg.slice(6), deliver);
                }
            }, 0);
        }),
    };
    return device;
}

const KB = { rows: 10, cols: 6, feature_flags: 0x40 } as unknown as Parameters<typeof keyboardService.getLayerStateMasks>[0];
const u32 = (n: number) => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >> 24) & 0xff];

describe('Late replies are not taken for the next command', () => {
    it('a layer state read skips a stray VIA reply (a matrix poll that timed out)', async () => {
        const device = makeDevice((id, protocol, payload, reply) => {
            if (protocol === SVAL && payload[0] === SvilUSB.CMD_SVIL_LAYER_STATE_GET) {
                // The matrix poll's late answer, with keys held, arrives first.
                reply(frame(id, VIA, [SvilUSB.CMD_VIA_GET_KEYBOARD_VALUE, SvilUSB.VIA_SWITCH_MATRIX_STATE, 0, 0x12, 0x34, 0x56, 0x78, 0x9a, 0xbc]));
                reply(frame(id, SVAL, [SvilUSB.CMD_SVIL_LAYER_STATE_GET, ...u32(0b10), ...u32(0b1)]));
            }
        });
        const usb = new SvilUSB();
        await usb.openDevice(device as unknown as HIDDevice);
        const service = Object.create(Object.getPrototypeOf(keyboardService)) as typeof keyboardService;
        (service as unknown as { usb: SvilUSB }).usb = usb;
        await expect(service.getLayerStateMasks(KB)).resolves.toEqual({ active: 0b10, default: 0b1 });
    });

    it('a layer state read skips another Sval command\'s late reply', async () => {
        const device = makeDevice((id, protocol, payload, reply) => {
            if (protocol === SVAL && payload[0] === SvilUSB.CMD_SVIL_LAYER_STATE_GET) {
                reply(frame(id, SVAL, [SvilUSB.CMD_SVIL_GET_INFO, 9, 9, 9, 9, 9, 9, 9, 9]));
                reply(frame(id, SVAL, [SvilUSB.CMD_SVIL_LAYER_STATE_GET, ...u32(0), ...u32(0b100)]));
            }
        });
        const usb = new SvilUSB();
        await usb.openDevice(device as unknown as HIDDevice);
        const service = Object.create(Object.getPrototypeOf(keyboardService)) as typeof keyboardService;
        (service as unknown as { usb: SvilUSB }).usb = usb;
        await expect(service.getLayerStateMasks(KB)).resolves.toEqual({ active: 0, default: 0b100 });
    });

    it('a VIA command skips a stray Sval reply', async () => {
        const device = makeDevice((id, protocol, payload, reply) => {
            if (protocol === VIA) {
                reply(frame(id, SVAL, [SvilUSB.CMD_SVIL_LAYER_STATE_GET, ...u32(0xff), ...u32(0xff)]));
                reply(frame(id, VIA, [payload[0], payload[1], 0, 7]));
            }
        });
        const usb = new SvilUSB();
        await usb.openDevice(device as unknown as HIDDevice);
        const reply = await usb.send(SvilUSB.CMD_VIA_GET_KEYBOARD_VALUE, [SvilUSB.VIA_SWITCH_MATRIX_STATE], {}) as Uint8Array;
        expect(Array.from(reply.slice(0, 4))).toEqual([SvilUSB.CMD_VIA_GET_KEYBOARD_VALUE, SvilUSB.VIA_SWITCH_MATRIX_STATE, 0, 7]);
    });
});
