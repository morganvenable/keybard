// What Keybard does about each half's side, as pure functions of what the board reports.
//
// - Boards without SIDE (per-hand builds) keep today's flow: nothing here applies.
// - Before an update Keybard notes each half's side (from SIDE, or from the updater's
//   INFO hand on a per-hand build). After the update it reads SIDE again and writes a
//   side only where a half came back unknown or changed. Halves that ran a per-hand
//   build adopt its side on their own (source "migrated"), so usually nothing is written.
// - The customer is asked only when a half has no side and Keybard didn't know it before.
// - Two halves on the same side: neither types until it is fixed. Keybard shows it with a
//   one-click fix that sets the other half to the other side.
// - Hardware mismatches warn and confirm; nothing here refuses. A thumb strap that
//   disagrees (SET status 4) is explained, not retried.

import {
    SideStatus, oppositeSide, strapSide, type Side, type SideReport, type SideValue,
} from "./side";

/** "usb": the half plugged into the computer. "other": the half on the split cable. */
export type HalfRole = "usb" | "other";

export type SideAssessment =
    /** Per-hand firmware: no SIDE command. Today's flow, unchanged. */
    | { kind: "unsupported" }
    /** SIDE is advertised but the read failed. */
    | { kind: "unreadable" }
    /** Both halves have a side, and they differ. */
    | { kind: "ok"; usb: Side; other: Side; migrated: boolean }
    /** Only the half with USB is connected. */
    | { kind: "alone"; usb: SideValue }
    /** The other half connected moments ago and hasn't reported yet. */
    | { kind: "pending"; usb: SideValue }
    /** One or both halves have no side. `guess` is the side the half most likely is. */
    | { kind: "unknown"; halves: HalfRole[]; usb: SideValue; other: SideValue | null; guess: Partial<Record<HalfRole, Side>> }
    /** Both halves claim the same side. */
    | { kind: "same"; side: Side };

/** Read the board's SIDE reply. */
export function assessSides(supported: boolean, r: SideReport | null): SideAssessment {
    if (!supported) return { kind: "unsupported" };
    if (!r) return { kind: "unreadable" };
    const otherKnown = r.otherConnected && r.otherReported;
    const other: SideValue | null = otherKnown ? r.otherSide : null;
    if (r.pair === "same" && r.side !== "unknown") return { kind: "same", side: r.side };
    const unknown: HalfRole[] = [];
    if (r.side === "unknown") unknown.push("usb");
    if (otherKnown && r.otherSide === "unknown") unknown.push("other");
    if (unknown.length) {
        const guess: Partial<Record<HalfRole, Side>> = {};
        // One half known: the other is the opposite.
        if (unknown.length === 1 && unknown[0] === "usb" && other && other !== "unknown") guess.usb = oppositeSide(other);
        if (unknown.length === 1 && unknown[0] === "other" && r.side !== "unknown") guess.other = oppositeSide(r.side);
        return { kind: "unknown", halves: unknown, usb: r.side, other, guess };
    }
    if (!r.otherConnected) return { kind: "alone", usb: r.side };
    if (!r.otherReported || r.pair === "pending") return { kind: "pending", usb: r.side };
    if (r.side === "unknown" || r.otherSide === "unknown") return { kind: "unknown", halves: [], usb: r.side, other, guess: {} };
    if (r.side === r.otherSide) return { kind: "same", side: r.side };
    return { kind: "ok", usb: r.side, other: r.otherSide, migrated: r.source === 3 };
}

/** Whether the halves can type: both have a side and they differ (or only one half is there). */
export const sidesSound = (a: SideAssessment): boolean => a.kind === "ok" || a.kind === "unsupported" || (a.kind === "alone" && a.usb !== "unknown");

/** What Keybard knew about each half's side before an update. */
export interface KnownSides {
    usb: Side | null;
    other: Side | null;
}

/** The sides as read before the update: from SIDE, or from a per-hand build's updater hand. */
export function knownSidesFrom(a: SideAssessment, updaterHand?: number, otherAnswered?: boolean): KnownSides {
    if (a.kind === "ok") return { usb: a.usb, other: a.other };
    if (a.kind === "alone") return { usb: a.usb === "unknown" ? null : a.usb, other: null };
    if (a.kind === "pending") return { usb: a.usb === "unknown" ? null : a.usb, other: null };
    if (a.kind === "unknown") {
        return { usb: a.usb === "unknown" ? null : a.usb, other: a.other && a.other !== "unknown" ? a.other : null };
    }
    if (a.kind === "unsupported" && (updaterHand === 0 || updaterHand === 1)) {
        const usb: Side = updaterHand === 0 ? "left" : "right";
        return { usb, other: otherAnswered === false ? null : oppositeSide(usb) };
    }
    return { usb: null, other: null };
}

export interface SideWrite {
    role: HalfRole;
    side: Side;
    /** Why: the half came back without a side, or with a different one. */
    why: "unknown" | "changed" | "same";
}

export interface AfterUpdatePlan {
    /** SETs Keybard sends on its own: the side each half had before the update. */
    writes: SideWrite[];
    /** Halves only the customer can name. */
    ask: HalfRole[];
    /** Both halves kept their sides. */
    kept: boolean;
    /** A half took its side from its per-hand build. */
    migrated: boolean;
}

/**
 * After an update: compare the sides now with the sides before, and decide what to write.
 * A half that came back unknown or different gets the side it had before. Only a half with
 * no side that Keybard didn't know before is asked about.
 */
