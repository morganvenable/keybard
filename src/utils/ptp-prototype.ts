// The touchpad prototype controls (dev firmware only): the dev protocol (0xFC)
// through the 0xDD client wrapper, op 0x42. Release firmware doesn't have it:
// it answers with a wrapper error frame (unknown protocol), and the group
// never shows.
//
// Request (absolute bytes of the report):
//   [0]=0xDD [1..4]=client id [5]=0xFC [6]=0x42 [7]=action [8..]=args
//   action 3, the prototype config: [8] 0 get, 1 set; a set writes all four:
//     [9] scroll, [10] sniper, [11] boost, [12] surface (stored, applies at next boot)
//   action 5: reboot the board about 200 ms after replying
// Reply:
//   [5]=0xFC [6]=0xC2 [7]=status (0 ok, 2 refused) [8]=touch owner [9]=flags
//   flags bit 4: the prototype block is present:
//   [56]=block version [57]=scroll [58]=sniper [59]=boost
//   [60]=surface stored [61]=surface active [62]=supported mask [63]=debug

export const DEV_PROTOCOL = 0xfc;
export const DEV_OP_PAD = 0x42;
export const DEV_OP_PAD_REPLY = 0xc2;
export const PROTO_ACTION_CONFIG = 3;
export const PROTO_ACTION_REBOOT = 5;
export const PROTO_CONFIG_GET = 0;
export const PROTO_CONFIG_SET = 1;
export const PROTO_STATUS_OK = 0;
export const PROTO_STATUS_REFUSED = 2;
export const PROTO_FLAG_BLOCK = 0x10;
/** The block sits at the end of a 64-byte report. */
export const PROTO_REPORT_BYTES = 64;
export const PROTO_BLOCK_AT = 56;

export const SUPPORT_SCROLL_TAKEOVER = 0x01;
export const SUPPORT_TAKEOVER = 0x02; // sniper and boost
export const SUPPORT_SCALING = 0x04; // sniper and boost
export const SUPPORT_LARGE_SURFACE = 0x08;

export const SCROLL_OFF = 0;
export const SCROLL_TAKEOVER = 1;
export const MODE_OFF = 0;
export const MODE_TAKEOVER = 1;
export const MODE_SCALING = 2;
export const SURFACE_STANDARD = 0;
export const SURFACE_LARGE = 1;

export interface ProtoConfig {
    scroll: number;
    sniper: number;
    boost: number;
    /** The surface written to the board: it applies at the next boot. */
    surface: number;
}

export interface ProtoState extends ProtoConfig {
    version: number;
    /** The surface in use now. */
    surfaceActive: number;
    supported: number;
}

export interface ProtoReply {
    status: number;
    owner: number;
    flags: number;
    /** The prototype block, when the reply carries it (flags bit 4, block version 1 or later). */
    state: ProtoState | null;
}

/** The payload after the protocol byte: [0x42][action][args...]. */
export function protoPayload(action: number, args: number[] = []): number[] {
    return [DEV_OP_PAD, action, ...args];
}

export function protoGetPayload(): number[] {
    return protoPayload(PROTO_ACTION_CONFIG, [PROTO_CONFIG_GET]);
}

/** A set writes all four values. */
export function protoSetPayload(config: ProtoConfig): number[] {
    return protoPayload(PROTO_ACTION_CONFIG, [PROTO_CONFIG_SET, config.scroll, config.sniper, config.boost, config.surface].map((v) => v & 0xff));
}

export function protoRebootPayload(): number[] {
    return protoPayload(PROTO_ACTION_REBOOT);
}

/**
 * A whole reply report (wrapper included). Null when it is not a reply to op
 * 0x42 on the dev protocol (or too short to be one).
 */
export function parseProtoReply(report: Uint8Array): ProtoReply | null {
    if (report.length < 10 || report[5] !== DEV_PROTOCOL || report[6] !== DEV_OP_PAD_REPLY) return null;
    const flags = report[9];
    let state: ProtoState | null = null;
    if (flags & PROTO_FLAG_BLOCK && report.length >= PROTO_REPORT_BYTES && report[PROTO_BLOCK_AT] >= 1) {
        const b = PROTO_BLOCK_AT;
        state = {
            version: report[b],
            scroll: report[b + 1],
            sniper: report[b + 2],
            boost: report[b + 3],
            surface: report[b + 4],
            surfaceActive: report[b + 5],
            supported: report[b + 6],
        };
    }
    return { status: report[7], owner: report[8], flags, state };
}

export function configOf(state: ProtoState): ProtoConfig {
    return { scroll: state.scroll, sniper: state.sniper, boost: state.boost, surface: state.surface };
}

export interface ProtoOption {
    value: number;
    label: string;
    /** The supported-mask bit the option needs (0: always there). */
    needs: number;
}

export const SCROLL_OPTIONS: readonly ProtoOption[] = [
    { value: SCROLL_OFF, label: "Off", needs: 0 },
    { value: SCROLL_TAKEOVER, label: "Takeover", needs: SUPPORT_SCROLL_TAKEOVER },
];
export const MODE_OPTIONS: readonly ProtoOption[] = [
    { value: MODE_OFF, label: "Off", needs: 0 },
    { value: MODE_TAKEOVER, label: "Takeover", needs: SUPPORT_TAKEOVER },
    { value: MODE_SCALING, label: "Scaling", needs: SUPPORT_SCALING },
];
export const SURFACE_OPTIONS: readonly ProtoOption[] = [
    { value: SURFACE_STANDARD, label: "Standard", needs: 0 },
    { value: SURFACE_LARGE, label: "Large", needs: SUPPORT_LARGE_SURFACE },
];

/** The options the board supports, plus the one it reports in use (so the read-back always shows). */
export function availableOptions(options: readonly ProtoOption[], supported: number, current: number): ProtoOption[] {
    return options.filter((o) => (o.needs & supported) === o.needs || o.value === current);
}

/** A reboot is pending: the stored surface differs from the one in use. */
export function surfacePending(state: ProtoState): boolean {
    return state.surface !== state.surfaceActive;
}
