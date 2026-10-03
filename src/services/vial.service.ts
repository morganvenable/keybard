import { requireProductionFirmware } from "./firmware-compatibility";
import { KleService } from "./kle.service";
import { keyService } from "./key.service";
import { SvilUSB, usbInstance } from "./usb.service";
import { LE16 } from "./utils";

import LZMA from "js-lzma";
import type { KeyboardInfo, AltRepeatKeyEntry, LeaderEntry } from "../types/vial.types";

// Svil feature flags (from protocol info response)
// CAPS_WORD = 0x01, LAYER_LOCK = 0x02 - not currently used
const SVIL_FLAG_ONESHOT = 0x04;
const SVIL_FLAG_LEADER = 0x08;
import { ComboService } from "./combo.service";
import { FragmentComposerService } from "./fragment-composer.service";
import { FragmentService } from "./fragment.service";
import { MacroService } from "./macro.service";
import { OverrideService } from "./override.service";
import { QMKService } from "./qmk.service";
import { svalService } from "./sval.service";
import { TapdanceService } from "./tapdance.service";

// Stream wrapper for js-lzma (Svil uses raw LZMA, not XZ container)
class LZMAInStream {
    private data: Uint8Array;
    private offset: number = 0;

    constructor(data: Uint8Array) {
        this.data = data;
    }

    readByte(): number {
        if (this.offset >= this.data.length) {
            return -1;
        }
        return this.data[this.offset++];
    }
}

class LZMAOutStream {
    private buffer: number[] = [];

    writeByte(byte: number): void {
        this.buffer.push(byte);
    }

    getBytes(): Uint8Array {
        return new Uint8Array(this.buffer);
    }
}

// LZMA decompression helper
async function decompress(buffer: ArrayBuffer): Promise<string> {
    try {
        const compressed = new Uint8Array(buffer);
        const inStream = new LZMAInStream(compressed);
        const outStream = new LZMAOutStream();

        LZMA.decompressFile(inStream, outStream);

        const decoder = new TextDecoder();
        return decoder.decode(outStream.getBytes());
    } catch (error) {
        console.error("LZMA decompression failed:", error);
        console.error("Buffer size:", buffer.byteLength);
        console.error("Buffer preview:", new Uint8Array(buffer).slice(0, 32));
        throw error;
    }
}

/**
 * SvilService - Keyboard configuration service using the Svil protocol
 *
 * The Svil protocol extends VIA3 with additional features:
 * - Alt Repeat Key, Leader sequences, One-shot settings
 * - Client ID wrapper for multi-client concurrent access
 * - Dynamic keyboard definitions with custom UI menus
 */
export class SvilService {
    private usb: SvilUSB;
    private macro: MacroService;
    private tapdance: TapdanceService;
    private combo: ComboService;
    private override: OverrideService;
    private qmk: QMKService;
    private kle: KleService;
    private fragment: FragmentService;
    private fragmentComposer: FragmentComposerService;

    constructor(usb: SvilUSB) {
        this.usb = usb;
        this.macro = new MacroService(usb);
        this.tapdance = new TapdanceService(usb);
        this.combo = new ComboService(usb);
        this.override = new OverrideService(usb);
        this.qmk = new QMKService(usb);
        this.kle = new KleService();
        this.fragment = new FragmentService(usb);
        this.fragmentComposer = new FragmentComposerService(this.kle, this.fragment);
    }

    static isWebHIDSupported(): boolean {
        return "hid" in navigator;
    }

    async init(_kbinfo: KeyboardInfo): Promise<void> {
        // Initialization hook for API setup
    }