export function planAfterUpdate(before: KnownSides, now: SideAssessment): AfterUpdatePlan {
    const none: AfterUpdatePlan = { writes: [], ask: [], kept: true, migrated: false };
    if (now.kind === "unsupported" || now.kind === "unreadable") return none;
    if (now.kind === "ok") {
        const writes: SideWrite[] = [];
        if (before.usb && now.usb !== before.usb && before.other && now.other !== before.other) {
            // Both swapped: put both back.
            writes.push({ role: "other", side: before.other, why: "changed" }, { role: "usb", side: before.usb, why: "changed" });
        }
        return { writes, ask: [], kept: writes.length === 0, migrated: now.migrated };
    }
    if (now.kind === "alone" || now.kind === "pending") {
        if (now.usb === "unknown") {
            return before.usb ? { writes: [{ role: "usb", side: before.usb, why: "unknown" }], ask: [], kept: false, migrated: false } : { ...none, ask: ["usb"], kept: false };
        }
        return none;
    }
    if (now.kind === "same") {
        // Put back whichever half moved. Unknown before: the customer says.
        if (before.usb && before.other && before.usb !== before.other) {
            const role: HalfRole = before.usb === now.side ? "other" : "usb";
            return { writes: [{ role, side: role === "usb" ? before.usb : before.other, why: "same" }], ask: [], kept: false, migrated: false };
        }
        return { writes: [], ask: ["other"], kept: false, migrated: false };
    }
    // unknown
    const writes: SideWrite[] = [];
    const ask: HalfRole[] = [];
    for (const role of now.halves) {
        const was = role === "usb" ? before.usb : before.other;
        if (was) writes.push({ role, side: was, why: "unknown" });
        else ask.push(role);
    }
    // The other half first: writing the half with USB restarts the connection.
    writes.sort((a, b) => (a.role === b.role ? 0 : a.role === "other" ? -1 : 1));
    return { writes, ask, kept: false, migrated: false };
}

/** The side to offer first when asking about a half: its own side when it has one, or the likely one. */
export function suggestedSide(a: SideAssessment, role: HalfRole): Side | null {
    if (a.kind === "unknown") {
        const own = role === "usb" ? a.usb : a.other;
        return own === "left" || own === "right" ? own : a.guess[role] ?? null;
    }
    // Two on one side: keeping the plugged-in half as it is takes one write (the other half).
    if (a.kind === "same") return role === "other" ? oppositeSide(a.side) : a.side;
    return null;
}

/** The sides each half runs as now (null: not connected, or not reported). */
export function currentSides(a: SideAssessment): { usb: SideValue | null; other: SideValue | null } {
    switch (a.kind) {
        case "ok": return { usb: a.usb, other: a.other };
        case "same": return { usb: a.side, other: a.side };
        case "unknown": return { usb: a.usb, other: a.other };
        case "alone":
        case "pending": return { usb: a.usb, other: null };
        default: return { usb: null, other: null };
    }
}

/**
 * The customer said which half is plugged into the computer: the SETs that make the
 * halves match, the other half first (writing the half with USB restarts the connection).
 */
export function writesForAnswer(a: SideAssessment, usb: Side): SideWrite[] {
    const now = currentSides(a);
    const why = a.kind === "same" ? "same" : "unknown";
    const writes: SideWrite[] = [];
    const other = oppositeSide(usb);
    if (now.other !== null && now.other !== other) writes.push({ role: "other", side: other, why: now.other === "unknown" ? "unknown" : why });
    if (now.usb !== usb) writes.push({ role: "usb", side: usb, why: now.usb === "unknown" ? "unknown" : why });
    return writes;
}

/** The one-click fix for two halves on the same side: the other half takes the other side. */
export function sameSideFix(side: Side): SideWrite {
    return { role: "other", side: oppositeSide(side), why: "same" };
}

const SUPPORT = "open a ticket in #customer-service on the Svalboard Discord (https://www.svalboard.com/discord)";

export const sideWord = (s: Side) => (s === "left" ? "left" : "right");
export const halfName = (role: HalfRole) => (role === "usb" ? "the half plugged into your computer" : "the half on the split cable");

/**
 * A SET or CLEAR status in plain words, or null for OK (0) and accepted (7).
 * `strap` is the GET reply's strap class, for status 4.
 */
export function explainSideStatus(status: number, o: { role?: HalfRole; wanted?: Side; strap?: number } = {}): string | null {
    const which = o.role ? halfName(o.role) : "this half";
    switch (status) {
        case SideStatus.OK:
        case SideStatus.OTHER_ACCEPTED:
            return null;
        case SideStatus.STRAP_DISAGREES: {
            // The thumb cluster's wiring sets the side, and it wins over a write.
            const fitted = (o.strap !== undefined ? strapSide(o.strap) : null) ?? (o.wanted ? oppositeSide(o.wanted) : null);
            if (!fitted) return `${capitalize(which)} has a thumb cluster for the other side, which sets its side. To sort it out, ${SUPPORT}.`;
            return `${capitalize(which)} has a ${fitted} thumb cluster, which makes it the ${fitted} half. ` +
                `If it's really the ${oppositeSide(fitted)} half, it has the wrong thumb cluster. To sort it out, ${SUPPORT}.`;
        }
        case SideStatus.NO_RECORD_AREA:
            return `${capitalize(which)} has no room to save its side. To sort it out, ${SUPPORT}.`;
        case SideStatus.WRITE_FAILED:
            return `${capitalize(which)} couldn't save its side. Try again; if it keeps failing, ${SUPPORT}.`;
        case SideStatus.OTHER_NOT_CONNECTED:
            return "The other half isn't connected. Check the split cable, then try again.";
        case SideStatus.NO_ANSWER:
            return "The other half didn't answer. It may run older firmware: update both halves, then try again.";
        default:
            return `Keybard couldn't set the side (status ${status}). Try again; if it keeps failing, ${SUPPORT}.`;
    }
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const SIDE_SUPPORT_TEXT = SUPPORT;
