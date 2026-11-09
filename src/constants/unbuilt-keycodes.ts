/**
 * Keycodes for features the Svalboard firmware does not build. No picker lists
 * them: a key that does nothing on the board is not shown. A layout that already
 * holds one still shows it by name (keygen.ts keeps every name), and Custom
 * keycode can still assign it.
 *
 * Checked against svalboard/qmk, branch svalboard:
 *   keyboards/svalboard/info.json   audio, backlight, bootmagic, midi, unicode,
 *                                   fauxclicky and bluetooth are all false
 *   keyboards/svalboard/rules.mk    no HAPTIC, JOYSTICK, DIGITIZER, PROGRAMMABLE_BUTTON,
 *                                   KEY_LOCK, SWAP_HANDS, DYNAMIC_TAPPING_TERM,
 *                                   DYNAMIC_MACRO, RGB_MATRIX or LED_MATRIX
 *   keymaps/sval/rules.mk           only STENO_ENABLE (geminipr), which is why
 *                                   the Steno keys stay
 *   rgblight                        on (it drives the layer LEDs), but no
 *                                   RGBLIGHT_EFFECT_* define, so rgblight builds the
 *                                   static mode only: mode, speed and effect keys do nothing
 */
const EXACT = new Set([
    "RGB_MOD", "RGB_RMOD", "RGB_SPI", "RGB_SPD",
    "RGB_M_B", "RGB_M_R", "RGB_M_SW", "RGB_M_SN", "RGB_M_K", "RGB_M_X", "RGB_M_G", "RGB_M_T",
    "QK_LOCK", "QK_KEY_LOCK", "LM_ON", "LM_OFF", "LM_TOGG", "LM_NEXT", "LM_PREV", "LM_BRIU", "LM_BRID", "LM_SPDU", "LM_SPDD",
]);

/** Name prefixes of whole unbuilt features. */
const PREFIXES = [
    "AU_", "QK_AUDIO", "CLICKY_", "QK_AUDIO_CLICKY", "MU_", "QK_MUSIC",
    "HPT_", "QK_HAPTIC",
    "BL_", "QK_BACKLIGHT",
    "MI_", "QK_MIDI",
    "UC_", "UM(", "UC(", "QK_UNICODE", "QK_UNICODEMAP",
    "JS_", "QK_JOYSTICK",
    "DG_", "QK_DIGITIZER",
    "PB_", "QK_PROGRAMMABLE_BUTTON",
    "DT_", "QK_DYNAMIC_TAPPING_TERM",
    "SH_", "QK_SWAP_HANDS",
    "DM_", "QK_DYNAMIC_MACRO",
    "RM_", "QK_RGB_MATRIX", "QK_LED_MATRIX",
];

export function isUnbuiltKeycode(name: string): boolean {
    return EXACT.has(name) || PREFIXES.some((p) => name.startsWith(p));
}
