/**
 * App Taps + app-aware base layers: a clickable UX prototype.
 *
 * Everything here runs only with ?proto=app-aware in the URL. It keeps its
 * state in memory, writes nothing to a board, and talks to no Keybard Overlay:
 * a pretend board and a pretend app signal stand in for both.
 *
 * Review params (all optional, read once per load):
 * - look=a|b|c        hold legend treatment (a: band at the bottom, b: tag, c: band at the top)
 * - selector=a|b      app selector placement (a: menu beside the layer tabs, b: app chips by the layer name)
 * - scene=<name>      a ready state (see SCENES in scenes.ts)
 * - app=<id>          the app selected in the editor
 * - pick=hold         the key card starts on Hold
 * - key=<KC_X>        pin this home-layer key's card
 * - menu=open|add|manage:<id>   open the app menu on that page
 * - overlay=off       no Keybard Overlay running
 * - os=mac            a Mac (no Keybard Overlay for Mac yet)
 * - board=old         a board without the feature (everything hides)
 * - dev=0|open        hide the pretend-signal panel, or start with it open
 */

export const PROTO_PARAM = "proto";
export const PROTO_VALUE = "app-aware";

export type LegendLook = "a" | "b" | "c";
export type SelectorPlacement = "a" | "b";

export interface ProtoParams {
    look: LegendLook;
    selector: SelectorPlacement;
    scene: string | null;
    app: string | null;
    pick: "tap" | "hold";
    key: string | null;
    menu: string | null;
    overlay: boolean;
    os: "win" | "mac";
    boardSupports: boolean;
    dev: boolean;
    devOpen: boolean;
}

function get(p: URLSearchParams, name: string): string | null {
    const v = p.get(name);
    return v === null ? null : v.trim();
}

/** The prototype params, or null when ?proto=app-aware is absent. */
export function parseProto(search: string): ProtoParams | null {
    let p: URLSearchParams;
    try { p = new URLSearchParams(search); } catch { return null; }
    if ((get(p, PROTO_PARAM) || "").toLowerCase() !== PROTO_VALUE) return null;
    const look = (get(p, "look") || "a").toLowerCase();
    const selector = (get(p, "selector") || "a").toLowerCase();
    return {
        look: look === "b" || look === "c" ? look : "a",
        selector: selector === "b" ? "b" : "a",
        scene: get(p, "scene"),
        app: get(p, "app"),
        pick: (get(p, "pick") || "").toLowerCase() === "hold" ? "hold" : "tap",
        key: get(p, "key"),
        menu: get(p, "menu"),
        overlay: (get(p, "overlay") || "").toLowerCase() !== "off",
        os: (get(p, "os") || "").toLowerCase() === "mac" ? "mac" : "win",
        boardSupports: (get(p, "board") || "").toLowerCase() !== "old",
        dev: get(p, "dev") !== "0",
        devOpen: get(p, "dev") === "open",
    };
}

let cached: ProtoParams | null | undefined;
/** This load's prototype params (null: the prototype is off). */
export function protoParams(): ProtoParams | null {
    if (cached === undefined) cached = typeof window === "undefined" ? null : parseProto(window.location.search);
    return cached;
}

/** True when this load runs the prototype. */
export function isAppAwareProto(): boolean {
    return protoParams() !== null;
}

/** Tests only. */
export function resetProtoForTests(search?: string) {
    cached = search === undefined ? undefined : parseProto(search);
}