    async load(kbinfo: KeyboardInfo): Promise<KeyboardInfo> {
        // Load keyboard information
        await this.getKeyboardInfo(kbinfo);

        // Register custom keycodes (SV_...) from the keyboard definition
        keyService.generateAllKeycodes(kbinfo);

        // Populate keylayout using KLE service if payload exists
        if (kbinfo.payload && kbinfo.payload.layouts && kbinfo.payload.layouts.keymap) {
            try {
                (kbinfo as any).keylayout = this.kle.deserializeToKeylayout(kbinfo, kbinfo.payload.layouts.keymap as unknown as any[]);
            } catch (e) {
                console.error("Failed to deserialize keylayout:", e);
            }
        }

        // Check for Svalboard-specific features
        const isSval = await svalService.check(kbinfo);
        if (isSval) {
            console.log("Svalboard detected, proto:", kbinfo.sval_proto, "firmware:", kbinfo.sval_firmware);
            await svalService.pull(kbinfo);
            // Sync hardware layer colors to cosmetic colors for UI display
            svalService.syncCosmeticLayerColors(kbinfo);
        }

        // Set up default cosmetic layer names
        svalService.setupCosmeticLayerNames(kbinfo);

        // Load features (combos, macros, etc.)
        await this.getFeatures(kbinfo);

        // Get keymap for all layers
        await this.getKeyMap(kbinfo);
        await this.macro.get(kbinfo);
        await this.tapdance.get(kbinfo);
        await this.combo.get(kbinfo);
        await this.override.get(kbinfo);

        // Load Svil-specific features based on feature flags
        // Alt Repeat Keys don't have a flag - check entry count from definition
        if (kbinfo.alt_repeat_key_count && kbinfo.alt_repeat_key_count > 0) {
            try {
                await this.getAltRepeatKeys(kbinfo);
            } catch (e) {
                console.warn("Alt Repeat Keys not available:", e);
            }
        }

        // Leaders require LEADER flag (0x08)
        const flags = kbinfo.feature_flags ?? 0;
        if ((flags & SVIL_FLAG_LEADER) && kbinfo.leader_count && kbinfo.leader_count > 0) {
            try {
                await this.getLeaders(kbinfo);
            } catch (e) {
                console.warn("Leaders not available:", e);
            }
        }

        // One-shot requires ONESHOT flag (0x04)
        if (flags & SVIL_FLAG_ONESHOT) {
            try {
                await this.getOneShot(kbinfo);
            } catch (e) {
                console.warn("One-shot settings not available:", e);
            }
        }

        // Load fragment data (hardware detection and EEPROM selections)
        if (this.fragment.hasFragments(kbinfo)) {
            try {
                await this.fragment.get(kbinfo);
                // Compose keyboard layout from fragments
                const composedLayout = this.fragmentComposer.composeLayout(kbinfo);
                if (Object.keys(composedLayout).length > 0) {
                    kbinfo.keylayout = composedLayout;
                    console.log("Fragment layout composed:", Object.keys(composedLayout).length, "keys");
                }
            } catch (e) {
                console.warn("Fragments not available:", e);
            }
        }

        return kbinfo;
    }

    async getKeyboardInfo(kbinfo: KeyboardInfo): Promise<KeyboardInfo> {
        // VIA Protocol version (via wrapped VIA command)
        kbinfo.via_proto = (await this.usb.send(SvilUSB.CMD_VIA_GET_PROTOCOL_VERSION, [], {
            unpack: "B>H",
            index: 1,
        })) as number;

        // Get Svil protocol info
        const svilInfo = await this.usb.sendSvil(SvilUSB.CMD_SVIL_GET_INFO, [], {
            uint8: true,
        });

        // Parse Svil info response:
        // Response format after wrapper stripped: [cmd_echo][protocol_version:4][uid:8][feature_flags:1]
        const dv = new DataView((svilInfo as Uint8Array).buffer);
        kbinfo.svil_proto = dv.getUint32(1, true); // Skip cmd_echo
        kbinfo.feature_flags = svilInfo[13]; // Skip cmd_echo

        // Extract UID as hex string for kbid
        // UID is stored as little-endian 64-bit integer, so reverse bytes for hex string
        const uidBytes = (svilInfo as Uint8Array).slice(5, 13); // Skip cmd_echo + protocol_version
        kbinfo.kbid = Array.from(uidBytes).reverse().map(b => b.toString(16).padStart(2, '0')).join('');

        // Get compressed JSON payload size via Svil protocol
        // Response format after wrapper stripped: [cmd_echo][size0][size1][size2][size3]
        const sizeResp = await this.usb.sendSvil(SvilUSB.CMD_SVIL_DEFINITION_SIZE, [], {
            uint32: true,
            index: 1, // Skip command echo byte
        });
        const payload_size = sizeResp as number;

        if (payload_size > 50 * 1024 * 1024) { // Safety sanity check (50MB)
            throw new Error(`Invalid payload size: ${payload_size}`);
        }

        // Fetch definition in chunks using Svil protocol
        // firmware definition chunk size = 22 (32 total - 6 wrapper - 4 response header)
        const chunkSize = 22;
        const payload = new ArrayBuffer(payload_size);
        const pdv = new DataView(payload);
        let offset = 0;

        while (offset < payload_size) {
            const requestSize = Math.min(chunkSize, payload_size - offset);
            const resp = await this.usb.sendSvil(
                SvilUSB.CMD_SVIL_DEFINITION_CHUNK,
                [...LE16(offset), requestSize],
                { uint8: true }
            );

            const data = resp as Uint8Array;
            // Response format after wrapper stripped: [cmd_echo][offset_lo][offset_hi][actual_size][data...]
            const actualSize = data[3];
            for (let i = 0; i < actualSize && offset < payload_size; i++) {
                pdv.setInt8(offset, data[4 + i]);
                offset++;
            }

            if (actualSize < requestSize) break; // End of data
        }

        // Decompress and parse JSON
        const decompressed = await decompress(payload);
        const payloadData = JSON.parse(decompressed);
        requireProductionFirmware(payloadData);
        kbinfo.payload = payloadData;

        kbinfo.rows = payloadData.matrix.rows;
        kbinfo.cols = payloadData.matrix.cols;
        kbinfo.custom_keycodes = payloadData.customKeycodes;

        // Extract keyboard name from definition
        if (payloadData.name) {
            kbinfo.name = payloadData.name;
        }

        // Extract Svil feature counts from the definition
        if (payloadData.viable) {
            kbinfo.tapdance_count = payloadData.viable.tap_dance || 0;
            kbinfo.combo_count = payloadData.viable.combo || 0;
            kbinfo.key_override_count = payloadData.viable.key_override || 0;
            kbinfo.alt_repeat_key_count = payloadData.viable.alt_repeat_key || 0;
            kbinfo.leader_count = payloadData.viable.leader || 0;
        }

        // Extract fragments and composition for modular layouts
        if (payloadData.fragments) {
            kbinfo.fragments = payloadData.fragments;
        }
        if (payloadData.composition) {
            kbinfo.composition = payloadData.composition;
        }

        // Extract VIA3 custom UI menus for dynamic settings panels
        if (payloadData.menus && Array.isArray(payloadData.menus)) {
            kbinfo.menus = payloadData.menus;
            console.log("Loaded custom UI menus:", payloadData.menus.map((m: { label?: string }) => m.label).filter(Boolean));
        }

        return kbinfo;
    }

