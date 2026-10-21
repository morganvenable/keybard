// What Keybard does about each half's side: supported or not, unknown, same side, migrated, status 4.
import { describe, expect, it } from "vitest";

import { SideSource, SideStatus, Strap, decodeSideGet, encodeSideGet, type SideReport } from "@/services/side";
import {
    assessSides, explainSideStatus, knownSidesFrom, planAfterUpdate, sameSideFix, sidesSound, suggestedSide, writesForAnswer,
} from "@/services/side-decision";

const report = (o: Parameters<typeof encodeSideGet>[0]): SideReport => decodeSideGet(encodeSideGet(o))!;
const pair = (usb: "left" | "right" | "unknown", other: "left" | "right" | "unknown", source: number = SideSource.KEYBARD) => report({
    side: usb, source, otherConnected: true, otherReported: true, otherSide: other,
    pair: usb === "unknown" || other === "unknown" ? "no-side" : usb === other ? "same" : "ok",
});

describe("assessSides", () => {
    it("unsupported: per-hand firmware keeps today's flow", () => {
        expect(assessSides(false, null)).toEqual({ kind: "unsupported" });
        expect(sidesSound(assessSides(false, null))).toBe(true);
        expect(assessSides(true, null)).toEqual({ kind: "unreadable" });
    });
    it("ok, with migrated when the half took its side from a per-hand build", () => {
        expect(assessSides(true, pair("right", "left"))).toEqual({ kind: "ok", usb: "right", other: "left", migrated: false });
        expect(assessSides(true, pair("left", "right", SideSource.MIGRATED))).toMatchObject({ kind: "ok", migrated: true });
    });
    it("unknown: which halves, and a guess when one half is known", () => {
        expect(assessSides(true, pair("unknown", "right"))).toEqual({ kind: "unknown", halves: ["usb"], usb: "unknown", other: "right", guess: { usb: "left" } });
        expect(assessSides(true, pair("left", "unknown"))).toEqual({ kind: "unknown", halves: ["other"], usb: "left", other: "unknown", guess: { other: "right" } });
        expect(assessSides(true, pair("unknown", "unknown"))).toMatchObject({ kind: "unknown", halves: ["usb", "other"], guess: {} });
    });
    it("same side", () => {
        expect(assessSides(true, pair("right", "right"))).toEqual({ kind: "same", side: "right" });
        expect(sidesSound({ kind: "same", side: "right" })).toBe(false);
    });
    it("alone and pending", () => {
        expect(assessSides(true, report({ side: "left", otherConnected: false }))).toEqual({ kind: "alone", usb: "left" });
        expect(assessSides(true, report({ side: "unknown", otherConnected: false }))).toMatchObject({ kind: "unknown", halves: ["usb"] });
        expect(assessSides(true, report({ side: "left", otherConnected: true, otherReported: false, pair: "pending" }))).toEqual({ kind: "pending", usb: "left" });
    });
});

describe("knownSidesFrom: the sides before an update", () => {
    it("from SIDE", () => {
        expect(knownSidesFrom(assessSides(true, pair("left", "right")))).toEqual({ usb: "left", other: "right" });
    });
    it("from a per-hand build's updater hand", () => {
        expect(knownSidesFrom({ kind: "unsupported" }, 1, true)).toEqual({ usb: "right", other: "left" });
        expect(knownSidesFrom({ kind: "unsupported" }, 0, false)).toEqual({ usb: "left", other: null });
        expect(knownSidesFrom({ kind: "unsupported" }, 0xff, true)).toEqual({ usb: null, other: null });
    });
});

