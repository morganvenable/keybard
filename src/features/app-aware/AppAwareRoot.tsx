import "./app-aware.css";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useKeyboard } from "@/contexts/KeyboardContext";
import { useKeyBinding } from "@/contexts/KeyBindingContext";
import { useLayer } from "@/contexts/LayerContext";
import { keyService } from "@/services/key.service";
import { svalService } from "@/services/sval.service";
import { shortKeyName } from "@/utils/combo-labels";
import { MATRIX_COLS } from "@/constants/svalboard-layout";
import type { KeyboardInfo } from "@/types/keyboard.types";
import { SEEN_APPS } from "./catalog";
import { AppMono } from "./AppMenu";
import { protoParams } from "./proto";
import { applyScene } from "./scenes";
import {
    appById, appName, describePress, dismissNote, dismissStrip, flicker, manualLayer, nativeHold, posKey, reportFront,
    setKeysHeld, setLayerNamer, setLocked, setOverlay, setPaused, setState, useAppAware,
} from "./store";

function layerLabel(kb: KeyboardInfo, i: number): string {
    const name = svalService.getLayerCosmetic(kb, i);
    return name ? `${name} layer` : `Layer ${i}`;
}

/** A link to this page with some params changed (platform and board reload the prototype). */
function withParams(patch: Record<string, string | null>): string {
    const u = new URL(window.location.href);
    for (const [k, v] of Object.entries(patch)) { if (v === null) u.searchParams.delete(k); else u.searchParams.set(k, v); }
    return u.toString();
}

function Toggle({ label, on, onChange, id }: { label: string; on: boolean; onChange: (v: boolean) => void; id: string }) {
    return (
        <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} data-dev={id}
            className="flex items-center justify-between gap-3 w-full py-1 text-left">
            <span>{label}</span>
            <span className={cn("relative inline-flex h-4 w-7 rounded-full transition-colors shrink-0", on ? "bg-kb-back-highlight" : "bg-kb-gray-border")} aria-hidden="true">
                <span className={cn("absolute top-0.5 h-3 w-3 rounded-full bg-kb-surface transition-transform", on ? "translate-x-3.5" : "translate-x-0.5")} />
            </span>
        </button>
    );
}

