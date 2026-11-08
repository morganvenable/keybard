import type { CustomKeycode } from "@/types/keyboard.types";

/**
 * Keybard's own key labels for firmware custom keycodes whose firmware
 * shortName doesn't say what the key does. The firmware definition keeps its
 * names; Keybard shows these on the layout and in every picker, so a key reads
 * the same wherever it appears. Prefer a space to "\n": keys wrap a label at
 * its spaces, while a binding editor's key slot shows only the last line of a
 * multi-line label ("Drag\nScroll" would read "Scroll" there).
 */
export const CUSTOM_KEYCODE_LABELS: Readonly<Record<string, string>> = {
    // Firmware: "Scroll\nToggle\nHold". While held, pointer motion scrolls.
    SV_SCROLL_HOLD: "Drag Scroll",
    // Firmware: "Velocity\nScroll". Hold: how far the pointer moves from where
    // it was sets a scroll speed, and it keeps scrolling while the pointer is still.
    // One name everywhere: Velocity Scroll (never "Vel Scroll").
    SV_VELOCITY_SCROLL: "Velocity Scroll",
    // Firmware: "Vel\nScrollTG". The same, from a tap that turns it on to the
    // next tap that turns it off.
    SV_VELOCITY_SCROLL_TOGGLE: "Velocity Scroll Toggle",
    // Firmware: "Axis Scroll Lock" on three lines. One name everywhere: Axis Lock, as in Settings.
    SV_AXIS_SCROLL_LOCK: "Axis Lock",
};

/** The label Keybard shows for a custom keycode, with real line breaks. */
export function customKeycodeShortName(custom: Pick<CustomKeycode, "name" | "shortName">): string {
    const label = CUSTOM_KEYCODE_LABELS[custom.name] ?? custom.shortName ?? custom.name;
    return label.replace(/\\n/g, "\n");
}