    async getFeatures(kbinfo: KeyboardInfo): Promise<void> {
        // Get macro info via VIA commands (wrapped)
        const macro_count = await this.usb.send(SvilUSB.CMD_VIA_MACRO_GET_COUNT, [], { uint8: true, index: 1 });

        const macros_size = (await this.usb.send(SvilUSB.CMD_VIA_MACRO_GET_BUFFER_SIZE, [], {
            unpack: "B>H",
            index: 1,
        })) as number;

        kbinfo.macro_count = macro_count;
        kbinfo.macros_size = macros_size;

        // Feature counts are already loaded from viable.json in getKeyboardInfo
    }

    async getKeyMap(kbinfo: KeyboardInfo): Promise<void> {
        kbinfo.layers = await this.usb.send(SvilUSB.CMD_VIA_GET_LAYER_COUNT, [], {
            uint8: true,
            index: 1,
        });

        if (!kbinfo.layers) {
            throw new Error("Failed to get layer count");
        }

        const size = kbinfo.layers * kbinfo.rows * kbinfo.cols;

        // Get keymap data as uint16 array (big-endian converted to host endian)
        const alldata = await this.usb.getViaBuffer(SvilUSB.CMD_VIA_KEYMAP_GET_BUFFER, size * 2, { uint16: true, slice: 2, bigendian: true, bytes: 2 });

        kbinfo.keymap = [];

        if (!Array.isArray(alldata)) {
            throw new Error("Expected array of keycodes from getViaBuffer");
        }

        for (let l = 0; l < kbinfo.layers; l++) {
            const layer: number[] = [];
            for (let r = 0; r < kbinfo.rows; r++) {
                for (let c = 0; c < kbinfo.cols; c++) {
                    const offset = l * kbinfo.rows * kbinfo.cols + r * kbinfo.cols + c;
                    const keycode = alldata[offset];
                    layer.push(keycode);
                }
            }
            kbinfo.keymap[l] = layer;
        }
    }

    /**
     * Get Alt Repeat Key entries from keyboard
     */
    async getAltRepeatKeys(kbinfo: KeyboardInfo): Promise<void> {
        if (!kbinfo.alt_repeat_key_count) return;

        kbinfo.alt_repeat_keys = [];
        for (let i = 0; i < kbinfo.alt_repeat_key_count; i++) {
            const data = await this.usb.sendSvil(
                SvilUSB.CMD_SVIL_ALT_REPEAT_KEY_GET,
                [i],
                { uint8: true }
            ) as Uint8Array;

            // Response format after wrapper stripped: [cmd_echo][index][keycode:2][alt_keycode:2][allowed_mods][options]
            const dv = new DataView(data.buffer);
            const entry: AltRepeatKeyEntry = {
                arkid: i,
                keycode: keyService.stringify(dv.getUint16(2, true)), // Skip cmd_echo + index
                alt_keycode: keyService.stringify(dv.getUint16(4, true)),
                allowed_mods: data[6],
                options: data[7],
            };
            kbinfo.alt_repeat_keys.push(entry);
        }
    }