describe("planAfterUpdate", () => {
    const before = { usb: "right" as const, other: "left" as const };
    it("migrated: nothing to write, nothing to ask", () => {
        expect(planAfterUpdate(before, assessSides(true, pair("right", "left", SideSource.MIGRATED)))).toEqual({ writes: [], ask: [], kept: true, migrated: true });
    });
    it("unsupported after the update: nothing", () => {
        expect(planAfterUpdate(before, { kind: "unsupported" })).toMatchObject({ writes: [], ask: [] });
    });
    it("a half came back unknown: Keybard puts back the side it had, without asking", () => {
        expect(planAfterUpdate(before, assessSides(true, pair("right", "unknown")))).toMatchObject({ writes: [{ role: "other", side: "left", why: "unknown" }], ask: [] });
        const both = planAfterUpdate(before, assessSides(true, pair("unknown", "unknown")));
        expect(both.writes.map((w) => w.role)).toEqual(["other", "usb"]);
        expect(both.ask).toEqual([]);
    });
    it("unknown and not known before: ask the customer", () => {
        expect(planAfterUpdate({ usb: null, other: null }, assessSides(true, pair("unknown", "unknown")))).toMatchObject({ writes: [], ask: ["usb", "other"] });
        expect(planAfterUpdate({ usb: "right", other: null }, assessSides(true, pair("right", "unknown")))).toMatchObject({ writes: [], ask: ["other"] });
    });
    it("same side after: put back the half that moved; unknown before, ask", () => {
        expect(planAfterUpdate(before, assessSides(true, pair("right", "right")))).toMatchObject({ writes: [{ role: "other", side: "left", why: "same" }] });
        expect(planAfterUpdate(before, assessSides(true, pair("left", "left")))).toMatchObject({ writes: [{ role: "usb", side: "right" }] });
        expect(planAfterUpdate({ usb: null, other: null }, assessSides(true, pair("left", "left")))).toMatchObject({ writes: [], ask: ["other"] });
    });
    it("both halves swapped: put both back, the other half first", () => {
        expect(planAfterUpdate(before, assessSides(true, pair("left", "right"))).writes.map((w) => `${w.role}:${w.side}`)).toEqual(["other:left", "usb:right"]);
    });
    it("only the half with USB, and it came back unknown", () => {
        const alone = assessSides(true, report({ side: "unknown", otherConnected: false }));
        expect(planAfterUpdate(before, alone)).toMatchObject({ writes: [{ role: "usb", side: "right" }] });
        expect(planAfterUpdate({ usb: null, other: null }, alone)).toMatchObject({ ask: ["usb"] });
    });
});

describe("the customer's answer and the one-click fix", () => {
    it("same side: the fix sets the other half to the other side", () => {
        expect(sameSideFix("right")).toEqual({ role: "other", side: "left", why: "same" });
        expect(suggestedSide({ kind: "same", side: "right" }, "other")).toBe("left");
        expect(suggestedSide({ kind: "same", side: "right" }, "usb")).toBe("right");
        // The half with USB knows its side, the other doesn't: offer the plugged-in half's own side.
        expect(suggestedSide(assessSides(true, pair("right", "unknown")), "usb")).toBe("right");
        expect(suggestedSide(assessSides(true, pair("unknown", "right")), "usb")).toBe("left");
        expect(suggestedSide(assessSides(true, pair("unknown", "unknown")), "usb")).toBeNull();
    });
    it("writes only what differs, the other half first", () => {
        expect(writesForAnswer(assessSides(true, pair("right", "right")), "left")).toEqual([{ role: "usb", side: "left", why: "same" }]);
        expect(writesForAnswer(assessSides(true, pair("right", "right")), "right")).toEqual([{ role: "other", side: "left", why: "same" }]);
        expect(writesForAnswer(assessSides(true, pair("unknown", "unknown")), "left").map((w) => `${w.role}:${w.side}`)).toEqual(["other:right", "usb:left"]);
        expect(writesForAnswer(assessSides(true, report({ side: "unknown", otherConnected: false })), "right")).toEqual([{ role: "usb", side: "right", why: "unknown" }]);
    });
});

describe("explainSideStatus", () => {
    it("OK and accepted need no words", () => {
        expect(explainSideStatus(SideStatus.OK)).toBeNull();
        expect(explainSideStatus(SideStatus.OTHER_ACCEPTED)).toBeNull();
    });
    it("status 4: the thumb strap, in plain words, with where to get help", () => {
        const text = explainSideStatus(SideStatus.STRAP_DISAGREES, { role: "usb", wanted: "left", strap: Strap.RIGHT })!;
        expect(text).toContain("right thumb cluster");
        expect(text).toBe("The half plugged into your computer has a right thumb cluster, which makes it the right half. If it's really the left half, it has the wrong thumb cluster. To sort it out, open a ticket in #customer-service on the Svalboard Discord (https://www.svalboard.com/discord).");
        expect(text).toContain("#customer-service on the Svalboard Discord (https://www.svalboard.com/discord)");
        expect(text).not.toMatch(/strap|status|0x/i);
        // Without the strap read (the other half), it says the other side of what was asked.
        expect(explainSideStatus(4, { role: "other", wanted: "right" })).toContain("a left thumb cluster");
    });
    it("every other status has words", () => {
        for (const s of [1, 2, 3, 5, 6, 9]) expect(explainSideStatus(s)).toMatch(/\w/);
        expect(explainSideStatus(SideStatus.OTHER_NOT_CONNECTED)).toContain("split cable");
    });
});
