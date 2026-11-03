// The app's flow host keeps to the board it updates: it reconnects only that board, never
// carries on against another board that was connected meanwhile, forgets a serial when the
// board it now edits has none, and doesn't keep probing a board that never answers.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

const kb = vi.hoisted(() => ({
    current: { isConnected: true, connectionSessionId: 1, keyboard: { kbid: "abc", keymap: [[4, 5]] } as Record<string, unknown> | null, setKeyboard: vi.fn(), connectDevice: vi.fn() as (d: unknown, o?: unknown) => Promise<boolean> },
}));
const hid = vi.hoisted(() => ({ devices: [] as unknown[], open: null as unknown, backupKey: null as string | null, serialNow: null as string | null, serials: new Map<unknown, string | null>(), probes: new Map<unknown, number>() }));
vi.mock("@/contexts/KeyboardContext", () => ({ useKeyboard: () => kb.current, listPermittedDevices: async () => hid.devices }));
vi.mock("@/contexts/ChangesContext", () => ({ useChanges: () => ({ queue: vi.fn(), commit: vi.fn() }) }));
vi.mock("@/contexts/BackupContext", () => ({ useBackups: () => ({ board: hid.backupKey ? { key: hid.backupKey } : null, snapshots: [] }), serializeForBackup: () => "{}" }));
vi.mock("@/services/usb.service", () => ({
    SvilUSB: { CMD_SVIL_GET_INFO: 0x00, CMD_SVIL_STORAGE_RESET_CLEAR: 0x2a },
    usbInstance: { isOpen: () => hid.open !== null, hasDevice: (d: unknown) => d === hid.open, sendSvil: async () => new Uint8Array(32) },
}));
vi.mock("@/services/identity.service", () => ({
    identityService: { getInfo: async () => (hid.serialNow ? { serial: hid.serialNow } : null) },
    boardSerialOf: (info: { serial?: string } | null) => info?.serial ?? null,
    probeBoardSerial: async (d: unknown) => { hid.probes.set(d, (hid.probes.get(d) ?? 0) + 1); return hid.serials.get(d) ?? null; },
}));
vi.mock("@/services/updater/webhid-transport", () => ({ WebHidUpdaterTransport: class { connected() { return hid.open !== null; } } }));

import { useAppFirmwareHost } from "@/features/firmware/useAppFirmwareHost";
import type { FirmwareUiHost } from "@/features/firmware/useFirmwareUpdate";

const A = { name: "board A" }, B = { name: "board B" }, MUTE = { name: "never answers" };

function Editor({ onHost }: { onHost: (h: FirmwareUiHost) => void }) {
    onHost(useAppFirmwareHost());
    return null;
}
function host(): FirmwareUiHost {
    let held: FirmwareUiHost | null = null;
    render(<Editor onHost={(h) => { held ??= h; }} />);
    return held!;
}
/** The editor renders again with the state set above (the host reads the latest render). */
const rerender = () => render(<Editor onHost={() => undefined} />);
const connectsTo = () => vi.fn(async (d: unknown) => { hid.open = d; kb.current = { ...kb.current, isConnected: true }; return true; });

beforeEach(() => {
    hid.devices = [];
    hid.open = A;
    hid.backupKey = "sval:AAAA";
    hid.serialNow = "sval:AAAA";
    hid.serials = new Map<unknown, string | null>([[A, "sval:AAAA"], [B, "sval:BBBB"], [MUTE, null]]);
    hid.probes = new Map();
    kb.current = { ...kb.current, isConnected: true, keyboard: { kbid: "abc" } };
});

describe("the app host's board", () => {
    it("keeps waiting when another board is connected and loaded meanwhile", async () => {
        const h = host();
        await h.makeBackup({ fromTag: "x4.3", toTag: "v4.3.5" }).catch(() => undefined);
        // A restarts; meanwhile B was connected from the chooser and has loaded.
        hid.open = B;
        hid.serialNow = "sval:BBBB";
        hid.devices = [B];
        kb.current = { ...kb.current, isConnected: true, connectDevice: connectsTo() };
        rerender();
        expect(await h.waitForDevice(1200)).toBeNull();
    });

    it("says so before any reset or write after the update", async () => {
        const h = host();
        await h.makeBackup({ fromTag: "x4.3", toTag: "v4.3.5" }).catch(() => undefined);
        hid.serialNow = "sval:BBBB";
        expect(await h.otherBoard!()).toMatch(/another keyboard \(sval:BBBB\)/);
        hid.serialNow = "sval:AAAA";
        expect(await h.otherBoard!()).toBeNull();
    });

    it("forgets the last board's serial when the board it edits now has none", async () => {
        const h = host();
        await h.makeBackup({ fromTag: "x4.3", toTag: "v4.3.5" }).catch(() => undefined);
        // Later this tab edits C, whose firmware has no identity; C restarts. A is plugged in too.
        hid.backupKey = "uid:4829F621F27D181B";
        hid.serialNow = null;
        hid.open = null;
        hid.devices = [A, B];
        const connectDevice = connectsTo();
        kb.current = { ...kb.current, isConnected: false, connectDevice };
        rerender();
        await h.waitForDevice(1200);
        expect(connectDevice).not.toHaveBeenCalledWith(A, expect.anything());
    });

    it("doesn't probe a board that never answers on every pass", async () => {
        const h = host();
        hid.open = null;
        hid.devices = [MUTE, B];
        kb.current = { ...kb.current, isConnected: false, connectDevice: connectsTo() };
        rerender();
        await h.waitForDevice(2600);
        expect(hid.probes.get(MUTE) ?? 0).toBeLessThanOrEqual(1);
    });

    it("asks a board that appears during the wait again soon, though it didn't answer at first", async () => {
        const h = host();
        await h.makeBackup({ fromTag: "x4.3", toTag: "v4.3.5" }).catch(() => undefined);
        const BACK = { name: "A after its restart" };
        hid.serials.set(BACK, null);
        hid.open = null;
        hid.devices = [B];
        const connectDevice = connectsTo();
        kb.current = { ...kb.current, isConnected: false, connectDevice };
        rerender();
        const waiting = h.waitForDevice(2500);
        // A comes back, still starting: it answers from its second read on.
        await new Promise((r) => setTimeout(r, 600));
        hid.devices = [B, BACK];
        const timer = setInterval(() => { if ((hid.probes.get(BACK) ?? 0) >= 1) hid.serials.set(BACK, "sval:AAAA"); }, 20);
        await waiting;
        clearInterval(timer);
        expect(connectDevice).toHaveBeenCalledWith(BACK, expect.anything());
    });
});
