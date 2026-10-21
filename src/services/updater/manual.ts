// The guided manual install's state (M): the backup taken when it opened, the layout
// choice, the steps done, and what happened after the keyboard came back.
//
// It lives in sessionStorage, like the flow's, because the editor unmounts while the
// keyboard reconnects (it shows the connect screen until the layout loads): the dialog
// that comes back must still hold the backup, and put it back. Closing the dialog, or
// the tab, forgets it; the pre-update snapshot and the downloaded file still hold the layout.

import type { FlowHost } from "./flow";
import type { Hand } from "./protocol";

/** The manual install can't wipe to a blank board: that needs the in-app updater's SETTINGS_RESET. */
export type ManualAfterwards = "restore" | "defaults";

export type ManualBackup =
    | { state: "pending" }
    | { state: "ok"; fileName: string; snapshotId?: string; svil: string }
    | { state: "failed"; error: string };

export interface ManualSession {
    version: 1;
    id: string;
    /** The release offered for download (null: the firmware release page). */
    releaseTag: string | null;
    only?: Hand;
    /** The half the user usually plugs in; the other goes first (U-Q5). */
    usualHand: Hand;
    /** Null: no keyboard was connected when it opened, so there's no backup. */
    backup: ManualBackup | null;
    afterwards: ManualAfterwards;
    downloaded: Partial<Record<Hand, boolean>>;
    installed: Partial<Record<Hand, boolean>>;
    /** The connection when it opened: the keyboard coming back is any other one. */
    openKey: string | null;
    phase: "steps" | "restoring" | "done" | "failed";
    result: { layout: "restored" | "defaults"; trimmed: string[] } | null;
    error: string | null;
}

export interface ManualStore {
    load(): ManualSession | null;
    save(session: ManualSession): void;
    clear(): void;
}

export const MANUAL_KEY = "keybard:firmware-manual-install";

/** sessionStorage: per tab, survives the editor's remount and a reload, gone with the tab. */
export function sessionManualStore(storage: Storage | null = typeof sessionStorage === "undefined" ? null : sessionStorage, onChange: () => void = () => undefined): ManualStore {
    return {
        load() {
            try {
                const raw = storage?.getItem(MANUAL_KEY);
                return raw ? (JSON.parse(raw) as ManualSession) : null;
            } catch { return null; }
        },
        save(session) {
            const had = (() => { try { return !!storage?.getItem(MANUAL_KEY); } catch { return false; } })();
            try { storage?.setItem(MANUAL_KEY, JSON.stringify(session)); } catch (e) { console.warn("[firmware] couldn't save the manual install state", e); }
            if (!had) onChange();
        },
        clear() {
            try { storage?.removeItem(MANUAL_KEY); } catch { /* nothing to do */ }
            onChange();
        },
    };
}

export function memoryManualStore(): ManualStore {
    let saved: string | null = null;
    return {
        load: () => (saved ? (JSON.parse(saved) as ManualSession) : null),
        save: (s) => { saved = JSON.stringify(s); },
        clear: () => { saved = null; },
    };
}

/** A manual install open in this tab owns the board's reset notice: it acts on it once the keyboard is back. */
export function manualOwnsResetNotice(storage: Storage | null = typeof sessionStorage === "undefined" ? null : sessionStorage): boolean {
    try { return !!storage?.getItem(MANUAL_KEY); } catch { return false; }
}

export function newManualSession(o: { releaseTag: string | null; only?: Hand; usualHand?: Hand; openKey: string | null; connected: boolean }): ManualSession {
    return {
        version: 1, id: Math.random().toString(36).slice(2, 10), releaseTag: o.releaseTag, only: o.only, usualHand: o.usualHand ?? 1, backup: o.connected ? { state: "pending" } : null,
        // Keep my layout once the backup is saved; with no keyboard there is nothing to keep.
        afterwards: o.connected ? "restore" : "defaults",
        downloaded: {}, installed: {}, openKey: o.openKey, phase: "steps", result: null, error: null,
    };
}

/** The halves the steps cover, the other half first (U-Q5). */
export function manualHalves(only: Hand | undefined, usualHand: Hand = 1): Hand[] {
    return only !== undefined ? [only] : [(usualHand === 0 ? 1 : 0) as Hand, usualHand];
}

/**
 * Whether the keyboard is back after the install: connected again, on another
 * connection than the one the dialog opened on, with every half's install step done.
 */
export function manualReady(s: ManualSession, key: string | null): boolean {
    return s.phase === "steps" && manualReconnected(s, key) && manualHalves(s.only, s.usualHand).every((h) => s.installed[h]);
}

/** Connected again since the dialog opened: another connection than the one it opened on. */
export function manualReconnected(s: ManualSession, key: string | null): boolean {
    return !!key && key !== s.openKey;
}

/**
 * The layout choice, once the keyboard is back on the new firmware: Keep my layout puts
 * the backup back through the import path; the default layout keeps what the firmware
 * started with. Then the reset notice is cleared (0x2A), last, as the in-app update does.
 */
export async function runManualAfterwards(host: Pick<FlowHost, "restoreLayout" | "readStorageFlags" | "clearStorageReset">, s: ManualSession): Promise<{ layout: "restored" | "defaults"; trimmed: string[] }> {
    let trimmed: string[] = [];
    const restore = s.afterwards === "restore" && s.backup?.state === "ok";
    if (restore) trimmed = (await host.restoreLayout((s.backup as Extract<ManualBackup, { state: "ok" }>).svil)).trimmed;
    // Firmware without the reset notice (or GET_INFO) has nothing to clear.
    const flags = await host.readStorageFlags().catch(() => 0);
    if (flags & 0x04) await host.clearStorageReset().catch((e) => console.warn("[firmware] couldn't clear the reset notice", e));
    return { layout: restore ? "restored" : "defaults", trimmed };
}
