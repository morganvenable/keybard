// One test build over another with the same fw_version: the Firmware card offers the install.
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { FirmwareReleasePin } from "@/constants/firmware-releases";
import type { BoardSummary } from "@/features/firmware/board-summary";
import { firmwareStatusFor } from "@/features/firmware/useFirmwareStatus";
import { FirmwareSection } from "@/features/firmware/FirmwareSection";

const pin = (tag: string, fwVersion: number): FirmwareReleasePin => ({
    tag, kind: "x", fwVersion, updaterProtocol: 4, svalProtocol: 3,
    file: { uf2: `svalboard_sval_${tag}.uf2`, sha256: tag, size: 1 }, notesUrl: "",
});
const board = (tag: string, fw: number): BoardSummary => ({
    updater: true, legacyLabel: null, usbHand: 1, differ: false, noChord: false, fwVersion: fw, tag,
    halves: [{ hand: 0, usb: false, tag, fwVersion: fw, answered: true }, { hand: 1, usb: true, tag, fwVersion: fw, answered: true }],
});

describe("another build, same version", () => {
    const releases = [pin("x4.5-ballfix", 21), pin("x4.5", 20)];
    it("offers the newest build instead of saying the keyboard has it", () => {
        const onInstall = vi.fn();
        render(<FirmwareSection board={board("x4.5-balldiag", 21)} releases={releases} onInstall={onInstall} onManual={vi.fn()} paranoid={false} />);
        expect(screen.queryByText(/has the newest firmware/)).toBeNull();
        fireEvent.click(screen.getByRole("button", { name: "Install x4.5-ballfix" }));
        expect(onInstall).toHaveBeenCalledWith({ kind: "release", release: releases[0] });
        expect(firmwareStatusFor(board("x4.5-balldiag", 21), releases).updateAvailable).toBe(true);
    });
    it("leaves a board on the newest build alone", () => {
        render(<FirmwareSection board={board("x4.5-ballfix", 21)} releases={releases} onInstall={vi.fn()} onManual={vi.fn()} paranoid={false} />);
        expect(screen.getByText(/has the newest firmware/)).toBeTruthy();
        expect(firmwareStatusFor(board("x4.5-ballfix", 21), releases).updateAvailable).toBe(false);
    });
});
