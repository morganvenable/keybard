// The guided manual install from Settings > Firmware: a backup when it opens, the same
// Keep my layout / default layout choice as the in-app install, and the layout put back
// once the keyboard is connected again, across the editor's remount on that reconnect.
// Also: what Settings shows for a board on an updater Keybard installs on only by hand.
import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

import type { FirmwareReleasePin } from "@/constants/firmware-releases";
import { readBoardSummary, updaterVersionLabel } from "@/features/firmware/board-summary";
import { ManualInstall } from "@/features/firmware/ManualInstall";
import { useManualInstall, type ManualHost } from "@/features/firmware/useManualInstall";
import { FakeHost, fakeSetup } from "@/services/updater/fake-host";
import { updateOwnsResetNotice } from "@/services/updater/flow";
import {
    MANUAL_KEY, manualOwnsResetNotice, manualReady, manualReconnected, memoryManualStore, newManualSession, runManualAfterwards, sessionManualStore,
    type ManualStore,
} from "@/services/updater/manual";
import { VirtualClock } from "@/services/updater/transport";

vi.mock("@/lib/paranoid", () => ({ PARANOID: false, userIsLooking: () => true }));

const release: FirmwareReleasePin = {
    tag: "x3.2", kind: "x", fwVersion: 4000, updaterProtocol: 4,
    files: { left: { svup: "l.svup", uf2: "left-x3.2.uf2", sha256: "l", size: 1, pid: 0x4044 }, right: { svup: "r.svup", uf2: "right-x3.2.uf2", sha256: "r", size: 1, pid: 0x4045 } },
    highlights: [], notesUrl: "",
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

/** The editor's part: the controller and the dialog, remounted on every reconnect like the app. */
function Editor({ host, store, connectionKey }: { host: Host; store: ManualStore; connectionKey: string | null }) {
    const m = useManualInstall(host, { connectionKey, fromTag: "x3.1.3", store });
    const s = m.session;
    if (!s) return <button onClick={() => m.open(release)}>Install x3.2</button>;
    return (
        <ManualInstall
            release={release} usualHand={s.usualHand} backup={s.backup} afterwards={s.afterwards}
            onAfterwards={(a) => { if (a !== "blank") m.setAfterwards(a); }}
            downloaded={s.downloaded} installed={s.installed} onDownloaded={m.markDownloaded} onInstalled={m.markInstalled}
            outcome={s} connected={manualReconnected(s, connectionKey)} onConnect={() => undefined} onClose={m.close}
        />
    );
}

const radio = (name: string) => screen.getByRole("radio", { name }) as HTMLInputElement;

describe("the manual install's state", () => {
    it("is ready only on another connection than the one it opened on, with every half's step done", () => {
        const s = newManualSession({ releaseTag: "x3.2", openKey: "p:1", connected: true });
        expect(s.afterwards).toBe("restore");
        expect(s.backup).toEqual({ state: "pending" });
        expect(manualReady(s, "p:1")).toBe(false);
        expect(manualReady({ ...s, installed: { 0: true, 1: true } }, "p:1")).toBe(false); // same connection: never unplugged
        expect(manualReady({ ...s, installed: { 0: true } }, "p:2")).toBe(false); // one half still to install
        expect(manualReady({ ...s, installed: { 0: true, 1: true } }, null)).toBe(false); // not connected yet
        expect(manualReady({ ...s, installed: { 0: true, 1: true } }, "p:2")).toBe(true);
        expect(manualReady({ ...s, only: 0, installed: { 0: true } }, "p:2")).toBe(true); // one-half recovery
        expect(manualReconnected(s, "p:2")).toBe(true);
    });

    it("with no keyboard connected has no backup and resets to the default layout", () => {
        const s = newManualSession({ releaseTag: null, openKey: null, connected: false });
        expect(s.backup).toBeNull();
        expect(s.afterwards).toBe("defaults");
    });

    it("Keep my layout puts the backup back, then clears the reset notice last", async () => {
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

    it("saves the layout first, offers the layout choice, and puts it back after the reconnect remount", async () => {
        const { host } = setup();
        const store = sessionManualStore(sessionStorage);
        const view = render(<Editor host={host} store={store} connectionKey="p:1" />);
        fireEvent.click(screen.getByRole("button", { name: "Install x3.2" }));

        // The backup, as the in-app install's sheet takes one.
        await waitFor(() => expect(screen.getByText("Kip-x3.1.3-2026-10-21.svil")).toBeTruthy());
        expect(host.backups).toBe(1);
        expect(screen.queryByText(/Connect your keyboard to save its layout first/)).toBeNull();
        expect(radio("Keep my layout").checked).toBe(true);
        expect(radio("Keep my layout").disabled).toBe(false);
        expect(radio("Reset to the default layout")).toBeTruthy();
        expect(screen.getByText("Put your layout back")).toBeTruthy();

        // Unplugged to install: both halves, then the keyboard is gone.
        for (const next of screen.getAllByRole("button", { name: "Next" })) fireEvent.click(next);
        view.rerender(<Editor host={host} store={store} connectionKey={null} />);
        expect(host.restores).toBe(0);
        expect(screen.getByRole("button", { name: "Connect" })).toBeTruthy();

        // Back on a new connection: the editor unmounts and mounts again, the dialog carries on.
        view.unmount();
        render(<Editor host={host} store={store} connectionKey="p:2" />);
        await waitFor(() => expect(screen.getByText("Layout put back")).toBeTruthy());
        expect(host.restores).toBe(1);
        expect(screen.getByRole("button", { name: "Done" })).toBeTruthy();
    });

    it("Reset to the default layout puts nothing back", async () => {
        const { host } = setup();
        const store = memoryManualStore();
        const view = render(<Editor host={host} store={store} connectionKey="p:1" />);
        fireEvent.click(screen.getByRole("button", { name: "Install x3.2" }));
        await waitFor(() => expect(radio("Keep my layout").disabled).toBe(false));
        fireEvent.click(radio("Reset to the default layout"));
        expect(radio("Reset to the default layout").checked).toBe(true);
        expect(screen.queryByText("Put your layout back")).toBeNull();
        for (const next of screen.getAllByRole("button", { name: "Next" })) fireEvent.click(next);
        view.rerender(<Editor host={host} store={store} connectionKey="p:2" />);
        await waitFor(() => expect(store.load()?.phase).toBe("done"));
        expect(store.load()?.result?.layout).toBe("defaults");
        expect(host.restores).toBe(0);
    });

    it("a failed backup switches to the default layout and says so", async () => {
        const { host } = setup();
        host.failBackup = true;
        render(<Editor host={host} store={memoryManualStore()} connectionKey="p:1" />);
        fireEvent.click(screen.getByRole("button", { name: "Install x3.2" }));
        await waitFor(() => expect(screen.getByText("Layout not saved")).toBeTruthy());
        expect(screen.getByText(/Disk full\. Switched to Reset to the default layout\./)).toBeTruthy();
        expect(radio("Keep my layout").disabled).toBe(true);
        expect(radio("Reset to the default layout").checked).toBe(true);
    });

    it("a failed restore says where the layout still is", async () => {
        const { host } = setup({ restoreFails: true });
        const store = memoryManualStore();
        const view = render(<Editor host={host} store={store} connectionKey="p:1" />);
        fireEvent.click(screen.getByRole("button", { name: "Install x3.2" }));
        await waitFor(() => expect(radio("Keep my layout").disabled).toBe(false));
        for (const next of screen.getAllByRole("button", { name: "Next" })) fireEvent.click(next);
        await act(async () => { view.rerender(<Editor host={host} store={store} connectionKey="p:2" />); });
        await waitFor(() => expect(screen.getByText("Layout not put back")).toBeTruthy());
        expect(screen.getByRole("alert").textContent).toMatch(/stopped answering.*Restore Kip-x3\.1\.3-2026-10-21\.svil from Backups/);
    });

    it("with no keyboard connected it still says to connect first", () => {
        render(<ManualInstall release={release} backup={null} afterwards="defaults" onAfterwards={() => undefined} connected={false} onConnect={() => undefined} onClose={() => undefined} />);
        expect(screen.getByText("Connect your keyboard to save its layout first.")).toBeTruthy();
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
