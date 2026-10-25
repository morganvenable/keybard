import "./app-aware.css";
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, ChevronLeft, ChevronRight, MoreHorizontal, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useKeyboard } from "@/contexts/KeyboardContext";
import { svalService } from "@/services/sval.service";
import { HOST_RELEASE } from "@/features/trainer/HostInstall";
import { READY_SETS, SEEN_APPS, TYPE_SENDS, catalogApp } from "./catalog";
import {
    ALL, addApp, addSet, appById, appName, closeMenu, freeLayers, holdCount, makeLayerFor, openMenu,
    removeApp, renameApp, selectApp, setTestAs, updateApp, useAppAware, type ProtoApp,
} from "./store";

/** The app mark: one or two letters on a tile (no product logos in Keybard). */
export function AppMono({ mono, size = 18, className }: { mono: string; size?: number; className?: string }) {
    return (
        <span
            className={cn("kb-app-mono inline-flex items-center justify-center rounded-[5px] font-bold shrink-0 select-none", className)}
            style={{ width: size, height: size, fontSize: Math.round(size * 0.5) }}
            aria-hidden="true"
        >{mono}</span>
    );
}

function monoFor(id: string): string {
    return appById(id)?.mono ?? catalogApp(id)?.mono ?? "";
}

/** Under the app's name in the menu: its holds and its base layer. */
function appMeta(app: ProtoApp, layerLabel: (i: number) => string): string {
    const n = holdCount(app.id);
    const parts = [n === 0 ? "No holds yet" : `${n} hold${n === 1 ? "" : "s"}`];
    if (app.baseLayer !== null) parts.push(`Base: ${layerLabel(app.baseLayer)}`);
    return parts.join(" · ");
}

/** A popover at an anchor, in a portal (the layer tab row scrolls and would clip it). */
function Popover({ anchor, onClose, children, label }: { anchor: HTMLElement | null; onClose: () => void; children: React.ReactNode; label: string }) {
    const ref = useRef<HTMLDivElement>(null);
    const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
    useLayoutEffect(() => {
        if (!anchor) return;
        const place = () => {
            const r = anchor.getBoundingClientRect();
            const width = 340;
            setPos({ left: Math.max(12, Math.min(r.left, window.innerWidth - width - 12)), top: r.bottom + 6 });
        };
        place();
        window.addEventListener("resize", place);
        return () => window.removeEventListener("resize", place);
    }, [anchor]);
    useEffect(() => {
        const down = (e: MouseEvent) => {
            const t = e.target as Node;
            if (ref.current?.contains(t) || anchor?.contains(t)) return;
            onClose();
        };
        const key = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } };
        document.addEventListener("mousedown", down);
        document.addEventListener("keydown", key, true);
        return () => { document.removeEventListener("mousedown", down); document.removeEventListener("keydown", key, true); };
    }, [anchor, onClose]);
    if (!pos) return null;
    return createPortal(
        <div
            ref={ref}
            role="dialog"
            aria-label={label}
            data-app-menu=""
            className="fixed z-[60] w-[340px] max-h-[min(560px,calc(100vh-120px))] overflow-y-auto rounded-xl border border-kb-combo-chip-border bg-kb-surface text-kb-ink shadow-xl p-1.5 text-sm kb-note-in"
            style={{ left: pos.left, top: pos.top }}
            onClick={(e) => e.stopPropagation()}
        >
            {children}
        </div>,
        document.body,
    );
}

const rowClass = "w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-kb-combo-row-lit focus-visible:outline-2 focus-visible:outline-kb-ink";
const headClass = "px-2.5 pt-2.5 pb-1 text-[12px] font-medium text-muted-foreground";

function BackRow({ title, onBack }: { title: string; onBack: () => void }) {
    return (
        <button type="button" className={cn(rowClass, "font-semibold")} onClick={onBack} data-menu-back="">
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            <span>{title}</span>
        </button>
    );
}

