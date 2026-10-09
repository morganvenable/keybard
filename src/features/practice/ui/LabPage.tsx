import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Unplug } from "lucide-react";

import { PILL_BRAND, PILL_INK, PILL_QUIET } from "@/components/shared/pills";
import { OWNER_Q4_PARANOID_READS_KEYS } from "@/constants/owner-decisions";
import { useKeyboard } from "@/contexts/KeyboardContext";
import { useLayoutSettings } from "@/contexts/LayoutSettingsContext";
import { PARANOID } from "@/lib/paranoid";
import { cn } from "@/lib/utils";
import { boardReader } from "../input/boardReader";
import { LabSession } from "../input/lab";
import { type Distribution, type LabSummary, labMarkdown } from "../input/labStats";
import { resolveKeymap } from "../keymap/resolver";
import { PAGE_FRAME } from "../PracticeWorkspace";
import { PracticeHeader } from "../PracticeHeader";
import { StatCell } from "./StatCell";
import { Well } from "./Wells";

// The M0 measurement lab (docs/practice/spec.md §4.2, §12 M0), at ?practiceLab=1#practice/lab where
// OWNER_Q7 allows it. Never linked from the UI. It runs the Live · USB sampler and correlator on the
// connected board while its text box has focus and the tab is visible (D10), and shows the numbers the
// owner posts in the PR: samples/s, round trip, DOM-to-edge skew, taps caught over 500 characters, LT
// roll timing, debounced-vs-raw evidence, and presses that typed nothing. Copy results gives the table
// as Markdown; Copy raw data gives every keystroke as JSON.

/** Characters to type for a full run (§12 M0). */
export const LAB_TARGET = 500;

const PROMPT = [
    "the quick brown fox jumps over the lazy dog. pack my box with five dozen liquor jugs.",
    "Hello, World! Sphinx of black quartz, judge my vow? (1 + 2 = 3) & 4 * 5 = 20!",
    "For LT rolls, type ! and the other layer 1 symbols with the layer-tap thumb (LT1) held.",
];

const CARD = "bg-kb-surface text-kb-ink rounded-2xl shadow-lg border border-gray-200 dark:border-neutral-700 p-6 flex flex-col gap-4";
const SUMMARY_MS = 250;

const ms = (v: number | null) => (v == null ? "—" : v.toFixed(1));

function DistributionRow({ label, d }: { label: string; d: Distribution }) {
    return (
        <tr className="border-t border-gray-200 dark:border-neutral-700">
            <th scope="row" className="py-1.5 pr-4 text-left font-normal text-muted-foreground">{label}</th>
            <td className="py-1.5 pr-4 tabular-nums">{ms(d.p50)}</td>
            <td className="py-1.5 pr-4 tabular-nums">{ms(d.p5)}</td>
            <td className="py-1.5 pr-4 tabular-nums">{ms(d.p95)}</td>
            <td className="py-1.5 pr-4 tabular-nums">{ms(d.min)} – {ms(d.max)}</td>
            <td className="py-1.5 tabular-nums">{d.n}</td>
        </tr>
    );
}

function Histogram({ buckets }: { buckets: LabSummary["skewHistogram"] }) {
    const max = Math.max(1, ...buckets.map(([, n]) => n));
    if (!buckets.length) return <p className="text-sm text-muted-foreground">No observed keystrokes yet</p>;
    return (
        <div className="flex flex-col gap-1" data-lab-histogram>
            {buckets.map(([start, n]) => (
                <div key={start} className="flex items-center gap-2 text-xs tabular-nums">
                    <span className="w-24 text-right text-muted-foreground">{start} to {start + 10} ms</span>
                    <span className="h-3 rounded-sm bg-kb-ink/40" style={{ width: `${(n / max) * 60}%` }} />
                    <span>{n}</span>
                </div>
            ))}
        </div>
    );
}

