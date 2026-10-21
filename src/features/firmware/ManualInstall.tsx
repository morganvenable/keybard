// M: the guided manual install. The first move off firmware without the one-chord updater,
// and every recovery of a half stuck in BOOTSEL. Backup first, the layout choice up front, put back at the end.

import { Check, CircleAlert, Download } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { carriedFileUrl, type FirmwareReleasePin } from "@/constants/firmware-releases";
import { SVALBOARD_FIRMWARE_URL } from "@/constants/firmware";
import { PARANOID } from "@/lib/paranoid";
import type { Afterwards } from "@/services/updater/flow";
import { handName, type Hand } from "@/services/updater/protocol";
import { LayoutChoice } from "./LayoutChoice";

/** The backup as the steps show it (the sheet's BackupStatus fits). */
export type ManualBackupView = { state: "pending" } | { state: "ok"; fileName: string } | { state: "failed"; error?: string };

/** After the keyboard is back: putting the layout back, or keeping the defaults. */
export interface ManualOutcome {
    phase: "steps" | "restoring" | "done" | "failed";
    result: { layout: "restored" | "defaults"; trimmed: string[] } | null;
    error: string | null;
}

export interface ManualInstallProps {
    release: FirmwareReleasePin | null;
    /** Recovery of one half (F10, F11): only its steps. */
    only?: Hand;
    /** The half the user usually plugs in; the other goes first (U-Q5). */
    usualHand?: Hand;
    backup: ManualBackupView | null;
    afterwards: Afterwards;
    onAfterwards: (a: Afterwards) => void;
    onConnect: () => void;
    /** Connected again after the install (for the last step). */
    connected: boolean;
    onClose: () => void;
    /** The steps done, when the caller keeps them (they outlive the editor's remount). */
    downloaded?: Partial<Record<Hand, boolean>>;
    installed?: Partial<Record<Hand, boolean>>;
    onDownloaded?: (hands: Hand[]) => void;
    onInstalled?: (hand: Hand) => void;
    /** What happened once the keyboard came back; none: the caller doesn't put the layout back. */
    outcome?: ManualOutcome;
    onOpenBackups?: () => void;
}

const HALF = (h: Hand) => (h === 0 ? "left" : "right");

