// M: Install by hand. Plain instructions: the layout choice, the two files, the steps.
// Keybard can't see a half while it is a drive, so nothing here is ticked off. The one
// check is on Connect: Keybard reads what each half runs, and either puts the layout back
// and says it's done, or names the half that still needs its file.

import { Button } from "@/components/ui/button";
import { carriedFileUrl, type FirmwareReleasePin } from "@/constants/firmware-releases";
import { SVALBOARD_FIRMWARE_URL } from "@/constants/firmware";
import { PARANOID } from "@/lib/paranoid";
import type { Afterwards } from "@/services/updater/flow";
import { manualHalves, manualPending, type ManualCheck, type ManualHalfState } from "@/services/updater/manual";
import { handName, otherHand, type Hand } from "@/services/updater/protocol";
import { LayoutChoice } from "./LayoutChoice";
import { FwTitle, Problem, SectionLabel, Spinner } from "./parts";

/** The backup as the instructions show it. */
export type ManualBackupView = { state: "pending" } | { state: "ok"; fileName: string } | { state: "failed"; error?: string };

/** After the check: putting the layout back, done, or the layout not put back. */
export interface ManualOutcome {
    phase: "steps" | "restoring" | "done" | "failed";
    result: { layout: "restored" | "defaults"; trimmed: string[] } | null;
    error: string | null;
}

export interface ManualInstallProps {
    release: FirmwareReleasePin | null;
    /** Recovery of one half (F10, F11): only its file and steps. */
    only?: Hand;
    /** The half the person usually plugs in. */
    usualHand?: Hand;
    /** The first move onto firmware Keybard updates: say it's needed once. */
    once?: boolean;
    /** Null: no keyboard was connected, so there's no layout to keep. */
    backup: ManualBackupView | null;
    afterwards: Afterwards;
    onAfterwards: (a: Afterwards) => void;
    /** What Keybard read from each half on the last Connect. */
    check?: ManualCheck | null;
    outcome?: ManualOutcome;
    onConnect: () => void;
    onClose: () => void;
    onOpenBackups?: () => void;
}

const fileOf = (r: FirmwareReleasePin, h: Hand) => (h === 0 ? r.files.left.uf2 : r.files.right.uf2);

function Files({ release, halves }: { release: FirmwareReleasePin | null; halves: Hand[] }) {
    if (!release) {
        return PARANOID
            ? <p className="text-sm">Download both halves' files from <code className="select-all break-all font-mono text-xs">{SVALBOARD_FIRMWARE_URL}</code></p>
            : <a className="text-sm font-medium text-kb-primary underline" href={SVALBOARD_FIRMWARE_URL} target="_blank" rel="noreferrer">Download both halves' files from the Svalboard firmware releases ↗</a>;
    }
    const sorted = [...halves].sort((a, b) => a - b);
    return (
        <div className={`grid gap-2 ${sorted.length > 1 ? "sm:grid-cols-2" : ""}`}>
            {sorted.map((h) => (
                <a key={h} href={carriedFileUrl(release, fileOf(release, h))} download={fileOf(release, h)} data-file={handName(h)}
                    className="flex min-w-0 flex-col gap-0.5 rounded-md border border-kb-gray-border px-3 py-2.5 text-kb-ink hover:border-kb-primary">
                    <span className="text-sm font-semibold">{h === 0 ? "Left half" : "Right half"}</span>
                    <span className="break-all font-mono text-xs text-muted-foreground">{fileOf(release, h)}</span>
                </a>
            ))}
        </div>
    );
}

const RESET = "Press its RESET button twice, about a quarter of a second apart. Too fast and nothing happens. A drive named RPI-RP2 opens.";

function Steps({ hand }: { hand?: Hand }) {
    const half = hand === undefined ? null : `the ${handName(hand)} half`;
    return (
        <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-sm marker:font-semibold marker:text-muted-foreground" data-testid="manual-steps">
            <li>Plug the USB cable into {half ? `${half}'s` : "the half's"} U port.</li>
            <li>{RESET}</li>
            <li>Drag {half ? `${half}'s` : "that half's"} file onto the drive. The half restarts and the drive closes.</li>
        </ol>
    );
}

const HALF_LABEL = (h: Hand) => (h === 0 ? "Left half" : "Right half");

