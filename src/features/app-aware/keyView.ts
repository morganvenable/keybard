import type { KeyboardInfo } from "@/types/keyboard.types";
import type { KeyAppHold } from "./HoldLegend";
import { protoParams } from "./proto";
import { ALL, appName, nativeHold, posKey, resolveHold, type AppAwareState } from "./store";

export interface KeyAppView {
    appHold?: KeyAppHold;
    appKey?: "type" | "pause";
}

const NONE: KeyAppView = {};

/** What the prototype draws on one layout key (nothing when it is off). */
export function keyAppView(
    s: AppAwareState, keyboard: KeyboardInfo | null | undefined,
    layer: number, row: number, col: number, keycodeName: string,
): KeyAppView {
    if (!s.on || !s.supported) return NONE;
    const pos = posKey(layer, row, col);
    const appKey = s.placed[pos];
    if (appKey) return { appKey };
    if (keycodeName === "KC_TRNS" || keycodeName === "KC_NO") return NONE;
    const look = protoParams()?.look ?? "a";
    const app = s.selectedApp;
    const r = resolveHold(app, pos, nativeHold(keyboard, keycodeName), s);
    if (r.source === "none") return NONE;
    if (app === ALL) {
        if (!r.hold) return NONE;
        return { appHold: { text: r.hold.short, state: "normal", look, title: `Hold: ${r.hold.name}` } };
    }
    if (r.source === "app") {
        if (!r.hold) return { appHold: { text: "", state: "removed", look, title: `No hold in ${appName(app)}` } };
        return { appHold: { text: r.hold.short, state: "own", look, title: `Hold in ${appName(app)}: ${r.hold.name}` } };
    }
    if (!r.hold) return NONE;
    return { appHold: { text: r.hold.short, state: "inherited", look, title: `Hold: ${r.hold.name}, same as All apps` } };
}
