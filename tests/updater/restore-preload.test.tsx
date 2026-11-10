// "Restore my layout" runs after the board restarts. Its code was fetched only then, so a
// site redeployed during the update (new chunk names) left the restore unable to load:
// "Failed to fetch dynamically imported module", with the board on its defaults. The sheet
// now loads that code first, and nothing is installed until it has.
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { UpdateDialog } from "@/features/firmware/UpdateDialog";
import { RESTORE_CODE_MISSING, useFirmwareUpdate, type FirmwareUiHost } from "@/features/firmware/useFirmwareUpdate";
import { FakeHost, fakeSetup, fixtureRelease } from "@/services/updater/fake-host";
import { memoryFlowStore, UpdateFlow } from "@/services/updater/flow";
import { Op } from "@/services/updater/protocol";
import { VirtualClock } from "@/services/updater/transport";

vi.mock("@/lib/paranoid", () => ({ PARANOID: false, userIsLooking: () => true }));

const CHUNK_404 = "Failed to fetch dynamically imported module: http://127.0.0.1:5232/assets/import.service-2TBb7MFR.js";

afterEach(() => {
    vi.doUnmock("@/services/import.service");
    vi.resetModules();
});

describe("loadRestoreModules", () => {
    it("rejects when a chunk 404s, and loads afresh on the next call", async () => {
        vi.resetModules();
        vi.doMock("@/services/import.service", () => { throw new TypeError(CHUNK_404); });
        const { loadRestoreModules } = await import("@/features/firmware/restore");
        // The import rejects (vitest wraps the factory's error in its own).
        await expect(loadRestoreModules()).rejects.toThrow();
        // Try again: the failure isn't kept.
        vi.doUnmock("@/services/import.service");
        const modules = await loadRestoreModules();
        expect(typeof modules.importService.syncWithKeyboard).toBe("function");
        expect(modules.keyboardService).toBeTruthy();
        // Loaded once, then shared.
        expect(await loadRestoreModules()).toBe(modules);
    });
});

class SheetHost extends FakeHost implements FirmwareUiHost {
    prepared = 0;
    constructor(board: ConstructorParameters<typeof FakeHost>[0], clock: VirtualClock, private readonly ok: boolean) { super(board, clock); }
    async prepareRestore() {
        this.prepared++;
        if (!this.ok) throw new TypeError(CHUNK_404);
    }
    async makeBackup() { return { fileName: "Kip-v3-2026-10-15.svil", svil: "{}" }; }
    boardName() { return "Kip"; }
}

async function startWithRestore(ok: boolean) {
    const clock = new VirtualClock();
    const v3 = await fixtureRelease("v3", 3000);
    const x32 = await fixtureRelease("x3.2", 4000, { noChord: true });
    const { board } = fakeSetup({ clock, running: v3, noChord: true });
    const host = new SheetHost(board, clock, ok);
    const store = memoryFlowStore();
    const source = { kind: "file" as const, files: [x32.files[0], x32.files[1]] };
    function Editor() {
        const fw = useFirmwareUpdate(host, { store, releases: [] });
        return (
            <>
                {fw.ui.kind === "idle" && <button onClick={() => void fw.openSheet(source)}>Open</button>}
                <UpdateDialog ui={fw.ui} now={() => clock.now()} chordLegends={() => ["M", ","]} cancellable={!!fw.flow?.cancellable} onAfterwards={fw.setAfterwards} onStart={fw.start} onCancel={fw.close} onClose={fw.close} onFailureAction={() => fw.close()} />
            </>
        );
    }
    const runs = vi.spyOn(UpdateFlow.prototype, "run");
    render(<Editor />);
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    await screen.findByTestId("update-sheet");
    expect(await screen.findByRole("radio", { name: "Restore my layout" })).toBeChecked();
    const start = await screen.findByRole("button", { name: /^(Update anyway|Update)$/ });
    await waitFor(() => expect(start).not.toBeDisabled());
    await act(async () => { fireEvent.click(start); });
    return { host, board, runs };
}

describe("the update sheet loads the restore's code before installing", () => {
    it("loads it when the sheet opens", async () => {
        const { host, runs } = await startWithRestore(true);
        expect(host.prepared).toBeGreaterThanOrEqual(1);
        await waitFor(() => expect(runs).toHaveBeenCalled());
        runs.mockRestore();
    });

    it("installs nothing when the code can't be fetched, and says to reload", async () => {
        const { board, runs } = await startWithRestore(false);
        expect(await screen.findByRole("alert")).toHaveTextContent(RESTORE_CODE_MISSING);
        expect(runs).not.toHaveBeenCalled();
        expect(board.requests.some((r) => r.op === Op.BEGIN || r.op === Op.COMMIT)).toBe(false);
        runs.mockRestore();
    });
});