function Halves({ check, tag }: { check: ManualCheck; tag: string }) {
    return (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm tabular-nums" data-testid="manual-halves">
            {([0, 1] as Hand[]).filter((h) => check.halves[h]).map((h) => {
                const s = check.halves[h]!;
                return [
                    <dt key={`t${h}`}>{HALF_LABEL(h)}</dt>,
                    <dd key={`d${h}`} data-half={handName(h)} data-state={s.state} className={s.state === "new" ? "font-semibold text-kb-primary" : "font-semibold text-kb-warn-ink"}>
                        {s.state === "new" ? tag : s.state === "old" ? s.tag ?? "its old firmware" : s.state === "silent" ? "didn't answer" : "not checked"}
                    </dd>,
                ];
            })}
        </dl>
    );
}

/** One line on what the last Connect found, for the instructions screen. */
function stillLine(check: ManualCheck, pending: Hand[], tag: string, usual: Hand): string {
    const st = (h: Hand) => check.halves[h] as ManualHalfState | undefined;
    if (pending.every((h) => st(h)?.state === "unknown")) return "Keybard couldn't read the keyboard's firmware. Install both files, then connect again.";
    if (pending.length === 2 && pending.every((h) => st(h)?.state === "old")) return `Neither half runs ${tag} yet. Install both files, then connect again.`;
    const usbOld = pending.find((h) => st(h)?.state === "old");
    const unknown = pending.find((h) => st(h)?.state === "unknown");
    const say = (h: Hand) => {
        const s = st(h);
        if (s?.state === "old") return `The ${handName(h)} half still runs ${s.tag ?? "its old firmware"}.`;
        if (s?.state === "silent") return `The ${handName(h)} half didn't answer.`;
        return "";
    };
    if (usbOld !== undefined && unknown !== undefined) {
        return `${say(usbOld)} Install its file, and the ${handName(unknown)} half's file if you haven't yet, then connect again.`;
    }
    const lines = pending.map(say).filter(Boolean).join(" ");
    return `${lines} Install ${pending.length > 1 ? "both files" : `the ${handName(pending[0] ?? usual)} half's file`}, then connect again.`;
}

