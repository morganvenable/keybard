// The flow host for the real app: the WebHID connection Keybard has open, reconnecting
// through KeyboardContext after the restart, the backup, and putting the layout back
// through the import path (preflight, then syncWithKeyboard), with no review dialog.

import { useBackups, serializeForBackup } from "@/contexts/BackupContext";
import { useChanges } from "@/contexts/ChangesContext";
import { listPermittedDevices, useKeyboard } from "@/contexts/KeyboardContext";
import { HOST_ORIGIN } from "@/features/trainer/host";
import { PARANOID } from "@/lib/paranoid";
import { getBackupService } from "@/services/backup/backup.service";
import { fileService } from "@/services/file.service";
import { readBoard } from "@/services/board-read";
import { boardSerialOf, identityService, probeBoardSerial } from "@/services/identity.service";
import { SvilUSB, usbInstance } from "@/services/usb.service";
import type { CheckRow } from "@/services/updater/checks";
import { noteResetNoticeCleared } from "@/services/updater/flow";
import { realClock, type UpdaterTransport } from "@/services/updater/transport";
import { WebHidUpdaterTransport } from "@/services/updater/webhid-transport";
import { usbSideHost } from "@/services/side-host";
import { restoreLayoutToBoard } from "./restore";
import { withBoardState } from "./board-state";
import type { FirmwareUiHost, UpdateBackup } from "./useFirmwareUpdate";

/** <board name>-<installed release>-<date>.svil */
export function backupFileName(boardName: string, now = new Date()): string {
    const safe = (s: string) => s.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "Svalboard";
    const pad = (n: number) => String(n).padStart(2, "0");
    // Named by board and when it was saved: a layout file, not a firmware version.
    return `${safe(boardName)}-layout-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}.svil`;
}

/** Save text to Downloads with no file picker: the sheet says where it went. */
export function downloadText(text: string, name: string): void {
    const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Hold a Web Lock (a second Keybard tab stays out) and a Screen Wake Lock. */
export async function holdUpdateLocks(): Promise<() => void> {
    let releaseLock: (() => void) | null = null;
    const locks = (navigator as Navigator & { locks?: LockManager }).locks;
    if (locks) {
        await new Promise<void>((acquired) => {
            void locks.request("keybard-firmware-update", { ifAvailable: true }, (lock) => {
                acquired();
                if (!lock) return undefined;
                return new Promise<void>((done) => { releaseLock = done; });
            }).catch(() => acquired());
        });
    }
    let wake: { release: () => Promise<void> } | null = null;
    try { wake = await (navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } }).wakeLock?.request("screen") ?? null; } catch { /* not granted: fine */ }
    return () => { releaseLock?.(); void wake?.release().catch(() => undefined); };
}

/** Ask Keybard Overlay to let go of the keyboard, where this page already uses it. */
async function pauseKeybardHost(): Promise<CheckRow | null> {
    const native = typeof window !== "undefined" && !!(window as Window & { __keybardNativeState?: unknown }).__keybardNativeState;
    const servedByHost = typeof location !== "undefined" && location.origin === HOST_ORIGIN;
    if (PARANOID || (!native && !servedByHost)) return null;
    try {
        const boot = await fetch(`/api/host/bootstrap`, { cache: "no-store", signal: AbortSignal.timeout(1500) });
        if (!boot.ok) return null;
        const { token } = await boot.json();
        const r = await fetch(`/api/host/command`, { method: "POST", headers: { "Content-Type": "application/json", "X-Keybard-Token": token }, body: JSON.stringify({ op: "disconnect" }), signal: AbortSignal.timeout(1500) });
        return r.ok ? { id: "host", label: "Keybard Overlay paused", state: "ok" } : { id: "host", label: "Keybard Overlay is still using the keyboard.", state: "warn", detail: "Quit Keybard Overlay if the update stops." };
    } catch {
        return null;
    }
}

type AppState = { kb: ReturnType<typeof useKeyboard>; changes: ReturnType<typeof useChanges>; backups: ReturnType<typeof useBackups> };

/**
 * The app's state as the editor last rendered it, shared by every mount. The editor
 * unmounts while the keyboard reconnects and mounts again once the layout has loaded, so a
 * running update must read the new mount's state: a ref of the old mount stays on
 * "disconnected" forever, and the update then waits out its reconnect and stops.
 */
