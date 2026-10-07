import { MIN_SVIL_PROTO } from "../constants/firmware";

/**
 * The keyboard doesn't speak the Sval protocol Keybard needs. Raised while
 * connecting, before any of its replies are parsed as Sval data, so the user gets
 * "update your firmware" instead of whatever the garbage replies would break.
 *
 * - svalboard-vial: a Svalboard still on its old Vial firmware (svalboard/vial-qmk).
 * - other-qmk: some other VIA/Vial keyboard.
 * - outdated-sval: Svalboard QMK from before Sval protocol 3 (pre-release builds).
 * - unknown: refused or echoed the Sval bootstrap, and nothing else recognisable.
 * - no-response: didn't answer the bootstrap at all. Vial always answers, so this
 *   is a busy or stuck board (or one held by another app), not old firmware.
 */
export type UnsupportedFirmwareKind = "svalboard-vial" | "other-qmk" | "outdated-sval" | "unknown" | "no-response";

export interface UnsupportedFirmwareInfo {
    kind: UnsupportedFirmwareKind;
    /** The firmware's own version string (Vial-era Svalboards report their QMK git tag). */
    reportedVersion?: string;
    /** Sval protocol version, for outdated-sval. */
    svilProto?: number;
}

function describe({ kind, reportedVersion, svilProto }: UnsupportedFirmwareInfo): string {
    switch (kind) {
        case "svalboard-vial":
            return `This Svalboard is running the old Vial firmware${reportedVersion ? ` (${reportedVersion})` : ""}. Keybard needs Svalboard QMK firmware: update the keyboard, then connect again.`;
        case "outdated-sval":
            return `This Svalboard runs a pre-release Svalboard QMK build (Sval protocol ${svilProto ?? "?"}). Update its firmware, then connect again.`;
        case "other-qmk":
            return "This keyboard doesn't run Svalboard firmware. Keybard only configures keyboards running Svalboard QMK.";
        case "no-response":
            return "The keyboard didn't respond. Close other apps that use it (Vial, VIA, other Keybard tabs), unplug it and plug it back in, then connect again.";
        default:
            return "The keyboard didn't answer like Svalboard QMK firmware. If it is a Svalboard, update its firmware and connect again.";
    }
}

export class UnsupportedFirmwareError extends Error {
    readonly info: UnsupportedFirmwareInfo;

    constructor(info: UnsupportedFirmwareInfo) {
        super(describe(info));
        this.name = "UnsupportedFirmwareError";
        this.info = info;
    }
}

/**
 * Throw unless GET_INFO's Sval protocol version is one Keybard can use
 * (protocol 0 is what an echoed request reads as).
 */
export function assertSupportedSvilProto(svilProto: number): void {
    if (!svilProto) throw new UnsupportedFirmwareError({ kind: "unknown" });
    if (svilProto < MIN_SVIL_PROTO) throw new UnsupportedFirmwareError({ kind: "outdated-sval", svilProto });
}
