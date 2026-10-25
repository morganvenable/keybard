import "./app-aware.css";
import { useEffect } from "react";
import { Pause, Play, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { AppMono } from "./AppMenu";
import { ALL, actingApp, appById, appName, holdCount, layerName, setPaused, setTestAs, useAppAware, type AppAwareState } from "./store";

/** One sentence: what the board is doing right now, and why. Null when there is nothing to say. */
export function statusSentence(s: AppAwareState): { text: string; kind: "app" | "manual" | "paused" | "home" | "test" | "wait" } | null {
    if (!s.on || !s.supported) return null;
    const layer = layerName(s.boardLayer);
    if (s.pendingLayer !== null) return { text: `Switching to ${layerName(s.pendingLayer)} when you let go of the keys`, kind: "wait" };
    if (s.paused) return { text: `App switching is paused, board is on ${layer}`, kind: "paused" };
    const { app, why } = actingApp(s);
    if (why === "test" && app) {
        const linked = appById(app)?.baseLayer;
        return { text: linked !== null && linked !== undefined ? `Testing as ${appName(app)}: board is on ${layer}` : `Testing as ${appName(app)}`, kind: "test" };
    }
    if (s.manual !== null && s.mode === "manual") return { text: `Board is on ${layer} because you switched to it`, kind: "manual" };
    if (why === "locked") return { text: `Board is on ${layer} because the screen is locked`, kind: "home" };
    if (why === "no-overlay") return null;
    if (s.mode === "app" && app) return { text: `Board is on ${layer} because ${appName(app)} is in front`, kind: "app" };
    if (app && appById(app)) {
        const n = holdCount(app, s);
        return { text: n ? `${appName(app)} is in front, with its ${n} hold${n === 1 ? "" : "s"}` : `${appName(app)} is in front`, kind: "home" };
    }
    if (app) return { text: `${appName(app)} is in front, with All apps holds`, kind: "home" };
    return null;
}

/** The status line by the layer name: the board's base layer and why, with a stop button. */
export function BoardStatus() {
    const s = useAppAware();
    // "Test as" turns off when you leave Keybard.
    useEffect(() => {
        if (!s.testAs) return;
        const off = () => { if (document.visibilityState === "hidden") setTestAs(null); };
        document.addEventListener("visibilitychange", off);
        return () => document.removeEventListener("visibilitychange", off);
    }, [s.testAs]);
    const line = statusSentence(s);
    if (!line) return null;
    const app = actingApp(s).app;
    const mono = app ? appById(app)?.mono : undefined;
    return (
        <div className="flex items-center gap-2 text-[13px] text-kb-ink min-w-0" data-board-status={line.kind} role="status">
            <span className={cn("inline-block h-2 w-2 rounded-full shrink-0", line.kind === "paused" ? "bg-kb-gray-border" : "bg-kb-back-highlight")} aria-hidden="true" />
            {mono && <AppMono mono={mono} size={16} />}
            <span className="truncate" title={line.text} data-board-status-text="">{line.text}</span>
            {line.kind === "test" && (
                <>
                    <input aria-label="Try your holds here" placeholder="Try your holds here" className="w-44 rounded-md border border-kb-combo-chip-border bg-kb-surface px-2 py-0.5 text-[12px]" data-test-field="" />
                    <button type="button" className="flex items-center gap-1 rounded-full border border-kb-combo-chip-border px-2 py-0.5 text-[12px] hover:bg-kb-combo-row-lit" onClick={() => setTestAs(null)} data-status-stop="">
                        <X className="h-3 w-3" aria-hidden="true" />Stop
                    </button>
                </>
            )}
            {(line.kind === "app" || line.kind === "manual") && (
                <button type="button" className="flex items-center gap-1 rounded-full border border-kb-combo-chip-border px-2 py-0.5 text-[12px] hover:bg-kb-combo-row-lit" onClick={() => setPaused(true)} data-status-stop="" title="Pause app switching">
                    <Pause className="h-3 w-3" aria-hidden="true" />Stop
                </button>
            )}
            {line.kind === "paused" && (
                <button type="button" className="flex items-center gap-1 rounded-full border border-kb-combo-chip-border px-2 py-0.5 text-[12px] hover:bg-kb-combo-row-lit" onClick={() => setPaused(false)} data-status-resume="">
                    <Play className="h-3 w-3" aria-hidden="true" />Resume
                </button>
            )}
        </div>
    );
}

/** "Test as <app>": the board acts as if that app were in front while you try holds. */
export function TestAsSwitch() {
    const s = useAppAware();
    if (!s.on || !s.supported || s.selectedApp === ALL) return null;
    const on = s.testAs === s.selectedApp;
    return (
        <button
            type="button"
            role="switch"
            aria-checked={on}
            data-test-as=""
            onClick={(e) => { e.stopPropagation(); setTestAs(on ? null : s.selectedApp); }}
            className="flex items-center gap-2 rounded-full px-2.5 py-1 text-[13px] text-kb-ink hover:bg-kb-combo-row-lit whitespace-nowrap"
        >
            <span className={cn("relative inline-flex h-4 w-7 rounded-full transition-colors", on ? "bg-kb-back-highlight" : "bg-kb-gray-border")} aria-hidden="true">
                <span className={cn("absolute top-0.5 h-3 w-3 rounded-full bg-kb-surface transition-transform", on ? "translate-x-3.5" : "translate-x-0.5")} />
            </span>
            Test as {appName(s.selectedApp)}
        </button>
    );
}
