// Scan Lab service: drives the firmware's matrix-timing characterization engine.
// Wire format: sval-qmk keyboards/svalboard/docs/scan-lab.md
import { SvilUSB, usbInstance } from "./usb.service";

export const SCANLAB_CHANNEL = 0x53;
export const SCANLAB_ROWS = 5;
export const SCANLAB_COLS = 6;
export const KEYBOARD_CHANNEL = 0;
export const ID_SCAN_PREWAIT_US = 13;
export const ID_SCAN_POSTWAIT_US = 14;
export const ID_HW_REVISION = 15;
export const ID_SCAN_PERIOD_US = 20;
export const ID_SCAN_IDLE_PERIOD_MS = 21;
export const ID_SCAN_IDLE_AFTER_MS = 22;
export const ID_SCAN_DEEP_AFTER_S = 23;
export const ID_SCAN_DEEP_PERIOD_MS = 24;
/**
 * Firmware overhead per row beyond pre-wait: row switching, the six pin reads
 * and the double-down logic. Measured on a revision B board: 58 µs LED-on per
 * row at 45 µs pre-wait. Used only until a measured LED-on time is available.
 */
export const ROW_READ_OVERHEAD_US = 13;

export type Hand = 0 | 1; // 0 = left, 1 = right

export const ROW_NAMES = ["Thumb", "Index", "Middle", "Ring", "Pinky"] as const;
export const FINGER_COLS = ["S", "E", "C", "N", "W", "DD"] as const;
export const THUMB_COLS = ["OL", "OU", "D", "IL", "MODE", "DD"] as const;
export const HAND_NAMES = ["Left", "Right"] as const;

export enum SweepState {
    Idle = 0,
    Reference = 1,
    Running = 2,
    Done = 3,
    ReferenceFailed = 4,
}

const OP = {
    SET_MODE: 0x01,
    PROBE: 0x02,
    ABORT: 0x03,
    REBOOT_ARM: 0x04,
    REBOOT_GO: 0x05,
    STATUS: 0x10,
    POWER: 0x11,
    SWEEP_ROW: 0x20,
    PROBE_ON: 0x40,
    PROBE_OFF: 0x60,
} as const;

const RESPONSE_BYTES = 23;
const UNREACHABLE = 0xff;

export interface ScanLabStatus {
    reachable: boolean;
    protoVersion: number;
    hwRevision: number;          // 0 = A, 1 = B (flipfet)
    sweepState: SweepState;
    framesDone: number;
    framesTarget: number;
    refValid: boolean;
    effPrewaitUs: number;
    effPostwaitUs: number;
    isLeft: boolean;
    fingerPushedMask: number;
    thumbPushedMask: number;
    probeValid: boolean;
    probeRow: number;
    savedPrewaitUs: number;
    savedPostwaitUs: number;
    turboIndex: number;
    otherHalfConnected: boolean;
}

const WIRE_CAP = 0xffff;

export type IdleStage = 0 | 1 | 2; // active, light idle, deep idle
export const IDLE_STAGE_NAMES = ["active", "light idle", "deep idle"] as const;

export interface IdleSettings {
    idleAfterMs: number;   // light idle timeout, ms (0 = never)
    idlePeriodMs: number;  // light idle frame period, ms
    deepAfterS: number;    // deep idle timeout, s (0 = never)
    deepPeriodMs: number;  // deep idle frame period, ms
}

/** Starting points for the idle fields; every value stays editable. */
export const IDLE_PRESETS: ReadonlyArray<{ name: string; hint: string } & IdleSettings> = [
    { name: "No idle", hint: "full rate always", idleAfterMs: 1000, idlePeriodMs: 1, deepAfterS: 0, deepPeriodMs: 0 },
    { name: "Light", hint: "100 ms wake-up after 2 s", idleAfterMs: 2000, idlePeriodMs: 100, deepAfterS: 0, deepPeriodMs: 0 },
    { name: "Deep", hint: "100 ms after 2 s, 1 s after 10 min", idleAfterMs: 2000, idlePeriodMs: 100, deepAfterS: 600, deepPeriodMs: 1000 },
];

