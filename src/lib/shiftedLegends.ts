/**
 * Shifted legends: a digit or punctuation key also shows the symbol Shift types
 * with it, like a printed keycap (`/` also shows `?` on US English). The shifted
 * symbol comes from the International keyboards setting (LAYOUTS in
 * Keyboards/layouts.ts, which holds every layout's shift row).
 *
 * Diagonal placement: the shifted legend upper right, the base legend lower
 * left, both pulled in from the corners and kept between the key's bands
 * (mod-tap, layer-tap and modifier labels), the same color and size.
 *
 * On by default; Settings > Appearance and editing turns it off (stored per
 * browser like the other display settings).
 */
import { BUTTON_TO_KEYCODE_MAP, getLabelForKeycode, KEY_DISPLAY_OVERRIDES, LAYOUT_KEY_MAPS, LAYOUTS, US_SHIFT_ALIASES } from "@/components/Keyboards/layouts";
import type { KeyContent } from "@/types/keyboard.types";

export const SHIFTED_LEGENDS_SETTING = "shifted-legends";
export const DEFAULT_SHIFTED_LEGENDS = true;

export interface DualLegend {
    base: string;
    shifted: string;
}

const PLAIN_KEYCODE = /^KC_[A-Z0-9_]+$/;
/** Key kinds that draw their base key in the middle, with a band above or below it. */
const WRAPPED_TYPES = new Set(["modmask", "modtap", "layerhold"]);

/**
 * True when a wrapper keycode (LSFT(...), LSFT_T(...), C_S(...), MEH_T(...)) holds
 * Shift, so the key types its shifted symbol.
 */
export function wrapperHasShift(wrapper: string, modids?: number): boolean {
    if (typeof modids === "number" && (modids & 0x0200) !== 0) return true;
    if (/^LT\d/.test(wrapper)) return false;
    return wrapper.includes("S") || /^(MEH|HYPR|ALL)(_T)?$/.test(wrapper);
}

const legendText = (token: string) => KEY_DISPLAY_OVERRIDES[token] || token.replace("{", "").replace("}", "");

/**
 * A key's legends on this OS layout by position: the token for `code` in the layout's
 * default rows and the token at the same row and place in its shift rows, the pairing the
 * QWERTY picker draws. (Looking the shifted symbol up by name instead can find a token
 * that names another key, such as French ":" or Danish "-".)
 */
export function positionalLegends(code: string, layoutId: string): DualLegend | null {
    const layout = LAYOUTS[layoutId] || LAYOUTS.us;
    const keyMap = LAYOUT_KEY_MAPS[layoutId] || {};
    for (let r = 0; r < layout.default.length; r++) {
        const tokens = layout.default[r].split(" ");
        const shiftTokens = (layout.shift[r] ?? "").split(" ");
        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];
            const mapped = keyMap[token] || keyMap[token.toLowerCase()] || BUTTON_TO_KEYCODE_MAP[token] || BUTTON_TO_KEYCODE_MAP[token.toLowerCase()];
            if (mapped !== code) continue;
            const shiftToken = shiftTokens[i];
            if (!shiftToken) return null;
            return { base: legendText(token), shifted: legendText(shiftToken) };
        }
    }
    return null;
}

const LETTER = /\p{L}/u;

/**
 * The base and shifted legends of a key on this OS layout, or null when the key
 * keeps one legend: special keycodes, keys whose shift is only the capital letter
 * (or nothing), keys the layout doesn't hold, and keys that already type a shifted
 * symbol (KC_QUES, LSFT(KC_4)).
 *
 * A modifier (LCTL(KC_1)), mod-tap (LCTL_T(KC_2)) or layer-tap (LT1(KC_3)) key gets
 * the legends of its base key. For a plain key, `label` is what the key would draw
 * with one legend; a key drawing something else (the picker while its Shift is on)
 * keeps that one legend.
 */
