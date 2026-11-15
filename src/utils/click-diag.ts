// Click diagnostics (x4.6.6-clickdiag firmware): Sval POINTING_HARDWARE (0x2C) asked with
// [0xC1, half (0 the USB half, 1 the other), cmd, ring, seq lo, seq hi].
// Reply after the wrapper: [0x2C] [0xC1] [half] [cmd] [n, 0xFF other half unavailable] [26 bytes].
// cmd 0 (header): ev seq u16, press seq u16, now u32, left, resets, inits, re-ATI, read fails u16,
//   touch-downs u16, touches while typing u16, button reports u16, chip clicks u16, flags
//   (1 USB half, 2 touchpad build, 4 OS touchpad mode now), ATI errors, frame seq u16.
// cmd 1: ring 0 events (2 per reply, seq then seq-1), ring 2 pad frames (2 per reply);
//   each entry [time ms u32] [type] [7 bytes]. See keyboards/svalboard/click_diag.h.

export type Query = (args: number[]) => Promise<Uint8Array>;

export interface Header {
    evSeq: number; frameSeq: number; now: number; left: boolean; master: boolean; padBuild: boolean; osTouchpad: boolean;
    resets: number; inits: number; reati: number; atiErrors: number; readFails: number;
    touchDowns: number; typingTouches: number; buttonReports: number; chipClicks: number;
}
export interface Entry { seq: number; t: number; type: number; p: number[] }
export interface HalfLog { half: number; header: Header; events: Entry[]; frames: Entry[] }

const u16 = (b: Uint8Array, o: number) => b[o] | (b[o + 1] << 8);
const u32 = (b: Uint8Array, o: number) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;

/** The reply's 26 payload bytes and count, or null if the firmware doesn't know the request. */
export function payload(reply: Uint8Array, half: number, cmd: number): { n: number; data: Uint8Array } | null {
    if (reply.length < 31 || reply[0] !== 0x2c || reply[1] !== 0xc1 || reply[2] !== half || reply[3] !== cmd) return null;
    return { n: reply[4], data: reply.slice(5, 31) };
}

export function parseHeader(d: Uint8Array): Header {
    const flags = d[22];
    return {
        evSeq: u16(d, 0), now: u32(d, 4), left: d[8] !== 0, resets: d[9], inits: d[10], reati: d[11],
        readFails: u16(d, 12), touchDowns: u16(d, 14), typingTouches: u16(d, 16), buttonReports: u16(d, 18), chipClicks: u16(d, 20),
        master: (flags & 1) !== 0, padBuild: (flags & 2) !== 0, osTouchpad: (flags & 4) !== 0, atiErrors: d[23], frameSeq: u16(d, 24),
    };
}

function entries(d: Uint8Array, n: number, seq: number): Entry[] {
    const out: Entry[] = [];
    for (let i = 0; i < n && i < 2; i++) {
        const o = 12 * i;
        out.push({ seq: (seq - i) & 0xffff, t: u32(d, o), type: d[o + 4], p: Array.from(d.slice(o + 5, o + 12)) });
    }
    return out;
}

async function readRing(q: Query, half: number, ring: number, newest: number, max: number): Promise<Entry[]> {
    const out: Entry[] = [];
    let seq = newest;
    while (out.length < max) {
        const r = payload(await q([0xc1, half, 1, ring, seq & 0xff, (seq >> 8) & 0xff]), half, 1);
        if (!r || r.n === 0 || r.n === 0xff) break;
        const got = entries(r.data, r.n, seq);
        out.push(...got);
        if (got.length < 2) break;
        seq = (seq - 2) & 0xffff;
    }
    return out;
}

/** Both halves: header, events and pad frames. A half that doesn't answer is left out. */
export async function readClickDiag(q: Query): Promise<{ halves: HalfLog[]; supported: boolean }> {
    const halves: HalfLog[] = [];
    let supported = false;
    for (const half of [0, 1]) {
        const r = payload(await q([0xc1, half, 0, 0, 0, 0]), half, 0);
        if (!r) continue;
        supported = true;
        if (r.n !== 1) continue;
        const header = parseHeader(r.data);
        const events = await readRing(q, half, 0, header.evSeq, 128);
        const frames = await readRing(q, half, 2, header.frameSeq, 256);
        halves.push({ half, header, events, frames });
    }
    return { halves, supported };
}