/** The pretend app signal: what the Keybard Overlay would report, plus the board's inputs. */
function DevPanel() {
    const s = useAppAware();
    const { keyboard } = useKeyboard();
    const { selectedTarget } = useKeyBinding();
    const [open, setOpen] = useState(() => !!protoParams()?.devOpen);
    const [press, setPress] = useState<string | null>(null);
    if (!keyboard) return null;
    const sel = selectedTarget?.type === "keyboard" && selectedTarget.layer !== undefined && selectedTarget.row !== undefined && selectedTarget.col !== undefined
        ? selectedTarget : null;
    const doPress = (held: boolean) => {
        if (!sel) return;
        const code = Number(keyboard.keymap?.[sel.layer!]?.[sel.row! * MATRIX_COLS + sel.col!] ?? 0);
        const name = keyService.stringify(code);
        const tap = shortKeyName(name.replace(/^(\w+_T|LT\d+)\((.+)\)$/, "$2"));
        setPress(describePress(posKey(sel.layer!, sel.row!, sel.col!), tap, nativeHold(keyboard, name), held));
    };
    const layers = Array.from({ length: keyboard.layers || 16 }, (_, i) => i);
    return (
        <div className="fixed right-4 bottom-4 z-[55] w-[272px] rounded-xl border border-kb-combo-chip-border bg-kb-surface text-kb-ink shadow-xl text-[12.5px]" data-dev-panel="" data-inspector-avoid="">
            <button type="button" className="w-full flex items-center justify-between px-3 py-2 font-semibold" onClick={() => setOpen(o => !o)} aria-expanded={open}>
                <span>Pretend signals</span>
                {open ? <ChevronDown className="h-4 w-4" aria-hidden="true" /> : <ChevronUp className="h-4 w-4" aria-hidden="true" />}
            </button>
            {open && (
                <div className="px-3 pb-3 grid gap-1.5 max-h-[60vh] overflow-y-auto">
                    <label className="grid gap-0.5">
                        <span className="text-muted-foreground">App in front</span>
                        <select data-dev="front" className="rounded-md border border-kb-combo-chip-border bg-kb-surface px-1.5 py-1"
                            value={s.front ?? ""} onChange={(e) => reportFront(e.target.value || null)}>
                            <option value="">None</option>
                            {SEEN_APPS.map(a => <option key={a.id} value={a.id}>{a.name}{appById(a.id) ? "" : " (not added)"}</option>)}
                        </select>
                    </label>
                    <button type="button" className="text-left underline" data-dev="flicker" onClick={() => flicker("slack")}>Flick to Slack and back (alt-tab)</button>
                    <Toggle id="held" label="Keys held down" on={s.keysHeld} onChange={setKeysHeld} />
                    <Toggle id="locked" label="Screen locked" on={s.locked} onChange={setLocked} />
                    <Toggle id="overlay" label="Keybard Overlay running" on={s.overlay} onChange={setOverlay} />
                    <Toggle id="paused" label="Paused (Pause key)" on={s.paused} onChange={setPaused} />
                    <label className="grid gap-0.5">
                        <span className="text-muted-foreground">Change layer by hand</span>
                        <select data-dev="manual" className="rounded-md border border-kb-combo-chip-border bg-kb-surface px-1.5 py-1"
                            value={s.manual ?? ""} onChange={(e) => { if (e.target.value !== "") manualLayer(Number(e.target.value)); }}>
                            <option value="">Not changed</option>
                            {layers.map(i => <option key={i} value={i}>{layerLabel(keyboard, i)}</option>)}
                        </select>
                    </label>
                    <div className="grid gap-0.5">
                        <span className="text-muted-foreground">Press the selected key</span>
                        <div className="flex gap-1.5">
                            <button type="button" disabled={!sel} className="flex-1 rounded-md border border-kb-combo-chip-border py-1 disabled:opacity-40" onClick={() => doPress(false)} data-dev="tap">Tap</button>
                            <button type="button" disabled={!sel} className="flex-1 rounded-md border border-kb-combo-chip-border py-1 disabled:opacity-40" onClick={() => doPress(true)} data-dev="hold">Hold</button>
                        </div>
                        {press && <div className="rounded-md bg-kb-combo-chip px-2 py-1" data-dev-press="">{press}</div>}
                    </div>
                    <div className="h-px bg-kb-combo-chip-border my-1" />
                    <span className="text-muted-foreground">Keybard Overlay settings</span>
                    <Toggle id="note" label="Note when the base layer changes" on={s.baseNote} onChange={(v) => setState({ baseNote: v })} />
                    <Toggle id="strip" label="Show app holds on app switch" on={s.hintStrip} onChange={(v) => setState({ hintStrip: v })} />
                    <div className="h-px bg-kb-combo-chip-border my-1" />
                    <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                        <a className="underline" href={withParams({ os: s.os === "mac" ? null : "mac" })} data-dev="os">{s.os === "mac" ? "Windows" : "Mac"}</a>
                        <a className="underline" href={withParams({ board: s.supported ? "old" : null })} data-dev="board">{s.supported ? "Older board" : "Newer board"}</a>
                    </div>
                    <ol className="list-none p-0 m-0 grid gap-0.5 text-muted-foreground" data-dev-log="" aria-label="Signal log">
                        {s.log.slice(0, 5).map(l => <li key={l.id}>{l.text}</li>)}
                    </ol>
                </div>
            )}
        </div>
    );
}

