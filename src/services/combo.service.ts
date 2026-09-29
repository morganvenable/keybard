import type { KeyboardInfo } from "../types/vial.types";
import { keyService } from "./key.service";
import { SvilUSB } from "./usb.service";

export class ComboService {
    constructor(private usb: SvilUSB) { }

    async get(kbinfo: KeyboardInfo): Promise<void> {
        const combo_count = kbinfo.combo_count || 0;
        if (combo_count === 0) return;

        kbinfo.combos = [];

        // Use Svil protocol: direct combo get command
        for (let i = 0; i < combo_count; i++) {
            const data = await this.usb.sendSvil(
                SvilUSB.CMD_SVIL_COMBO_GET,
                [i],
                { uint8: true }
            ) as Uint8Array;

            // Response: [cmd_echo][index][key0:2][key1:2][key2:2][key3:2][output:2][custom_combo_term:2]
            const dv = new DataView(data.buffer);
            kbinfo.combos.push({
                cmbid: i,
                keys: [
                    keyService.stringify(dv.getUint16(2, true)),
                    keyService.stringify(dv.getUint16(4, true)),
                    keyService.stringify(dv.getUint16(6, true)),
                    keyService.stringify(dv.getUint16(8, true)),
                ].map(k => k === "KC_NO" ? "KC_NO" : k),
                output: keyService.stringify(dv.getUint16(10, true)),
                options: dv.getUint16(12, true),
            });
        }
    }

    async push(kbinfo: KeyboardInfo, cmbid: number): Promise<void> {
        if (!kbinfo.combos) return;
        const combo = kbinfo.combos.find(c => c.cmbid === cmbid);
        if (!combo) return;

        const keys = [...combo.keys];
        while (keys.length < 4) keys.push("KC_NO");

        // Use Svil protocol: direct combo set command
        await this.usb.sendSvil(SvilUSB.CMD_SVIL_COMBO_SET, [
            cmbid,
            ...this.LE16(keyService.parse(keys[0])),
            ...this.LE16(keyService.parse(keys[1])),
            ...this.LE16(keyService.parse(keys[2])),
            ...this.LE16(keyService.parse(keys[3])),
            ...this.LE16(keyService.parse(combo.output)),
            ...this.LE16(combo.options ?? 0),
        ], {});
    }

    private LE16(val: number): [number, number] {
        return [val & 0xFF, (val >> 8) & 0xFF];
    }
}