function ListPage() {
    const s = useAppAware();
    const { keyboard } = useKeyboard();
    const layerLabel = (i: number) => (keyboard ? layerTitle(keyboard, i) : `Layer ${i}`);
    const allCount = holdCount(ALL);
    const noOverlay = s.os === "mac" ? "Per-app holds need Keybard Overlay, coming to Mac" : !s.overlay ? "Keybard Overlay isn't running" : null;
    return (
        <div data-menu-page="list">
            <button type="button" className={rowClass} onClick={() => { selectApp(ALL); closeMenu(); }} aria-pressed={s.selectedApp === ALL} data-menu-app={ALL}>
                <span className="w-[22px] inline-flex justify-center">{s.selectedApp === ALL && <Check className="h-4 w-4" aria-hidden="true" />}</span>
                <span className="flex-1 min-w-0">
                    <span className="block font-semibold">All apps</span>
                    <span className="block text-[12px] text-muted-foreground">{allCount === 0 ? "Holds every app gets" : `${allCount} hold${allCount === 1 ? "" : "s"}`}</span>
                </span>
            </button>
            {s.apps.map(app => (
                <div key={app.id} className="flex items-center">
                    <button type="button" className={cn(rowClass, "flex-1 min-w-0")} onClick={() => { selectApp(app.id); closeMenu(); }} aria-pressed={s.selectedApp === app.id} data-menu-app={app.id}>
                        <span className="w-[22px] inline-flex justify-center">{s.selectedApp === app.id ? <Check className="h-4 w-4" aria-hidden="true" /> : <AppMono mono={app.mono} />}</span>
                        <span className="flex-1 min-w-0">
                            <span className="flex items-center gap-2 font-semibold">
                                <span className="truncate">{app.name}</span>
                                {s.lastSeen === app.id && s.overlay && <span className="text-[11px] font-normal text-muted-foreground whitespace-nowrap">Last in front</span>}
                            </span>
                            <span className="block text-[12px] text-muted-foreground truncate">{appMeta(app, layerLabel)}</span>
                        </span>
                    </button>
                    <button type="button" className="p-2 rounded-lg hover:bg-kb-combo-row-lit" aria-label={`Manage ${app.name}`} onClick={() => openMenu("manage", app.id)} data-menu-manage={app.id}>
                        <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                    </button>
                </div>
            ))}
            <StartWith />
            <div className="my-1 h-px bg-kb-combo-chip-border" />
            <button type="button" className={rowClass} onClick={() => openMenu("add")} data-menu-add="">
                <span className="w-[22px] inline-flex justify-center"><Plus className="h-4 w-4" aria-hidden="true" /></span>
                <span className="flex-1 font-semibold">Add app</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            </button>
            {noOverlay && (
                <div className="px-2.5 py-2 text-[12px] text-muted-foreground flex items-center gap-2 flex-wrap" data-menu-overlay-note="">
                    <span>{noOverlay}</span>
                    {s.os !== "mac" && <a className="underline text-kb-ink" href={HOST_RELEASE} target="_blank" rel="noreferrer">Get Keybard Overlay</a>}
                </div>
            )}
        </div>
    );
}

/** The empty state: the two most useful first steps, one click each. */
function StartWith() {
    const s = useAppAware();
    const { keyboard } = useKeyboard();
    const lastId = s.overlay && s.os !== "mac" && s.lastSeen && !s.apps.some(a => a.id === s.lastSeen) ? s.lastSeen : null;
    const last = lastId ? catalogApp(lastId) : undefined;
    const lastSet = last?.setId ? READY_SETS.find(x => x.id === last.setId) : undefined;
    const basicsAdded = holdCount(ALL) > 0;
    if (!keyboard || (!last && basicsAdded)) return null;
    return (
        <div data-menu-start="">
            <div className={headClass}>Start with</div>
            {last && (
                <button type="button" className={rowClass} data-menu-start-app={last.id}
                    onClick={() => { if (lastSet) addSet(keyboard, lastSet.id); else addApp(last.id); selectApp(last.id); closeMenu(); }}>
                    <AppMono mono={last.mono} size={22} />
                    <span className="flex-1 min-w-0">
                        <span className="block font-semibold truncate">{last.name}</span>
                        <span className="block text-[12px] text-muted-foreground truncate">Last in front{lastSet ? ` · ${lastSet.holds.length} ready-made holds` : ""}</span>
                    </span>
                    <Plus className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                </button>
            )}
            {!basicsAdded && (
                <button type="button" className={rowClass} data-menu-start-basics=""
                    onClick={() => { addSet(keyboard, "basics"); selectApp(ALL); closeMenu(); }}>
                    <span className="w-[22px] h-[22px] rounded-[5px] border border-kb-combo-chip-border inline-flex items-center justify-center text-[10px] font-bold">All</span>
                    <span className="flex-1 min-w-0">
                        <span className="block font-semibold truncate">All-apps basics</span>
                        <span className="block text-[12px] text-muted-foreground truncate">Hold Z, X, C, V for undo, cut, copy, paste</span>
                    </span>
                    <Plus className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                </button>
            )}
        </div>
    );
}

