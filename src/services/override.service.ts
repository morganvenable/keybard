import type { KeyboardInfo } from "../types/vial.types";
import { keyService } from "./key.service";
import { SvilUSB, svilEntryOffset, svilIndexArgs } from "./usb.service";

export class OverrideService {
    constructor(private usb: SvilUSB) { }

    async get(kbinfo: KeyboardInfo): Promise<void> {
        const override_count = kbinfo.key_override_count || 0;
        if (override_count === 0) return;

        kbinfo.key_overrides = [];
        const proto = this.usb.svilProtocolVersion;
        const o = svilEntryOffset(proto);

        // Use Svil protocol: direct key override get command
        for (let i = 0; i < override_count; i++) {
            const data = await this.usb.sendSvil(
                SvilUSB.CMD_SVIL_KEY_OVERRIDE_GET,
                svilIndexArgs(proto, i),
                { uint8: true }
            ) as Uint8Array;

            // Response: [cmd_echo][index (v1: 1 byte, v2: 2 bytes)][trigger:2][replacement:2][layers:4][trigger_mods][negative_mod_mask][suppressed_mods][options]
            const dv = new DataView(data.buffer);
            kbinfo.key_overrides.push({
                koid: i,
                trigger: keyService.stringify(dv.getUint16(o, true)),
                replacement: keyService.stringify(dv.getUint16(o + 2, true)),
                layers: dv.getUint32(o + 4, true),
                trigger_mods: data[o + 8],
                negative_mod_mask: data[o + 9],
                suppressed_mods: data[o + 10],
                options: data[o + 11],
            });
        }
    }

    async push(kbinfo: KeyboardInfo, koid: number): Promise<void> {
        if (!kbinfo.key_overrides) return;
        const ko = kbinfo.key_overrides[koid];
        if (!ko) return;

        // Use Svil protocol: direct key override set command
        await this.usb.sendSvil(SvilUSB.CMD_SVIL_KEY_OVERRIDE_SET, [
            ...svilIndexArgs(this.usb.svilProtocolVersion, koid),
            ...this.LE16(keyService.parse(ko.trigger)),
            ...this.LE16(keyService.parse(ko.replacement)),
            ...this.LE32(ko.layers),
            ko.trigger_mods,
            ko.negative_mod_mask,
            ko.suppressed_mods,
            ko.options,
        ], {});
    }

    private LE16(val: number): [number, number] {
        return [val & 0xFF, (val >> 8) & 0xFF];
    }

    private LE32(val: number): [number, number, number, number] {
        return [val & 0xFF, (val >> 8) & 0xFF, (val >> 16) & 0xFF, (val >> 24) & 0xFF];
    }
}
