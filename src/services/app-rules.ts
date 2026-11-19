// App rules: layer changes while a given app is in front on the computer.
//
// The board keeps up to 64 rules; Keybard Host tells it which app is in front, and the
// first rule with that app's ID applies: a default layer, a front layer (just above the
// default layer), and on/off masks over the user's layers (off wins). Nothing a rule does
// is saved; leaving the app restores everything.
//
// Discovery: GET_INFO byte 22 (the fifth feature byte), bit 0. Older firmware leaves it
// clear and answers 0x40 and 0x41 with the command byte 0xFF: Keybard then shows nothing.
// The wire format is in svalboard/qmk keyboards/svalboard/docs/protocol.md, "App rules".
import type { AppRule } from "@/types/keyboard.types";

/** GET_INFO byte 22 (feature_flags5) bit 0. */
export const SVIL_FLAG5_APP_RULES = 0x01;
export const hasAppRules = (flags5: number | undefined | null): boolean => ((flags5 ?? 0) & SVIL_FLAG5_APP_RULES) !== 0;

export const CMD_SVIL_APP_FOREGROUND = 0x40;
export const CMD_SVIL_APP_RULES = 0x41;

export const APP_RULES_INFO = 0;
export const APP_RULES_READ = 1;
export const APP_RULES_WRITE = 2;
export const APP_RULES_BEGIN = 3;
export const APP_RULES_COMMIT = 4;
export const APP_FOREGROUND_STATUS = 0;

export const APP_RULES_FORMAT = 1;
export const APP_RULES_MAX = 64;
export const APP_RULE_BYTES = 24;
export const APP_RULES_HEADER_BYTES = 4;
export const APP_RULES_RECORD_BYTES = APP_RULES_HEADER_BYTES + APP_RULES_MAX * APP_RULE_BYTES; // 1540
export const APP_RULES_CHUNK = 48;
export const APP_RULE_LABEL_BYTES = 13;
/** "None" for the default and front layers. */
export const APP_LAYER_NONE = 0xff;
/** The masks hold 16 layers. */
export const APP_MASK_LAYERS = 16;

/** Framing around a READ reply's data, counted from the start of the report: [wrapper:6][0x41][op][status][offset:2][len]. */
const READ_REPLY_HEADER_BYTES = 12;

export const APP_STATUS_OK = 0;
export const APP_STATUS_BAD = 1;
export const APP_STATUS_NOT_USB = 2;
export const APP_STATUS_SHORT = 3;
export const APP_STATUS_INVALID = 4;
export const APP_STATUS_NOT_SAVED = 5;

const STATUS_TEXT: Record<number, string> = {
    [APP_STATUS_BAD]: "the board refused the request",
    [APP_STATUS_NOT_USB]: "this half isn't the one with USB",
    [APP_STATUS_SHORT]: "the report was too short",
    [APP_STATUS_INVALID]: "the board found the rules invalid and kept its old ones",
    [APP_STATUS_NOT_SAVED]: "the board uses the new rules but couldn't save them; they are lost when it restarts",
};

/** The board answered an app rules request with a nonzero status. */
export class AppRulesError extends Error {
    constructor(public readonly op: number, public readonly status: number) {
        super(`App rules: ${STATUS_TEXT[status] ?? `status ${status}`}`);
        this.name = "AppRulesError";
    }
}

/** What carries the requests: SvilUSB, or a test double. */
export interface AppRulesLink {
    reportLength?: number;
    sendSvil(cmd: number, args: number[], options: { uint8: true }): Promise<Uint8Array>;
}

// ---- app IDs ------------------------------------------------------------------

/** The key as the board hashes it: spaces and tabs dropped at both ends, ASCII A-Z lowered. */
export function canonicalAppKey(key: string): string {
    return key.replace(/^[ \t]+|[ \t]+$/g, "").replace(/[A-Z]/g, (c) => c.toLowerCase());
}

/**
 * The 4-byte app ID the board stores for an app key: FNV-1a 32 over the canonical key's
 * UTF-8 bytes. A result of 0 is sent as 1; an empty key is 0, "no app".
 */