export interface ScanLabPower extends IdleSettings {
    reachable: boolean;
    periodUs: number;          // saved active frame period (0 = unpaced)
    measuredFrameUs: number;   // smoothed frame-to-frame interval (capped at 65535 on the wire)
    frameCapped: boolean;      // measuredFrameUs hit the wire cap; the stage's set period is the better estimate
    effectivePeriodTrueUs: number; // period in force now with the wire cap undone from the idle settings
    measuredLedUs: number;     // smoothed LED-on time per frame
    stage: IdleStage;
    idleActive: boolean;       // stage > 0
    effectivePeriodUs: number; // period in force right now (0 = unpaced, capped at 65535)
    effPrewaitUs: number;
    effPostwaitUs: number;
    rows: number;
    hostBootloader: boolean;   // firmware accepts REBOOT_ARM / REBOOT_GO
    rebootArmed: boolean;
    /** measuredLedUs over the frame interval (the set period when capped), in percent; null until measured */
    dutyPct: number | null;
    /** 1e6 over the same interval; null until measured */
    scanHz: number | null;
}

export interface ProbeColumn {
    col: number;
    settleUs: number;        // last level change after row-on (0 = never moved)
    settleChanges: number;
    recoverUs: number;       // last level change after row-off
    recoverChanges: number;
    idleHigh: boolean;
    litHigh: boolean;
    releasedHigh: boolean;
    /** Line moved when its row lit with nothing pressed: an active-dark key. */
    activeDark: boolean;
    /** Expected polarity from the firmware's pushed-state table. */
    expectedActiveDark: boolean;
}

export interface ProbeRow {
    hand: Hand;
    row: number;
    valid: boolean;
    columns: ProbeColumn[];
}

export interface SweepRowResult {
    mismatches: number[];
    refBits: number;
    lastBits: number;
    state: SweepState;
    refValid: boolean;
}

export interface SweepStep {
    hand: Hand;
    prewaitUs: number;
    postwaitUs: number;
    frames: number;
    state: SweepState;
    rows: SweepRowResult[];
    totalMismatches: number;
}

const u16 = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8);
const lo = (v: number) => v & 0xff;
const hi = (v: number) => (v >> 8) & 0xff;

export function hwRevisionName(rev: number): string {
    return rev === 1 ? "B (flipfet)" : rev === 0 ? "A" : `unknown (${rev})`;
}

export function colNames(row: number): readonly string[] {
    return row === 0 ? THUMB_COLS : FINGER_COLS;
}

export class ScanLabService {
    private usb: SvilUSB;

    constructor(usb: SvilUSB) {
        this.usb = usb;
    }

    private async get(hand: Hand, op: number, row = 0): Promise<Uint8Array> {
        const id = op | (hand << 3) | (row & 0x07);
        const data = await this.usb.customValueGet(SCANLAB_CHANNEL, id, RESPONSE_BYTES);
        const out = new Uint8Array(RESPONSE_BYTES);
        out.set(data.slice(0, RESPONSE_BYTES));
        return out;
    }

    private async set(hand: Hand, op: number, args: number[]): Promise<void> {
        await this.usb.customValueSet(SCANLAB_CHANNEL, op, [hand, ...args]);
    }

    parseStatus(b: Uint8Array): ScanLabStatus {
        if (b[0] === UNREACHABLE) {
            return {
                reachable: false, protoVersion: 0, hwRevision: -1, sweepState: SweepState.Idle,
                framesDone: 0, framesTarget: 0, refValid: false, effPrewaitUs: 0, effPostwaitUs: 0,
                isLeft: false, fingerPushedMask: 0, thumbPushedMask: 0, probeValid: false, probeRow: 0,
                savedPrewaitUs: 0, savedPostwaitUs: 0, turboIndex: 0, otherHalfConnected: false,
            };
        }
        return {
            reachable: true,
            protoVersion: b[0],
            hwRevision: b[1],
            sweepState: b[2] as SweepState,
            framesDone: u16(b, 3),
            framesTarget: u16(b, 5),
            refValid: b[7] === 1,
            effPrewaitUs: u16(b, 8),
            effPostwaitUs: u16(b, 10),
            isLeft: b[12] === 1,
            fingerPushedMask: b[13],
            thumbPushedMask: b[14],
            probeValid: b[15] === 1,
            probeRow: b[16],
            savedPrewaitUs: u16(b, 17),
            savedPostwaitUs: u16(b, 19),
            turboIndex: b[21],
            otherHalfConnected: b[22] === 1,
        };
    }