const BUTTONS = ["left", "right", "middle", "back", "forward", "b6", "b7", "b8"];
export function buttonNames(b: number): string {
    const n = BUTTONS.filter((_, i) => b & (1 << i));
    return n.length ? n.join("+") : "none";
}
const MODS = ["LCtrl", "LShift", "LOpt", "LCmd", "RCtrl", "RShift", "ROpt", "RCmd"];
function mods(m: number): string {
    const n = MODS.filter((_, i) => m & (1 << i));
    return n.length ? `, mods ${n.join("+")}` : "";
}
function layers(s: number): string {
    const l: number[] = [];
    for (let i = 0; i < 16; i++) if (s & (1 << i)) l.push(i);
    return l.length ? l.join(",") : "base";
}
const hex4 = (lo: number, hi: number) => `0x${((hi << 8) | lo).toString(16).padStart(4, "0")}`;
function since(lo: number, hi: number): string {
    const ms = lo | (hi << 8);
    return ms >= 0xfffe ? "no key pressed yet" : `last key press ${ms} ms before`;
}
function gestureNames(ge0: number, ge1: number): string {
    const n: string[] = [];
    if (ge0 & 1) n.push("one-finger tap (left click)");
    if (ge0 & 2) n.push("press and hold (left button)");
    if (ge0 & 4) n.push("swipe X- (back)");
    if (ge0 & 8) n.push("swipe X+ (forward)");
    if (ge0 & 16) n.push("swipe Y+ (middle)");
    if (ge0 & 32) n.push("swipe Y- (button 6)");
    if (ge1 & 1) n.push("TWO-FINGER TAP (right click)");
    if (ge1 & 2) n.push("scroll");
    if (ge1 & 4) n.push("zoom");
    return n.join(", ") || "none";
}
const CAUSE = ["not a key (firmware or unknown)", "key", "Auto Mouse", "Keybard/host"];

export function eventText(e: Entry): string {
    const p = e.p;
    switch (e.type) {
        case 1: return "Half started";
        case 2: return `Key ${p[5] & 1 ? "press" : "release"}${p[5] & 2 ? " (combo)" : ""}: keycode ${hex4(p[3], p[4])} at row ${p[1]} col ${p[2]}, layer ${p[0]}${p[5] >> 4 ? `, taps ${p[5] >> 4}` : ""}${mods(p[6])}`;
        case 3: return `Tap dance ${p[0]} step ${p[1]} (tap ${hex4(p[2], p[3])}, hold ${hex4(p[4], p[5])})${mods(p[6])}`;
        case 4: return `Key override ${p[0]} on layer ${p[1]}: ${hex4(p[2], p[3])} -> ${hex4(p[4], p[5])}${mods(p[6])}`;
        case 5: return `Touchpad chip gesture: ${gestureNames(p[0] & 0x3f, p[1] & 7)}; ${p[2]} finger(s)${p[3] || p[4] ? ` at (${p[3] * 16},${p[4] * 16})` : ""}${p[5] || p[6] ? ` and (${p[5] * 16},${p[6] * 16})` : ""}`;
        case 6: return `Touch down: ${p[0] & 0x7f} finger(s) (was ${p[1]}) at (${p[2] * 16},${p[3] * 16}), strength ${p[4] * 16}, area ${p[5]}${p[0] & 0x80 ? ", WHILE TYPING" : ""}`;
        case 7: return `${p[0] ? "Right" : "Left"} hand pointing buttons: ${buttonNames(p[1])} (was ${buttonNames(p[2])}); ${since(p[3], p[4])}${mods(p[5])}, layer ${p[6]}`;
        case 8: return `MOUSE REPORT SENT: buttons ${buttonNames(p[0])} (was ${buttonNames(p[1])})${mods(p[2])}, layer ${p[3]}; ${since(p[4], p[5])}${p[6] ? "; native touchpad mode on" : ""}`;
        case 9: return `Native touchpad report: buttons ${p[0]} (was ${p[1]}), ${p[2]} contact(s)${mods(p[3])}, layer ${p[4]}`;
        case 10: return `Layer change: ${layers(p[0] | (p[1] << 8))} -> ${layers(p[2] | (p[3] << 8))}; cause ${CAUSE[p[4]] ?? p[4]}${p[4] === 1 ? ` ${hex4(p[5], p[6])}` : ""}`;
        case 11: return `Auto Mouse layer ${p[0] ? "on" : "off"}${p[1] ? " (timeout)" : ""}`;
        case 12: return p[2] === 1 ? "Touchpad chip reset itself" : p[2] === 2 ? "Touchpad recalibrated (re-ATI)" : p[2] === 3 ? "Touchpad read failed" : p[2] === 4 ? "Touchpad ATI error" : `Touchpad status ${p[2]}`;
        case 13: return `Touchpad start #${p[0]}: ${p[1] ? "ok" : "no touchpad on this half"}`;
        default: return `Event ${e.type}: ${p.map((b) => b.toString(16).padStart(2, "0")).join(" ")}`;
    }
}

