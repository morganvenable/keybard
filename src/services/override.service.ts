import type { KeyboardInfo } from "../types/keyboard.types";
import { keyService } from "./key.service";
import { SVIL_TABLE_KEY_OVERRIDE, SvilUSB, checkSvilStatus, readSvilTable, svilIndexArgs } from "./usb.service";

export class OverrideService {
    constructor(private usb: SvilUSB) { }

    async get(kbinfo: KeyboardInfo): Promise<void> {
        const override_count = kbinfo.key_override_count || 0;
        if (override_count === 0) return;

        kbinfo.key_overrides = [];

        // Use Svil protocol: scan (v3+) or per-index get
        const entries = await readSvilTable(this.usb, SVIL_TABLE_KEY_OVERRIDE, override_count);
        for (let i = 0; i < override_count; i++) {
            const data = entries[i];

            // Entry: [trigger:2][replacement:2][layers:4][trigger_mods][negative_mod_mask][suppressed_mods][options]
            const dv = new DataView(data.buffer);
            kbinfo.key_overrides.push({
                koid: i,
                trigger: keyService.stringify(dv.getUint16(0, true)),
                replacement: keyService.stringify(dv.getUint16(2, true)),
                layers: dv.getUint32(4, true),
                trigger_mods: data[8],
                negative_mod_mask: data[9],
                suppressed_mods: data[10],
                options: data[11],
            });
        }
    }

    async push(kbinfo: KeyboardInfo, koid: number): Promise<void> {
        if (!kbinfo.key_overrides) return;
        const ko = kbinfo.key_overrides[koid];
        if (!ko) return;

        // Use Svil protocol: direct key override set command
        const resp = await this.usb.sendSvil(SvilUSB.CMD_SVIL_KEY_OVERRIDE_SET, [
            ...svilIndexArgs(this.usb.svilProtocolVersion, koid),
            ...this.LE16(keyService.parse(ko.trigger)),
            ...this.LE16(keyService.parse(ko.replacement)),
            ...this.LE32(ko.layers),
            ko.trigger_mods,
            ko.negative_mod_mask,
            ko.suppressed_mods,
            ko.options,
        ], { uint8: true }) as Uint8Array;
        // Response: [cmd_echo][status], nonzero = refused (e.g. index out of range)
        checkSvilStatus(SvilUSB.CMD_SVIL_KEY_OVERRIDE_SET, resp);
    }

    private LE16(val: number): [number, number] {
        return [val & 0xFF, (val >> 8) & 0xFF];
    }

    private LE32(val: number): [number, number, number, number] {
        return [val & 0xFF, (val >> 8) & 0xFF, (val >> 16) & 0xFF, (val >> 24) & 0xFF];
    }
}
