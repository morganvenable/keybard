import type { KeyboardInfo } from "../types/vial.types";
import { keyService } from "./key.service";
import { SvilUSB, svilEntryOffset, svilIndexArgs } from "./usb.service";

export class TapdanceService {
    constructor(private usb: SvilUSB) { }

    async get(kbinfo: KeyboardInfo): Promise<void> {
        const tapdance_count = kbinfo.tapdance_count || 0;
        if (tapdance_count === 0) return;

        kbinfo.tapdances = [];
        const proto = this.usb.svilProtocolVersion;
        const o = svilEntryOffset(proto);

        // Use Svil protocol: direct tap dance get command
        for (let i = 0; i < tapdance_count; i++) {
            const data = await this.usb.sendSvil(
                SvilUSB.CMD_SVIL_TAP_DANCE_GET,
                svilIndexArgs(proto, i),
                { uint8: true }
            ) as Uint8Array;

            // Response: [cmd_echo][index (v1: 1 byte, v2: 2 bytes)][tap:2][hold:2][doubletap:2][taphold:2][tapping_term:2]
            // tapping_term is 2 bytes: bit 15 = enabled flag (ignored), bits 0-14 = timing in ms
            // Keybard always treats tap dances as enabled
            const dv = new DataView(data.buffer);
            const termRaw = dv.getUint16(o + 8, true);
            kbinfo.tapdances.push({
                idx: i,
                tap: keyService.stringify(dv.getUint16(o, true)),
                hold: keyService.stringify(dv.getUint16(o + 2, true)),
                doubletap: keyService.stringify(dv.getUint16(o + 4, true)),
                taphold: keyService.stringify(dv.getUint16(o + 6, true)),
                tapping_term: termRaw & 0x7FFF,
            });
        }
    }

    async push(kbinfo: KeyboardInfo, tdid?: number): Promise<void> {
        if (!kbinfo.tapdances) return;

        const toPush = tdid !== undefined
            ? kbinfo.tapdances.filter(td => td.idx === tdid)
            : kbinfo.tapdances;

        for (const td of toPush) {
            // Use Svil protocol: direct tap dance set command
            // tapping_term is 2 bytes: bit 15 = enabled flag, bits 0-14 = timing in ms
            // Keybard always enables tap dances (the disabled feature is pointless)
            const termWithEnabled = ((td.tapping_term || 200) & 0x7FFF) | 0x8000;
            await this.usb.sendSvil(SvilUSB.CMD_SVIL_TAP_DANCE_SET, [
                ...svilIndexArgs(this.usb.svilProtocolVersion, td.idx),
                ...this.LE16(keyService.parse(td.tap)),
                ...this.LE16(keyService.parse(td.hold)),
                ...this.LE16(keyService.parse(td.doubletap)),
                ...this.LE16(keyService.parse(td.taphold)),
                ...this.LE16(termWithEnabled),
            ], {});
        }
    }

    private LE16(val: number): [number, number] {
        return [val & 0xFF, (val >> 8) & 0xFF];
    }
}