/** Mock of the Keybard Overlay's on-screen pieces: the base-change note and the hint strip. */
function OverlayMock({ sticky }: { sticky: boolean }) {
    const s = useAppAware();
    const { keyboard } = useKeyboard();
    useEffect(() => {
        if (!s.note || sticky) return;
        const t = setTimeout(dismissNote, 2600);
        return () => clearTimeout(t);
    }, [s.note, sticky]);
    useEffect(() => {
        if (!s.strip || sticky) return;
        const t = setTimeout(dismissStrip, 5000);
        return () => clearTimeout(t);
    }, [s.strip, sticky]);
    const stripApp = s.strip ? appById(s.strip.app) : undefined;
    const stripHolds = stripApp && keyboard
        ? Object.entries(s.holds[stripApp.id] || {}).filter(([, h]) => h.code).slice(0, 7).map(([pos, h]) => {
            const [l, r, c] = pos.split(":").map(Number);
            const code = Number(keyboard.keymap?.[l]?.[r * MATRIX_COLS + c] ?? 0);
            return { key: shortKeyName(keyService.stringify(code)), name: h.short || h.name };
        })
        : [];
    if (!s.note && !stripApp) return null;
    return (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-6 z-[56] flex flex-col items-center gap-2 pointer-events-none" data-overlay-mock="">
            {s.note && (
                <div key={s.note.id} className="kb-overlay-mock kb-note-in rounded-full px-4 py-1.5 text-[13px] font-medium pointer-events-auto flex items-center gap-2" data-overlay-note="">
                    <span className="text-[10px] uppercase tracking-wide opacity-60">Keybard Overlay</span>
                    <span>{s.note.text}</span>
                    {sticky && <button type="button" aria-label="Dismiss" onClick={dismissNote}><X className="h-3 w-3" aria-hidden="true" /></button>}
                </div>
            )}
            {stripApp && (
                <div key={s.strip!.id} className="kb-overlay-mock kb-note-in rounded-xl px-3 py-2 text-[12.5px] pointer-events-auto flex items-center gap-3" data-overlay-strip="">
                    <AppMono mono={stripApp.mono} size={20} />
                    <span className="font-semibold">{appName(stripApp.id)}</span>
                    {stripHolds.map((h, i) => (
                        <span key={i} className="flex items-center gap-1 whitespace-nowrap">
                            <span className="rounded border border-current px-1 text-[11px] font-bold opacity-80">{h.key}</span>
                            <span>{h.name}</span>
                        </span>
                    ))}
                    {sticky && <button type="button" aria-label="Dismiss" onClick={dismissStrip}><X className="h-3 w-3" aria-hidden="true" /></button>}
                </div>
            )}
        </div>
    );
}

/**
 * The prototype's root (mounted by the editor; renders nothing without ?proto=app-aware):
 * sets up the scene once the example layout loads, and shows the pretend-signal panel.
 */
export default function AppAwareRoot() {
    const s = useAppAware();
    const { keyboard, setKeyboard } = useKeyboard();
    const started = useRef(false);
    const params = protoParams();
    const { selectedLayer, setSelectedLayer } = useLayer();
    // Picking an app with its own base layer shows that layer; leaving it goes back home.
    const prevApp = useRef(s.selectedApp);
    useEffect(() => {
        const prev = prevApp.current;
        if (prev === s.selectedApp) return;
        prevApp.current = s.selectedApp;
        const base = appById(s.selectedApp)?.baseLayer;
        if (base !== null && base !== undefined) setSelectedLayer(base);
        else if (selectedLayer === appById(prev)?.baseLayer) setSelectedLayer(0);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [s.selectedApp]);
    useEffect(() => {
        if (keyboard) setLayerNamer(i => layerLabel(keyboard, i));
    }, [keyboard]);
    useEffect(() => {
        if (!params || !keyboard || started.current) return;
        started.current = true;
        applyScene(params, keyboard, setKeyboard);
    }, [keyboard, params, setKeyboard]);
    if (!params || !s.on) return null;
    return (
        <>
            {s.supported && params.dev && <DevPanel />}
            {s.supported && <OverlayMock sticky={params.scene === "overlay"} />}
        </>
    );
}
