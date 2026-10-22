// Install by hand from Settings > Firmware: plain instructions (no Next buttons, nothing
// ticked off), a backup when it opens, and one real check on Connect: Keybard reads what
// each half runs. Both on the release: the layout goes back and it says so. One half old,
// or silent: only that half's file and steps. Neither: the instructions, with one line.
// Also: what Settings shows for a board on an updater Keybard installs on only by hand.
import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import type { FirmwareReleasePin } from "@/constants/firmware-releases";
import { readBoardSummary, updaterVersionLabel } from "@/features/firmware/board-summary";
import { ManualInstall } from "@/features/firmware/ManualInstall";
import { useManualInstall, type ManualHost } from "@/features/firmware/useManualInstall";
import { FakeHost, fakeSetup } from "@/services/updater/fake-host";
import type { FakeSvalboard } from "@/services/updater/fake-board";
import { updateOwnsResetNotice } from "@/services/updater/flow";
import {
    MANUAL_KEY, checkManual, manualOwnsResetNotice, manualPending, manualShouldCheck, memoryManualStore, newManualSession, runManualAfterwards, sessionManualStore,
    type ManualStore,
} from "@/services/updater/manual";
import { VirtualClock } from "@/services/updater/transport";

vi.mock("@/lib/paranoid", () => ({ PARANOID: false, userIsLooking: () => true }));

const release: FirmwareReleasePin = {
    tag: "x3.2", kind: "x", fwVersion: 4000, updaterProtocol: 4,
    files: { left: { svup: "l.svup", uf2: "left-x3.2.uf2", sha256: "l", size: 1, pid: 0x4044 }, right: { svup: "r.svup", uf2: "right-x3.2.uf2", sha256: "r", size: 1, pid: 0x4045 } },
    notesUrl: "",
};

class Host extends FakeHost implements ManualHost {
    backups = 0;
    failBackup = false;
    async makeBackup({ fromTag }: { fromTag: string }) {
        this.backups++;
        if (this.failBackup) throw new Error("Disk full.");
        return { fileName: `Kip-${fromTag}-2026-10-21.svil`, svil: '{"layout":"mine"}' };
    }
}

function setup(o: { restoreFails?: boolean; trimmed?: string[] } = {}) {
    const clock = new VirtualClock();
    const { board } = fakeSetup({ clock, running: { tag: "x3.1.3", fwVersion: 2301 }, half: { protocol: 3 }, host: o });
    return { board, host: new Host(board, clock, o) };
}

const flash = (board: FakeSvalboard, hand: 0 | 1) => board.flashByHand(hand, { fwVersion: release.fwVersion, tag: release.tag });

/** The editor's part: the controller and the dialog, remounted on every reconnect like the app. */
function Editor({ host, store, connectionKey }: { host: Host; store: ManualStore; connectionKey: string | null }) {
    const m = useManualInstall(host, { connectionKey, readBoard: () => readBoardSummary(host.board), fromTag: "x3.1.3", fromFw: 2301, once: true, store });
    const s = m.session;
    if (!s) return <button onClick={() => m.open(release)}>Update to x3.2</button>;
    return (
        <ManualInstall
            release={release} usualHand={s.usualHand} once={s.once} backup={s.backup} afterwards={s.afterwards}
            onAfterwards={(a) => { if (a !== "blank") m.setAfterwards(a); }}
            check={s.check} outcome={s} onConnect={m.checkNow} onClose={m.close}
        />
    );
}

const radio = (name: string) => screen.getByRole("radio", { name }) as HTMLInputElement;

async function opened(o: Parameters<typeof setup>[0] = {}, store: ManualStore = memoryManualStore()) {
    const s = setup(o);
    const view = render(<Editor host={s.host} store={store} connectionKey="p:1" />);
    fireEvent.click(screen.getByRole("button", { name: "Update to x3.2" }));
    await waitFor(() => expect(screen.getByText("Kip-x3.1.3-2026-10-21.svil")).toBeTruthy());
    const reconnect = async (key: string) => { await act(async () => { view.rerender(<Editor host={s.host} store={store} connectionKey={key} />); }); };
    return { ...s, view, store, reconnect };
}