const shared: { current: AppState | null } = { current: null };
let appHost: FirmwareUiHost | null = null;

export function useAppFirmwareHost(): FirmwareUiHost {
    const kb = useKeyboard();
    const changes = useChanges();
    const backups = useBackups();
    shared.current = { kb, changes, backups };
    if (!appHost) {
        appHost = createAppHost(shared as { current: AppState });
        // ?fakeBoard: the browser tests drive the real host's after-update steps against the simulated board.
        if (typeof window !== "undefined" && window.keybardFakeBoard) window.keybardFakeBoard.firmwareHost = appHost;
    }
    return appHost;
}

/**
 * Which permitted device is the board being updated. Several Svalboards may be plugged in and
 * permitted at once, and the one that just restarted is usually listed last: the reconnect
 * must open that board, never the first one listed. A device's serial is read once, on a
 * connection of its own (the editor never loads another board for it). With no serial to go
 * by, only a lone candidate is taken.
 */
export async function pickBoard(devices: HIDDevice[], serial: string | null, isOpen: (d: HIDDevice) => boolean, probe: (d: HIDDevice) => Promise<string | null>): Promise<HIDDevice | null> {
    const candidates = devices.filter((d) => !isOpen(d));
    if (!serial) return candidates.length === 1 && devices.length === 1 ? candidates[0] : null;
    for (const device of candidates) {
        if ((await probe(device)) === serial) return device;
    }
    return null;
}

/** How long a permitted board that didn't answer the serial read is left alone. */
const PROBE_RETRY_MS = 5_000;