function AddPage() {
    const s = useAppAware();
    const { keyboard } = useKeyboard();
    const seen = SEEN_APPS.filter(a => !s.apps.some(x => x.id === a.id));
    const canSee = s.overlay && s.os !== "mac";
    const added = (setId: string, forApp: string) => {
        const set = READY_SETS.find(x => x.id === setId)!;
        if (forApp === ALL) {
            const want = new Set(set.holds.map(h => h.hold.name));
            return Object.values(s.holds[ALL] || {}).filter(h => want.has(h.name)).length > 0;
        }
        return holdCount(forApp) > 0 && s.apps.some(a => a.id === forApp);
    };
    return (
        <div data-menu-page="add">
            <BackRow title="Add app" onBack={() => openMenu("list")} />
            <div className={headClass}>{canSee ? "Seen recently" : "Apps you use show here with Keybard Overlay"}</div>
            {canSee && seen.map(app => {
                const set = app.setId ? READY_SETS.find(x => x.id === app.setId) : undefined;
                return (
                    <div key={app.id} className="flex items-center">
                        <button
                            type="button" className={cn(rowClass, "flex-1 min-w-0")} data-menu-seen={app.id}
                            onClick={() => { addApp(app.id); selectApp(app.id); closeMenu(); }}
                        >
                            <AppMono mono={app.mono} size={22} />
                            <span className="flex-1 min-w-0">
                                <span className="block font-semibold truncate">{app.name}</span>
                                <span className="block text-[12px] text-muted-foreground truncate">{app.browser ? `In ${app.browser}` : app.game ? "Game" : "Program"}</span>
                            </span>
                        </button>
                        {set && keyboard && (
                            <button type="button" className="mr-1 rounded-full border border-kb-combo-chip-border px-2 py-0.5 text-[12px] whitespace-nowrap hover:bg-kb-combo-row-lit" data-menu-seen-set={app.id}
                                onClick={() => { addSet(keyboard, set.id); selectApp(app.id); closeMenu(); }}>
                                With {set.holds.length} holds
                            </button>
                        )}
                    </div>
                );
            })}
            {canSee && seen.length === 0 && <div className="px-2.5 py-1 text-[12px] text-muted-foreground">All added</div>}
            {!canSee && s.os !== "mac" && (
                <div className="px-2.5 pb-1"><a className="underline text-[12px]" href={HOST_RELEASE} target="_blank" rel="noreferrer">Get Keybard Overlay</a></div>
            )}
            <div className={headClass}>Ready-made sets</div>
            {READY_SETS.map(set => {
                const done = added(set.id, set.forApp);
                return (
                    <button
                        key={set.id} type="button" className={cn(rowClass, done && "opacity-60")} disabled={done || !keyboard}
                        data-menu-set={set.id}
                        onClick={() => {
                            if (!keyboard) return;
                            addSet(keyboard, set.id);
                            selectApp(set.forApp);
                            closeMenu();
                        }}
                    >
                        {set.forApp === ALL ? <span className="w-[22px] h-[22px] rounded-[5px] border border-kb-combo-chip-border inline-flex items-center justify-center text-[10px] font-bold">All</span> : <AppMono mono={monoFor(set.forApp)} size={22} />}
                        <span className="flex-1 min-w-0">
                            <span className="block font-semibold truncate">{set.name}</span>
                            <span className="block text-[12px] text-muted-foreground truncate">{set.holds.slice(0, 4).map(h => h.hold.name).join(", ")}{set.holds.length > 4 ? "…" : ""}</span>
                        </span>
                        <span className="text-[12px] text-muted-foreground whitespace-nowrap">{done ? "Added" : `${set.holds.length} holds`}</span>
                    </button>
                );
            })}
        </div>
    );
}

export function layerTitle(keyboard: NonNullable<ReturnType<typeof useKeyboard>["keyboard"]>, i: number): string {
    const name = svalService.getLayerCosmetic(keyboard, i);
    return name ? `${name} layer` : `Layer ${i}`;
}

