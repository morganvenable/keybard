import { describe, it, expect, vi, afterEach } from 'vitest';
import { SvilUSB } from '../../src/services/usb.service';
import { KeyboardService } from '../../src/services/keyboard.service';
import { UnsupportedFirmwareError } from '../../src/utils/unsupported-firmware';

/**
 * Fake HID devices answering the way real firmware does. `answer` gets each sent
 * report and returns the reply (or null for no reply).
 */
function makeDevice(answer: (msg: Uint8Array) => Uint8Array | null) {
    const listeners = new Set<(ev: { data: DataView }) => void>();
    const sent: Uint8Array[] = [];
    const device = {
        productName: 'Svalboard', vendorId: 0x303a, productId: 0x4044, opened: false,
        collections: [{ usagePage: 0xff60, usage: 0x61, inputReports: [], outputReports: [], featureReports: [] }],
        open: vi.fn(async () => { device.opened = true; }),
        close: vi.fn(async () => { device.opened = false; }),
        addEventListener: vi.fn((_t: string, l: (ev: { data: DataView }) => void) => { listeners.add(l); }),
        removeEventListener: vi.fn((_t: string, l: (ev: { data: DataView }) => void) => { listeners.delete(l); }),
        sendReport: vi.fn(async (_id: number, data: BufferSource) => {
            const msg = new Uint8Array(data as ArrayBuffer).slice();
            sent.push(msg);
            const reply = answer(msg);
            if (!reply) return;
            setTimeout(() => {
                const buf = new Uint8Array(32); buf.set(reply.slice(0, 32));
                for (const l of Array.from(listeners)) l({ data: new DataView(buf.buffer) });
            }, 0);
        }),
    };
    return { device, sent };
}

const padded = (bytes: number[], from?: Uint8Array) => {
    const f = from ? from.slice() : new Uint8Array(32);
    f.set(bytes);
    return f;
};
const ascii = (s: string) => Array.from(new TextEncoder().encode(s));
// Svalboard's VIAL_KEYBOARD_UID, little-endian
const SVAL_UID = [0x1b, 0x18, 0x7d, 0xf2, 0x21, 0xf6, 0x29, 0x48];
const unhandled = (msg: Uint8Array) => padded([0xff], msg);

/** svalboard/vial-qmk v25.02 to v2025-11-01: echoes unknown packets, has the 0xEE protocol. */
const vialEcho = (msg: Uint8Array) => {
    if (msg[0] === 0xee && msg[1] === 0x01) return padded([...ascii('sval'), 3, 0, 0, 0]);
    if (msg[0] === 0xee && msg[1] === 0x02) return padded([...ascii('v2025-11-01'), 0]);
    if (msg[0] === 0xfe && msg[1] === 0x00) return padded([6, 0, 0, 0, ...SVAL_UID, 0]);
    if (msg[0] === 0x01) return padded([0x01, 0x00, 0x09], msg);
    return msg; // raw_hid_receive_kb returns without touching the buffer
};

/** svalboard/vial-qmk before v25.02: no 0xEE handler, unknown packets get id_unhandled. */
const vialOld = (msg: Uint8Array) => {
    if (msg[0] === 0xfe && msg[1] === 0x00) return padded([6, 0, 0, 0, ...SVAL_UID, 0]);
    if (msg[0] === 0x01) return padded([0x01, 0x00, 0x09], msg);
    return unhandled(msg);
};

/** Some other keyboard's VIA firmware. */
const viaBoard = (msg: Uint8Array) => (msg[0] === 0x01 ? padded([0x01, 0x00, 0x0c], msg) : unhandled(msg));

/** Another keyboard's Vial firmware: Vial answers, with a different UID. */
const otherVial = (msg: Uint8Array) =>
    msg[0] === 0xfe && msg[1] === 0x00 ? padded([6, 0, 0, 0, 1, 2, 3, 4, 5, 6, 7, 8]) : viaBoard(msg);

/** Current Svalboard QMK, unwrapped: only VIA's own commands answer. */
const svalQmkUnwrapped = (msg: Uint8Array) => (msg[0] === 0x01 ? padded([0x01, 0x00, 0x0c], msg) : unhandled(msg));

/** Svalboard QMK's bootstrap reply: our request with a client ID and TTL 120. */
const bootstrapReply = (msg: Uint8Array, clientId: number[]) => padded([0xdd, 0, 0, 0, 0, ...msg.slice(5, 25), ...clientId, 120, 0]);

async function bootstrapFailure(answer: (msg: Uint8Array) => Uint8Array | null) {
    const { device, sent } = makeDevice(answer);
    const usb = new SvilUSB();
    await usb.openDevice(device as unknown as HIDDevice);
    const failure = await usb.send(SvilUSB.CMD_VIA_GET_PROTOCOL_VERSION, []).catch((e: unknown) => e);
    return { failure, sent };
}