export function dualLegendFor(
    keycode: string,
    label: string,
    keyContents: KeyContent | undefined,
    layoutId: string
): DualLegend | null {
    let code = keycode.toUpperCase();
    let wrapped = false;
    if (keyContents?.type) {
        if (!WRAPPED_TYPES.has(keyContents.type)) return null;
        const m = /^([A-Z0-9_]+)\((KC_[A-Z0-9_]+)\)$/.exec(code);
        if (!m) return null;
        if (wrapperHasShift(m[1], keyContents.modids)) return null;
        // AltGr types a third symbol on many layouts (AltGr+2 is "²" on German): keep one legend.
        if (/^(RALT|ALGR|RCAG|RCA|RSA|SAGR|RCS)/.test(m[1])) return null;
        code = m[2];
        wrapped = true;
    }
    if (!PLAIN_KEYCODE.test(code)) return null;
    if (code in US_SHIFT_ALIASES) return null; // already a shifted symbol (KC_QUES)
    // Numpad (KC_KP_*, KC_P1, KC_PDOT...) and KC_PSCR-style keys: never dual. KC_P is a letter.
    if (code.startsWith("KC_KP_") || code.startsWith("KC_P")) return null;
    const legends = positionalLegends(code, layoutId);
    if (!legends) return null;
    const { base, shifted } = legends;
    if ([...base].length > 2 || [...shifted].length > 2) return null; // "Space", "enter", "backsp"
    if (base === shifted) return null;
    // Letters keep one legend, in every script (a, é, ж, ش): only digits and symbols get two.
    if (LETTER.test(base) || LETTER.test(shifted)) return null;
    if (!wrapped && label) {
        // A key drawing something else (the picker while its Shift is on) keeps that legend.
        const same = (a: string | null) => !!a && a.toLocaleUpperCase() === label.toLocaleUpperCase();
        if (!same(base) && !same(getLabelForKeycode(code, layoutId))) return null;
    }
    return { base, shifted };
}

export type KeySizeName = "default" | "medium" | "small";

/**
 * Legend font size (px) per key size, the same for both legends. Keys are
 * 60 / 45 / 30 px (default / medium / small); the picker draws small keys,
 * zoomed to 24-30 px.
 */
export const DUAL_LEGEND_FONT_PX = { default: 15, medium: 12, small: 10 } as const;

/**
 * Line height of a legend, in em. Inter's tallest legend ink runs from 1.00 em above the
 * baseline (Å) to 0.24 em below it (|), measured with canvas measureText at weight 600 over
 * every legend in LAYOUTS; its content area is 0.97 + 0.24 em. At 1.3 the line box holds
 * all of it, so fitting a legend's box fits its glyphs.
 */
export const DUAL_LEGEND_LINE_HEIGHT = 1.3;

/** Band height (px) along a key's top or bottom (mod-tap, layer-tap, modifier), per key size. */
export const KEY_BAND_PX = { default: 18, medium: 14, small: 10 } as const;

/**
 * `x`: each legend's inset from its side; `y`: from the top or bottom of the room between
 * the key's bands. On a key with a band the room is shorter than two lines, so the legends
 * overlap in height; they never overlap in width, since 2x + the two glyphs' widths stays
 * within the key (widest US pair "@ 2" at 10px: 16px of 28).
 */
export const DIAGONAL_INSET_PX = {
    default: { x: 12, y: 8 },
    medium: { x: 8, y: 5 },
    small: { x: 4, y: 2 },
} as const;

/** Widest legend glyph advance in Inter 600, in em, rounded up ("@" is 0.95 em). */
export const DUAL_LEGEND_GLYPH_EM = 1;

/**
 * The legend size and vertical inset that keep both legends whole: a line inside `roomPx`
 * (the height between the key's border and bands) and both legends side by side inside
 * `widthPx` (the key's inner width less the two side insets) at their widest glyphs,
 * `chars` characters in all. Sizes step down by 0.5 px only when the key can't hold them.
 */
export function fitDualLegend(size: KeySizeName, roomPx: number, widthPx = Infinity, chars = 2): { fontPx: number; insetY: number } {
    const base = DUAL_LEGEND_FONT_PX[size];
    const byHeight = roomPx / DUAL_LEGEND_LINE_HEIGHT;
    const byWidth = widthPx / (Math.max(1, chars) * DUAL_LEGEND_GLYPH_EM);
    const fontPx = Math.max(1, Math.min(base, Math.floor(Math.min(byHeight, byWidth) * 2) / 2));
    const insetY = Math.max(0, Math.min(DIAGONAL_INSET_PX[size].y, (roomPx - fontPx * DUAL_LEGEND_LINE_HEIGHT) / 2));
    return { fontPx, insetY };
}
