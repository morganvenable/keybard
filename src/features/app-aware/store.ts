/**
 * The prototype's in-memory state: apps, holds per app, the pretend app
 * signal and the pretend board's base layer. Nothing here is saved or sent.
 */
import { useSyncExternalStore } from "react";
import type { KeyboardInfo } from "@/types/keyboard.types";
import { keyService } from "@/services/key.service";
import { MATRIX_COLS } from "@/constants/svalboard-layout";
import { catalogApp, readySet, NO_HOLD, REPEAT_KEYS, type HoldValue } from "./catalog";
import { protoParams } from "./proto";

export const ALL = "all";
export const HOME_LAYER = 0;
/** Overlay app switches shorter than this are ignored. */
export const DEBOUNCE_MS = 150;

export interface ProtoApp {
    id: string;
    name: string;
    mono: string;
    program?: string;
    title?: string;
    browser?: string;
    /** The layer this app makes the base, or null (unchanged). */
    baseLayer: number | null;
    /** What the Type key sends after flipping to home ("" = nothing). */
    typeSends: string;
}

export type BoardMode = "home" | "app" | "manual" | "paused";

export interface LogLine { id: number; text: string }

export interface AppAwareState {
    on: boolean;
    supported: boolean;
    os: "win" | "mac";
    /** Keybard Overlay running and talking to the board. */
    overlay: boolean;
    apps: ProtoApp[];
    /** holds[app][layer:row:col]. In an app, NO_HOLD means "no hold in this app". */
    holds: Record<string, Record<string, HoldValue>>;
    selectedApp: string;
    pickMode: "tap" | "hold";
    /** The app the Overlay reports in front (an id from the catalog, or null). */
    front: string | null;
    /** The app the Overlay saw last before Keybard. */
    lastSeen: string | null;
    keysHeld: boolean;
    locked: boolean;
    paused: boolean;
    /** A layer chosen by hand on the board; wins until the next app change. */
    manual: number | null;
    testAs: string | null;
    boardLayer: number;
    pendingLayer: number | null;
    mode: BoardMode;
    log: LogLine[];
    /** Overlay: a short note when the base changes (on), the hint strip (off). */
    baseNote: boolean;
    hintStrip: boolean;
    note: { id: number; text: string } | null;
    strip: { id: number; app: string } | null;
    /** The repeat warning on the key card. */
    warning: { pos: string; key: string; app: string; prev: HoldValue | undefined } | null;
    /** Type and Pause keys placed on the layout (pretend keycodes). */
    placed: Record<string, "type" | "pause">;
    menu: { open: boolean; page: "list" | "add" | "manage"; appId?: string };
    /** The last change, for the review page's "it happened" checks. */
    rev: number;
}

const params = protoParams();

function initial(): AppAwareState {
    return {
        on: !!params,
        supported: params?.boardSupports ?? false,
        os: params?.os ?? "win",
        overlay: params ? params.overlay && params.os !== "mac" : false,
        apps: [],
        holds: { [ALL]: {} },
        selectedApp: ALL,
        pickMode: params?.pick ?? "tap",
        front: null,
        lastSeen: null,
        keysHeld: false,
        locked: false,
        paused: false,
        manual: null,
        testAs: null,
        boardLayer: HOME_LAYER,
        pendingLayer: null,
        mode: "home",
        log: [],
        baseNote: true,
        hintStrip: false,
        note: null,
        strip: null,
        warning: null,
        placed: {},
        menu: { open: false, page: "list" },
        rev: 0,
    };
}

let state: AppAwareState = initial();
const listeners = new Set<() => void>();
let seq = 1;

function emit() { listeners.forEach(l => l()); }

export function getState(): AppAwareState { return state; }

export function setState(patch: Partial<AppAwareState> | ((s: AppAwareState) => Partial<AppAwareState>)) {
    const p = typeof patch === "function" ? patch(state) : patch;
    state = { ...state, ...p, rev: state.rev + 1 };
    emit();
}

function subscribe(l: () => void) {
    listeners.add(l);
    return () => { listeners.delete(l); };
}

/** The prototype state (re-renders on every change). */
export function useAppAware(): AppAwareState {
    return useSyncExternalStore(subscribe, getState, getState);
}