export default function LabPage() {
    const { keyboard, originalKeyboard, isConnected, connect, isWebHIDSupported } = useKeyboard();
    const { internationalLayout } = useLayoutSettings();
    const board = isConnected ? originalKeyboard ?? keyboard : null;
    const boardRef = useRef(board);
    boardRef.current = board;
    const [session, setSession] = useState<LabSession | null>(null);
    const [summary, setSummary] = useState<LabSummary | null>(null);
    const [reading, setReading] = useState(false);
    const [copied, setCopied] = useState<string | null>(null);
    const text = useRef<HTMLTextAreaElement | null>(null);
    const blocked = PARANOID && !OWNER_Q4_PARANOID_READS_KEYS;

    const keymap = useMemo(() => {
        if (!board?.keymap) return null;
        return { resolution: resolveKeymap({ keymap: board.keymap, rows: board.rows, cols: board.cols }, { layoutId: internationalLayout }), keymap: board.keymap, rows: board.rows, cols: board.cols };
    }, [board, internationalLayout]);

    // One session per keymap; made in the effect so StrictMode's second mount gets a fresh one.
    useEffect(() => {
        if (!keymap || blocked) return;
        const created = new LabSession(boardReader(() => boardRef.current), keymap);
        setSession(created);
        const timer = setInterval(() => {
            setSummary(created.summary());
            setReading(created.running);
        }, SUMMARY_MS);
        const onVisibility = () => { if (document.visibilityState !== "visible") created.stop(); };
        document.addEventListener("visibilitychange", onVisibility);
        return () => {
            clearInterval(timer);
            document.removeEventListener("visibilitychange", onVisibility);
            created.stop();
            setSession(null);
        };
    }, [keymap, blocked]);

    const reset = useCallback(() => {
        session?.reset();
        if (text.current) text.current.value = "";
        setSummary(session?.summary() ?? null);
        text.current?.focus();
    }, [session]);

    const copy = useCallback(async (what: "results" | "raw") => {
        if (!session) return;
        const content = what === "results"
            ? labMarkdown(session.summary(), {
                board: board?.name ?? "Svalboard",
                keybard: typeof __GIT_SHA__ === "string" ? __GIT_SHA__.slice(0, 7) : "unknown",
                date: new Date().toISOString().slice(0, 10),
            })
            : JSON.stringify({ summary: session.summary(), steps: session.raw() }, null, 2);
        try {
            await navigator.clipboard.writeText(content);
            setCopied(what === "results" ? "Results copied" : "Raw data copied");
        } catch {
            setCopied("Copy failed");
        }
    }, [session, board]);

    let body: React.ReactNode;
    if (blocked) {
        body = <Well title="The lab doesn't read keys in Paranoid" />;
    } else if (!board) {
        body = (
            <Well title="Connect the board to measure">
                {isWebHIDSupported
                    ? <button type="button" className={PILL_BRAND} onClick={() => void connect()}><Unplug aria-hidden="true" />Connect board</button>
                    : <p className="text-sm text-muted-foreground">Needs Chrome or Edge</p>}
            </Well>
        );
    } else {
        const s = summary;
        const caught = s?.caught == null ? "—" : (s.caught * 100).toFixed(1);
        body = (
            <>
                <section aria-label="Type" className={CARD}>
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                        <h2 className="text-base font-semibold">Type this, about {LAB_TARGET} characters</h2>
                        <span className="flex items-center gap-2 text-sm" data-lab-reading={reading}>
                            <span aria-hidden="true" className={cn("size-2 rounded-full", reading ? "bg-kb-primary" : "border-2 border-kb-gray-border")} />
                            {reading ? "Reading the board" : "Click the text box to read"}
                        </span>
                    </div>
                    <div className="text-sm text-muted-foreground flex flex-col gap-1">
                        {PROMPT.map((line) => <p key={line}>{line}</p>)}
                    </div>
                    <textarea
                        ref={text}
                        aria-label="Lab text"
                        rows={4}
                        spellCheck={false}
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="off"
                        className="w-full rounded-md border border-kb-gray-border bg-kb-gray px-3 py-2 text-base text-kb-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                        onFocus={() => { session?.start(); setReading(true); }}
                        onBlur={() => { session?.stop(); setReading(false); }}
                        onKeyDown={(e) => session?.keydown(e.nativeEvent.timeStamp, e.repeat)}
                        onInput={(e) => {
                            const event = e.nativeEvent as InputEvent;
                            if (event.inputType === "insertLineBreak") session?.input(0x0a, event.timeStamp);
                            else if (event.inputType === "insertText" && event.data) for (const ch of event.data) session?.input(ch.codePointAt(0)!, event.timeStamp);
                        }}
                    />
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm tabular-nums mr-auto" data-lab-count>{s?.typed ?? 0} / {LAB_TARGET} characters</span>
                        {copied && <span role="status" className="text-sm text-muted-foreground">{copied}</span>}
                        <button type="button" className={PILL_QUIET} onClick={reset}>Reset</button>
                        <button type="button" className={PILL_QUIET} onClick={() => void copy("raw")}>Copy raw data</button>
                        <button type="button" className={PILL_INK} onClick={() => void copy("results")}>Copy results</button>
                    </div>
                </section>
                <section aria-label="Measurements" className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCell label="Samples per second" value={s?.rate ?? "—"} unit="target ≥ 100" />
                    <StatCell label="Round trip p50 / p95" value={`${ms(s?.rttP50 ?? null)} / ${ms(s?.rttP95 ?? null)}`} unit="ms" />
                    <StatCell label="Taps caught" value={caught} unit={`% of ${s?.typed ?? 0}`} />
                    <StatCell label="Presses with no character" value={s?.strays ?? 0} />
                </section>
                {s && (
                    <section aria-label="Timing" className={CARD}>
                        <h2 className="text-base font-semibold">Timing</h2>
                        <div className="overflow-x-auto">
                            <table className="text-sm w-full">
                                <thead>
                                    <tr className="text-xs text-muted-foreground text-left">
                                        <th className="font-medium pb-1 pr-4">Measure, ms</th>
                                        <th className="font-medium pb-1 pr-4">p50</th>
                                        <th className="font-medium pb-1 pr-4">p5</th>
                                        <th className="font-medium pb-1 pr-4">p95</th>
                                        <th className="font-medium pb-1 pr-4">Range</th>
                                        <th className="font-medium pb-1">n</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <DistributionRow label="Press edge − input (skew)" d={s.skew} />
                                    <DistributionRow label="Press edge − keydown" d={s.edgeMinusKeydown} />
                                    <DistributionRow label="LT roll: target release → input" d={s.ltReleaseToInput} />
                                    <DistributionRow label="LT roll: target press → input" d={s.ltPressToInput} />
                                </tbody>
                            </table>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            Edges seen before their keydown (raw-read evidence): <span className="text-kb-ink tabular-nums">{s.edgesBeforeKeydown}</span>
                            {" · "}Failed reads: <span className="text-kb-ink tabular-nums">{s.failures}</span>
                            {" · "}LT rolls: <span className="text-kb-ink tabular-nums">{s.ltRolls}</span>
                        </p>
                        <h3 className="text-sm font-semibold">Skew, 10 ms buckets</h3>
                        <Histogram buckets={s.skewHistogram} />
                    </section>
                )}
            </>
        );
    }

    return (
        <div className={PAGE_FRAME} data-practice-page="lab">
            <PracticeHeader right={<span className="text-sm text-muted-foreground">Measurement lab</span>} />
            {body}
        </div>
    );
}
