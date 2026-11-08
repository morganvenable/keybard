/**
 * Special Keys groups. Each key lives where its job is.
 *
 * Only keys that do something on a Svalboard are listed. Keys for features the
 * firmware does not build are in unbuilt-keycodes.ts, which says why, and no
 * picker shows them.
 */
export interface SpecialKeyDef {
    keycode: string;
    label: string;
    /** Use this label instead of the keycode's own name. */
    fixedLabel?: boolean;
}

export interface SpecialKeyGroupDef {
    id: string;
    title: string;
    keys: SpecialKeyDef[];
}

const k = (keycode: string, label: string, fixedLabel = false): SpecialKeyDef => ({ keycode, label, fixedLabel });

export const EDITING_KEYS: SpecialKeyDef[] = [
    k("KC_UNDO", "Undo"),
    k("KC_CUT", "Cut"),
    k("KC_COPY", "Copy"),
    k("KC_PSTE", "Paste"),
    k("KC_FIND", "Find"),
    k("KC_AGIN", "Again"),
    k("KC_SLCT", "Select"),
];

/** Media keeps everything it had except the editing keys. */
export const MEDIA_KEYS: SpecialKeyDef[] = [
    k("KC_BRID", "Bright. Down"),
    k("KC_BRIU", "Bright. Up"),
    k("KC_WBAK", "Browser Back"),
    k("KC_WFAV", "Browser Fav."),
    k("KC_WFWD", "Browser Forward"),
    k("KC_WHOM", "Browser Home"),
    k("KC_WREF", "Browser Refresh"),
    k("KC_WSCH", "Browser Search"),
    k("KC_WSTP", "Browser Stop"),
    k("KC_CALC", "Calc"),
    k("KC_EJCT", "Eject"),
    k("KC_EXEC", "Exec"),
    k("KC_HELP", "Help"),
    k("KC_LCAP", "Locking Caps"),
    k("KC_LNUM", "Locking Num"),
    k("KC_LSCR", "Locking Scroll"),
    k("KC_MAIL", "Mail"),
    k("KC_MNXT", "Media Next"),
    k("KC_MPLY", "Media Play"),
    k("KC_MSEL", "Media Player"),
    k("KC_MPRV", "Media Prev"),
    k("KC_MSTP", "Media Stop"),
    k("KC_MUTE", "Mute"),
    k("KC_MYCM", "My PC"),
    k("KC_MFFD", "Next Track (macOS)"),
    k("KC_PWR", "Power"),
    k("KC_MRWD", "Prev Track (macOS)"),
    k("KC_SLEP", "Sleep"),
    k("KC_STOP", "Stop"),
    k("KC_VOLU", "Vol +"),
    k("KC_VOLD", "Vol -"),
    k("KC_WAKE", "Wake"),
];

export const FEATURE_SWITCH_KEYS: SpecialKeyDef[] = [
    k("KC_ASON", "Auto Shift On"),
    k("KC_ASOFF", "Auto Shift Off"),
    k("KC_ASTG", "Auto Shift Toggle"),
    k("CMB_ON", "Combos On"),
    k("CMB_OFF", "Combos Off"),
    k("CMB_TOG", "Combos Toggle"),
];

/** The layer LEDs are RGB lighting, so these work. RGB_TOG turns them off. */
export const LIGHTING_KEYS: SpecialKeyDef[] = [
    k("RGB_TOG", "LEDs On/Off", true),
    k("RGB_VAI", "Bright +"),
    k("RGB_VAD", "Bright -"),
    k("RGB_HUI", "Hue +"),
    k("RGB_HUD", "Hue -"),
    k("RGB_SAI", "Sat +"),
    k("RGB_SAD", "Sat -"),
    k("RGB_M_P", "Static"),
];

export const LIGHTING_NOTE = "LEDs On/Off turns the layer lights off and back on.";

/** Board and firmware keys. QK_BOOT is code 0x7C00, named RESET in the keycode table. */
export const BOARD_KEYS: SpecialKeyDef[] = [
    k("RESET", "Bootloader", true),
    k("QK_REBOOT", "Reboot", true),
    k("QK_DEBUG_TOGGLE", "Debug", true),
];

/** Auto Shift timing keys: built, but rarely touched. */
export const AUTO_SHIFT_TIMING_KEYS: SpecialKeyDef[] = [
    k("KC_ASDN", "Auto Shift Down"),
    k("KC_ASUP", "Auto Shift Up"),
    k("KC_ASRP", "Auto Shift Report"),
];

export const MORE_KEYS_STORAGE = "keybard-special-more-open";
