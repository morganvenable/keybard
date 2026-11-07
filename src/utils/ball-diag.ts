// Trackball diagnostics (x4.5-ballfix firmware): Sval POINTING_HARDWARE (0x2C) asked with
// [0xA5, 1]. Reply after the wrapper: [0x2C] then the report, byte i of the report at reply[1 + i]:
//  0 0xA5   1 version   2 flags (1 sub counters valid, 2 split link up, 4 USB half is the left half)
//  3 USB half boots since power-on
//  4..8 the sub's pointing block as the USB half last received it: flags, built_for, detected, id0, id1
//  9..10 age of the last reply, 0.1 s   11..12 age since that block last changed, s
//  13..14 age of the last nonzero sub pointing report, s   (0xFFFF: never)
//  15..20 the sub's own counters: boots | link << 4, first_spi | search << 4, start (0.1 s),
//         health, recoveries, checks
//  21..25 the USB half's own sensor: health, recoveries, checks, first_spi | search << 4, start (0.1 s)
//  26..27 the USB half: unstick resets | slow-probe starts << 4, give-ups (x4.5-ballfix; each saturates at 15)
//  28..29 the same for the sub

export const BALL_DIAG_REQUEST = [0xa5, 1];

const NEVER = 0xffff;

const SENSOR: Record<number, string> = {
    0: "not checked yet",
    1: "PMW3360",
    2: "PMW3389",
    3: "no answer",
    4: "another ID",
    5: "Azoteq trackpad",
    6: "TrackPoint",
};

const BAD: [number, string][] = [
    [1, "Product_ID"],
    [2, "Inverse_Product_ID"],
    [4, "Config2"],
];

export interface SensorCounters {
    health: number;
    recoveries: number;
    checks: number;
    firstSpi: number;
    search: number;
    startTenths: number;
    /** x4.5-ballfix and later; null from x4.5-balldiag. */
    unsticks: number | null;
    slowStarts: number | null;
    giveUps: number | null;
}

export interface BallDiag {
    usbLeft: boolean;
    linkUp: boolean;
    subValid: boolean;
    usbBoots: number;
    subBlock: { flags: number; builtFor: number; detected: number; id0: number; id1: number };
    replyAgeTenths: number;
    changedAgeS: number;
    motionAgeS: number;
    subBoots: number;
    subLinkHalfs: number;
    sub: SensorCounters;
    usb: SensorCounters;
}

function recovery(reply: Uint8Array, at: number): Pick<SensorCounters, "unsticks" | "slowStarts" | "giveUps"> {
    if (reply.length < 1 + at + 2 || reply.length < 31) return { unsticks: null, slowStarts: null, giveUps: null };
    const a = reply[1 + at], b = reply[1 + at + 1];
    return { unsticks: a & 15, slowStarts: a >> 4, giveUps: b & 15 };
}

export function parseBallDiag(reply: Uint8Array): BallDiag | null {
    if (reply.length < 27 || reply[0] !== 0x2c || reply[1] !== 0xa5 || reply[2] !== 1) return null;
    const r = (i: number) => reply[1 + i];
    const u16 = (i: number) => r(i) | (r(i + 1) << 8);
    const flags = r(2);
    return {
        usbLeft: (flags & 4) !== 0,
        linkUp: (flags & 2) !== 0,
        subValid: (flags & 1) !== 0,
        usbBoots: r(3),
        subBlock: { flags: r(4), builtFor: r(5), detected: r(6), id0: r(7), id1: r(8) },
        replyAgeTenths: u16(9),
        changedAgeS: u16(11),
        motionAgeS: u16(13),
        subBoots: r(15) & 15,
        subLinkHalfs: r(15) >> 4,
        sub: { health: r(18), recoveries: r(19), checks: r(20), firstSpi: r(16) & 15, search: r(16) >> 4, startTenths: r(17), ...recovery(reply, 28) },
        usb: { health: r(21), recoveries: r(22), checks: r(23), firstSpi: r(24) & 15, search: r(24) >> 4, startTenths: r(25), ...recovery(reply, 26) },
    };
}

const hex = (n: number) => n.toString(16).padStart(2, "0");

function ago(s: number): string {
    if (s === NEVER) return "never";
    if (s >= 120) return `${Math.round(s / 60)} min ago`;
    return `${s} s ago`;
}

function health(h: number, checks: number): string {
    const result = h & 3;
    const bad = BAD.filter(([bit]) => (h >> 4) & bit).map(([, name]) => name).join(" and ");
    const what = result === 0 ? "no check yet"
        : result === 1 ? "last check ok"
            : result === 2 ? `last check had one bad look (${bad || "unknown"}), then ok`
                : `last check failed twice (${bad || "unknown"}), so the driver was restarted`;
    return `${what}; ${checks} checks run (counts wrap at 256)`;
}

function recovered(c: SensorCounters): string {
    const n = (v: number | null) => (v === null ? "?" : v >= 15 ? "15 or more" : String(v));
    return `${c.recoveries} recoveries, ${n(c.unsticks)} unstick resets sent, ${n(c.slowStarts)} slow-probe starts, ${n(c.giveUps)} give-ups`;
}

function started(c: SensorCounters): string {
    if (c.search === 15) return "not started yet";
    const how = c.search === 14 ? "the boot-time probe" : `search ${c.search}`;
    return `started by ${how} at ${(c.startTenths / 10).toFixed(1)} s after boot`;
}

/** Plain lines for the panel and for pasting into Discord. */
export function ballDiagLines(d: BallDiag): string[] {
    const usbSide = d.usbLeft ? "left" : "right";
    const subSide = d.usbLeft ? "right" : "left";
    const sensor = (c: SensorCounters) =>
        `first SPI probe: ${SENSOR[c.firstSpi] ?? (c.firstSpi === 15 ? "not probed yet" : `code ${c.firstSpi}`)}; trackball ${started(c)}`;
    const lines = [
        `Master (USB, ${usbSide} half): booted ${d.usbBoots} time${d.usbBoots === 1 ? "" : "s"} since power-on`,
        `Master trackball: ${sensor(d.usb)}`,
        `Master trackball health: ${health(d.usb.health, d.usb.checks)}; ${recovered(d.usb)}`,
        `Split link: ${d.linkUp ? "up" : "down"}`,
    ];
    if (d.subValid) {
        const link = d.subLinkHalfs === 15 ? "never" : d.subLinkHalfs === 14 ? "after 7 s or more" : `at ${(d.subLinkHalfs * 0.5).toFixed(1)} s`;
        lines.push(
            `Sub (${subSide} half): booted ${d.subBoots} time${d.subBoots === 1 ? "" : "s"} since power-on; split link first answered ${link} after boot`,
            `Sub trackball: ${sensor(d.sub)}`,
            `Sub trackball health: ${health(d.sub.health, d.sub.checks)}; ${recovered(d.sub)}`,
        );
    } else {
        lines.push(`Sub (${subSide} half): no counters (split link down, or the sub has not answered since the master booted)`);
    }
    const b = d.subBlock;
    lines.push(
        `Last pointing block the master got from the sub: flags ${hex(b.flags)} (driver ${b.flags & 4 ? "running" : "not running"}), detected ${SENSOR[b.detected] ?? b.detected}, IDs ${hex(b.id0)} ${hex(b.id1)}`,
        `That block: last reply ${d.replyAgeTenths === NEVER ? "never" : `${(d.replyAgeTenths / 10).toFixed(1)} s ago`}, last changed ${ago(d.changedAgeS)}`,
        `Last sub pointer movement the master received: ${ago(d.motionAgeS)}`,
    );
    return lines;
}