/** Tests only. */
export function resetAppAwareForTests(patch: Partial<AppAwareState> = {}) {
    state = { ...initial(), ...patch };
    timers.forEach(t => clearTimeout(t));
    timers.clear();
    emit();
}

// ---------------------------------------------------------------------------
// Positions and holds
// ---------------------------------------------------------------------------

export const posKey = (layer: number, row: number, col: number) => `${layer}:${row}:${col}`;

export function appById(id: string | null | undefined): ProtoApp | undefined {
    return id ? state.apps.find(a => a.id === id) : undefined;
}

export function appName(id: string | null | undefined): string {
    if (!id) return "";
    if (id === ALL) return "All apps";
    return appById(id)?.name ?? catalogApp(id)?.name ?? id;
}

export type HoldSource = "app" | "all" | "native" | "none";

export interface ResolvedHold {
    hold: HoldValue | null;
    source: HoldSource;
}

/** The key's own hold from its keycode: a mod-tap's mod, a layer-tap's layer, a tap dance's hold slot. */
export function nativeHold(keyboard: KeyboardInfo | null | undefined, keycodeName: string): HoldValue | null {
    let m: RegExpExecArray | null;
    if ((m = /^(\w+)_T\(/.exec(keycodeName))) {
        const mod = m[1].replace(/^[LR]/, "");
        const name = mod === "CTL" ? "Ctrl" : mod === "SFT" ? "Shift" : mod === "ALT" ? "Alt" : mod === "GUI" ? "GUI" : mod;
        return { code: m[1], name, short: name };
    }
    if ((m = /^LT(\d+)\(/.exec(keycodeName))) {
        const n = Number(m[1]);
        const label = keyboard?.cosmetic?.layer?.[String(n)];
        return { code: `MO(${n})`, name: label ? `Layer ${n} (${label})` : `Layer ${n}`, short: `L${n}` };
    }
    if ((m = /^TD\((\d+)\)$/.exec(keycodeName))) {
        const td = keyboard?.tapdances?.[Number(m[1])];
        if (!td || !td.hold || td.hold === "KC_NO") return null;
        const k = td.hold.replace(/^KC_/, "");
        const name = /^L?CTRL|LCTL$/.test(k) ? "Ctrl" : /^L?SHIFT|LSFT$/.test(k) ? "Shift" : k.charAt(0) + k.slice(1).toLowerCase();
        return { code: td.hold, name, short: name };
    }
    return null;
}

/** This app's hold, then All apps, then the key's own hold. */
export function resolveHold(app: string, pos: string, native: HoldValue | null, s: AppAwareState = state): ResolvedHold {
    if (app !== ALL) {
        const own = s.holds[app]?.[pos];
        if (own) return { hold: own.code ? own : null, source: "app" };
    }
    const all = s.holds[ALL]?.[pos];
    if (all) return { hold: all.code ? all : null, source: "all" };
    if (native) return { hold: native, source: "native" };
    return { hold: null, source: "none" };
}

/** Number of key holds an app changes. */
export function holdCount(app: string, s: AppAwareState = state): number {
    return Object.keys(s.holds[app] || {}).length;
}

function log(text: string) {
    setState(s => ({ log: [{ id: seq++, text }, ...s.log].slice(0, 8) }));
}

// ---------------------------------------------------------------------------
// Editing
// ---------------------------------------------------------------------------

/** Writes a hold for the selected app. Warns (does not block) on keys that repeat. */
export function setHold(pos: string, hold: HoldValue, tapKeycode?: string) {
    const app = state.selectedApp;
    const prev = state.holds[app]?.[pos];
    setState(s => ({
        holds: { ...s.holds, [app]: { ...(s.holds[app] || {}), [pos]: hold } },
        warning: hold.code && tapKeycode && REPEAT_KEYS.has(tapKeycode)
            ? { pos, key: tapKeycode, app, prev }
            : null,
    }));
}

/** Removes the selected app's hold on a key ("Same as All apps"). */
export function clearHold(pos: string, app = state.selectedApp) {
    setState(s => {
        const next = { ...(s.holds[app] || {}) };
        delete next[pos];
        return { holds: { ...s.holds, [app]: next }, warning: null };
    });
}

export function undoWarning() {
    const w = state.warning;
    if (!w) return;
    setState(s => {
        const next = { ...(s.holds[w.app] || {}) };
        if (w.prev) next[w.pos] = w.prev; else delete next[w.pos];
        return { holds: { ...s.holds, [w.app]: next }, warning: null };
    });
}

export function selectApp(id: string) {
    setState({ selectedApp: id, warning: null });
}

export function setPickMode(mode: "tap" | "hold") {
    setState({ pickMode: mode, warning: null });
}

export function addApp(id: string): ProtoApp {
    const existing = appById(id);
    if (existing) return existing;
    const c = catalogApp(id);
    const app: ProtoApp = {
        id, name: c?.name ?? id, mono: c?.mono ?? id.slice(0, 2), program: c?.program, title: c?.title, browser: c?.browser,
        baseLayer: null, typeSends: "",
    };
    setState(s => ({ apps: [...s.apps, app], holds: { ...s.holds, [id]: s.holds[id] || {} } }));
    log(`Added ${app.name}`);
    return app;
}

export function renameApp(id: string, name: string) {
    setState(s => ({ apps: s.apps.map(a => a.id === id ? { ...a, name } : a) }));
}

export function removeApp(id: string) {
    setState(s => {
        const holds = { ...s.holds };
        delete holds[id];
        return {
            apps: s.apps.filter(a => a.id !== id), holds,
            selectedApp: s.selectedApp === id ? ALL : s.selectedApp,
            testAs: s.testAs === id ? null : s.testAs,
        };
    });
    recompute();
}

export function updateApp(id: string, patch: Partial<ProtoApp>) {
    setState(s => ({ apps: s.apps.map(a => a.id === id ? { ...a, ...patch } : a) }));
    recompute();
}

/** Home-layer positions whose tap is `tap` (KC_ name). */
export function positionsForTap(keyboard: KeyboardInfo, tap: string, layer = HOME_LAYER): string[] {
    const code = keyService.parse(tap);
    const row = keyboard.keymap?.[layer] || [];
    const out: string[] = [];
    row.forEach((kc, i) => {
        if (Number(kc) === code) out.push(posKey(layer, Math.floor(i / MATRIX_COLS), i % MATRIX_COLS));
    });
    return out;
}

/** Adds a ready-made set: to All apps, or to its app (adding the app). Returns holds added. */
export function addSet(keyboard: KeyboardInfo, setId: string): number {
    const set = readySet(setId);
    if (!set) return 0;
    const target = set.forApp;
    if (target !== ALL) addApp(target);
    let n = 0;
    const next = { ...(state.holds[target] || {}) };
    for (const h of set.holds) {
        for (const pos of positionsForTap(keyboard, h.tap)) { next[pos] = h.hold; n++; }
    }
    setState(s => ({ holds: { ...s.holds, [target]: next } }));
    log(`Added the ${set.name} set (${n} holds)`);
    return n;
}

// ---------------------------------------------------------------------------
// Layers
// ---------------------------------------------------------------------------

function layerIsBlank(keyboard: KeyboardInfo, i: number): boolean {
    const l = keyboard.keymap?.[i];
    if (!l) return true;
    return l.every(k => Number(k) === 0 || Number(k) === 1);
}

function layerIsReferenced(keyboard: KeyboardInfo, i: number): boolean {
    for (const layer of keyboard.keymap || []) {
        for (const k of layer) {
            const n = Number(k);
            // LT(i) 0x4000 | i<<8 | key; MO(i) 0x5220+i; TG, TO, TT, OSL, DF use other ranges.
            if (n >= 0x4000 && n <= 0x4fff && ((n >> 8) & 0x0f) === i) return true;
            const s = keyService.stringify(n);
            if (new RegExp(`^(MO|TG|TO|TT|OSL|DF|PDF)\\(${i}\\)$`).test(s)) return true;
        }
    }
    return false;
}

/** Layers with no keys that no key switches to. */
export function freeLayers(keyboard: KeyboardInfo): number[] {
    const n = keyboard.layers || 16;
    const out: number[] = [];
    for (let i = 1; i < n; i++) {
        if (state.apps.some(a => a.baseLayer === i)) continue;
        if (layerIsBlank(keyboard, i) && !layerIsReferenced(keyboard, i)) out.push(i);
    }
    return out;
}

/** The apps that use a layer as their base. */
export function appsOnLayer(layer: number, s: AppAwareState = state): ProtoApp[] {
    return s.apps.filter(a => a.baseLayer === layer);
}

/**
 * "Make a layer for this app": copies the home base into the first free layer,
 * names it after the app and links it. Returns the new keyboard and layer.
 */
export function makeLayerFor(keyboard: KeyboardInfo, appId: string, withTypeKey = false): { keyboard: KeyboardInfo; layer: number } | null {
    const free = freeLayers(keyboard);
    if (!free.length) return null;
    const layer = free[0];
    const next = structuredClone(keyboard);
    next.keymap = next.keymap || [];
    next.keymap[layer] = [...(keyboard.keymap?.[HOME_LAYER] || [])];
    // A game's layer is "Game" (games often share it); other apps name it after themselves.
    const label = withTypeKey ? "Game" : appName(appId);
    next.cosmetic = { ...(next.cosmetic || {}), layer: { ...(next.cosmetic?.layer || {}), [String(layer)]: label } };
    if (withTypeKey) {
        // The Type key goes where Enter is on the home base (Enter opens chat in most games).
        const i = (keyboard.keymap?.[HOME_LAYER] || []).findIndex(k => /^(KC_ENTER|.*\(KC_ENTER\))$/.test(keyService.stringify(Number(k))));
        if (i >= 0) {
            const pos = posKey(layer, Math.floor(i / MATRIX_COLS), i % MATRIX_COLS);
            setState(s => ({ placed: { ...s.placed, [pos]: "type" } }));
        }
    }
    updateApp(appId, { baseLayer: layer });
    log(`Made layer ${layer} for ${appName(appId)}`);
    return { keyboard: next, layer };
}

export function placeKey(pos: string, kind: "type" | "pause" | null) {
    setState(s => {
        const placed = { ...s.placed };
        if (kind) placed[pos] = kind; else delete placed[pos];
        return { placed };
    });
}

// ---------------------------------------------------------------------------
// The pretend board: which base layer, and why
// ---------------------------------------------------------------------------

const timers = new Set<ReturnType<typeof setTimeout>>();
let frontTimer: ReturnType<typeof setTimeout> | null = null;
let lastReportAt = 0;

/** The app the board acts for right now, and why. */
export function actingApp(s: AppAwareState = state): { app: string | null; why: "test" | "front" | "locked" | "no-overlay" | "paused" | "none" } {
    if (s.paused) return { app: null, why: "paused" };
    if (s.testAs) return { app: s.testAs, why: "test" };
    if (!s.overlay) return { app: null, why: "no-overlay" };
    if (s.locked) return { app: null, why: "locked" };
    if (s.front) return { app: s.front, why: "front" };
    return { app: null, why: "none" };
}

function desired(s: AppAwareState): { layer: number; mode: BoardMode } {
    if (s.paused) return { layer: HOME_LAYER, mode: "paused" };
    const { app } = actingApp(s);
    if (s.manual !== null && s.overlay && !s.locked) return { layer: s.manual, mode: "manual" };
    const linked = appById(app)?.baseLayer;
    if (linked !== null && linked !== undefined) return { layer: linked, mode: "app" };
    return { layer: HOME_LAYER, mode: "home" };
}

/** Applies the rules: switches wait until no keys are held. */
export function recompute() {
    const d = desired(state);
    if (d.layer === state.boardLayer) {
        if (state.pendingLayer !== null || state.mode !== d.mode) setState({ pendingLayer: null, mode: d.mode });
        return;
    }
    if (state.keysHeld) {
        if (state.pendingLayer !== d.layer) {
            setState({ pendingLayer: d.layer });
            log(`Keys held: waiting to switch to layer ${d.layer}`);
        }
        return;
    }
    const id = seq++;
    setState({ boardLayer: d.layer, pendingLayer: null, mode: d.mode, note: state.baseNote ? { id, text: noteText(d.layer, d.mode) } : state.note });
    log(`Board base is now layer ${d.layer}`);
}

let layerNamer: (i: number) => string = i => `Layer ${i}`;
/** The status line and notes name layers the way the editor does. */
export function setLayerNamer(fn: (i: number) => string) { layerNamer = fn; }
export function layerName(i: number): string { return layerNamer(i); }

function noteText(layer: number, mode: BoardMode): string {
    if (mode === "app") {
        const app = actingApp().app;
        return `${layerName(layer)}: ${appName(app)}`;
    }
    if (mode === "paused") return "App switching paused";
    return `${layerName(layer)}: home`;
}

/** The pretend Overlay reports a new app in front (debounced). */
export function reportFront(id: string | null) {
    const now = Date.now();
    const quick = now - lastReportAt < DEBOUNCE_MS && frontTimer !== null;
    lastReportAt = now;
    if (frontTimer) { clearTimeout(frontTimer); timers.delete(frontTimer); }
    if (quick) log(`Ignored a switch shorter than ${DEBOUNCE_MS} ms`);
    frontTimer = setTimeout(() => {
        if (frontTimer) timers.delete(frontTimer);
        frontTimer = null;
        applyFront(id);
    }, DEBOUNCE_MS);
    timers.add(frontTimer);
}

/** Applies a front-app change at once (scenes and tests). */
export function applyFront(id: string | null) {
    if (id === state.front) return;
    const changed = state.front !== id;
    setState(s => ({
        front: id,
        lastSeen: id ?? s.lastSeen,
        manual: changed ? null : s.manual,
        strip: id && s.hintStrip && holdCount(id, s) > 0 ? { id: seq++, app: id } : s.strip,
    }));
    log(id ? `${appName(id)} is in front` : "No app in front");
    recompute();
}

/** A quick there-and-back switch (alt-tab flicker): ignored by the debounce. */
export function flicker(to: string) {
    const back = state.front;
    reportFront(to);
    const t = setTimeout(() => { timers.delete(t); reportFront(back); }, 60);
    timers.add(t);
}

export function setKeysHeld(held: boolean) {
    setState({ keysHeld: held });
    log(held ? "Keys held down" : "Keys lifted");
    recompute();
}

export function setLocked(locked: boolean) {
    setState({ locked });
    log(locked ? "Screen locked" : "Screen unlocked");
    recompute();
}

export function setOverlay(running: boolean) {
    setState({ overlay: running, manual: running ? state.manual : null });
    log(running ? "Keybard Overlay connected" : "Lost contact with Keybard Overlay");
    recompute();
}

export function setPaused(paused: boolean) {
    setState({ paused });
    log(paused ? "App switching paused" : "App switching resumed");
    recompute();
}

/** A layer change made by hand on the board (a layer key). */
export function manualLayer(layer: number) {
    setState({ manual: layer });
    log(`Switched to layer ${layer} by hand`);
    recompute();
}

export function setTestAs(id: string | null) {
    setState({ testAs: id });
    log(id ? `Testing as ${appName(id)}` : "Stopped testing");
    recompute();
}

/** What the board sends for a press of `pos` right now (the dev panel's "press" readout). */
export function describePress(pos: string, tapName: string, native: HoldValue | null, held: boolean): string {
    const { app, why } = actingApp();
    const who = app ?? ALL;
    const r = resolveHold(who, pos, native);
    const where = why === "test" ? `testing as ${appName(app)}` : app ? `${appName(app)} in front` : "no app";
    if (!held) return `Tap ${tapName} (${where}): ${tapName}`;
    if (!r.hold) return `Hold ${tapName} (${where}): ${tapName}, repeating; no hold`;
    const from = r.source === "app" ? `${appName(app)}'s hold` : r.source === "all" ? "the All apps hold" : "the key's own hold";
    return `Hold ${tapName} (${where}): ${r.hold.name}, from ${from}`;
}

export { NO_HOLD };

export function openMenu(page: AppAwareState["menu"]["page"] = "list", appId?: string) {
    setState({ menu: { open: true, page, appId } });
}

export function closeMenu() {
    setState(s => ({ menu: { ...s.menu, open: false } }));
}

export function dismissNote() { setState({ note: null }); }
export function dismissStrip() { setState({ strip: null }); }