    /**
     * Get Leader sequence entries from keyboard
     */
    async getLeaders(kbinfo: KeyboardInfo): Promise<void> {
        if (!kbinfo.leader_count) return;

        kbinfo.leaders = [];
        for (let i = 0; i < kbinfo.leader_count; i++) {
            const data = await this.usb.sendSvil(
                SvilUSB.CMD_SVIL_LEADER_GET,
                [i],
                { uint8: true }
            ) as Uint8Array;

            // Response format after wrapper stripped: [cmd_echo][index][seq0:2][seq1:2][seq2:2][seq3:2][seq4:2][output:2][options:2]
            const dv = new DataView(data.buffer);
            const sequence: string[] = [];
            for (let j = 0; j < 5; j++) {
                const kc = dv.getUint16(2 + j * 2, true); // Skip cmd_echo + index
                if (kc !== 0) {
                    sequence.push(keyService.stringify(kc));
                }
            }

            const entry: LeaderEntry = {
                ldrid: i,
                sequence,
                output: keyService.stringify(dv.getUint16(12, true)), // Skip cmd_echo
                options: dv.getUint16(14, true),
            };
            kbinfo.leaders.push(entry);
        }
    }

    /**
     * Get One-shot settings from keyboard
     */
    async getOneShot(kbinfo: KeyboardInfo): Promise<void> {
        const data = await this.usb.sendSvil(
            SvilUSB.CMD_SVIL_ONE_SHOT_GET,
            [],
            { uint8: true }
        ) as Uint8Array;

        // Response format after wrapper stripped: [cmd_echo][timeout:2][tap_toggle]
        const dv = new DataView(data.buffer);
        kbinfo.one_shot = {
            timeout: dv.getUint16(1, true), // Skip cmd_echo
            tap_toggle: data[3],
        };
    }

    async pollMatrix(kbinfo: KeyboardInfo): Promise<boolean[][]> {
        const data = await this.usb.send(SvilUSB.CMD_VIA_GET_KEYBOARD_VALUE, [SvilUSB.VIA_SWITCH_MATRIX_STATE], {}) as Uint8Array;
        const rowbytes = Math.ceil(kbinfo.cols / 8);

        // Skip first 3 bytes: cmd echo, value ID, offset byte (matches viable-gui)
        let offset = 0;
        if (data[0] === SvilUSB.CMD_VIA_GET_KEYBOARD_VALUE && data[1] === SvilUSB.VIA_SWITCH_MATRIX_STATE) {
            offset = 3;
        }

        const kmpressed: boolean[][] = [];
        for (let row = 0; row < kbinfo.rows; row++) {
            const rowpressed: boolean[] = [];
            if (offset + rowbytes > data.length) {
                break;
            }
            const coldata = data.slice(offset, offset + rowbytes);
            for (let col = 0; col < kbinfo.cols; col++) {
                // Reverse byte order within row (matches viable-gui)
                const colbyte = rowbytes - 1 - Math.floor(col / 8);
                const colbit = 1 << (col % 8);

                if (colbyte >= 0 && colbyte < coldata.length) {
                    rowpressed.push((coldata[colbyte] & colbit) !== 0);
                } else {
                    rowpressed.push(false);
                }
            }
            offset += rowbytes;
            kmpressed.push(rowpressed);
        }
        return kmpressed;
    }

    async getLayerStateMask(): Promise<number> {
        const mask = await this.usb.sendSvil(SvilUSB.CMD_SVIL_LAYER_STATE_GET, [], {
            uint32: true,
            index: 1,
        }) as number;
        return mask >>> 0;
    }

    getActiveLayerIndexFromMask(mask: number): number {
        const unsignedMask = mask >>> 0;
        if (unsignedMask === 0) return 0;
        for (let i = 31; i >= 0; i--) {
            if ((unsignedMask & (1 << i)) !== 0) {
                return i;
            }
        }
        /* v8 ignore next */
        return 0;
    }

    async getActiveLayerIndex(): Promise<number> {
        const mask = await this.getLayerStateMask();
        return this.getActiveLayerIndexFromMask(mask);
    }