describe('SvilUSB firmware detection', () => {
    afterEach(() => { vi.useRealTimers(); });

    it('recognizes the echo of Svalboard Vial firmware and reports its version', async () => {
        const { failure, sent } = await bootstrapFailure(vialEcho);
        expect(failure).toBeInstanceOf(UnsupportedFirmwareError);
        expect((failure as UnsupportedFirmwareError).info).toEqual({ kind: 'svalboard-vial', reportedVersion: 'v2025-11-01' });
        // One bootstrap, then only the unwrapped probes: no wrapped command went out
        expect(sent[0][0]).toBe(0xdd);
        expect(sent.slice(1).map(m => Array.from(m.slice(0, 2)))).toEqual([[0xee, 0x01], [0xee, 0x02]]);
    });

    it('recognizes older Svalboard Vial firmware by its Vial keyboard UID', async () => {
        const { failure, sent } = await bootstrapFailure(vialOld);
        expect((failure as UnsupportedFirmwareError).info).toEqual({ kind: 'svalboard-vial' });
        expect(sent.length).toBe(3); // bootstrap, 0xEE probe, Vial keyboard ID
    });

    it.each([['a VIA keyboard', viaBoard], ['another Vial keyboard', otherVial]])('calls %s other QMK firmware', async (_name, answer) => {
        const { failure } = await bootstrapFailure(answer);
        expect(failure).toBeInstanceOf(UnsupportedFirmwareError);
        expect((failure as UnsupportedFirmwareError).info.kind).toBe('other-qmk');
        expect((failure as Error).message).toContain("doesn't run Svalboard firmware");
    });

    it('reports a keyboard that never answers as not responding, not as old firmware', async () => {
        vi.useFakeTimers();
        const { device } = makeDevice(() => null);
        const usb = new SvilUSB();
        await usb.openDevice(device as unknown as HIDDevice);
        const failure = usb.send(SvilUSB.CMD_VIA_GET_PROTOCOL_VERSION, []).catch((e: unknown) => e);
        await vi.advanceTimersByTimeAsync(10_000);
        expect(((await failure) as UnsupportedFirmwareError).info).toEqual({ kind: 'no-response' });
    });

    it('retries a current-firmware board that misses the first bootstraps instead of calling it another keyboard', async () => {
        vi.useFakeTimers();
        let bootstraps = 0;
        const { device } = makeDevice((msg) => {
            if (msg[0] !== 0xdd) return svalQmkUnwrapped(msg);
            const clientId = msg[1] | (msg[2] << 8) | (msg[3] << 16) | (msg[4] << 24);
            if (clientId === 0) return ++bootstraps <= 5 ? null : bootstrapReply(msg, [0x1d, 0x03, 0x05, 0x00]);
            return padded([0xdd, ...msg.slice(1, 6), 0x01, 0x00, 0x0c]);
        });
        const usb = new SvilUSB();
        await usb.openDevice(device as unknown as HIDDevice);
        const result = usb.send(SvilUSB.CMD_VIA_GET_PROTOCOL_VERSION, [], { unpack: 'B>H', index: 1 }).catch((e: unknown) => e);
        await vi.advanceTimersByTimeAsync(10_000);
        expect(await result).toBe(0x0c);
        expect(bootstraps).toBe(6);
        await usb.close();
    });

    it('reports current firmware that answers VIA but never the bootstrap as not responding', async () => {
        vi.useFakeTimers();
        const { device } = makeDevice((msg) => (msg[0] === 0xdd ? null : svalQmkUnwrapped(msg)));
        const usb = new SvilUSB();
        await usb.openDevice(device as unknown as HIDDevice);
        const failure = usb.send(SvilUSB.CMD_VIA_GET_PROTOCOL_VERSION, []).catch((e: unknown) => e);
        await vi.advanceTimersByTimeAsync(20_000);
        expect(((await failure) as UnsupportedFirmwareError).info).toEqual({ kind: 'no-response' });
    });

    it('asks again when current firmware hands out client ID 0', async () => {
        let bootstraps = 0;
        const { device } = makeDevice((msg) => {
            const clientId = msg[1] | (msg[2] << 8) | (msg[3] << 16) | (msg[4] << 24);
            if (clientId === 0) return bootstrapReply(msg, ++bootstraps === 1 ? [0, 0, 0, 0] : [0x01, 0, 0, 0]);
            return padded([0xdd, ...msg.slice(1, 6), 0x01, 0x00, 0x0c]);
        });
        const usb = new SvilUSB();
        await usb.openDevice(device as unknown as HIDDevice);
        await expect(usb.send(SvilUSB.CMD_VIA_GET_PROTOCOL_VERSION, [], { unpack: 'B>H', index: 1 })).resolves.toBe(0x0c);
        expect(bootstraps).toBe(2);
        await usb.close();
    });

    it('matches each probe to its own reply when a reply arrives late', async () => {
        // The "sval" reply misses its probe's window and lands during the next one
        const { device } = makeDevice(() => null);
        const listeners = () => (device.addEventListener.mock.calls.map(c => c[1]));
        const deliver = (bytes: Uint8Array) => {
            const buf = new Uint8Array(32); buf.set(bytes.slice(0, 32));
            for (const l of new Set(listeners())) l({ data: new DataView(buf.buffer) });
        };
        vi.useFakeTimers();
        device.sendReport.mockImplementation(async (_id: number, data: BufferSource) => {
            const msg = new Uint8Array(data as ArrayBuffer).slice();
            if (msg[0] === 0xdd) { setTimeout(() => deliver(msg), 0); return; } // echo, like Vial
            if (msg[0] === 0xee && msg[1] === 0x01) { setTimeout(() => deliver(vialEcho(msg)), 400); return; }
            setTimeout(() => deliver(vialEcho(msg)), 200); // the keyboard ID comes after the late "sval"
        });
        const usb = new SvilUSB();
        await usb.openDevice(device as unknown as HIDDevice);
        const failure = usb.send(SvilUSB.CMD_VIA_GET_PROTOCOL_VERSION, []).catch((e: unknown) => e);
        await vi.advanceTimersByTimeAsync(10_000);
        // The late "sval" reply must not be read as the Vial keyboard-ID answer
        expect(((await failure) as UnsupportedFirmwareError).info).toEqual({ kind: 'svalboard-vial' });
    });

    it('connects to current firmware without probing', async () => {
        const { device, sent } = makeDevice((msg) => {
            const clientId = msg[1] | (msg[2] << 8) | (msg[3] << 16) | (msg[4] << 24);
            if (clientId === 0) return padded([0xdd, 0, 0, 0, 0, ...msg.slice(5, 25), 0x1d, 0x03, 0x05, 0x00, 120, 0]);
            return padded([0xdd, ...msg.slice(1, 6), 0x01, 0x00, 0x0d]);
        });
        const usb = new SvilUSB();
        await usb.openDevice(device as unknown as HIDDevice);
        await expect(usb.send(SvilUSB.CMD_VIA_GET_PROTOCOL_VERSION, [], { unpack: 'B>H', index: 1 })).resolves.toBe(0x0d);
        expect(sent.every(m => m[0] === 0xdd)).toBe(true);
        await usb.close();
    });

    it('stops a Vial board before any of its replies reach the definition decoder', async () => {
        // Before detection, the echoed size request read as 0 and js-lzma looped
        // until V8 gave up with "Too many properties to enumerate".
        const { device } = makeDevice(vialEcho);
        const usb = new SvilUSB();
        await usb.openDevice(device as unknown as HIDDevice);
        const failure = await new KeyboardService(usb).load({ rows: 0, cols: 0 }).catch((e: unknown) => e);
        expect(failure).toBeInstanceOf(UnsupportedFirmwareError);
        expect((failure as Error).message).toContain('old Vial firmware (v2025-11-01)');
    });
});