describe("the manual install's state", () => {
    it("checks each new connection once, never the one it opened on", () => {
        const s = newManualSession({ releaseTag: "x3.2", releaseFw: 4000, openKey: "p:1", connected: true });
        expect(s.afterwards).toBe("restore");
        expect(s.backup).toEqual({ state: "pending" });
        expect(manualShouldCheck(s, "p:1")).toBe(false);
        expect(manualShouldCheck(s, null)).toBe(false);
        expect(manualShouldCheck(s, "p:2")).toBe(true);
        expect(manualShouldCheck({ ...s, checkedKey: "p:2" }, "p:2")).toBe(false);
        expect(manualShouldCheck({ ...s, phase: "done" }, "p:3")).toBe(false);
    });

    it("with no keyboard connected has no backup and starts from the default layout", () => {
        const s = newManualSession({ releaseTag: null, openKey: null, connected: false });
        expect(s.backup).toBeNull();
        expect(s.afterwards).toBe("defaults");
    });

    it("reads each half against the release, and names a half by what the board ran before", () => {
        const s = { releaseFw: 4000, fromTag: "x3.1.3", fromFw: 2301 };
        const half = (hand: 0 | 1, fwVersion: number, answered = true) => ({ hand, answered, fwVersion, tag: fwVersion === 4000 ? "x3.2" : `build ${fwVersion}` });
        const board = (halves: ReturnType<typeof half>[]) => ({ updater: true, legacyLabel: null, usbHand: 1 as const, tag: "x3.2", fwVersion: 4000, halves });
        expect(checkManual(s, board([half(0, 4000), half(1, 4000)]))).toEqual({ halves: { 0: { state: "new" }, 1: { state: "new" } } });
        expect(checkManual(s, board([half(0, 2301), half(1, 4000)])).halves[0]).toEqual({ state: "old", tag: "x3.1.3" });
        expect(checkManual(s, board([half(0, 0, false), half(1, 4000)])).halves[0]).toEqual({ state: "silent" });
        // The half with USB still on firmware without a protocol-4 updater: it can't be asked about the other half.
        expect(checkManual(s, { updater: false, legacyLabel: "x3.1.3", usbHand: 1, tag: "x3.1.3", fwVersion: 2301, halves: [] })).toEqual({ halves: { 1: { state: "old", tag: "x3.1.3" }, 0: { state: "unknown" } } });
        expect(manualPending({ usualHand: 1 }, { halves: { 0: { state: "old" }, 1: { state: "new" } } })).toEqual([0]);
        expect(manualPending({ only: 0, usualHand: 1 }, { halves: { 0: { state: "new" }, 1: { state: "old" } } })).toEqual([]);
    });

    it("Put my layout back puts the backup back, then clears the reset notice last", async () => {
        const { board, host } = setup();
        board.storageFlags = 0x04;
        const s = { ...newManualSession({ releaseTag: "x3.2", openKey: "p:1", connected: true }), backup: { state: "ok" as const, fileName: "f.svil", svil: "{}" } };
        expect(await runManualAfterwards(host, s)).toEqual({ layout: "restored", trimmed: [] });
        expect(host.events).toEqual(["restore", "flags:4", "0x2A"]);
        expect(board.storageFlags & 0x04).toBe(0);
    });

    it("the default layout writes nothing; with no reset notice there's nothing to clear", async () => {
        const { host } = setup();
        const s = { ...newManualSession({ releaseTag: "x3.2", openKey: "p:1", connected: true }), afterwards: "defaults" as const, backup: { state: "ok" as const, fileName: "f.svil", svil: "{}" } };
        expect(await runManualAfterwards(host, s)).toEqual({ layout: "defaults", trimmed: [] });
        expect(host.restores).toBe(0);
        expect(host.clears).toBe(0);
    });

    it("owns the board's reset notice while it is open, so the reset dialog doesn't ask as well", () => {
        sessionStorage.clear();
        expect(manualOwnsResetNotice()).toBe(false);
        const store = sessionManualStore(sessionStorage);
        store.save(newManualSession({ releaseTag: "x3.2", openKey: "p:1", connected: true }));
        expect(sessionStorage.getItem(MANUAL_KEY)).toBeTruthy();
        expect(manualOwnsResetNotice()).toBe(true);
        expect(updateOwnsResetNotice()).toBe(true);
        store.clear();
        expect(updateOwnsResetNotice()).toBe(false);
    });
});

