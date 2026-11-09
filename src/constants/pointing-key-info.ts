// What each Pointing Devices key does in Svalboard firmware (svalboard/qmk, branch svalboard,
// keyboards/svalboard/keymaps/keymap_support.c process_record_kb and svalboard.c), for the
// picker tiles' tooltips and the mouse layer notice.
//
// Saved: the key flips or steps a value in global_saved_values and calls write_eeprom_kb(),
// which writes the board's settings to wear-leveled flash on every press.
// Ignored on the mouse layer: process_record_kb lists these in BAD_KEYCODE_CONDITONAL. While
// Auto Mouse has the mouse layer on, pressing one turns the layer off and the key does nothing.

export type PointingKeyKind = "hold" | "toggle" | "press";

export interface PointingKeyInfo {
    /** What one press does, in a short sentence. */
    does: string;
    kind: PointingKeyKind;
    /** Which pointer it acts on. */
    hand: "left" | "right" | "both" | "keyboard";
    /** Each press writes a setting to the keyboard's memory. */
    saved: boolean;
    /** The firmware ignores it while Auto Mouse has the mouse layer on. */
    mouseLayerIgnored: boolean;
    /** It works on the mouse layer and doesn't turn it off. */
    keepsMouseLayer?: boolean;
}

const sniper = (n: number, toggle: boolean): PointingKeyInfo => ({
    does: toggle ? `Slows the pointer ${n}x until you press it again.` : `Slows the pointer ${n}x while held.`,
    kind: toggle ? "toggle" : "hold", hand: "both", saved: false, mouseLayerIgnored: false, keepsMouseLayer: toggle,
});
const boost = (n: number, toggle: boolean): PointingKeyInfo => ({
    does: toggle ? `Speeds the pointer up ${n}x until you press it again.` : `Speeds the pointer up ${n}x while held.`,
    kind: toggle ? "toggle" : "hold", hand: "both", saved: false, mouseLayerIgnored: false, keepsMouseLayer: toggle,
});
const dpi = (side: "left" | "right", up: boolean): PointingKeyInfo => ({
    does: `${up ? "Raises" : "Lowers"} the ${side} pointer's DPI one step.`,
    kind: "press", hand: side, saved: true, mouseLayerIgnored: true,
});

export const POINTING_KEY_INFO: Record<string, PointingKeyInfo> = {
    SV_SNIPER_2: sniper(2, false), SV_SNIPER_3: sniper(3, false), SV_SNIPER_5: sniper(5, false),
    SV_SNIPER_2_TG: sniper(2, true), SV_SNIPER_3_TG: sniper(3, true), SV_SNIPER_5_TG: sniper(5, true),
    SV_BOOST_2: boost(2, false), SV_BOOST_3: boost(3, false), SV_BOOST_5: boost(5, false),
    SV_BOOST_2_TG: boost(2, true), SV_BOOST_3_TG: boost(3, true), SV_BOOST_5_TG: boost(5, true),
    SV_SCROLL_TOGGLE: {
        does: "Switches between pointing and scrolling until you press it again.",
        kind: "toggle", hand: "both", saved: false, mouseLayerIgnored: false,
    },
    SV_LEFT_SCROLL_TOGGLE: {
        does: "Switches the left pointer between pointing and scrolling.",
        kind: "toggle", hand: "left", saved: true, mouseLayerIgnored: true,
    },
    SV_RIGHT_SCROLL_TOGGLE: {
        does: "Switches the right pointer between pointing and scrolling.",
        kind: "toggle", hand: "right", saved: true, mouseLayerIgnored: true,
    },
    SV_VELOCITY_SCROLL: {
        does: "Hold and move the pointer: the farther it moves, the faster it scrolls.",
        kind: "hold", hand: "both", saved: false, mouseLayerIgnored: false, keepsMouseLayer: true,
    },
    SV_VELOCITY_SCROLL_TOGGLE: {
        does: "Velocity Scroll that stays on until you press it again.",
        kind: "toggle", hand: "both", saved: false, mouseLayerIgnored: false, keepsMouseLayer: true,
    },
    SV_RECALIBRATE_POINTER: {
        does: "Recalibrates the pointer to stop drift.",
        kind: "press", hand: "keyboard", saved: false, mouseLayerIgnored: false,
    },
    SV_TOGGLE_AUTOMOUSE: {
        does: "Turns Auto Mouse on or off.",
        kind: "toggle", hand: "keyboard", saved: true, mouseLayerIgnored: true,
    },
    SV_MH_CHANGE_TIMEOUTS: {
        does: "Steps the mouse layer timeout to the next choice.",
        kind: "press", hand: "keyboard", saved: true, mouseLayerIgnored: true,
    },
    SV_LEFT_DPI_INC: dpi("left", true), SV_LEFT_DPI_DEC: dpi("left", false),
    SV_RIGHT_DPI_INC: dpi("right", true), SV_RIGHT_DPI_DEC: dpi("right", false),
    // Hidden from the picker, still found on older layouts.
    SV_AXIS_SCROLL_LOCK: { does: "Turns Axis Lock on or off.", kind: "toggle", hand: "both", saved: true, mouseLayerIgnored: true },
};

