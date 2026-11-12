// sendUpdaterReports: CHUNKs back to back for a board with a CHUNK window. Replies in order,
// never more unanswered than the window, a wrapper rejection, and a timeout when replies stop.
import { describe, expect, it, vi } from 'vitest';
import { ClientIdRejectedError, SvilUSB } from '../../src/services/usb.service';

const WRAPPER = 0xdd;
const VIA = 0xfe;

function makeDevice(o: { drop?: (n: number) => boolean; reject?: boolean } = {}) {
    const listeners = new Set<(ev: { data: DataView }) => void>();
    const id = 0x0005031d;
    let unanswered = 0;
    let maxUnanswered = 0;
    let chunks = 0;
    const deliver = (frame: Uint8Array) => {
        const buf = new Uint8Array(64); buf.set(frame.slice(0, 64));
        for (const l of Array.from(listeners)) l({ data: new DataView(buf.buffer) });
    };
    const device = {
        productName: 'Svalboard', vendorId: 0x303a, productId: 0x4044, opened: false,
        collections: [{ usagePage: 0xff61, usage: 0x62, inputReports: [{ reportId: 0, items: [{ reportSize: 8, reportCount: 64 }] }], outputReports: [{ reportId: 0, items: [{ reportSize: 8, reportCount: 64 }] }], featureReports: [] }],
        open: vi.fn(async () => { device.opened = true; }),
        close: vi.fn(async () => { device.opened = false; }),
        addEventListener: vi.fn((_t: string, l: (ev: { data: DataView }) => void) => { listeners.add(l); }),
        removeEventListener: vi.fn((_t: string, l: (ev: { data: DataView }) => void) => { listeners.delete(l); }),
        sendReport: vi.fn(async (_r: number, data: BufferSource) => {
            const msg = new Uint8Array(data as ArrayBuffer);
            const clientId = (msg[1] | (msg[2] << 8) | (msg[3] << 16) | (msg[4] << 24)) >>> 0;
            if (clientId === 0) {
                const f = new Uint8Array(64); f[0] = WRAPPER; f.set(msg.slice(5, 25), 5);
                f[25] = id & 0xff; f[26] = (id >> 8) & 0xff; f[27] = (id >> 16) & 0xff; f[28] = (id >> 24) & 0xff; f[29] = 120;
                setTimeout(() => deliver(f), 0);
                return;
            }
            const n = chunks++;
            unanswered++;
            maxUnanswered = Math.max(maxUnanswered, unanswered);
            setTimeout(() => {
                unanswered--;
                if (o.drop?.(n)) return;
                const f = new Uint8Array(64); f.set(msg.slice(0, 5));
                if (o.reject) { f[5] = 0xff; f[6] = 1; } else { f[5] = VIA; f.set(msg.slice(6, 10), 6); f[10] = n; }
                deliver(f);
            }, 1);
        }),
    };
    return { device, stats: () => ({ maxUnanswered, chunks }) };
}

const chunk = (i: number) => [0x07, 0x55, 0x04, 1, i, 0, 0, 1, 0xaa];

describe('SvilUSB.sendUpdaterReports', () => {
    it('sends every request, keeps no more than the window unanswered, and returns the replies in order', async () => {
        const { device, stats } = makeDevice();
        const usb = new SvilUSB();
        await usb.openDevice(device as unknown as HIDDevice);
        const replies = await usb.sendUpdaterReports(Array.from({ length: 40 }, (_, i) => chunk(i)), 3, 1000, 16);
        expect(replies).toHaveLength(40);
        expect(replies.map((r) => r[10])).toEqual(Array.from({ length: 40 }, (_, i) => i));
        expect(stats().chunks).toBe(40);
        expect(stats().maxUnanswered).toBeLessThanOrEqual(16);
    });

    it('a wrapper rejection rejects the burst', async () => {
        const { device } = makeDevice({ reject: true });
        const usb = new SvilUSB();
        await usb.openDevice(device as unknown as HIDDevice);
        await expect(usb.sendUpdaterReports([chunk(0), chunk(1)], 3, 1000, 16)).rejects.toBeInstanceOf(ClientIdRejectedError);
    });

    it('times out when a reply never comes', async () => {
        const { device } = makeDevice({ drop: (n) => n === 3 });
        const usb = new SvilUSB();
        await usb.openDevice(device as unknown as HIDDevice);
        await expect(usb.sendUpdaterReports(Array.from({ length: 8 }, (_, i) => chunk(i)), 3, 200, 16)).rejects.toThrow(/timeout/i);
    });
});