export function ManualInstall({ release, only, usualHand = 1, once = false, backup, afterwards, onAfterwards, check = null, outcome, onConnect, onClose, onOpenBackups }: ManualInstallProps) {
    const tag = release?.tag ?? "the newest firmware";
    const halves = manualHalves(only, usualHand);
    const phase = outcome?.phase ?? "steps";
    const onHalf = only !== undefined ? ` on the ${handName(only)} half` : "";
    const fromNowOn = once ? " From now on, updates install from Keybard." : "";

    if (phase === "restoring") {
        return (
            <div className="flex flex-col gap-4" data-testid="manual-install" data-screen="restoring" aria-busy="true">
                <FwTitle sub={`${tag} is installed${onHalf}.`}>Putting your layout back</FwTitle>
                <p className="flex items-center gap-3 text-sm"><Spinner />Writing your layout to the keyboard</p>
            </div>
        );
    }
    if (phase === "done" || phase === "failed") {
        const restored = outcome?.result?.layout === "restored";
        const sub = phase === "failed" ? undefined : `${restored ? "Your layout is back on the keyboard." : "Your keyboard has the default layout."}${fromNowOn}`;
        return (
            <div className="flex flex-col gap-4" data-testid="manual-install" data-screen="done">
                <FwTitle sub={sub}>{`${tag} is installed${onHalf}`}</FwTitle>
                {phase === "failed" && (
                    <div role="alert">
                        <Problem title="Keybard couldn't put your layout back.">
                            {outcome?.error} Restore {backup?.state === "ok" ? <span className="break-all font-mono text-xs">{backup.fileName}</span> : "your backup"} from Backups.
                        </Problem>
                    </div>
                )}
                {outcome?.result && outcome.result.trimmed.length > 0 && (
                    <Problem title="Some of your layout didn't fit this firmware.">
                        {outcome.result.trimmed.map((line) => <p key={line}>{line}</p>)}
                    </Problem>
                )}
                <div className="flex flex-wrap justify-end gap-2">
                    {phase === "failed" && onOpenBackups && <Button variant="outline" onClick={onOpenBackups}>Open Backups</Button>}
                    <Button variant="kb-primary" onClick={onClose}>Done</Button>
                </div>
            </div>
        );
    }

    const pending = check ? manualPending({ only, usualHand }, check) : halves;
    const one = check && pending.length === 1 && check.halves[pending[0]]?.state !== "unknown" ? pending[0] : undefined;

    if (one !== undefined && check) {
        const s = check.halves[one]!;
        const other = otherHand(one);
        const otherNew = only === undefined && check.halves[other]?.state === "new";
        const title = s.state === "silent" ? `The ${handName(one)} half didn't answer` : `The ${handName(one)} half still runs ${s.state === "old" && s.tag ? s.tag : "its old firmware"}`;
        const lead = otherNew ? `The ${handName(other)} half has ${tag}. ` : "";
        const sub = s.state === "silent"
            ? `${lead}The ${handName(one)} half may still run its old firmware, which doesn't answer over the split cable. Install its file, then connect again.`
            : `${lead}Install the ${handName(one)} half's file, then connect again.`;
        return (
            <div className="flex flex-col gap-5" data-testid="manual-install" data-screen="one-half" data-half={handName(one)}>
                <FwTitle sub={sub}>{title}</FwTitle>
                <Halves check={check} tag={tag} />
                <section className="flex flex-col gap-3" aria-label={`Install on the ${handName(one)} half`}>
                    <Files release={release} halves={[one]} />
                    <Steps hand={one} />
                </section>
                <footer className="flex flex-col gap-3 border-t border-kb-gray-border pt-4">
                    {one !== usualHand && <p className="text-sm text-muted-foreground">Then plug into your usual half.</p>}
                    <div className="flex justify-end"><Button variant="kb-primary" data-connect onClick={onConnect}>Connect again</Button></div>
                </footer>
            </div>
        );
    }

    const sub = only !== undefined ? "It takes a couple of minutes." : once
        ? "Your keyboard needs this once. After that, Keybard installs updates for you. It takes about five minutes."
        : "It takes about five minutes.";
    return (
        <div className="flex flex-col gap-5" data-testid="manual-install" data-screen="instructions">
            <FwTitle sub={sub}>{only !== undefined ? `Install ${tag} on the ${handName(only)} half` : `Install ${tag} by hand`}</FwTitle>
            {check && <p role="status" className="text-sm font-medium text-kb-warn-ink" data-testid="manual-still">{stillLine(check, pending, tag, usualHand)}</p>}

            {backup && (
                <section className="flex flex-col gap-2" aria-label="Your layout">
                    <SectionLabel>Your layout</SectionLabel>
                    {backup.state === "failed" ? (
                        <Problem title="Keybard couldn't save your layout.">{backup.error ? `${backup.error} ` : ""}Afterward the keyboard starts from the default layout.</Problem>
                    ) : (
                        <>
                            <p className="text-sm">
                                {backup.state === "ok" ? <>Saved to Downloads as <span className="break-all font-mono text-xs">{backup.fileName}</span>. Afterward:</> : "Keybard is saving it to Downloads. Afterward:"}
                            </p>
                            {/* No blank keyboard here: clearing every key needs the updater (SETTINGS_RESET), which this install can't ask. */}
                            <LayoutChoice value={afterwards} onChange={onAfterwards} keepDisabled={backup.state !== "ok"} choices={["restore", "defaults"]} label="After the install" />
                        </>
                    )}
                </section>
            )}

            <section className="flex flex-col gap-2" aria-label="Firmware files">
                <SectionLabel>Firmware files</SectionLabel>
                <Files release={release} halves={halves} />
            </section>

            <section className="flex flex-col gap-2" aria-label="Install on each half">
                <SectionLabel>{only !== undefined ? `Install on the ${handName(only)} half` : "Install on each half"}</SectionLabel>
                <Steps hand={only} />
                {only === undefined && <p className="text-sm">Then move the cable to the other half and do the same with its file.</p>}
            </section>

            <footer className="flex flex-col gap-3 border-t border-kb-gray-border pt-4">
                <p className="text-sm text-muted-foreground">{only === undefined ? "When both halves are done, plug into your usual half." : "When it's done, plug into your usual half."}</p>
                <div className="flex justify-end"><Button variant="kb-primary" data-connect onClick={onConnect}>{check ? "Connect again" : "Connect keyboard"}</Button></div>
            </footer>
        </div>
    );
}
