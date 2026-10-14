// Touch gestures (Sval 0x2E, experimental): who owns scroll, swipe and pinch on a
// unified Azoteq touchpad pair, the firmware's own swipe and pinch outputs, and
// their tunables. Wire format: sval-qmk keyboards/svalboard/docs/protocol.md,
// "Touch gestures" (branch experiment/cyrus-multitouch on morganvenable/sval-qmk).
import { usbInstance, type SvilUSB } from "./usb.service";

/** GET_INFO second feature byte: the board answers TOUCH_GESTURES (0x2E). */
export const SVIL_FLAG2_TOUCH_GESTURES = 0x10;
export const CMD_SVIL_TOUCH_GESTURES = 0x2e;
const VERSION = 1;
const SIZE = 21;

export type ScrollOwner = "windows" | "chip";
export type GestureOwner = "windows" | "firmware";
export const OUTPUTS = [
    { key: "swipeLeft", label: "Swipe left" },
    { key: "swipeRight", label: "Swipe right" },
    { key: "swipeUp", label: "Swipe up" },
    { key: "swipeDown", label: "Swipe down" },
    { key: "pinchOut", label: "Pinch out" },
    { key: "pinchIn", label: "Pinch in" },
] as const;

export interface TouchGestures {
    scrollOwner: ScrollOwner;
    swipeOwner: GestureOwner;
    pinchOwner: GestureOwner;
    spanPads: boolean;
    hostAlwaysMerge: boolean;
    swipeFingers: number;
    sustainMin: number;
    swipeMm: number;
    swipeRatioX10: number;
    settleMs: number;
    swipeWindow10ms: number;
    swipeRepeatMm: number;
    pinchStartX2: number;
    pinchStepX2: number;
    /** Swipe left, right, up, down, pinch out, pinch in: 16-bit QMK keycodes, 0 = nothing. */
    keycodes: number[];
}

export interface TouchGestureStatus {
    mode: "normal" | "single-pad lease" | "unified" | "unknown";
    handingBack: boolean;
    claimed: boolean;
    lastGesture: string;
    outputs: number;
    claims: number;
    contactsLeft: number | null;
    contactsRight: number | null;
}

export const TUNABLES: ReadonlyArray<{ key: keyof TouchGestures; label: string; min: number; max: number; scale?: number; unit?: string; hint: string }> = [
    { key: "swipeFingers", label: "Swipe fingers", min: 3, max: 5, hint: "Fingers that start a swipe." },
    { key: "sustainMin", label: "Fingers to keep going", min: 1, max: 5, hint: "A recognized swipe continues while this many fingers stay down." },
    { key: "swipeMm", label: "Swipe distance", min: 4, max: 40, unit: "mm", hint: "Travel that recognizes a swipe." },
    { key: "swipeRatioX10", label: "Axis ratio", min: 10, max: 50, scale: 10, hint: "The main direction must beat the other by this much." },
    { key: "settleMs", label: "Settle time", min: 0, max: 200, unit: "ms", hint: "All swipe fingers down this long before travel counts." },
    { key: "swipeWindow10ms", label: "Swipe window", min: 10, max: 200, scale: 0.1, unit: "ms", hint: "The swipe distance must be covered within this time." },
    { key: "swipeRepeatMm", label: "Repeat every", min: 0, max: 40, unit: "mm", hint: "0 fires once per swipe; otherwise fires again for every this many mm." },
    { key: "pinchStartX2", label: "Pinch start", min: 2, max: 40, scale: 2, unit: "mm", hint: "Change in finger distance that starts a pinch." },
    { key: "pinchStepX2", label: "Pinch step", min: 1, max: 40, scale: 2, unit: "mm", hint: "Further change for each zoom step." },
];

export const DEFAULT_TOUCH_GESTURES: TouchGestures = {
    scrollOwner: "windows", swipeOwner: "windows", pinchOwner: "windows", spanPads: true, hostAlwaysMerge: false,
    swipeFingers: 3, sustainMin: 1, swipeMm: 12, swipeRatioX10: 20, settleMs: 40, swipeWindow10ms: 60,
    swipeRepeatMm: 0, pinchStartX2: 8, pinchStepX2: 6,
    keycodes: [0x094f, 0x0950, 0x082b, 0x0807, 0x01d9, 0x01da],
};

export function supportsTouchGestures(featureFlags2: number | undefined): boolean {
    return ((featureFlags2 ?? 0) & SVIL_FLAG2_TOUCH_GESTURES) !== 0;
}

export function problems(c: TouchGestures): string[] {
    const out: string[] = [];
    for (const t of TUNABLES) {
        const v = c[t.key] as number;
        if (!Number.isInteger(v) || v < t.min || v > t.max) out.push(`${t.label} is out of range`);
    }
    if (c.sustainMin > c.swipeFingers) out.push("Fingers to keep going can't exceed swipe fingers");
    if (c.swipeRepeatMm !== 0 && c.swipeRepeatMm < 4) out.push("Repeat every must be 0 or 4-40 mm");
    return out;
}