function ManagePage({ appId }: { appId: string }) {
    const s = useAppAware();
    const { keyboard, setKeyboard } = useKeyboard();
    const app = s.apps.find(a => a.id === appId);
    const [recogOpen, setRecogOpen] = useState(false);
    if (!app || !keyboard) return <BackRow title="Apps" onBack={() => openMenu("list")} />;
    const free = freeLayers(keyboard);
    const total = keyboard.layers || 16;
    const layerOptions = Array.from({ length: total }, (_, i) => i).filter(i => i !== 0);
    const sharing = app.baseLayer !== null ? s.apps.filter(a => a.baseLayer === app.baseLayer && a.id !== app.id) : [];
    const recog = app.title ? `Window title has "${app.title}"${app.browser ? `, in ${app.browser}` : ""}` : `Program ${app.program ?? app.name}`;
    const isGame = !!catalogApp(app.id)?.game;
    return (
        <div data-menu-page="manage" data-menu-app-id={app.id}>
            <BackRow title="Apps" onBack={() => openMenu("list")} />
            <div className="px-2.5 pt-1 pb-2 flex items-center gap-2.5">
                <AppMono mono={app.mono} size={28} />
                <input
                    aria-label="App name"
                    className="flex-1 min-w-0 rounded-md border border-kb-combo-chip-border bg-transparent px-2 py-1 font-semibold"
                    value={app.name}
                    onChange={(e) => renameApp(app.id, e.target.value)}
                />
            </div>

            <div className={headClass}>Base layer</div>
            <div className="px-2.5 flex items-center gap-2">
                <select
                    aria-label="Base layer"
                    data-menu-base=""
                    className="flex-1 rounded-md border border-kb-combo-chip-border bg-kb-surface px-2 py-1.5"
                    value={app.baseLayer === null ? "" : String(app.baseLayer)}
                    onChange={(e) => updateApp(app.id, { baseLayer: e.target.value === "" ? null : Number(e.target.value) })}
                >
                    <option value="">Unchanged</option>
                    {layerOptions.map(i => <option key={i} value={i}>{layerTitle(keyboard, i)}</option>)}
                </select>
            </div>
            {sharing.length > 0 && <div className="px-2.5 pt-1 text-[12px] text-muted-foreground">Shared with {sharing.map(a => a.name).join(", ")}</div>}
            {app.baseLayer === null && (
                <button
                    type="button" className={cn(rowClass, "mt-1")} disabled={free.length === 0} data-menu-make-layer=""
                    onClick={() => {
                        const made = makeLayerFor(keyboard, app.id, isGame);
                        if (made) setKeyboard(made.keyboard);
                    }}
                >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    <span className="flex-1">
                        <span className="block font-semibold">Make a layer for {app.name}</span>
                        <span className="block text-[12px] text-muted-foreground">A copy of your home layer · {free.length} of {total} layers free</span>
                    </span>
                </button>
            )}
            {app.baseLayer !== null && (
                <>
                    <div className={headClass}>Type key sends</div>
                    <div className="px-2.5">
                        <select
                            aria-label="Type key sends"
                            className="w-full rounded-md border border-kb-combo-chip-border bg-kb-surface px-2 py-1.5"
                            value={app.typeSends}
                            onChange={(e) => updateApp(app.id, { typeSends: e.target.value })}
                        >
                            {TYPE_SENDS.map(t => <option key={t.code} value={t.code}>{t.name}</option>)}
                        </select>
                    </div>
                </>
            )}

            <div className="my-2 h-px bg-kb-combo-chip-border" />
            <button type="button" className={rowClass} onClick={() => setRecogOpen(o => !o)} aria-expanded={recogOpen} data-menu-recognition="">
                <span className="flex-1 min-w-0">
                    <span className="block font-medium">Recognized by</span>
                    {!recogOpen && <span className="block text-[12px] text-muted-foreground truncate">{recog}</span>}
                </span>
                <ChevronDown className={cn("h-4 w-4 transition-transform", recogOpen && "rotate-180")} aria-hidden="true" />
            </button>
            {recogOpen && (
                <div className="px-2.5 pb-2 grid gap-1.5">
                    <label className="text-[12px] text-muted-foreground">{app.title ? "Window title has" : "Program"}
                        <input
                            className="mt-0.5 w-full rounded-md border border-kb-combo-chip-border bg-transparent px-2 py-1 text-kb-ink"
                            value={app.title ?? app.program ?? ""}
                            onChange={(e) => updateApp(app.id, app.title !== undefined ? { title: e.target.value } : { program: e.target.value })}
                        />
                    </label>
                </div>
            )}
            <button type="button" className={rowClass} onClick={() => { setTestAs(s.testAs === app.id ? null : app.id); closeMenu(); }} data-menu-test="">
                <span className="flex-1 font-medium">{s.testAs === app.id ? `Stop testing as ${app.name}` : `Test as ${app.name}`}</span>
            </button>
            <button type="button" className={cn(rowClass, "text-muted-foreground")} onClick={() => { removeApp(app.id); openMenu("list"); }} data-menu-remove="">
                <span className="flex-1">Remove {app.name}</span>
            </button>
        </div>
    );
}

