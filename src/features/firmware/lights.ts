// What each half's light does at each step, from the firmware code (svalboard/qmk x4.3).
// Derived from the flow state, never read from the board.

import type { FlowState, Stage } from "@/services/updater/flow";
import type { Hand } from "@/services/updater/protocol";

export type LightPattern =
    /** The user's layer color: nothing updater-related. */
    | "layer"
    /** Firmware default color after a restart (layer 0 green). */
    | "default"
    /** Blue, blinking twice a second: hold the chord now. */
    | "blue-blink"
    /** The rainbow: one slow continuous hue cycle, "busy". */
    | "rainbow"
    /** Steady magenta: installing, don't unplug. */
    | "magenta"
    /** Red, blinking once a second: it failed (red is only ever a failure). */
    | "red-slow"
    | "off";

export const LIGHT_LABEL: Record<LightPattern, string> = {
    layer: "Layer color",
    default: "Default color",
    "blue-blink": "Blue, blinking",
    rainbow: "Rainbow",
    magenta: "Magenta, steady",
    "red-slow": "Red, blinking slowly",
    off: "Off",
};

/**
 * The light on one half now, as svalboard/qmk x4.3 drives it (keyboards/svalboard/updater/updater.c,
 * led_mode() and own_light()). The half with USB sends its light to the other half on the 500 ms
 * presence ping (updater_split_light), so the other half shows the rainbow whenever the half with
 * USB does, except while the link is paused for the copy, when it shows its own (also the rainbow).
 * The chord's blue light and white flash are not sent: the other half keeps its layer color then.
 */
export function lightFor(state: FlowState, hand: Hand, now: number): LightPattern {
    const usb = state.usbHand;
    const isUsb = hand === usb;
    const since = now - state.stepAt;
    switch (state.step) {
        case "start":
            return "layer";
        case "approve":
            return isUsb ? "blue-blink" : "layer";
        case "other-erase":
        case "other-send":
        case "other-verify":
        case "relay":
            return "rainbow";
        case "other-install":
            // Only the half that writes holds magenta; the half with USB keeps the rainbow.
            return isUsb ? "rainbow" : "magenta";
        case "other-restart":
            // Both keep the rainbow until the halves match; waiting is never red.
            return "rainbow";
        case "self-arm":
            return isUsb ? (state.target === "both" ? "rainbow" : "layer") : "rainbow";
        case "self-erase":
        case "self-send":
        case "self-verify":
            return "rainbow";
        case "self-install":
            return isUsb ? "magenta" : "rainbow";
        case "reconnect":
            // The half with USB comes back from its own install showing the rainbow until the halves match.
            return "rainbow";
        case "settings-reset":
            return "default";
        case "sides":
            // A half without a side, or two on the same side, shows the default color and doesn't type.
            return "default";
        case "check-halves":
            // Two green flashes once the halves match, then the default color.
            return state.committed.includes(hand) || state.target === "both" ? "default" : "layer";
        case "restore":
        case "done":
            return state.afterwards === "restore" ? "layer" : "default";
        case "failed":
            // A refused or failed install: red, once a second, for 30 s on both halves, then the layer color.
            return since < 30_000 ? "red-slow" : "layer";
    }
}

/** Row labels (update-flow 5.1). */
export function stageLabel(stage: Stage, progress: number | null, otherName: string): string {
    const pct = progress === null ? "" : ` ${Math.round(progress * 100)}%`;
    switch (stage) {
        case "waiting": return "Waiting";
        case "approve": return "Approve";
        case "preparing": return "Preparing";
        case "sending": return `Sending${pct}`;
        case "checking": return "Checking";
        case "copying": return `Copying to ${otherName}${pct}`;
        case "installing": return "Installing";
        case "restarting": return "Restarting";
        case "reconnecting": return "Reconnecting";
        case "checking-halves": return "Checking both halves";
        case "checking-sides": return "Checking which half is which";
        case "restoring": return "Putting your layout back";
        case "done": return "Done";
        case "stopped": return "Stopped";
    }
}