function frameText(f: Entry): string {
    const fingers = f.type & 7, g = f.p[0], c = f.p.slice(1);
    const pts = [0, 3].filter((o) => c[o + 2]).map((o) => `(${c[o] * 16},${c[o + 1] * 16} s${c[o + 2] * 16})`);
    const ges = (g & 0x3f) || (g >> 6) ? `, chip: ${gestureNames(g & 0x3f, g >> 6)}` : "";
    return `${fingers} finger(s) ${pts.join(" ")}${ges}${f.type & 0x80 ? ", reset flag" : ""}`;
}

const secs = (h: Header, t: number) => `${((h.now - t) / 1000).toFixed(2)} s ago`;

function sideName(h: Header) {
    return `${h.left ? "left" : "right"} half${h.master ? " (USB)" : ""}`;
}

export function healthLine(l: HalfLog): string {
    const h = l.header;
    const pad = h.inits === 0 ? "no touchpad start seen" : `touchpad start attempts ${h.inits}`;
    return `Pad health, ${sideName(h)}: ${pad}, chip resets ${h.resets}, recalibrations ${h.reati}, ATI errors ${h.atiErrors}, read failures ${h.readFails}, touches ${h.touchDowns} (${h.typingTouches} while typing), chip clicks ${h.chipClicks}, mouse reports with a button ${h.buttonReports}${h.osTouchpad ? ", native touchpad mode on" : ""}; up ${(h.now / 1000).toFixed(0)} s`;
}

/** Plain lines, newest first: pad health, then every event, with the pad frames from up to
 *  2 s before each chip right click or right-button report on that half. */
export function clickDiagLines(halves: HalfLog[]): string[] {
    const lines = halves.map(healthLine);
    const all = halves.flatMap((l) => l.events.map((e) => ({ l, e, age: l.header.now - e.t })));
    all.sort((a, b) => a.age - b.age);
    for (const { l, e } of all) {
        lines.push(`${secs(l.header, e.t)} [${l.header.left ? "L" : "R"}] ${eventText(e)}`);
        const right = (e.type === 5 && (e.p[1] & 1)) || (e.type === 7 && (e.p[1] & 2) && !(e.p[2] & 2));
        if (right) {
            for (const src of halves) {
                const fr = src.frames.filter((f) => {
                    const d = (src.header.now - f.t) - (l.header.now - e.t);
                    return d >= -100 && d <= 2000;
                });
                for (const f of fr) lines.push(`    pad frame ${secs(src.header, f.t)} [${src.header.left ? "L" : "R"}]: ${frameText(f)}`);
            }
        }
    }
    if (!all.length) lines.push("No events recorded yet.");
    return lines;
}
