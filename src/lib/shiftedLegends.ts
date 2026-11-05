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
 *
 * AltGr legends (off by default; Settings > Appearance and editing, shown only when the
 * International keyboards layout has AltGr data, LayoutDefinition.altgr): a third legend,
 * what AltGr types, lower right: shifted upper right, base lower left, AltGr lower right.
 * Letter keys that have one get base lower left and AltGr lower right. Where the key
 * has no room for them (bands, combo folds) it keeps the two-legend diagonal.
 */
import { BUTTON_TO_KEYCODE_MAP, getLabelForKeycode, KEY_DISPLAY_OVERRIDES, LAYOUT_KEY_MAPS, LAYOUTS, US_SHIFT_ALIASES } from "@/components/Keyboards/layouts";
import type { KeyContent } from "@/types/keyboard.types";

export const SHIFTED_LEGENDS_SETTING = "shifted-legends";
export const DEFAULT_SHIFTED_LEGENDS = true;

export const ALTGR_LEGENDS_SETTING = "altgr-legends";
export const DEFAULT_ALTGR_LEGENDS = false;

export interface DualLegend {
    base: string;
    /** What Shift types: absent on letters (their shift is the capital) and with Shifted Key Symbols off. */
    shifted?: string;
    /** What AltGr types: present only with AltGr Symbols on and a character on this layout's key. */
    altgr?: string;
}

/** True when the layout has an AltGr level (LayoutDefinition.altgr), so AltGr Symbols can show. */
export function hasAltGr(layoutId: string): boolean {
    const rows = LAYOUTS[layoutId]?.altgr;
    return !!rows && rows.some((r) => r.split(" ").some((tok) => tok !== "" && tok !== NO_ALTGR));
}

const NO_ALTGR = "{none}";

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
export function positionalLegends(code: string, layoutId: string): (DualLegend & { shifted: string }) | null {
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
            const altgrToken = layout.altgr?.[r]?.split(" ")[i];
            const altgr = altgrToken && altgrToken !== NO_ALTGR ? legendText(altgrToken) : undefined;
            return altgr ? { base: legendText(token), shifted: legendText(shiftToken), altgr } : { base: legendText(token), shifted: legendText(shiftToken) };
        }
    }
    return null;
}

const LETTER = /\p{L}/u;
const DIGIT = /^[0-9]$/;

/** What each kind of legend a key may draw (Settings > Appearance and editing). */
export interface LegendOptions {
    /** Shifted Key Symbols (on when absent). */
    shifted?: boolean;
    /** AltGr Symbols (off when absent). */
    altgr?: boolean;
}

/** Wrappers that hold AltGr alone (RALT(KC_2), ALGR(KC_2)): the key types the AltGr character. */
const ALTGR_ONLY_WRAPPER = /^(RALT|ALGR)$/;
const ALTGR_WRAPPER = /^(RALT|ALGR|RCAG|RCA|RSA|SAGR|RCS)/;

/**
 * The legends of a key on this OS layout: the base legend, the shifted symbol and,
 * with `options.altgr`, the AltGr character. Null when the key keeps one legend: special
 * keycodes, keys the layout doesn't hold, keys that already type a shifted symbol
 * (KC_QUES, LSFT(KC_4)), and keys with nothing to add. Shift's legend is left out on
 * letters (its shift is only the capital letter), so a letter gets two legends only
 * with an AltGr character (Q is "@" on German).
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
    layoutId: string,
    options: LegendOptions = {}
): DualLegend | null {
    const wantShifted = options.shifted ?? true;
    const wantAltGr = options.altgr ?? false;
    if (!wantShifted && !wantAltGr) return null;
    let code = keycode.toUpperCase();
    let wrapped = false;
    if (keyContents?.type) {
        if (!WRAPPED_TYPES.has(keyContents.type)) return null;
        const m = /^([A-Z0-9_]+)\((KC_[A-Z0-9_]+)\)$/.exec(code);
        if (!m) return null;
        if (wrapperHasShift(m[1], keyContents.modids)) return null;
        // AltGr types its own symbol (altgrOnlyLegend), or with other modifiers is unknown: no extra legends.
        if (ALTGR_WRAPPER.test(m[1]) || (typeof keyContents.modids === "number" && (keyContents.modids & 0x1400) === 0x1400)) return null;
        code = m[2];
        wrapped = true;
    }
    if (!PLAIN_KEYCODE.test(code)) return null;
    if (code in US_SHIFT_ALIASES) return null; // already a shifted symbol (KC_QUES)
    // Numpad (KC_KP_*, KC_P1, KC_PDOT...) and KC_PSCR-style keys: never dual. KC_P is a letter.
    if (code.startsWith("KC_KP_") || (code.startsWith("KC_P") && code !== "KC_P")) return null;
    const legends = positionalLegends(code, layoutId);
    if (!legends) return null;
    const { base, shifted, altgr } = legends;
    if ([...base].length > 2 || [...shifted].length > 2) return null; // "Space", "enter", "backsp"
    if (!wrapped && label) {
        // A key drawing something else (the picker while its Shift is on) keeps that legend.
        // Exact, not case-insensitive: the picker's shifted letter is the capital of the base.
        const same = (a: string | null) => !!a && (a === label || (DIGIT.test(shifted) && a.toLocaleUpperCase() === label.toLocaleUpperCase()));
        if (!same(base) && !same(getLabelForKeycode(code, layoutId))) return null;
    }
    // Letters keep one shift legend, in every script (a, é, ж, ش): only digits and symbols get two. A
    // number-row key whose base is a letter (French é è ç à) still shows its shifted digit, read
    // from the layout's shift row, never the capital of the base letter.
    const showShifted = wantShifted && base !== shifted && !LETTER.test(shifted) && (!LETTER.test(base) || DIGIT.test(shifted));
    const showAltGr = wantAltGr && !!altgr && [...altgr].length <= 2 && altgr !== base;
    if (!showShifted && !showAltGr) return null;
    const out: DualLegend = { base };
    if (showShifted) out.shifted = shifted;
    if (showAltGr) out.altgr = altgr;
    return out;
}

/**
 * The AltGr character a RALT(KC_2) or ALGR(KC_2) key types on this layout ("²" on German),
 * or null. With AltGr Symbols on, that key shows it as its one legend, not the bare base key.
 * Wrappers that add Shift or other modifiers are left alone.
 */
