/**
 * Ready states for review links (?scene=...). Each sets up the in-memory
 * prototype on top of the loaded example layout, so a link lands on the
 * exact state to review.
 */
import type { KeyboardInfo } from "@/types/keyboard.types";
import { keyService } from "@/services/key.service";
import { MATRIX_COLS } from "@/constants/svalboard-layout";
import { action } from "./catalog";
import type { ProtoParams } from "./proto";
import {
    ALL, HOME_LAYER, addApp, clearHold, addSet, appById, applyFront, getState, makeLayerFor, manualLayer, openMenu, positionsForTap,
    recompute, selectApp, setHold, setLocked, setPaused, setState, setTestAs, updateApp,
} from "./store";

export const SCENES = [
    "first", "holds", "game", "shared", "manual", "paused", "locked", "waiting", "tapdance", "test", "warn", "overlay",
] as const;

type SetKb = (kb: KeyboardInfo) => void;

function holds(kb: KeyboardInfo) {
    addSet(kb, "basics");
    addSet(kb, "figma");
    addSet(kb, "code");
}

function game(kb: KeyboardInfo, setKb: SetKb): KeyboardInfo {
    addApp("elden");
    const made = makeLayerFor(kb, "elden", true);
    if (!made) return kb;
    setKb(made.keyboard);
    updateApp("elden", { typeSends: "KC_ENTER" });
    return made.keyboard;
}

/** Puts tap dance 0 (tap A, hold Ctrl) on the home layer's A key. */
function tapdanceOnA(kb: KeyboardInfo, setKb: SetKb): { kb: KeyboardInfo; pos: string | null } {
    const pos = positionsForTap(kb, "KC_A")[0] ?? null;
    if (!pos) return { kb, pos };
    const [, r, c] = pos.split(":").map(Number);
    const next = structuredClone(kb);
    next.keymap![HOME_LAYER][r * MATRIX_COLS + c] = keyService.parse("TD(0)");
    // The plain ?demo layout has empty tap dances: give tap dance 0 a tap and a hold (as ?demo=combos does).
    const td = next.tapdances?.[0];
    if (td && (!td.tap || td.tap === "KC_NO")) next.tapdances![0] = { ...td, tap: "KC_A", hold: "KC_LCTRL" };
    setKb(next);
    return { kb: next, pos };
}

export function applyScene(p: ProtoParams, keyboard: KeyboardInfo, setKeyboard: SetKb) {
    let kb = keyboard;
    const scene = p.scene ?? "first";
    setState({ lastSeen: "figma" });
    switch (scene) {
        case "holds":
        case "test":
        case "overlay":
            holds(kb);
            break;
        case "game":
        case "manual":
        case "paused":
        case "locked":
        case "waiting":
            holds(kb);
            kb = game(kb, setKeyboard);
            break;
        case "shared":
            holds(kb);
            kb = game(kb, setKeyboard);
            addApp("hades");
            updateApp("hades", { baseLayer: appById("elden")?.baseLayer ?? null });
            break;
        case "tapdance": {
            holds(kb);
            const r = tapdanceOnA(kb, setKeyboard);
            kb = r.kb;
            if (r.pos) {
                // The key's All apps hold is now the tap dance's hold slot.
                clearHold(r.pos, ALL);
                setState({ selectedApp: "figma" });
                setHold(r.pos, action({ name: "Select all", short: "Sel all", key: "A" }));
            }
            break;
        }
        case "warn": {
            holds(kb);
            break;
        }
        default:
            break;
    }

    // The app the Overlay saw last before Keybard: Keybard opens on it.
    const front = scene === "game" || scene === "shared" || scene === "manual" || scene === "paused" || scene === "locked" || scene === "waiting"
        ? "elden" : scene === "first" ? null : "figma";
    if (front && p.overlay && p.os !== "mac") applyFront(front);
    const opensOn = p.app ?? (front && p.overlay ? front : null);
    selectApp(opensOn && (opensOn === ALL || getState().apps.some(a => a.id === opensOn)) ? opensOn : ALL);

    if (scene === "manual") manualLayer(1);
    if (scene === "paused") setPaused(true);
    if (scene === "locked") setLocked(true);
    if (scene === "waiting") {
        setState({ keysHeld: true });
        applyFront("figma");
        setState({ keysHeld: true });
    }
    if (scene === "test") setTestAs("figma");
    if (scene === "overlay") setState({ hintStrip: true, strip: { id: 1, app: "figma" }, note: { id: 2, text: "Game layer: Elden Ring" } });
    if (scene !== "overlay") setState({ note: null });
    recompute();
    if (scene === "overlay") setState({ note: { id: 3, text: "Game layer: Elden Ring" } });

    // Pin a key's card, and open the menu, once the layout has drawn.
    const keyName = p.key ?? (scene === "tapdance" ? "TD(0)" : scene === "warn" ? "KC_BSPACE" : null);
    setTimeout(() => {
        if (keyName) {
            const el = document.querySelector<HTMLElement>(`[data-keyboard-view-instance] [data-keycode="${CSS.escape(keyName)}"]`);
            el?.click();
        }
        if (scene === "warn") {
            setState({ pickMode: "hold", selectedApp: ALL });
            const pos = positionsForTap(kb, "KC_BSPACE")[0];
            if (pos) setHold(pos, { code: "PRI(KC_BSPACE)", name: "Delete word", short: "Del wd" }, "KC_BSPACE");
        }
        if (p.menu) {
            const [page, id] = p.menu.split(":");
            openMenu(page === "add" ? "add" : page === "manage" ? "manage" : "list", id);
        }
    }, 400);
}