describe("Install by hand from Settings > Firmware", () => {
    beforeEach(() => sessionStorage.clear());

    it("is plain instructions: the layout choice, both files, the steps with the reset timing, and no Next or check marks", async () => {
        await opened();
        const dialog = screen.getByTestId("manual-install");
        expect(screen.getByRole("heading", { name: "Install x3.2 by hand" })).toBeTruthy();
        expect(screen.getByText("Your keyboard needs this once. After that, Keybard installs updates for you. It takes about five minutes.")).toBeTruthy();
        expect(radio("Put my layout back").checked).toBe(true);
        expect(radio("Put my layout back").disabled).toBe(false);
        expect(radio("Start from the default layout")).toBeTruthy();
        expect(screen.queryByRole("radio", { name: "Start from a blank keyboard" })).toBeNull();
        expect(dialog.querySelectorAll("[data-file]")).toHaveLength(2);
        expect(dialog.textContent).toContain("Press its RESET button twice, about a quarter of a second apart. Too fast and nothing happens. A drive named RPI-RP2 opens.");
        expect(dialog.textContent).toContain("Plug the USB cable into the half's U port.");
        expect(screen.queryByRole("button", { name: "Next" })).toBeNull();
        expect(dialog.querySelector("svg")).toBeNull();
        expect(screen.getByRole("button", { name: "Connect keyboard" })).toBeTruthy();
    });

    it("Connect with both halves on x3.2 puts the layout back and says it's done, across the reconnect remount", async () => {
        const store = sessionManualStore(sessionStorage);
        const { board, host, view } = await opened({}, store);
        flash(board, 0);
        flash(board, 1);
        // Back on a new connection: the editor unmounts and mounts again, the dialog carries on.
        view.unmount();
        render(<Editor host={host} store={store} connectionKey="p:2" />);
        await waitFor(() => expect(screen.getByRole("heading", { name: "x3.2 is installed" })).toBeTruthy());
        expect(screen.getByText("Your layout is back on the keyboard. From now on, updates install from Keybard.")).toBeTruthy();
        expect(host.restores).toBe(1);
        expect(screen.getByRole("button", { name: "Done" })).toBeTruthy();
    });

    it("Connect with one half still old names it and shows only its file and steps; Connect again finishes", async () => {
        const { board, host, reconnect } = await opened();
        flash(board, 1); // the right half, with USB
        await reconnect("p:2");
        await waitFor(() => expect(screen.getByRole("heading", { name: "The left half still runs x3.1.3" })).toBeTruthy());
        expect(screen.getByText("The right half has x3.2. Install the left half's file, then connect again.")).toBeTruthy();
        const dialog = screen.getByTestId("manual-install");
        expect([...dialog.querySelectorAll("[data-file]")].map((a) => a.getAttribute("data-file"))).toEqual(["left"]);
        expect(dialog.textContent).toContain("Plug the USB cable into the left half's U port.");
        expect(within(screen.getByTestId("manual-halves")).getByText("x3.1.3")).toBeTruthy();
        expect(host.restores).toBe(0);
        flash(board, 0);
        await reconnect("p:3");
        await waitFor(() => expect(screen.getByRole("heading", { name: "x3.2 is installed" })).toBeTruthy());
        expect(host.restores).toBe(1);
    });

    it("a half that doesn't answer over the split cable is named, with its steps", async () => {
        const { board, reconnect } = await opened();
        flash(board, 1);
        board.setAnswering(0, false);
        await reconnect("p:2");
        await waitFor(() => expect(screen.getByRole("heading", { name: "The left half didn't answer" })).toBeTruthy());
        expect(screen.getByText(/may still run its old firmware, which doesn't answer over the split cable/)).toBeTruthy();
    });

    it("neither half changed: the instructions stay, with one line saying so", async () => {
        const { host, reconnect } = await opened();
        await reconnect("p:2");
        await waitFor(() => expect(screen.getByTestId("manual-still")).toBeTruthy());
        expect(screen.getByTestId("manual-still").textContent).toBe("The right half still runs x3.1.3. Install its file, and the left half's file if you haven't yet, then connect again.");
        expect(screen.getByRole("heading", { name: "Install x3.2 by hand" })).toBeTruthy();
        expect(screen.getByRole("button", { name: "Connect again" })).toBeTruthy();
        expect(host.restores).toBe(0);
    });

    it("Start from the default layout puts nothing back", async () => {
        const { board, host, store, reconnect } = await opened();
        fireEvent.click(radio("Start from the default layout"));
        expect(radio("Start from the default layout").checked).toBe(true);
        flash(board, 0);
        flash(board, 1);
        await reconnect("p:2");
        await waitFor(() => expect(store.load()?.phase).toBe("done"));
        expect(store.load()?.result?.layout).toBe("defaults");
        expect(screen.getByText("Your keyboard has the default layout. From now on, updates install from Keybard.")).toBeTruthy();
        expect(host.restores).toBe(0);
    });

    it("a failed backup says so and starts from the default layout", async () => {
        const { host } = setup();
        host.failBackup = true;
        render(<Editor host={host} store={memoryManualStore()} connectionKey="p:1" />);
        fireEvent.click(screen.getByRole("button", { name: "Update to x3.2" }));
        await waitFor(() => expect(screen.getByText("Keybard couldn't save your layout.")).toBeTruthy());
        expect(screen.getByText(/Disk full\. Afterward the keyboard starts from the default layout\./)).toBeTruthy();
        expect(screen.queryByRole("radio", { name: "Put my layout back" })).toBeNull();
    });

    it("a failed restore says where the layout still is", async () => {
        const { board, reconnect } = await opened({ restoreFails: true });
        flash(board, 0);
        flash(board, 1);
        await reconnect("p:2");
        await waitFor(() => expect(screen.getByText("Keybard couldn't put your layout back.")).toBeTruthy());
        expect(screen.getByRole("alert").textContent).toMatch(/stopped answering.*Restore Kip-x3\.1\.3-2026-10-21\.svil from Backups/);
    });

    it("with no keyboard connected there's no layout to keep, and nothing about connecting first", () => {
        render(<ManualInstall release={release} backup={null} afterwards="defaults" onAfterwards={() => undefined} onConnect={() => undefined} onClose={() => undefined} />);
        expect(screen.queryByText(/Connect your keyboard to save its layout first/)).toBeNull();
        expect(screen.queryByRole("radiogroup")).toBeNull();
        expect(screen.getByRole("button", { name: "Connect keyboard" })).toBeTruthy();
    });
});

describe("a board on updater protocol 3 (vNext1, x3.x)", () => {
    it("is named by its version string from INFO page 1, not as vNext1", async () => {
        const { board } = setup();
        const summary = await readBoardSummary(board);
        expect(summary.updater).toBe(false);
        expect(summary.legacyLabel).toBe("x3.1.3");
        expect(summary.fwVersion).toBe(2301);
    });

    it("falls back to its numeric version when the string is empty (a local build)", async () => {
        const clock = new VirtualClock();
        const { board } = fakeSetup({ clock, running: { tag: "", fwVersion: 2301 }, half: { protocol: 3 } });
        expect((await readBoardSummary(board)).legacyLabel).toBe("fw version 2301");
        expect(updaterVersionLabel("  ", 7)).toBe("fw version 7");
        expect(updaterVersionLabel("vNext1", 2300)).toBe("vNext1");
    });

    it("protocol 4 still installs in Keybard, named by its tag", async () => {
        const clock = new VirtualClock();
        const { board } = fakeSetup({ clock, running: { tag: "v3", fwVersion: 3000 } });
        const summary = await readBoardSummary(board);
        expect(summary.updater).toBe(true);
        expect(summary.tag).toBe("v3");
    });
});