    async getStatus(hand: Hand): Promise<ScanLabStatus> {
        return this.parseStatus(await this.get(hand, OP.STATUS));
    }

    parsePower(b: Uint8Array): ScanLabPower {
        if (b[0] === UNREACHABLE && b[1] === 0 && b[17] === 0) {
            return {
                reachable: false, periodUs: 0, idlePeriodMs: 0, idleAfterMs: 0, deepAfterS: 0, deepPeriodMs: 0,
                measuredFrameUs: 0, frameCapped: false, effectivePeriodTrueUs: 0, measuredLedUs: 0, stage: 0, idleActive: false,
                effectivePeriodUs: 0, effPrewaitUs: 0, effPostwaitUs: 0, rows: 0, hostBootloader: false, rebootArmed: false, dutyPct: null, scanHz: null,
            };
        }
        const measuredFrameUs = u16(b, 6);
        const measuredLedUs = u16(b, 8);
        const stage = Math.min(2, b[10]) as IdleStage;
        const periodUs = u16(b, 0);
        const idlePeriodMs = u16(b, 2);
        const deepPeriodMs = u16(b, 20);
        const effectivePeriodUs = u16(b, 11);
        // The wire carries 16-bit microseconds; idle periods run to 65 s. When a field saturates,
        // the stage tells us which setting is in force and that is the better number.
        const stagePeriodUs = stage === 2 ? deepPeriodMs * 1000 : stage === 1 ? idlePeriodMs * 1000 : periodUs;
        const effectivePeriodTrueUs = effectivePeriodUs >= WIRE_CAP ? Math.max(effectivePeriodUs, stagePeriodUs) : effectivePeriodUs;
        const frameCapped = measuredFrameUs >= WIRE_CAP;
        const frameUs = frameCapped ? Math.max(measuredFrameUs, effectivePeriodTrueUs) : measuredFrameUs;
        return {
            reachable: true,
            periodUs,
            idlePeriodMs,
            idleAfterMs: u16(b, 4),
            measuredFrameUs,
            frameCapped,
            effectivePeriodTrueUs,
            measuredLedUs,
            stage,
            idleActive: stage > 0,
            effectivePeriodUs,
            effPrewaitUs: u16(b, 13),
            effPostwaitUs: u16(b, 15),
            rows: b[17],
            deepAfterS: u16(b, 18),
            deepPeriodMs,
            hostBootloader: (b[22] & 1) !== 0,
            rebootArmed: (b[22] & 2) !== 0,
            dutyPct: frameUs > 0 ? (100 * measuredLedUs) / frameUs : null,
            scanHz: frameUs > 0 ? 1e6 / frameUs : null,
        };
    }

    /** Pacing settings plus the firmware's measured frame interval and LED-on time. */
    async getPower(hand: Hand): Promise<ScanLabPower> {
        return this.parsePower(await this.get(hand, OP.POWER));
    }

    /** Persist frame pacing and both idle stages; the master relays them to the other half. */
    async applyPacing(periodUs: number, idle: IdleSettings): Promise<void> {
        const pairs: [number, number][] = [
            [ID_SCAN_PERIOD_US, periodUs],
            [ID_SCAN_IDLE_PERIOD_MS, idle.idlePeriodMs],
            [ID_SCAN_IDLE_AFTER_MS, idle.idleAfterMs],
            [ID_SCAN_DEEP_AFTER_S, idle.deepAfterS],
            [ID_SCAN_DEEP_PERIOD_MS, idle.deepPeriodMs],
        ];
        for (const [id, v] of pairs) await this.usb.customValueSet(KEYBOARD_CHANNEL, id, [lo(v), hi(v)]);
        await this.usb.customValueSave(KEYBOARD_CHANNEL);
    }

    /** SET op whose response bytes we need (REBOOT_ARM hands back a token). */
    private async setWithResponse(hand: Hand, op: number, args: number[]): Promise<Uint8Array> {
        const resp = await this.usb.send(SvilUSB.CMD_VIA_LIGHTING_SET_VALUE, [SCANLAB_CHANNEL, op, hand, ...args], {
            uint8: true,
            skipBytes: 3,
            validateInput: (u) => u[0] === SvilUSB.CMD_VIA_LIGHTING_SET_VALUE && u[1] === SCANLAB_CHANNEL && u[2] === op,
        });
        const out = new Uint8Array(RESPONSE_BYTES);
        out.set((resp as Uint8Array).slice(0, RESPONSE_BYTES));
        return out;
    }

