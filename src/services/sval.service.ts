import { SvilUSB, usbInstance } from "./usb.service";
import { getClosestPresetColor } from "../utils/color-conversion";

// Svalboard-specific protocol service
import type { KeyboardInfo } from "../types/keyboard.types";

export class SvalService {
    private static readonly SVAL_IDENTIFIER = 0xee;
    private static readonly GET_PROTO_VERSION = 0x01;
    private static readonly GET_FIRMWARE_VERSION = 0x02;
    private static readonly LAYER_COLOR_GET = 0x10;
    private static readonly LAYER_COLOR_SET = 0x11;

    private usb: SvilUSB;

    constructor(usb: SvilUSB) {
        this.usb = usb;
    }

    private async send(param: number, args: number[], options?: any): Promise<any> {
        return this.usb.send(SvalService.SVAL_IDENTIFIER, [param, ...args], options);
    }

    async check(kbinfo: KeyboardInfo): Promise<boolean> {
        try {
            const check = (await this.send(SvalService.GET_PROTO_VERSION, [], {
                unpack: "BBBB<I",
            })) as (number | bigint)[];

            // Check for "sval" identifier
            const code = "sval";
            if (check[0] === code.charCodeAt(0) && check[1] === code.charCodeAt(1) && check[2] === code.charCodeAt(2) && check[3] === code.charCodeAt(3)) {
                kbinfo.sval_proto = check[4] as number;

                // Get firmware version
                const version = (await this.send(SvalService.GET_FIRMWARE_VERSION, [], {
                    uint8: true,
                })) as Uint8Array;

                const decoder = new TextDecoder();
                kbinfo.sval_firmware = decoder.decode(version).replace(/\x00/g, "");

                return true;
            }
        } catch (error) {
            console.log("Sval protocol not supported:", error);
        }

        kbinfo.sval_proto = 0;
        return false;
    }

    async pull(kbinfo: KeyboardInfo): Promise<void> {
        if (!kbinfo.sval_proto || kbinfo.sval_proto < 1) {
            return;
        }

        const layer_colors: Array<{ hue: number; sat: number; val: number }> = [];

        for (let i = 0; i < (kbinfo.layers || 16); i++) {
            try {
                const hsv = (await this.send(SvalService.LAYER_COLOR_GET, [i], {
                    unpack: "BBB",
                })) as number[];

                layer_colors[i] = {
                    hue: hsv[0],
                    sat: hsv[1],
                    val: hsv[2],
                };
            } catch (error) {
                // Layer might not exist, continue
                layer_colors[i] = { hue: 0, sat: 0, val: 0 };
            }
        }

        kbinfo.layer_colors = layer_colors;
    }

    async setLayerColor(layer: number, hue: number, sat: number, val: number): Promise<void> {
        await this.send(SvalService.LAYER_COLOR_SET, [layer, hue, sat, val]);
    }

    /**
     * Set default cosmetic layer names if not present
     */
    setupCosmeticLayerNames(kbinfo: KeyboardInfo): void {
        if ((kbinfo.svil_proto ?? 1) >= 2) {
            kbinfo.cosmetic ??= {};
            kbinfo.cosmetic.layer ??= {};
            return;
        }
        if (!kbinfo.cosmetic) {
            kbinfo.cosmetic = {
                layer: {
                    "0": "default",
                    "4": "NAS",
                    "5": "Fn Keys",
                    "15": "Mouse",
                },
            };
        } else if (!kbinfo.cosmetic.layer) {
            kbinfo.cosmetic.layer = {
                "0": "default",
                "4": "NAS",
                "5": "Fn Keys",
                "15": "Mouse",
            };
        }
    }

    /**
     * Get the display name for a layer
     * Prefer the custom name, with a fallback for unnamed layers.
     */
    getLayerName(kbinfo: KeyboardInfo, layerIndex: number): string {
        const name = this.getLayerCosmetic(kbinfo, layerIndex);
        if (name) return name;
        if (layerIndex === 15 && (kbinfo.svil_proto ?? 1) < 2) {
            return "Mouse";
        }
        return `Layer ${layerIndex}`;
    }

    getLayerCosmetic(kbinfo: KeyboardInfo, layerIndex: number): string | undefined {
        return kbinfo.cosmetic?.layer?.[layerIndex.toString()];
    }

    /**
     * Get the short display name for a layer (used in tabs)
     * Prefer the custom name, with a fallback for unnamed layers.
     */
    getLayerNameNoLabel(kbinfo: KeyboardInfo, layerIndex: number): string {
        const name = this.getLayerCosmetic(kbinfo, layerIndex);
        if (name) return name;
        if (layerIndex === 15 && (kbinfo.svil_proto ?? 1) < 2) {
            return "mouse";
        }
        return `${layerIndex}`;
    }

    /**
     * Sync hardware layer colors to cosmetic layer colors
     * Call this after pull() to ensure UI reflects actual hardware state
     */
    syncCosmeticLayerColors(kbinfo: KeyboardInfo): void {
        if (!kbinfo.layer_colors || kbinfo.layer_colors.length === 0) {
            return;
        }

        if (!kbinfo.cosmetic) {
            kbinfo.cosmetic = { layer: {}, layer_colors: {} };
        }
        if (!kbinfo.cosmetic.layer_colors) {
            kbinfo.cosmetic.layer_colors = {};
        }

        // For each hardware layer color, find the closest preset and set it
        for (let i = 0; i < kbinfo.layer_colors.length; i++) {
            const hwColor = kbinfo.layer_colors[i];
            if (hwColor && (hwColor.hue !== 0 || hwColor.sat !== 0 || hwColor.val !== 0)) {
                const closestPreset = getClosestPresetColor(hwColor.hue, hwColor.sat, hwColor.val);
                if (closestPreset) {
                    kbinfo.cosmetic.layer_colors[i.toString()] = closestPreset;
                }
            }
        }
    }
}

export const svalService = new SvalService(usbInstance);