describe('SvilUSB.checkFirmware (before switching the editing target)', () => {
    /** Svalboard QMK answering the bootstrap, then GET_INFO with the given protocol version. */
    const svalQmk = (proto: number) => (msg: Uint8Array) => {
        if (msg[0] !== 0xdd) return svalQmkUnwrapped(msg);
        if (msg[1] === 0 && msg[2] === 0 && msg[3] === 0 && msg[4] === 0) return bootstrapReply(msg, [0x01, 0x00, 0x01, 0x00]);
        if (msg[5] === 0xdf && msg[6] === 0x00) return padded([0xdd, 1, 0, 1, 0, 0xdf, 0x00, proto, 0, 0, 0]);
        return null;
    };

    it('passes current Svalboard QMK and closes its own connection', async () => {
        const { device } = makeDevice(svalQmk(3));
        await expect(SvilUSB.checkFirmware(device as unknown as HIDDevice)).resolves.toBeUndefined();
        expect(device.close).toHaveBeenCalled();
        expect(device.opened).toBe(false);
    });

    it('rejects the old Vial firmware and still closes', async () => {
        const { device } = makeDevice(vialEcho);
        const failure = await SvilUSB.checkFirmware(device as unknown as HIDDevice).catch((e: unknown) => e);
        expect(failure).toBeInstanceOf(UnsupportedFirmwareError);
        expect((failure as UnsupportedFirmwareError).info.kind).toBe('svalboard-vial');
        expect(device.opened).toBe(false);
    });

    it('rejects a pre-release Sval protocol build', async () => {
        const { device } = makeDevice(svalQmk(2));
        const failure = await SvilUSB.checkFirmware(device as unknown as HIDDevice).catch((e: unknown) => e);
        expect((failure as UnsupportedFirmwareError).info).toEqual({ kind: 'outdated-sval', svilProto: 2 });
    });
});
