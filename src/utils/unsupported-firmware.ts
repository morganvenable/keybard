/**
 * The keyboard doesn't speak the Sval protocol Keybard needs. Raised while
 * connecting, before any of its replies are parsed as Sval data, so the user gets
 * "update your firmware" instead of whatever the garbage replies would break.
 *
 * - svalboard-vial: a Svalboard still on its old Vial firmware (svalboard/vial-qmk).
 * - other-qmk: some other VIA/Vial keyboard.
 * - outdated-sval: Svalboard QMK from before Sval protocol 3 (pre-release builds).
 * - unknown: no Sval reply and nothing else recognisable.
 */
export type UnsupportedFirmwareKind = "svalboard-vial" | "other-qmk" | "outdated-sval" | "unknown";

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