export function encodeTouchGestures(c: TouchGestures): number[] {
    const owners = (c.scrollOwner === "chip" ? 1 : 0) | (c.swipeOwner === "firmware" ? 2 : 0) |
        (c.pinchOwner === "firmware" ? 4 : 0) | (c.spanPads ? 8 : 0) | (c.hostAlwaysMerge ? 16 : 0);
    const out = [owners, (c.swipeFingers & 15) | (c.sustainMin << 4), c.swipeMm, c.swipeRatioX10, c.settleMs,
        c.swipeWindow10ms, c.swipeRepeatMm, c.pinchStartX2, c.pinchStepX2];
    for (const k of c.keycodes) out.push(k & 0xff, (k >> 8) & 0xff);
    return out;
}

export function decodeTouchGestures(p: ArrayLike<number>): TouchGestures {
    if (p.length < SIZE) throw new Error("Touch gesture payload is 21 bytes");
    const keycodes: number[] = [];
    for (let i = 0; i < 6; i++) keycodes.push(p[9 + 2 * i] | (p[10 + 2 * i] << 8));
    return {
        scrollOwner: p[0] & 1 ? "chip" : "windows",
        swipeOwner: p[0] & 2 ? "firmware" : "windows",
        pinchOwner: p[0] & 4 ? "firmware" : "windows",
        spanPads: (p[0] & 8) !== 0,
        hostAlwaysMerge: (p[0] & 16) !== 0,
        swipeFingers: p[1] & 15, sustainMin: p[1] >> 4, swipeMm: p[2], swipeRatioX10: p[3], settleMs: p[4],
        swipeWindow10ms: p[5], swipeRepeatMm: p[6], pinchStartX2: p[7], pinchStepX2: p[8], keycodes,
    };
}

const STATUS_TEXT: Record<number, string> = {
    1: "the board didn't accept this payload version",
    2: "a value is out of range, so nothing was changed",
    3: "this firmware has no touch gesture support",
};

function check(reply: Uint8Array, sub: number): void {
    // reply[0] is the command (0x2E), then the sub-command and its status.
    if (reply[0] !== CMD_SVIL_TOUCH_GESTURES || reply[1] !== sub) throw new Error("Unexpected touch gestures reply");
    if (reply[2] !== 0) throw new Error(`Touch gestures: ${STATUS_TEXT[reply[2]] ?? `status ${reply[2]}`}`);
}

export class TouchGesturesService {
    constructor(private usb: SvilUSB) { }

    async get(): Promise<TouchGestures> {
        const r = await this.usb.sendSvil(CMD_SVIL_TOUCH_GESTURES, [0], { uint8: true }) as Uint8Array;
        check(r, 0);
        if (r[3] !== VERSION || r[4] !== SIZE) throw new Error(`Touch gestures payload v${r[3]} is not supported`);
        return decodeTouchGestures(r.slice(5, 5 + SIZE));
    }

    /** Applies at once; the board saves it only if something changed. */
    async set(c: TouchGestures): Promise<void> {
        const r = await this.usb.sendSvil(CMD_SVIL_TOUCH_GESTURES, [1, VERSION, SIZE, ...encodeTouchGestures(c)], { uint8: true }) as Uint8Array;
        check(r, 1);
    }

    async defaults(): Promise<TouchGestures> {
        const r = await this.usb.sendSvil(CMD_SVIL_TOUCH_GESTURES, [2], { uint8: true }) as Uint8Array;
        check(r, 2);
        return decodeTouchGestures(r.slice(3, 3 + SIZE));
    }

    /** Live readout; the output and claim counts are since the previous read. */
    async status(): Promise<TouchGestureStatus> {
        const r = await this.usb.sendSvil(CMD_SVIL_TOUCH_GESTURES, [3], { uint8: true }) as Uint8Array;
        check(r, 3);
        const modes = ["normal", "single-pad lease", "unified"] as const;
        const gestures = ["none", ...OUTPUTS.map(o => o.label)];
        return {
            mode: modes[r[3] & 0x7f] ?? "unknown",
            handingBack: (r[3] & 0x80) !== 0,
            claimed: r[4] !== 0,
            lastGesture: gestures[r[5]] ?? `gesture ${r[5]}`,
            outputs: r[6] | (r[7] << 8),
            claims: r[8] | (r[9] << 8),
            contactsLeft: r[10] === 0xff ? null : r[10],
            contactsRight: r[11] === 0xff ? null : r[11],
        };
    }
}

export const touchGesturesService = new TouchGesturesService(usbInstance);
