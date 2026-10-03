import { describe, it, expect, vi } from 'vitest';
import { IdentityService, IdentityStatus, nameLength, nameProblem, SerialSource } from '../../src/services/identity.service';

const GET = 0x08;
const SET = 0x07;

// A fake keyboard speaking the identity protocol: answers like identity.c does.
function fakeKeyboard(initialName = '', opts: { available?: boolean; proto?: number; nameMax?: number } = {}) {
    let name = new TextEncoder().encode(initialName);
    const staged = new Uint8Array(64);
    const sent: number[][] = [];
    const send = vi.fn(async (cmd: number, args: number[]) => {
        sent.push([cmd, ...args]);
        // Enforce the real wrapper capacity, including bytes lost on the return trip.
        expect(1 + args.length).toBeLessThanOrEqual(26);
        const [, op, ...d] = args;
        const v = new Uint8Array(29);
        if (cmd === GET && op === 0) {
            v.set([opts.proto ?? 1, opts.available === false ? 0 : 1, name.length, opts.nameMax ?? 64, SerialSource.FlashId]);
            v.set([0xe4, 0x64, 0x98, 0x76, 0x9f, 0x36, 0x59, 0x34], 5);
        } else if (cmd === GET && op === 1) {
            const off = d[0];
            const chunk = name.slice(off, off + 24);
            v.set([0, chunk.length, ...chunk]);
        } else if (cmd === SET && op === 1) {
            staged.set(d.slice(2, 2 + d[1]), d[0]);
            v[0] = 0;
        } else if (cmd === SET && op === 2) {
            name = staged.slice(0, d[0]);
            v[0] = 0;
        }
        return v.slice(0, 23);
    });
    return { usb: { send } as any, sent, current: () => new TextDecoder().decode(name) };
}

describe('IdentityService', () => {
    it('reads the serial and a multi-chunk UTF-8 name', async () => {
        const kb = fakeKeyboard("Morgan's Sval — Rīga ✓ and more text");
        const info = await new IdentityService(kb.usb).getInfo();
        expect(info).toEqual({
            available: true,
            name: "Morgan's Sval — Rīga ✓ and more text",
            nameMaxBytes: 64,
            serialSource: SerialSource.FlashId,
            serial: 'sval:E46498769F365934',
        });
    });

    it('treats firmware without the protocol as having no identity', async () => {
        // Older firmware ignores the channel and answers a DPI index in byte 0.
        expect(await new IdentityService(fakeKeyboard('', { proto: 3, nameMax: 0 }).usb).getInfo()).toBeNull();
        const failing = { send: vi.fn().mockRejectedValue(new Error('timeout')) } as any;
        expect(await new IdentityService(failing).getInfo()).toBeNull();
    });

    it('writes a name in wrapper-safe 21-byte chunks and commits its byte length', async () => {
        const kb = fakeKeyboard();
        const name = 'Ünïcødé board name ✓✓✓';
        const bytes = new TextEncoder().encode(name).length; // 35: multi-byte characters
        expect(await new IdentityService(kb.usb).setName(name)).toBe(IdentityStatus.Ok);
        expect(kb.current()).toBe(name);
        const stages = kb.sent.filter((p) => p[0] === SET && p[2] === 1);
        expect(stages.map((p) => [p[3], p[4]])).toEqual([[0, 21], [21, bytes - 21]]);
        expect(kb.sent.at(-1)).toEqual([SET, 0x49, 2, bytes]);
    });

    it('clears the name with an empty commit', async () => {
        const kb = fakeKeyboard('Old');
        await new IdentityService(kb.usb).setName('');
        expect(kb.current()).toBe('');
    });
});

describe('name validation', () => {
    it('counts characters, not UTF-16 units', () => {
        expect(nameLength('✓🎹')).toBe(2);
    });
    it('limits names to 32 characters and the byte budget', () => {
        expect(nameProblem('x'.repeat(32), 64)).toBeNull();
        expect(nameProblem('x'.repeat(33), 64)).toMatch(/32/);
        expect(nameProblem('🎹'.repeat(17), 64)).toMatch(/too long/); // 68 bytes
        expect(nameProblem('tab\tok', 64)).toBeNull();
        expect(nameProblem('line\nbreak', 64)).toMatch(/control/);
    });
});
