// The board status on one-image firmware: the side warning, its fix, and the pointing report's "no side".
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { readBoardSummary } from "@/features/firmware/board-summary";
import { FirmwareSection } from "@/features/firmware/FirmwareSection";
import { SideFix, sideProblem } from "@/features/firmware/SideFix";
import { applySideWrites } from "@/features/firmware/side-actions";
import { Strap } from "@/services/side";
import { fakeSetup, fixtureRelease, type FixtureRelease } from "@/services/updater/fake-host";
import { VirtualClock } from "@/services/updater/transport";
import { parsePointingHardware } from "@/utils/pointing-hardware";

let clock: VirtualClock;
let v3: FixtureRelease;
beforeEach(async () => {
    clock = new VirtualClock();
    v3 ??= await fixtureRelease("v3", 3000);
});

describe("board summary", () => {
    it("a per-hand board has no sides", async () => {
        const { board, host } = fakeSetup({ clock, running: v3 });
        expect((await readBoardSummary(board, null, host.sides)).sides ?? null).toBeNull();
    });
    it("same side on a one-image board: a side to set, not halves that differ", async () => {
        const { board, host } = fakeSetup({ clock, running: v3, sides: { supported: true, usb: { side: "right" }, other: { side: "right" } } });
        const s = await readBoardSummary(board, null, host.sides);
        expect(s.sides).toEqual({ kind: "same", side: "right" });
        expect(s.differ).toBe(false);
    });
    it("one-image board, both sides known", async () => {
        const { board, host } = fakeSetup({ clock, running: v3, sides: { supported: true } });
        expect((await readBoardSummary(board, null, host.sides)).sides).toMatchObject({ kind: "ok", usb: "right", other: "left" });
    });
});

describe("the side fix", () => {
    it("words each problem plainly", () => {
        expect(sideProblem({ kind: "same", side: "left" })).toBe("Both halves are set up as the left half, so neither half types.");
        expect(sideProblem({ kind: "unknown", halves: ["other"], usb: "left", other: "unknown", guess: {} })).toContain("the split cable");
        expect(sideProblem({ kind: "ok", usb: "left", other: "right", migrated: false })).toBeNull();
        expect(sideProblem({ kind: "unsupported" })).toBeNull();
    });
    it("same side: asks which half is plugged in (no guess), then confirms before any write", () => {
        const onApply = vi.fn();
        render(<SideFix sides={{ kind: "same", side: "right" }} onApply={onApply} />);
        expect(screen.getByText("Which half is plugged into your computer?")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Left half" }).getAttribute("data-variant") ?? "").not.toBe("kb-primary");
        fireEvent.click(screen.getByRole("button", { name: "Right half" }));
        expect(onApply).not.toHaveBeenCalled();
        expect(screen.getByText("The half on the split cable becomes the left half.")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Back" }));
        fireEvent.click(screen.getByRole("button", { name: "Left half" }));
        expect(screen.getByText("The half plugged into your computer becomes the left half.")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Set the sides" }));
        expect(onApply).toHaveBeenCalledWith([{ role: "usb", side: "left", why: "same" }]);
    });
    it("restore wording: Keep the plugged-in half as the left half?", () => {
        const onApply = vi.fn();
        render(<SideFix restore suggested="left" sides={{ kind: "unknown", halves: ["other"], usb: "left", other: "unknown", guess: { other: "right" } }} onApply={onApply} />);
        expect(screen.getByText("Keep the plugged-in half as the left half?")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "No, it's the right half" })).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Yes, the left half" }));
        fireEvent.click(screen.getByRole("button", { name: "Set the sides" }));
        expect(onApply).toHaveBeenCalledWith([{ role: "other", side: "right", why: "unknown" }]);
    });
    it("confirm: That's right sends nothing; Swap confirms, then sets both", () => {
        const onApply = vi.fn();
        render(<SideFix mode="confirm" from="migrated" sides={{ kind: "ok", usb: "right", other: "left", migrated: true }} onApply={onApply} />);
        fireEvent.click(screen.getByRole("button", { name: "That's right" }));
        expect(onApply).toHaveBeenLastCalledWith([]);
        fireEvent.click(screen.getByRole("button", { name: "Swap" }));
        fireEvent.click(screen.getByRole("button", { name: "Set the sides" }));
        expect(onApply).toHaveBeenLastCalledWith([{ role: "other", side: "right", why: "swap" }, { role: "usb", side: "left", why: "swap" }]);
    });
    it("unknown: asks which half is plugged in, the likely one first", () => {
        const onApply = vi.fn();
        render(<SideFix sides={{ kind: "unknown", halves: ["usb"], usb: "unknown", other: "right", guess: { usb: "left" } }} onApply={onApply} note="Why it didn't take" />);
        expect(screen.getByText("Which half is plugged into your computer?")).toBeInTheDocument();
        expect(screen.getByRole("alert")).toHaveTextContent("Why it didn't take");
        fireEvent.click(screen.getByRole("button", { name: "Left half" }));
        fireEvent.click(screen.getByRole("button", { name: "Set the sides" }));
        expect(onApply).toHaveBeenCalledWith([{ role: "usb", side: "left", why: "unknown" }]);
    });
    it("the Firmware page shows the warning with its question", () => {
        const board = { updater: true, legacyLabel: null, usbHand: 1 as const, halves: [], differ: false, noChord: false, fwVersion: 4000, tag: "x4", sides: { kind: "same" as const, side: "right" as const } };
        const apply = vi.fn();
        render(<FirmwareSection board={board} releases={[]} onInstall={vi.fn()} onManual={vi.fn()} sides={{ busy: false, note: null, apply }} paranoid={false} />);
        expect(screen.getByText("Set which half is which")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Right half" }));
        fireEvent.click(screen.getByRole("button", { name: "Set the sides" }));
        expect(apply).toHaveBeenCalledWith([{ role: "other", side: "left", why: "same" }]);
    });
    it("applySideWrites: sets the side, and explains status 4", async () => {
        const ok = fakeSetup({ clock, running: v3, sides: { supported: true, usb: { side: "right" }, other: { side: "right" } } });
        expect(await applySideWrites({ ...ok.host, sides: ok.host.sides, clock, waitForDevice: (ms) => ok.host.waitForDevice(ms) }, [{ role: "other", side: "left", why: "same" }])).toBeNull();
        expect(ok.sides!.halves.other.side).toBe("left");
        const strap = fakeSetup({ clock, running: v3, sides: { supported: true, usb: { side: "right", strap: Strap.RIGHT }, other: { side: "right" } } });
        const note = await applySideWrites({ sides: strap.host.sides, clock, waitForDevice: (ms) => strap.host.waitForDevice(ms) }, [{ role: "usb", side: "left", why: "same" }]);
        expect(note).toContain("right thumb PCBA");
    });
});

describe("POINTING_HARDWARE flags bit 5", () => {
    it("a half with no side isn't drawn as a hand", () => {
        // [0x2C][1][usb: flags reported+left, ...][other: reported + no side]
        const reply = Uint8Array.from([0x2c, 1, 0x0b, 2, 2, 0x47, 0xb8, 0x21, 0, 3, 0, 0]);
        const r = parsePointingHardware(reply)!;
        expect(r.halves).toHaveLength(1);
        expect(r.halves[0]).toMatchObject({ usb: true, side: "left" });
        expect(parsePointingHardware(Uint8Array.from([0x2c, 1, 0x21, 0, 3, 0, 0, 0, 0, 0, 0, 0]))).toBeNull();
    });
});