    /**
     * Two-stage reboot into the RP2040 bootloader: arm for a one-time token,
     * then go with it. The connected half acknowledges and reboots ~100 ms
     * later, so expect a disconnect; the other half drops into the bootloader
     * and waits until its USB is plugged in. Resolves true when accepted.
     */
    async rebootToBootloader(hand: Hand): Promise<boolean> {
        const arm = await this.setWithResponse(hand, OP.REBOOT_ARM, []);
        if (arm[2] !== 1) throw new Error(`${HAND_NAMES[hand]} half's firmware does not allow host-initiated reboot (build with SVAL_HOST_BOOTLOADER)`);
        const token = u16(arm, 0);
        const go = await this.setWithResponse(hand, OP.REBOOT_GO, [lo(token), hi(token)]);
        return go[0] === 1;
    }

    parseProbeRow(hand: Hand, row: number, on: Uint8Array, off: Uint8Array, pushedMask: number): ProbeRow {
        const valid = on[20] === 1 && off[20] === 1;
        const idle = on[18], lit = on[19], released = off[18];
        const columns: ProbeColumn[] = [];
        for (let c = 0; c < SCANLAB_COLS; c++) {
            const bit = 1 << c;
            columns.push({
                col: c,
                settleUs: u16(on, 2 * c),
                settleChanges: on[12 + c],
                recoverUs: u16(off, 2 * c),
                recoverChanges: off[12 + c],
                idleHigh: (idle & bit) !== 0,
                litHigh: (lit & bit) !== 0,
                releasedHigh: (released & bit) !== 0,
                activeDark: ((idle ^ lit) & bit) !== 0,
                expectedActiveDark: (pushedMask & bit) !== 0,
            });
        }
        return { hand, row, valid, columns };
    }

    /** Run the settle probe on one row and read both phases back. Nothing should be pressed. */
    async probeRow(hand: Hand, row: number, status?: ScanLabStatus): Promise<ProbeRow> {
        const st = status ?? (await this.getStatus(hand));
        if (!st.reachable) throw new Error(`${HAND_NAMES[hand]} half is not reachable`);
        await this.set(hand, OP.PROBE, [row]);
        const on = await this.get(hand, OP.PROBE_ON, row);
        const off = await this.get(hand, OP.PROBE_OFF, row);
        const mask = row === 0 ? st.thumbPushedMask : st.fingerPushedMask;
        return this.parseProbeRow(hand, row, on, off, mask);
    }

    async probeAll(hand: Hand, onRow?: (r: ProbeRow) => void): Promise<ProbeRow[]> {
        const st = await this.getStatus(hand);
        const rows: ProbeRow[] = [];
        for (let r = 0; r < SCANLAB_ROWS; r++) {
            const pr = await this.probeRow(hand, r, st);
            rows.push(pr);
            onRow?.(pr);
        }
        return rows;
    }

    async startSweep(hand: Hand, prewaitUs: number, postwaitUs: number, frames: number): Promise<void> {
        await this.set(hand, OP.SET_MODE, [1, lo(prewaitUs), hi(prewaitUs), lo(postwaitUs), hi(postwaitUs), lo(frames), hi(frames)]);
    }

    async abort(hand: Hand): Promise<void> {
        await this.set(hand, OP.ABORT, []);
    }

    async waitForSweep(hand: Hand, timeoutMs = 20000, pollMs = 100): Promise<ScanLabStatus> {
        const deadline = Date.now() + timeoutMs;
        for (;;) {
            const st = await this.getStatus(hand);
            if (!st.reachable) throw new Error(`${HAND_NAMES[hand]} half is not reachable`);
            if (st.sweepState === SweepState.Done || st.sweepState === SweepState.ReferenceFailed || st.sweepState === SweepState.Idle) return st;
            if (Date.now() > deadline) {
                await this.abort(hand);
                throw new Error(`${HAND_NAMES[hand]} sweep timed out`);
            }
            await new Promise((r) => setTimeout(r, pollMs));
        }
    }

