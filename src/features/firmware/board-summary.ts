// What the Firmware page shows under "This keyboard", read from the updater.

import { describeFirmware } from "@/constants/firmware";
import type { KeyboardInfo } from "@/types/keyboard.types";
import { UpdaterClient } from "@/services/updater/client";
import { HAND_SELF, POINTING_NAMES, Presence, UPDATER_PROTOCOL, otherHand, type Hand } from "@/services/updater/protocol";
import type { UpdaterTransport } from "@/services/updater/transport";

export interface HalfSummary {
    hand: Hand;
    usb: boolean;
    /** The release tag, or "build <n>" for the half without USB when it differs. */
    tag: string;
    fwVersion: number;
    pointing: string;
    answered: boolean;
}

export interface BoardSummary {
    /** The board runs an updater this Keybard installs through (protocol 4). */
    updater: boolean;
    /** For boards without one: what they run, as far as Keybard can tell. */
    legacyLabel: string | null;
    usbHand: Hand;
    halves: HalfSummary[];
    /** Presence or INFO bit5 say the halves run different firmware (F9 / Q17). */
    differ: boolean;
    noChord: boolean;
    fwVersion: number;
    tag: string;
}

/**
 * What an updater build calls itself: its version string (the release tag release CI
 * builds it with), or its numeric version when the string is empty (a local build).
 */
export function updaterVersionLabel(versionString: string, fwVersion: number): string {
    const text = versionString.trim();
    return text || `fw version ${fwVersion}`;
}

/** Read the board's firmware state; a board without a protocol-4 updater reads as legacy. */
export async function readBoardSummary(transport: UpdaterTransport, keyboard?: KeyboardInfo | null): Promise<BoardSummary> {
    const legacy = (): BoardSummary => ({
        updater: false, legacyLabel: keyboard ? describeFirmware(keyboard) : null, usbHand: 1, halves: [], differ: false,
        noChord: false, fwVersion: 0, tag: keyboard ? describeFirmware(keyboard) ?? "" : "",
    });
    const c = new UpdaterClient(transport);
    let usb;
    try {
        usb = await c.info(HAND_SELF);
    } catch {
        return legacy();
    }
    if (usb.protocol !== UPDATER_PROTOCOL || (usb.hand !== 0 && usb.hand !== 1)) {
        // An updater Keybard doesn't install through (protocol 3, vNext1 and x3.x): name what it
        // runs from INFO page 1, which every updater protocol answers.
        const label = await c.info1().then((p) => updaterVersionLabel(p.tag, p.fwVersion || usb.fwVersion)).catch(() => updaterVersionLabel("", usb.fwVersion));
        return { ...legacy(), legacyLabel: label, tag: label, fwVersion: usb.fwVersion, usbHand: usb.hand === 0 ? 0 : 1 };
    }
    const usbHand = usb.hand as Hand;
    const tag = updaterVersionLabel((await c.info1()).tag, usb.fwVersion);
    const status = await c.status(usbHand);
    const o = await c.info(otherHand(usbHand)).catch(() => null);
    const halves: HalfSummary[] = [
        { hand: usbHand, usb: true, tag, fwVersion: usb.fwVersion, pointing: POINTING_NAMES[usb.pointingId] ?? "Unknown", answered: true },
    ];
    if (o?.answered) {
        halves.push({ hand: otherHand(usbHand), usb: false, tag: o.fwVersion === usb.fwVersion ? tag : `build ${o.fwVersion}`, fwVersion: o.fwVersion, pointing: POINTING_NAMES[o.pointingId] ?? "Unknown", answered: true });
    } else {
        halves.push({ hand: otherHand(usbHand), usb: false, tag: "", fwVersion: 0, pointing: "", answered: false });
    }
    const differ = usb.otherDiffers || status.presence === Presence.VERSION || status.presence === Presence.SAME_HAND || status.presence === Presence.INVALID;
    halves.sort((a, b) => a.hand - b.hand);
    return { updater: true, legacyLabel: null, usbHand, halves, differ, noChord: usb.noChord, fwVersion: usb.fwVersion, tag };
}