function Step({ n, title, done, children }: { n: number; title: string; done?: boolean; children?: React.ReactNode }) {
    return (
        <li className="flex gap-3" data-step={n}>
            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${done ? "bg-kb-green text-white" : "border border-kb-gray-border"}`}>{done ? <Check className="h-3.5 w-3.5" aria-hidden /> : n}</span>
            <div className="flex min-w-0 flex-col gap-1">
                <span className="text-sm font-semibold">{title}</span>
                {children}
            </div>
        </li>
    );
}

export function ManualInstall({ release, only, usualHand = 1, backup, afterwards, onAfterwards, onConnect, connected, onClose, outcome, onOpenBackups, ...p }: ManualInstallProps) {
    const [ownDownloaded, setOwnDownloaded] = useState<Partial<Record<Hand, boolean>>>({});
    const [ownInstalled, setOwnInstalled] = useState<Partial<Record<Hand, boolean>>>({});
    const downloaded = p.downloaded ?? ownDownloaded;
    const installed = p.installed ?? ownInstalled;
    const setDownloaded = (hands: Hand[]) => (p.onDownloaded ? p.onDownloaded(hands) : setOwnDownloaded((d) => ({ ...d, ...Object.fromEntries(hands.map((h) => [h, true])) })));
    const setInstalled = (h: Hand) => (p.onInstalled ? p.onInstalled(h) : setOwnInstalled((i) => ({ ...i, [h]: true })));
    const restoring = outcome?.phase === "restoring";
    const first = (usualHand === 0 ? 1 : 0) as Hand;
    const halves: Hand[] = only !== undefined ? [only] : [first, usualHand];
    const tag = release?.tag ?? "the latest firmware";
    const fileFor = (h: Hand) => (release ? (h === 0 ? release.files.left.uf2 : release.files.right.uf2) : null);
    let n = 1;
    return (
        <div className="flex flex-col gap-4" data-testid="manual-install">
            <header>
                <h2 className="text-lg font-semibold text-kb-ink">{only !== undefined ? `Install ${tag} on the ${HALF(only)} half` : `Install ${tag} by hand`}</h2>
                {only === undefined && <p className="text-sm text-muted-foreground">Once per keyboard. Later updates come from Keybard.</p>}
            </header>
            {/* No blank board here: a wipe needs the in-app updater (SETTINGS_RESET), which a manual install can't ask. */}
            <LayoutChoice value={afterwards} onChange={onAfterwards} keepDisabled={backup?.state !== "ok"} choices={["restore", "defaults"]} />
            <ol className="flex flex-col gap-3">
                <Step n={n++} title={backup?.state === "failed" ? "Layout not saved" : "Layout saved"} done={backup?.state === "ok"}>
                    {backup?.state === "ok" && <span className="text-sm"><span className="font-mono text-xs">{backup.fileName}</span> · Downloads</span>}
                    {backup?.state === "pending" && <span className="text-sm text-muted-foreground">Saving…</span>}
                    {backup?.state === "failed" && <span className="text-sm text-muted-foreground">{backup.error ? `${backup.error} ` : ""}Switched to Reset to the default layout.</span>}
                    {!backup && <span className="text-sm text-muted-foreground">Connect your keyboard to save its layout first.</span>}
                </Step>
                <Step n={n++} title="Download firmware" done={halves.every((h) => downloaded[h])}>
                    <div className="flex flex-wrap gap-2">
                        {!release ? (
                            PARANOID
                                ? <code className="select-all break-all font-mono text-xs">{SVALBOARD_FIRMWARE_URL}</code>
                                : <a className="text-sm text-kb-primary underline" href={SVALBOARD_FIRMWARE_URL} target="_blank" rel="noreferrer" onClick={() => setDownloaded([0, 1])}>Svalboard firmware release</a>
                        ) : halves.map((h) => {
                            const file = fileFor(h)!;
                            return (
                                <Button key={h} asChild size="sm" variant="outline" onClick={() => setDownloaded([h])}>
                                    <a href={carriedFileUrl(release, file)} download={file}><Download className="h-4 w-4" aria-hidden />{h === 0 ? "Left" : "Right"} half .uf2</a>
                                </Button>
                            );
                        })}
                    </div>
                </Step>
                {halves.map((h) => (
                    <Step key={h} n={n++} title={`Install on the ${HALF(h)} half`} done={installed[h]}>
                        <ul className="text-sm">
                            <li>Plug USB into the {HALF(h)} half</li>
                            <li>Double-tap its reset button</li>
                            <li>Copy the {HALF(h)} file onto the RPI-RP2 drive</li>
                        </ul>
                        {!installed[h] && <Button size="sm" variant="outline" className="self-start" onClick={() => setInstalled(h)}>Next</Button>}
                    </Step>
                ))}
                <Step n={n++} title="Connect your keyboard" done={connected}>
                    <span className="text-sm">Plug USB back into your usual half{only === undefined ? "" : ` (the ${handName(usualHand)} half)`}</span>
                    {!connected && <Button size="sm" variant="kb-primary" className="self-start" onClick={onConnect}>Connect</Button>}
                </Step>
                {outcome && afterwards === "restore" && (
                    <Step n={n++} title={outcome.phase === "done" ? "Layout put back" : outcome.phase === "failed" ? "Layout not put back" : "Put your layout back"} done={outcome.phase === "done"}>
                        {outcome.phase === "steps" && <span className="text-sm text-muted-foreground">Keybard puts it back when the keyboard is connected again.</span>}
                        {restoring && <span className="text-sm text-muted-foreground">Putting it back…</span>}
                        {outcome.phase === "failed" && (
                            <span className="text-sm text-kb-red" role="alert">
                                {outcome.error} Restore {backup?.state === "ok" ? <span className="font-mono text-xs">{backup.fileName}</span> : "the backup"} from{" "}
                                {onOpenBackups ? <button type="button" className="text-kb-primary underline" onClick={onOpenBackups}>Backups</button> : "Backups"}.
                            </span>
                        )}
                        {outcome.result?.trimmed.map((line) => (
                            <span key={line} className="flex items-center gap-2 text-sm text-kb-orange"><CircleAlert className="h-4 w-4" aria-hidden />{line}</span>
                        ))}
                    </Step>
                )}
            </ol>
            <div className="flex justify-end"><Button variant="outline" disabled={restoring} onClick={onClose}>{connected ? "Done" : "Close"}</Button></div>
        </div>
    );
}