    parseSweepRow(b: Uint8Array): SweepRowResult {
        const mismatches: number[] = [];
        for (let c = 0; c < SCANLAB_COLS; c++) mismatches.push(u16(b, 2 * c));
        return { mismatches, refBits: b[12], lastBits: b[13], state: b[14] as SweepState, refValid: b[15] === 1 };
    }

    async readSweepRows(hand: Hand): Promise<SweepRowResult[]> {
        const rows: SweepRowResult[] = [];
        for (let r = 0; r < SCANLAB_ROWS; r++) rows.push(this.parseSweepRow(await this.get(hand, OP.SWEEP_ROW, r)));
        return rows;
    }

    /** One sweep step on one hand: start, wait, read per-key mismatch counts. */
    async runSweepStep(hand: Hand, prewaitUs: number, postwaitUs: number, frames: number): Promise<SweepStep> {
        await this.startSweep(hand, prewaitUs, postwaitUs, frames);
        const st = await this.waitForSweep(hand);
        const rows = await this.readSweepRows(hand);
        const totalMismatches = rows.reduce((a, r) => a + r.mismatches.reduce((x, y) => x + y, 0), 0);
        return { hand, prewaitUs, postwaitUs, frames, state: st.sweepState, rows, totalMismatches };
    }

    /** Persist explicit scan timing on the keyboard; the master relays it to the other half. */
    async applyTiming(prewaitUs: number, postwaitUs: number): Promise<void> {
        await this.usb.customValueSet(KEYBOARD_CHANNEL, ID_SCAN_PREWAIT_US, [lo(prewaitUs), hi(prewaitUs)]);
        await this.usb.customValueSet(KEYBOARD_CHANNEL, ID_SCAN_POSTWAIT_US, [lo(postwaitUs), hi(postwaitUs)]);
        await this.usb.customValueSave(KEYBOARD_CHANNEL);
    }
}

/**
 * Expected sensor LED duty cycle, in percent, for a pre-wait and frame period.
 * Returns null for an unpaced (0) period, where duty depends on loop load.
 */
export function expectedDutyPct(rows: number, prewaitUs: number, periodUs: number): number | null {
    if (periodUs <= 0) return null;
    return Math.min(100, (100 * rows * (prewaitUs + ROW_READ_OVERHEAD_US)) / periodUs);
}

/**
 * Predicted duty for a candidate period: from the firmware's measured LED-on
 * time per frame when it has one, otherwise from the pre-wait model.
 */
export function predictDutyPct(power: Pick<ScanLabPower, "rows" | "effPrewaitUs" | "measuredLedUs">, periodUs: number): number | null {
    if (periodUs <= 0) return null;
    if (power.measuredLedUs > 0) return Math.min(100, (100 * power.measuredLedUs) / periodUs);
    return expectedDutyPct(power.rows || 5, power.effPrewaitUs, periodUs);
}

/**
 * Current model measured on a revision B left half with a pmw3389 trackball:
 * 60 mA with the sensor LEDs effectively off (65 ms frame, 0.5% duty), and
 * about 1.1 mA per percent of LED duty, i.e. ~110 mA while a row is lit.
 * Checked at 15% (80 mA), 29% (90 mA) and 58% (125 mA).
 */
export const DEFAULT_BASELINE_MA = 60;
export const DEFAULT_LIT_ROW_MA = 110;

/** Predicted total current for an LED duty (percent). */
export function predictCurrentMa(baselineMa: number, litRowMa: number, dutyPct: number | null): number | null {
    if (dutyPct === null) return null;
    return baselineMa + (litRowMa * dutyPct) / 100;
}

/**
 * Given sweep steps ordered from the most generous timing to the tightest,
 * returns the tightest value that was clean and stayed clean at every more
 * generous step, or null if nothing was clean.
 */
export function lowestCleanValue(steps: { value: number; totalMismatches: number }[]): number | null {
    const sorted = [...steps].sort((a, b) => b.value - a.value);
    let lowest: number | null = null;
    for (const s of sorted) {
        if (s.totalMismatches === 0) lowest = s.value;
        else break;
    }
    return lowest;
}

/** Suggested setting: the lowest clean value plus 50% margin, rounded up to 5 µs. */
export function suggestWithMargin(lowestClean: number | null): number | null {
    if (lowestClean === null) return null;
    return Math.ceil((lowestClean * 1.5) / 5) * 5;
}

export const scanlabService = new ScanLabService(usbInstance);
