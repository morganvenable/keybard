/**
 * Special Keys groups. Each key lives where its job is.
 *
 * The "not built" groups are checked against the Svalboard firmware build
 * (svalboard/qmk, branch svalboard, keyboards/svalboard):
 *   info.json   audio, backlight, midi and fauxclicky are all false
 *   rules.mk    no HAPTIC_ENABLE anywhere in the keyboard
 *   rgblight    on (it drives the layer LEDs), but no RGBLIGHT_EFFECT_* or
 *               RGBLIGHT_ANIMATIONS define, so rgblight_modes.h builds the
 *               single static mode only: mode and effect keys do nothing
 * Auto Shift, Combos and the console are built, so their keys stay visible.
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

/** Keys for features this firmware does not build. They stay assignable, under More. */
export const NOT_BUILT_GROUPS: SpecialKeyGroupDef[] = [
    {
        id: "not-built-audio",
        title: "Audio, music and clicky",
        keys: [
            k("AU_ON", "Audio ON"),
            k("AU_OFF", "Audio OFF"),
            k("AU_TOG", "Audio Toggle"),
            k("CLICKY_TOGGLE", "Clicky Toggle"),
            k("CLICKY_UP", "Clicky Up"),
            k("CLICKY_DOWN", "Clicky Down"),
            k("CLICKY_RESET", "Clicky Reset"),
            k("MU_ON", "Music On"),
            k("MU_OFF", "Music Off"),
            k("MU_TOG", "Music Toggle"),
            k("MU_MOD", "Music Cycle"),
        ],
    },
    {
        id: "not-built-haptic",
        title: "Haptic",
        keys: [
            k("HPT_ON", "Haptic On"),
            k("HPT_OFF", "Haptic Off"),
            k("HPT_TOG", "Haptic Toggle"),
            k("HPT_RST", "Haptic Reset"),
            k("HPT_FBK", "Haptic Feedback"),
            k("HPT_BUZ", "Haptic Buzz"),
            k("HPT_MODI", "Haptic Next"),
            k("HPT_MODD", "Haptic Prev"),
            k("HPT_CONT", "Haptic Cont."),
            k("HPT_CONI", "Haptic +"),
            k("HPT_COND", "Haptic -"),
            k("HPT_DWLI", "Haptic Dwell+"),
            k("HPT_DWLD", "Haptic Dwell-"),
        ],
    },
    {
        id: "not-built-backlight",
        title: "Backlight",
        keys: [
            k("BL_TOGG", "BL Toggle"),
            k("BL_STEP", "BL Cycle"),
            k("BL_BRTG", "BL Breath"),
            k("BL_ON", "BL On"),
            k("BL_OFF", "BL Off"),
            k("BL_INC", "BL +"),
            k("BL_DEC", "BL -"),
        ],
    },
    {
        id: "not-built-effects",
        title: "Lighting effects",
        keys: [
            k("RGB_MOD", "Mode +"),
            k("RGB_RMOD", "Mode -"),
            k("RGB_SPI", "Effect +"),
            k("RGB_SPD", "Effect -"),
            k("RGB_M_B", "RGB Mode B"),
            k("RGB_M_R", "RGB Mode R"),
            k("RGB_M_SW", "RGB Mode SW"),
            k("RGB_M_SN", "RGB Mode SN"),
            k("RGB_M_K", "RGB Mode K"),
            k("RGB_M_X", "RGB Mode X"),
            k("RGB_M_G", "RGB Mode G"),
            k("RGB_M_T", "RGB Mode T"),
        ],
    },
];

export const NOT_BUILT_NOTE = "The Svalboard firmware is built without these features, so they do nothing on the keyboard.";

export const MORE_KEYS_STORAGE = "keybard-special-more-open";