function createAppHost(ref: { current: AppState }): FirmwareUiHost {
    const transport = new WebHidUpdaterTransport(usbInstance);
    const live = (): UpdaterTransport | null => (usbInstance.isOpen() ? transport : null);
    const keyboardLoaded = () => ref.current.kb.isConnected && !!ref.current.kb.keyboard;
    /** The serial of the board this host updates: read while it was connected, before it restarts. */
    let boardSerial: string | null = null;
    // A board still starting doesn't answer yet: only serials read are kept.
    const serials = new WeakMap<HIDDevice, string>();
    const probe = async (device: HIDDevice) => {
        const known = serials.get(device);
        if (known) return known;
        const serial = await probeBoardSerial(device);
        if (serial) serials.set(device, serial);
        return serial;
    };
    /**
     * The board this session edits. A board whose key isn't a serial (firmware without an
     * identity) has none: never the serial of a board updated earlier in this tab.
     */
    const rememberBoard = async () => {
        const key = ref.current.backups.board?.key;
        if (key) boardSerial = key.startsWith("sval:") ? key : null;
        else if (usbInstance.isOpen() && ref.current.kb.isConnected) boardSerial = boardSerialOf(await identityService.getInfo().catch(() => null));
        return boardSerial;
    };
    /** Why the board connected now isn't `serial` (the one being updated), or null when it is or nothing says otherwise. */
    const otherBoard = async (serial: string | null = boardSerial): Promise<string | null> => {
        if (!serial) return null;
        const now = boardSerialOf(await identityService.getInfo().catch(() => null));
        return now && now !== serial ? `Keybard is connected to another keyboard (${now}), not the one that was updated. Nothing was written. Connect the updated keyboard and restore the backup from Backups.` : null;
    };
    return {
        clock: realClock,
        transport: live,
        async waitForDevice(timeoutMs) {
            // The board this session edits, the one that is restarting.
            await rememberBoard();
            const deadline = Date.now() + timeoutMs;
            // A board that doesn't answer (other firmware, the bootloader, busy) is asked again only
            // every few seconds.
            // Only boards listed when the wait began are left alone: a device that appears during it
            // (the restarted board, still starting) is asked on every pass until it answers.
            const missed = new Map<HIDDevice, number>();
            let listedAtStart: Set<HIDDevice> | null = null;
            const probeHere = async (device: HIDDevice) => {
                const at = missed.get(device);
                if (at !== undefined && Date.now() - at < PROBE_RETRY_MS) return null;
                const serial = await probe(device);
                if (serial) missed.delete(device);
                else if (listedAtStart?.has(device)) missed.set(device, Date.now());
                return serial;
            };
            while (Date.now() < deadline) {
                // A board loaded meanwhile counts only when it is the one being updated.
                if (keyboardLoaded() && usbInstance.isOpen() && !(await otherBoard())) return transport;
                const devices = await listPermittedDevices();
                listedAtStart ??= new Set(devices);
                const device = await pickBoard(devices, boardSerial, (d) => usbInstance.hasDevice(d), probeHere);
                if (device) await ref.current.kb.connectDevice(device, { discardEdits: true }).catch(() => false);
                await realClock.sleep(500);
            }
            return null;
        },
        async readStorageFlags() {
            const info = await usbInstance.sendSvil(SvilUSB.CMD_SVIL_GET_INFO, [], { uint8: true });
            return info[17] ?? 0;
        },
        async clearStorageReset() {
            try {
                await usbInstance.sendSvil(SvilUSB.CMD_SVIL_STORAGE_RESET_CLEAR, [], {});
            } finally {
                // The layout loaded on the reconnect still carries the notice: the update has
                // acted on it, so the reset dialog must not ask again on this connection, even
                // if 0x2A didn't get through (the board then asks on the next one).
                // (Not by editing the layout: that would count as an unsaved change.)
                noteResetNoticeCleared(ref.current.kb.connectionSessionId);
            }
        },
        async restoreLayout(svil) {
            // Wait for the reconnect's load, then write onto what the board holds now: the
            // restore reads the whole board itself and never plans against the editor's copy.
            const deadline = Date.now() + 20_000;
            while (!keyboardLoaded() && Date.now() < deadline) await realClock.sleep(250);
            const { kb: k, changes: ch } = ref.current;
            if (!k.keyboard) throw new Error("The keyboard didn't finish loading.");
            const other = await otherBoard();
            if (other) throw new Error(other);
            return restoreLayoutToBoard(svil, { readBoard, setKeyboard: k.setKeyboard, queue: ch.queue, commit: ch.commit, markSaved: k.markAsSaved, applyBoardState: k.applyBoardState });
        },
        otherBoard,
        currentBoard: rememberBoard,
        async keymapBlank() {
            // After the wipe's reconnect: wait for the load, then every key on every layer is KC_NO.
            const deadline = Date.now() + 20_000;
            while (!keyboardLoaded() && Date.now() < deadline) await realClock.sleep(250);
            const keymap = ref.current.kb.keyboard?.keymap;
            return !!keymap?.length && keymap.every((layer) => layer.every((code) => code === 0));
        },
        holdLocks: holdUpdateLocks,
        sides: usbSideHost(usbInstance),
        async makeBackup({ fromTag, toTag }): Promise<UpdateBackup> {
            const serial = await rememberBoard();
            const { kb: k, backups: b } = ref.current;
            if (!k.keyboard) throw new Error("No layout loaded.");
            // The layout plus the board's touchpad mode, which only the update's restore puts back.
            const svil = withBoardState(serializeForBackup(k.keyboard), k.keyboard);
            // Parse it back before Start is enabled.
            await fileService.loadFile(new File([svil], "check.svil", { type: "application/json" }));
            const boardName = b.board?.name ?? k.keyboard.name ?? "Svalboard";
            const fileName = backupFileName(boardName);
            let snapshotId: string | undefined;
            // Before the board is identified, keep it under its keyboard UID: the reset dialog
            // finds a fresh pre-update backup under any key, and the board may come back
            // under another one anyway.
            const boardKey = b.board?.key ?? (k.keyboard.kbid ? `uid:${k.keyboard.kbid.toUpperCase()}` : null);
            if (boardKey) {
                const meta = await getBackupService()?.saveSnapshot({ boardKey, boardName, svil, kind: "pre-update", pendingCount: 0, fromTag, toTag });
                snapshotId = meta?.id;
            }
            downloadText(svil, fileName);
            return { snapshotId, fileName, svil, boardSerial: serial };
        },
        async prepareRows() {
            await rememberBoard();
            const row = await pauseKeybardHost();
            return row ? [row] : [];
        },
        boardName: () => ref.current.backups.board?.name ?? ref.current.kb.keyboard?.name ?? "Svalboard",
    };
}