export function appId(key: string): number {
    const k = canonicalAppKey(key);
    if (!k) return 0;
    let h = 0x811c9dc5;
    for (const b of new TextEncoder().encode(k)) {
        h ^= b;
        h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h === 0 ? 1 : h >>> 0;
}

export const appIdHex = (id: number): string => (id >>> 0).toString(16).toUpperCase().padStart(8, "0");

/** Text cut to at most `max` UTF-8 bytes, never inside a character. */
export function truncateUtf8(text: string, max = APP_RULE_LABEL_BYTES): string {
    const enc = new TextEncoder();
    if (enc.encode(text).length <= max) return text;
    let out = "";
    let used = 0;
    for (const ch of text) {
        const n = enc.encode(ch).length;
        if (used + n > max) break;
        out += ch;
        used += n;
    }
    return out;
}

export const utf8Length = (text: string): number => new TextEncoder().encode(text).length;

// ---- the record ----------------------------------------------------------------

const le16 = (b: Uint8Array, o: number) => b[o] | (b[o + 1] << 8);
const le32 = (b: Uint8Array, o: number) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
const layerOrNull = (v: number): number | null => (v === APP_LAYER_NONE ? null : v);

/** One 24-byte rule. */
export function parseRule(b: Uint8Array, o = 0): AppRule {
    const raw = b.subarray(o + 11, o + 11 + APP_RULE_LABEL_BYTES);
    const end = raw.indexOf(0);
    return {
        appId: le32(b, o),
        defaultLayer: layerOrNull(b[o + 4]),
        frontLayer: layerOrNull(b[o + 5]),
        onMask: le16(b, o + 6),
        offMask: le16(b, o + 8),
        flags: b[o + 10],
        label: new TextDecoder().decode(end < 0 ? raw : raw.subarray(0, end)),
    };
}

/** The rules in a record (header and rules). A record never stored (all zeros) has none. */
export function parseRecord(bytes: Uint8Array): AppRule[] {
    if (bytes.length < APP_RULES_HEADER_BYTES) throw new Error("App rules: the record is too short");
    const format = bytes[0];
    const count = bytes[1];
    if (format === 0 && count === 0) return [];
    if (format !== APP_RULES_FORMAT) throw new Error(`App rules: unknown record format ${format}`);
    if (count > APP_RULES_MAX) throw new Error(`App rules: ${count} rules is more than ${APP_RULES_MAX}`);
    if (bytes.length < APP_RULES_HEADER_BYTES + count * APP_RULE_BYTES) throw new Error("App rules: the record is shorter than its count");
    return Array.from({ length: count }, (_, i) => parseRule(bytes, APP_RULES_HEADER_BYTES + i * APP_RULE_BYTES));
}

function putLayer(v: number | null | undefined): number {
    return v === null || v === undefined || !Number.isInteger(v) || v < 0 || v >= APP_LAYER_NONE ? APP_LAYER_NONE : v;
}

/** The header and the used rules (the board zeroes the rest at COMMIT). */
export function serializeRecord(rules: readonly AppRule[]): Uint8Array {
    if (rules.length > APP_RULES_MAX) throw new Error(`App rules: at most ${APP_RULES_MAX} rules`);
    const out = new Uint8Array(APP_RULES_HEADER_BYTES + rules.length * APP_RULE_BYTES);
    out[0] = APP_RULES_FORMAT;
    out[1] = rules.length;
    rules.forEach((r, i) => {
        const o = APP_RULES_HEADER_BYTES + i * APP_RULE_BYTES;
        const id = r.appId >>> 0;
        out[o] = id & 0xff; out[o + 1] = (id >>> 8) & 0xff; out[o + 2] = (id >>> 16) & 0xff; out[o + 3] = id >>> 24;
        out[o + 4] = putLayer(r.defaultLayer);
        out[o + 5] = putLayer(r.frontLayer);
        out[o + 6] = r.onMask & 0xff; out[o + 7] = (r.onMask >> 8) & 0xff;
        out[o + 8] = r.offMask & 0xff; out[o + 9] = (r.offMask >> 8) & 0xff;
        out[o + 10] = r.flags & 0xff;
        out.set(new TextEncoder().encode(truncateUtf8(r.label ?? "")), o + 11);
    });
    return out;
}

/** What the board stores of a rule (Keybard's own `key` left out), for comparing. */
export const ruleWire = (r: AppRule) => [r.appId >>> 0, putLayer(r.defaultLayer), putLayer(r.frontLayer), r.onMask & 0xffff, r.offMask & 0xffff, r.flags & 0xff, truncateUtf8(r.label ?? "")];
export const sameRules = (a: readonly AppRule[] | undefined, b: readonly AppRule[] | undefined): boolean =>
    JSON.stringify((a ?? []).map(ruleWire)) === JSON.stringify((b ?? []).map(ruleWire));

// ---- per-layer state of a rule's masks ------------------------------------------

export type MaskState = "neutral" | "on" | "off";

export function maskState(rule: Pick<AppRule, "onMask" | "offMask">, layer: number): MaskState {
    if ((rule.offMask >> layer) & 1) return "off";
    if ((rule.onMask >> layer) & 1) return "on";
    return "neutral";
}

/** The next state on a click: neutral, on, off (struck through), neutral. */
export function cycleMask<T extends Pick<AppRule, "onMask" | "offMask">>(rule: T, layer: number): T {
    if (layer < 0 || layer >= APP_MASK_LAYERS) return rule;
    const bit = 1 << layer;
    const state = maskState(rule, layer);
    if (state === "neutral") return { ...rule, onMask: (rule.onMask | bit) & 0xffff, offMask: rule.offMask & ~bit & 0xffff };
    if (state === "on") return { ...rule, onMask: rule.onMask & ~bit & 0xffff, offMask: (rule.offMask | bit) & 0xffff };
    return { ...rule, onMask: rule.onMask & ~bit & 0xffff, offMask: rule.offMask & ~bit & 0xffff };
}

// ---- the requests ----------------------------------------------------------------

export interface AppRulesInfo {
    format: number;
    max: number;
    ruleBytes: number;
    count: number;
    recordBytes: number;
    chunk: number;
    layers: number;
}

/** The reply's status, after checking it answers this request. Throws on 0xFF (no such command) or a nonzero status. */
function checked(cmd: number, op: number, resp: Uint8Array): Uint8Array {
    if (resp[0] !== cmd) throw new Error(`App rules: the board doesn't know command 0x${cmd.toString(16)}`);
    if (resp[1] !== op) throw new Error(`App rules: reply to op ${resp[1]}, expected ${op}`);
    if (resp[2] !== APP_STATUS_OK) throw new AppRulesError(op, resp[2]);
    return resp;
}

/** Data bytes per READ or WRITE: 48, or what a smaller report holds. */
export function chunkSize(link: { reportLength?: number }, boardChunk = APP_RULES_CHUNK): number {
    return Math.max(1, Math.min(boardChunk || APP_RULES_CHUNK, APP_RULES_CHUNK, (link.reportLength || 32) - READ_REPLY_HEADER_BYTES));
}

export async function readAppRulesInfo(link: AppRulesLink): Promise<AppRulesInfo> {
    const r = checked(CMD_SVIL_APP_RULES, APP_RULES_INFO, await link.sendSvil(CMD_SVIL_APP_RULES, [APP_RULES_INFO], { uint8: true }));
    return { format: r[3], max: r[4], ruleBytes: r[5], count: r[6], recordBytes: le16(r, 7), chunk: r[9], layers: r[10] };
}

/** The rules in use: INFO, then READ of the header and the used rules, a chunk at a time. */
export async function readAppRules(link: AppRulesLink): Promise<{ rules: AppRule[]; info: AppRulesInfo }> {
    const info = await readAppRulesInfo(link);
    if (info.format !== APP_RULES_FORMAT || info.ruleBytes !== APP_RULE_BYTES) {
        throw new Error(`App rules: unknown record format ${info.format} (${info.ruleBytes}-byte rules)`);
    }
    const chunk = chunkSize(link, info.chunk);
    const total = Math.min(info.recordBytes || APP_RULES_RECORD_BYTES, APP_RULES_HEADER_BYTES + Math.min(info.count, APP_RULES_MAX) * APP_RULE_BYTES);
    const bytes = new Uint8Array(total);
    for (let off = 0; off < total; off += chunk) {
        const len = Math.min(chunk, total - off);
        const r = checked(CMD_SVIL_APP_RULES, APP_RULES_READ,
            await link.sendSvil(CMD_SVIL_APP_RULES, [APP_RULES_READ, off & 0xff, off >> 8, len], { uint8: true }));
        if (le16(r, 3) !== off || r[5] !== len) throw new Error(`App rules: READ answered offset ${le16(r, 3)} length ${r[5]}, asked ${off} ${len}`);
        bytes.set(r.subarray(6, 6 + len), off);
    }
    return { rules: parseRecord(bytes), info };
}

/** Save the rules: BEGIN, WRITE the header and the used rules, COMMIT. Resolves to the board's count. */
export async function writeAppRules(link: AppRulesLink, rules: readonly AppRule[], boardChunk = APP_RULES_CHUNK): Promise<number> {
    const bytes = serializeRecord(rules);
    const chunk = chunkSize(link, boardChunk);
    checked(CMD_SVIL_APP_RULES, APP_RULES_BEGIN, await link.sendSvil(CMD_SVIL_APP_RULES, [APP_RULES_BEGIN], { uint8: true }));
    for (let off = 0; off < bytes.length; off += chunk) {
        const part = Array.from(bytes.subarray(off, off + chunk));
        checked(CMD_SVIL_APP_RULES, APP_RULES_WRITE,
            await link.sendSvil(CMD_SVIL_APP_RULES, [APP_RULES_WRITE, off & 0xff, off >> 8, part.length, ...part], { uint8: true }));
    }
    const r = checked(CMD_SVIL_APP_RULES, APP_RULES_COMMIT, await link.sendSvil(CMD_SVIL_APP_RULES, [APP_RULES_COMMIT], { uint8: true }));
    return r[3];
}

export interface AppForegroundStatus {
    /** The app in front, 0 for none (or expired). */
    appId: number;
    msLeft: number;
    /** The rule that applies, null for none. */
    rule: number | null;
    frontLayer: number | null;
    onMask: number;
    offMask: number;
    flags: number;
}

/** APP_FOREGROUND STATUS: which app is in front and which rule applies now. */
export async function readAppForeground(link: AppRulesLink): Promise<AppForegroundStatus> {
    const r = checked(CMD_SVIL_APP_FOREGROUND, APP_FOREGROUND_STATUS,
        await link.sendSvil(CMD_SVIL_APP_FOREGROUND, [APP_FOREGROUND_STATUS], { uint8: true }));
    return {
        appId: le32(r, 3),
        msLeft: le16(r, 7),
        rule: r[9] === 0xff ? null : r[9],
        frontLayer: r[10] === 0xff ? null : r[10],
        onMask: le16(r, 11),
        offMask: le16(r, 13),
        flags: r[31] ?? 0,
    };
}

// ---- layout files (.svil) ----------------------------------------------------------

/** A rule as a .svil file keeps it: the app key too, when Keybard knows it. */
export interface SvilAppRule {
    app_id: number;
    key?: string;
    label: string;
    default_layer: number | null;
    front_layer: number | null;
    on_mask: number;
    off_mask: number;
    flags?: number;
}

export const appRulesToSvil = (rules: readonly AppRule[]): SvilAppRule[] => rules.map((r) => ({
    app_id: r.appId >>> 0,
    ...(r.key?.trim() ? { key: r.key.trim() } : {}),
    label: truncateUtf8(r.label ?? ""),
    default_layer: r.defaultLayer,
    front_layer: r.frontLayer,
    on_mask: r.onMask & 0xffff,
    off_mask: r.offMask & 0xffff,
    flags: r.flags & 0xff,
}));

const fileLayer = (v: unknown): number | null => (typeof v === "number" && Number.isInteger(v) && v >= 0 && v < APP_LAYER_NONE ? v : null);
const fileMask = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v & 0xffff : 0);

/** Rules from a file: at most 64; a key in the file gives the ID (an ID that disagrees loses). Null when absent. */
export function appRulesFromSvil(value: unknown): AppRule[] | null {
    if (!Array.isArray(value)) return null;
    return value.slice(0, APP_RULES_MAX).filter((e) => e && typeof e === "object").map((e: Record<string, unknown>) => {
        const key = typeof e.key === "string" && e.key.trim() ? e.key.trim() : undefined;
        const id = key ? appId(key) : (typeof e.app_id === "number" ? e.app_id >>> 0 : 0);
        return {
            appId: id,
            defaultLayer: fileLayer(e.default_layer),
            frontLayer: fileLayer(e.front_layer),
            onMask: fileMask(e.on_mask),
            offMask: fileMask(e.off_mask),
            flags: typeof e.flags === "number" ? e.flags & 0xff : 0,
            label: truncateUtf8(typeof e.label === "string" ? e.label : key ?? ""),
            ...(key ? { key } : {}),
        };
    });
}