const KIND_TEXT: Record<PointingKeyKind, string> = {
    hold: "Momentary.",
    toggle: "Toggle.",
    press: "One step per press.",
};
const HAND_TEXT: Record<PointingKeyInfo["hand"], string> = {
    left: "Left hand.",
    right: "Right hand.",
    both: "Both hands.",
    keyboard: "",
};

/** The tile's tooltip and accessible description, or undefined for a key with no entry. */
export function pointingKeyDescription(keycode: string): string | undefined {
    const info = POINTING_KEY_INFO[keycode];
    if (!info) return undefined;
    const parts = [info.does, KIND_TEXT[info.kind], HAND_TEXT[info.hand]];
    if (info.saved) parts.push("Each press changes a setting saved on the keyboard.");
    else if (info.kind !== "press") parts.push("Not saved: it resets when the keyboard restarts.");
    else parts.push("Not saved.");
    if (info.mouseLayerIgnored) parts.push("Keep it off the mouse layer: the keyboard ignores it there.");
    else if (info.keepsMouseLayer) parts.push("Works on the mouse layer.");
    return parts.filter(Boolean).join(" ");
}

/** Keys the firmware ignores while Auto Mouse has the mouse layer on. */
export function isMouseLayerIgnored(keycodeName: string): boolean {
    return POINTING_KEY_INFO[keycodeName]?.mouseLayerIgnored === true;
}

/** The names the picker shows for the keys the firmware ignores on the mouse layer. */
export const MOUSE_LAYER_IGNORED_NAMES: Record<string, string> = {
    SV_LEFT_SCROLL_TOGGLE: "Left Scroll Toggle",
    SV_RIGHT_SCROLL_TOGGLE: "Right Scroll Toggle",
    SV_AXIS_SCROLL_LOCK: "Axis Lock",
    SV_TOGGLE_AUTOMOUSE: "AutoMouse Toggle",
    SV_MH_CHANGE_TIMEOUTS: "Layer Time",
    SV_LEFT_DPI_INC: "Left DPI +",
    SV_LEFT_DPI_DEC: "Left DPI -",
    SV_RIGHT_DPI_INC: "Right DPI +",
    SV_RIGHT_DPI_DEC: "Right DPI -",
};

/** The mouse layer notice for keys just placed there, by keycode name. */
export function mouseLayerNoticeText(keycodeNames: string[]): string | null {
    const names = [...new Set(keycodeNames.filter(isMouseLayerIgnored))].map((k) => MOUSE_LAYER_IGNORED_NAMES[k] ?? k);
    if (!names.length) return null;
    const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
    const one = names.length === 1;
    return `${list} ${one ? "is" : "are"} on the mouse layer. While Auto Mouse has that layer on, the keyboard ignores ${one ? "this key" : "these keys"} and turns the layer off. Each press also changes a saved setting. Put ${one ? "it" : "them"} on another layer.`;
}