/** The app menu: pick an app, add one, manage one. */
export function AppMenu({ anchor }: { anchor: HTMLElement | null }) {
    const s = useAppAware();
    if (!s.menu.open) return null;
    return (
        <Popover anchor={anchor} onClose={closeMenu} label="Apps">
            {s.menu.page === "add" ? <AddPage /> : s.menu.page === "manage" && s.menu.appId ? <ManagePage appId={s.menu.appId} /> : <ListPage />}
        </Popover>
    );
}

/** Option a: one menu button at the start of the layer tab row. */
export function AppSelectorButton() {
    const s = useAppAware();
    const ref = useRef<HTMLButtonElement>(null);
    const [anchor, setAnchor] = useState<HTMLElement | null>(null);
    useEffect(() => setAnchor(ref.current), []);
    const app = appById(s.selectedApp);
    return (
        <>
            <button
                ref={ref}
                type="button"
                data-app-selector="a"
                aria-haspopup="dialog"
                aria-expanded={s.menu.open}
                onClick={(e) => { e.stopPropagation(); if (s.menu.open) closeMenu(); else openMenu("list"); }}
                className={cn(
                    "flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition-colors",
                    s.selectedApp === ALL
                        ? "border-kb-combo-chip-border text-kb-ink hover:bg-kb-combo-row-lit"
                        : "border-kb-ink text-kb-ink bg-kb-combo-row-lit",
                )}
            >
                {app && <AppMono mono={app.mono} size={16} />}
                <span className="whitespace-nowrap">{appName(s.selectedApp)}</span>
                <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <AppMenu anchor={anchor} />
        </>
    );
}

/** Option b: app chips beside the layer name; the last chip adds an app. */
export function AppSelectorChips() {
    const s = useAppAware();
    const addRef = useRef<HTMLButtonElement>(null);
    const [anchor, setAnchor] = useState<HTMLElement | null>(null);
    const chip = (id: string, label: React.ReactNode, title: string) => {
        const on = s.selectedApp === id;
        return (
            <button
                key={id}
                type="button"
                aria-pressed={on}
                aria-label={title}
                data-app-chip={id}
                onClick={(e) => {
                    e.stopPropagation();
                    if (on && id !== ALL) { setAnchor(e.currentTarget); openMenu("manage", id); return; }
                    selectApp(id);
                }}
                className={cn(
                    "flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-medium transition-colors whitespace-nowrap",
                    on ? "bg-kb-active text-kb-active-fg" : "text-kb-ink hover:bg-kb-combo-row-lit",
                )}
            >
                {label}
                {on && id !== ALL && <MoreHorizontal className="h-3.5 w-3.5 opacity-70" aria-hidden="true" />}
            </button>
        );
    };
    return (
        <div className="flex items-center gap-0.5 rounded-full border border-kb-combo-chip-border p-0.5" data-app-selector="b" role="group" aria-label="App">
            {chip(ALL, <span>All apps</span>, "All apps")}
            {s.apps.map(a => chip(a.id, <><AppMono mono={a.mono} size={15} /><span>{a.name}</span></>, a.name))}
            <button
                ref={addRef}
                type="button"
                aria-label="Add app"
                data-app-chip-add=""
                onClick={(e) => { e.stopPropagation(); setAnchor(e.currentTarget); if (s.menu.open && s.menu.page === "add") closeMenu(); else openMenu("add"); }}
                className="rounded-full p-1.5 text-kb-ink hover:bg-kb-combo-row-lit"
            >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <AppMenu anchor={anchor ?? addRef.current} />
        </div>
    );
}