    // API methods for updating keyboard settings
    async updateKey(layer: number, row: number, col: number, keymask: number): Promise<void> {
        const BE16 = (num: number) => [(num >> 8) & 0xff, num & 0xff];
        await this.usb.send(SvilUSB.CMD_VIA_SET_KEYCODE, [layer, row, col, ...BE16(keymask)], {});
    }

    async updateMacros(kbinfo: KeyboardInfo) {
        await this.macro.push(kbinfo);
    }

    async updateTapdance(kbinfo: KeyboardInfo, tdid: number) {
        await this.tapdance.push(kbinfo, tdid);
    }

    async updateCombo(kbinfo: KeyboardInfo, cmbid: number) {
        await this.combo.push(kbinfo, cmbid);
    }

    async updateKeyoverride(kbinfo: KeyboardInfo, koid: number) {
        await this.override.push(kbinfo, koid);
    }

    async updateQMKSetting(kbinfo: KeyboardInfo, qfield: number) {
        await this.qmk.push(kbinfo, qfield);
    }

    /**
     * Update Alt Repeat Key entry on keyboard
     */
    async updateAltRepeatKey(kbinfo: KeyboardInfo, arkid: number): Promise<void> {
        const entry = kbinfo.alt_repeat_keys?.[arkid];
        if (!entry) return;

        const keycode = keyService.parse(entry.keycode);
        const alt_keycode = keyService.parse(entry.alt_keycode);

        await this.usb.sendSvil(SvilUSB.CMD_SVIL_ALT_REPEAT_KEY_SET, [
            arkid,
            keycode & 0xff,
            (keycode >> 8) & 0xff,
            alt_keycode & 0xff,
            (alt_keycode >> 8) & 0xff,
            entry.allowed_mods,
            entry.options,
        ], {});
    }

    /**
     * Update Leader sequence entry on keyboard
     */
    async updateLeader(kbinfo: KeyboardInfo, ldrid: number): Promise<void> {
        const entry = kbinfo.leaders?.[ldrid];
        if (!entry) return;

        const args: number[] = [ldrid];

        // Add up to 5 sequence keys
        for (let i = 0; i < 5; i++) {
            const kc = entry.sequence[i] ? keyService.parse(entry.sequence[i]) : 0;
            args.push(kc & 0xff, (kc >> 8) & 0xff);
        }

        // Add output keycode
        const output = keyService.parse(entry.output);
        args.push(output & 0xff, (output >> 8) & 0xff);

        // Add options
        args.push(entry.options & 0xff, (entry.options >> 8) & 0xff);

        await this.usb.sendSvil(SvilUSB.CMD_SVIL_LEADER_SET, args, {});
    }

    /**
     * Update One-shot settings on keyboard
     */
    async updateOneShot(kbinfo: KeyboardInfo): Promise<void> {
        const os = kbinfo.one_shot;
        if (!os) return;

        await this.usb.sendSvil(SvilUSB.CMD_SVIL_ONE_SHOT_SET, [
            os.timeout & 0xff,
            (os.timeout >> 8) & 0xff,
            os.tap_toggle,
        ], {});
    }

    /**
     * Update a fragment selection on keyboard
     */
    async updateFragmentSelection(
        kbinfo: KeyboardInfo,
        instanceIdx: number,
        optionIdx: number
    ): Promise<boolean> {
        return this.fragment.setSelection(kbinfo, instanceIdx, optionIdx);
    }

    /**
     * Get fragment service for direct access if needed
     */
    getFragmentService(): FragmentService {
        return this.fragment;
    }

    /**
     * Get fragment composer service for recomposing layouts
     */
    getFragmentComposer(): FragmentComposerService {
        return this.fragmentComposer;
    }

    /**
     * Save all Svil settings to EEPROM
     */
    async saveSvil(): Promise<void> {
        await this.usb.sendSvil(SvilUSB.CMD_SVIL_SAVE, [], {});
    }

    /**
     * Reset all Svil settings to defaults
     */
    async resetSvil(): Promise<void> {
        await this.usb.sendSvil(SvilUSB.CMD_SVIL_RESET, [], {});
    }

    isLayerEmpty(layer: number[]): boolean {
        return layer.every((keycode) => keycode === 0 || keycode === -1 || keycode === 255);
    }
}

// Export with both names for backward compatibility
export const svilService = new SvilService(usbInstance);
export const vialService = svilService; // Alias for backward compatibility

// Also export the class with old name
export { SvilService as VialService };