export function altgrOnlyLegend(keycode: string, keyContents: KeyContent | undefined, layoutId: string): string | null {
    if (keyContents?.type !== "modmask") return null;
    const m = /^([A-Z0-9_]+)\((KC_[A-Z0-9_]+)\)$/.exec(keycode.toUpperCase());
    if (!m || !ALTGR_ONLY_WRAPPER.test(m[1])) return null;
    // Right Alt alone: no other modifier bits (0x1400 is RALT).
    if (typeof keyContents.modids === "number" && (keyContents.modids & 0x1f00) !== 0x1400) return null;
    const code = m[2];
    if (!PLAIN_KEYCODE.test(code) || code in US_SHIFT_ALIASES) return null;
    if (code.startsWith("KC_KP_") || (code.startsWith("KC_P") && code !== "KC_P")) return null;
    const altgr = positionalLegends(code, layoutId)?.altgr;
    return altgr && [...altgr].length <= 2 ? altgr : null;
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

/** Where each legend sits: shifted upper right, base lower left, AltGr lower right. */
export interface LegendPlan {
    legend: DualLegend;
    fontPx: number;
    insetY: number;
    /** The AltGr legend was dropped for want of room (bands) or because a combo fold sits in its corner. */
    droppedAltGr: boolean;
}

/**
 * Chooses what a key draws and at what size. With an AltGr legend the key holds it only
 * when every legend fits whole at the size the other keys use, none of them overlapping:
 * a shifted legend on its own line above the base and AltGr legends (two lines of room),
 * or the base and AltGr legends side by side (one line) on a letter. `roomPx` is the key's
 * inner height less its bands; `widthPx` its inner width less the side insets; `hasFold`
 * a combo fold, which covers the lower right corner where the AltGr legend goes.
 * Otherwise the AltGr legend is dropped and the key keeps its two-legend diagonal
 * (fitDualLegend), or its one legend when it has no shifted legend either (null).
 */
export function planLegends(legend: DualLegend, size: KeySizeName, roomPx: number, widthPx: number, hasFold: boolean): LegendPlan | null {
    const chars = (s?: string) => (s ? [...s].length : 0);
    let dropped = false;
    if (legend.altgr) {
        const rows = legend.shifted ? 2 : 1;
        const nominal = DUAL_LEGEND_FONT_PX[size];
        const byHeight = roomPx / (rows * DUAL_LEGEND_LINE_HEIGHT);
        const wide = Math.max(chars(legend.base) + chars(legend.altgr), chars(legend.shifted));
        const byWidth = widthPx / (wide * DUAL_LEGEND_GLYPH_EM);
        const fontPx = Math.floor(Math.min(nominal, byHeight, byWidth) * 2) / 2;
        if (!hasFold && fontPx >= nominal) {
            const insetY = Math.max(0, Math.min(DIAGONAL_INSET_PX[size].y, (roomPx - rows * fontPx * DUAL_LEGEND_LINE_HEIGHT) / 2));
            return { legend, fontPx, insetY, droppedAltGr: false };
        }
        dropped = true;
    }
    if (!legend.shifted) return null;
    const diagonal = { base: legend.base, shifted: legend.shifted };
    const fit = fitDualLegend(size, roomPx, widthPx, chars(diagonal.base) + chars(diagonal.shifted));
    return { legend: diagonal, ...fit, droppedAltGr: dropped };
}
