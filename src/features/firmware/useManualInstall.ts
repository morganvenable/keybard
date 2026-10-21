// The guided manual install's controller: the backup when it opens (as the in-app
// install's sheet takes one), the layout choice, and, once the keyboard is back on the
// new firmware, putting the layout back or keeping the defaults. The state is in
// sessionStorage, so the dialog the editor shows again after the reconnect carries on.

import { useCallback, useEffect, useRef, useState } from "react";

import type { FirmwareReleasePin } from "@/constants/firmware-releases";
import { announceFlowState, type FlowHost } from "@/services/updater/flow";
import {
    manualReady, newManualSession, runManualAfterwards, sessionManualStore,
    type ManualAfterwards, type ManualSession, type ManualStore,
} from "@/services/updater/manual";
import type { Hand } from "@/services/updater/protocol";
import type { UpdateBackup } from "./useFirmwareUpdate";

export interface ManualHost extends Pick<FlowHost, "restoreLayout" | "readStorageFlags" | "clearStorageReset"> {
    makeBackup(info: { fromTag: string; toTag: string }): Promise<UpdateBackup>;
}

let tabStore: ManualStore | null = null;
/** Backups and restores running in this page, by session id: a remounted controller doesn't start them again. */
const backingUp = new Set<string>();
const restoring = new Set<string>();

export interface UseManualInstallOptions {
    /** The connection the keyboard is on now, null while none is (see manualReconnected). */
    connectionKey: string | null;
    /** What the board runs, for the backup's name. */
    fromTag: string;
    usualHand?: Hand;
    store?: ManualStore;
}

export function useManualInstall(host: ManualHost | null, o: UseManualInstallOptions) {
    const storeRef = useRef<ManualStore>(o.store ?? (tabStore ??= sessionManualStore(undefined, announceFlowState)));
    const [session, setSession] = useState<ManualSession | null>(() => storeRef.current.load());
    const hostRef = useRef(host);
    hostRef.current = host;

    /** Change the saved session, only while it is still the open one. */
    const patch = useCallback((id: string, change: (s: ManualSession) => ManualSession) => {
        const now = storeRef.current.load();
        if (!now || now.id !== id) return;
        const next = change(now);
        storeRef.current.save(next);
        setSession(next);
    }, []);

    const open = useCallback((release: FirmwareReleasePin | null, only?: Hand) => {
        const h = hostRef.current;
        const connected = !!h && !!o.connectionKey;
        const s = newManualSession({ releaseTag: release?.tag ?? null, only, usualHand: o.usualHand, openKey: o.connectionKey, connected });
        storeRef.current.save(s);
        setSession(s);
        if (!connected) return;
        backingUp.add(s.id);
        void h!.makeBackup({ fromTag: o.fromTag, toTag: release?.tag ?? "" }).then(
            (b) => patch(s.id, (x) => ({ ...x, backup: { state: "ok", fileName: b.fileName, snapshotId: b.snapshotId, svil: b.svil } })),
            // Gentle, as on the sheet: warn, and switch Keep my layout to the default layout.
            (e) => patch(s.id, (x) => ({ ...x, backup: { state: "failed", error: e instanceof Error ? e.message : String(e) }, afterwards: "defaults" })),
        ).finally(() => backingUp.delete(s.id));
    }, [o.connectionKey, o.fromTag, o.usualHand, patch]);

    // After a reload mid-backup: that backup is gone with the page.
    useEffect(() => {
        if (session?.backup?.state === "pending" && !backingUp.has(session.id)) {
            patch(session.id, (x) => ({ ...x, backup: { state: "failed", error: "The backup didn't finish." }, afterwards: "defaults" }));
        }
    }, [session, patch]);

    const setAfterwards = useCallback((afterwards: ManualAfterwards) => {
        if (!session) return;
        patch(session.id, (x) => ((afterwards === "restore" && x.backup?.state !== "ok") || x.phase !== "steps" ? x : { ...x, afterwards }));
    }, [session, patch]);

    const markDownloaded = useCallback((hands: Hand[]) => {
        if (session) patch(session.id, (x) => ({ ...x, downloaded: { ...x.downloaded, ...Object.fromEntries(hands.map((h) => [h, true])) } }));
    }, [session, patch]);

    const markInstalled = useCallback((hand: Hand) => {
        if (session) patch(session.id, (x) => ({ ...x, installed: { ...x.installed, [hand]: true } }));
    }, [session, patch]);

    // The keyboard is back after every half's install: act on the layout choice, once.
    useEffect(() => {
        const h = hostRef.current;
        if (!h || !session) return;
        // A reload mid-restore: the page that ran it is gone, so run it again (it writes only what differs).
        const resume = session.phase === "restoring" && !restoring.has(session.id);
        if (!resume && !manualReady(session, o.connectionKey)) return;
        if (restoring.has(session.id)) return;
        restoring.add(session.id);
        patch(session.id, (x) => ({ ...x, phase: "restoring", error: null }));
        void runManualAfterwards(h, session).then(
            (result) => patch(session.id, (x) => ({ ...x, phase: "done", result })),
            (e) => patch(session.id, (x) => ({ ...x, phase: "failed", error: e instanceof Error ? e.message : String(e) })),
        ).finally(() => restoring.delete(session.id));
    }, [session, o.connectionKey, patch]);

    const close = useCallback(() => {
        storeRef.current.clear();
        setSession(null);
    }, []);

    return { session, open, setAfterwards, markDownloaded, markInstalled, close };
}
