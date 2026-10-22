// What the Firmware page shows under "This keyboard", read from the updater.

import { describeFirmware } from "@/constants/firmware";
import type { KeyboardInfo } from "@/types/keyboard.types";
import { UpdaterClient } from "@/services/updater/client";
import { HAND_SELF, Presence, UPDATER_PROTOCOL, otherHand, type Hand } from "@/services/updater/protocol";
import type { UpdaterTransport } from "@/services/updater/transport";
import type { SideHost } from "@/services/side-host";
import { assessSides, type SideAssessment } from "@/services/side-decision";

export interface HalfSummary {
    hand: Hand;
    usb: boolean;
    /** The release tag, or "build <n>" for the half without USB when it differs. */
    tag: string;
    fwVersion: number;
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
    /** One-image firmware: which half is which (null: a per-hand build, or not read). */
    sides?: SideAssessment | null;
}

/** SIDE on one-image firmware; null on a per-hand build. Waits out "not reported yet" (0.5 s). */
export async function readSides(sides: SideHost | undefined, sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms))): Promise<SideAssessment | null> {
    if (!sides || !(await sides.supported())) return null;
    let a = assessSides(true, await sides.read());
    for (let i = 0; i < 6 && (a.kind === "pending" || a.kind === "unreadable"); i++) {
        await sleep(250);
        a = assessSides(true, await sides.read());
    }
    return a;
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
export async function readBoardSummary(transport: UpdaterTransport, keyboard?: KeyboardInfo | null, sideHost?: SideHost): Promise<BoardSummary> {
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
    const sides = await readSides(sideHost).catch(() => null);
    if (usb.protocol === UPDATER_PROTOCOL && usb.hand === HAND_SELF) {
        // One-image firmware on a half with no side yet: it answers as hand 0xFF. Show the fix, no halves.
        return {
            updater: true, legacyLabel: null, usbHand: 1, halves: [], differ: false, noChord: usb.noChord, fwVersion: usb.fwVersion,
            tag: (await c.info1().catch(() => null))?.tag ?? "", sides: sides ?? { kind: "unknown", halves: ["usb"], usb: "unknown", other: null, guess: {} },
        };
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
        { hand: usbHand, usb: true, tag, fwVersion: usb.fwVersion, answered: true },
    ];
    if (o?.answered) {
        halves.push({ hand: otherHand(usbHand), usb: false, tag: o.fwVersion === usb.fwVersion ? tag : `build ${o.fwVersion}`, fwVersion: o.fwVersion, answered: true });
    } else {
        halves.push({ hand: otherHand(usbHand), usb: false, tag: "", fwVersion: 0, answered: false });
    }
    // On one-image firmware, two halves on one side (SAME_HAND) is a side to set, not firmware to finish.
    const sideTrouble = !!sides && (sides.kind === "same" || sides.kind === "unknown");
    const differ = usb.otherDiffers || status.presence === Presence.VERSION || (!sideTrouble && (status.presence === Presence.SAME_HAND || status.presence === Presence.INVALID));
    halves.sort((a, b) => a.hand - b.hand);
    return { updater: true, legacyLabel: null, usbHand, halves, differ, noChord: usb.noChord, fwVersion: usb.fwVersion, tag, sides };
}
