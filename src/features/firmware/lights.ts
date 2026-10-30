// What each half's light does at each step, from the firmware (svalboard/qmk).
// Derived from the flow state, never read from the board.

import type { FlowState, Stage } from "@/services/updater/flow";
import type { Hand } from "@/services/updater/protocol";

export type LightPattern =
    /** The user's layer color: nothing updater-related. */
    | "layer"
    /** Firmware default color after a restart (layer 0 green). */
    | "default"
    /** Blue, blinking: waiting for the chord. */
    | "blue-blink"
    /** The rainbow: working. */
    | "rainbow"
    /** Magenta: writing. */
    | "magenta"
    /** Red, blinking: a failure (red is only ever a failure). */
    | "red-slow"
    /**
     * While a half writes its firmware or restarts, the firmware isn't driving its lights, so they may
     * freeze or show other colors until it's running again. No color is claimed.
     */
    | "not-driven"
    | "off";

export const LIGHT_LABEL: Record<LightPattern, string> = {
    layer: "Layer color",
    default: "Default color",
    "blue-blink": "Blue, blinking",
    rainbow: "Rainbow",
    magenta: "Magenta",
    "red-slow": "Red, blinking",
    "not-driven": "Not driven: may freeze or show other colors",
    off: "Off",
};

/**
 * The light on one half now: only the states the firmware drives on purpose (svalboard/qmk
 * keyboards/svalboard/updater). Blue blinking waits for the chord, the rainbow is working, magenta is
 * writing, red is a failure. While either half writes or restarts, nothing is claimed for either half.
 */
export function lightFor(state: FlowState, hand: Hand, now: number): LightPattern {
    const isUsb = hand === state.usbHand;
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
        case "self-erase":
        case "self-send":
        case "self-verify":
            return "rainbow";
        case "self-arm":
            return isUsb && state.target !== "both" ? "layer" : "rainbow";
        case "other-install":
        case "other-restart":
        case "self-install":
        case "reconnect":
        case "settings-reset":
            return "not-driven";
        case "sides":
            // A half without a side, or two on the same side, shows the default color and doesn't type.
            return "default";
        case "check-halves":
            return state.committed.includes(hand) || state.target === "both" ? "default" : "layer";
        case "restore":
        case "done":
            return state.afterwards === "restore" ? "layer" : "default";
        case "failed":
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
