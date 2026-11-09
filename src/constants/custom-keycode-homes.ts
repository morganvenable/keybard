import type { CustomKeycode } from "@/types/keyboard.types";

/**
 * Where each firmware custom keycode (SV_*) is offered in the pickers.
 *
 * - "mouse": Mouse Keys lists it. Mouse Keys is only QMK's emulated mouse
 *   keys, so no SV_ key has this home.
 * - "pointing": Pointing Devices lists it: every Svalboard pointing key.
 * - "board": Special Keys, More keys, Board and firmware.
 * - "svalboard": the Svalboard group on Special Keys.
 *
 * A key is placed by name. A name this table does not know, such as a key a
 * newer firmware adds, goes to "svalboard", never to Mouse Keys, so a new key
 * is visible without a Keybard release.
 */
export type CustomKeycodeHome = "mouse" | "pointing" | "board" | "svalboard";

/**
 * Every Svalboard pointing key: exactly the ones the Pointing Devices panel
 * lists (MouseKeysSection.tsx). A new Sniper or Boost key it does not list is
 * not matched here, so it lands in Svalboard instead of nowhere.
 */
const POINTING_KEYS: ReadonlySet<string> = new Set([
    ...["2", "3", "5", "2_TG", "3_TG", "5_TG"].flatMap((m) => [`SV_SNIPER_${m}`, `SV_BOOST_${m}`]),
    "SV_SCROLL_HOLD",
    "SV_VELOCITY_SCROLL",
    "SV_VELOCITY_SCROLL_TOGGLE",
    "SV_LEFT_DPI_INC",
    "SV_LEFT_DPI_DEC",
    "SV_RIGHT_DPI_INC",
    "SV_RIGHT_DPI_DEC",
    "SV_LEFT_SCROLL_TOGGLE",
    "SV_RIGHT_SCROLL_TOGGLE",
    "SV_SCROLL_TOGGLE",
    "SV_NATURAL_SCROLL_TOGGLE",
    "SV_AXIS_SCROLL_LOCK",
    "SV_RECALIBRATE_POINTER",
    "SV_TOGGLE_AUTOMOUSE",
    "SV_MH_CHANGE_TIMEOUTS",
]);
/** Firmware housekeeping keys, grouped with Bootloader, Reboot and Debug. */
const BOARD_KEYS: ReadonlySet<string> = new Set(["SV_TURBO_SCAN", "SV_OUTPUT_STATUS"]);

export function customKeycodeHome(name: string): CustomKeycodeHome {
    if (POINTING_KEYS.has(name)) return "pointing";
    if (BOARD_KEYS.has(name)) return "board";
    // Not about the pointer (Caps Word, MO 23, MO 45)
    // and every key this table does not know.
    return "svalboard";
}

/** The firmware's SV_ keys whose home is the given group, in firmware order. */
export function customKeycodesAt(
    custom: readonly CustomKeycode[] | undefined,
    home: CustomKeycodeHome,
): CustomKeycode[] {
    return (custom ?? []).filter((ck) => ck.name.startsWith("SV_") && customKeycodeHome(ck.name) === home);
}
