import { KEYCODE_NUMBERINGS, activeKeycodeVersion } from "./keycode-numbering";

/**
 * Layer-Mod keys: LM(layer, mods) turns a layer on while holding modifiers.
 * The code is the start of the QK_LAYER_MOD range plus the layer in bits 5-8 and a 5-bit
 * modifier field: bit 4 means the right-hand modifiers, bits 0-3 are
 * Ctrl, Shift, Alt and GUI.
 */
const RIGHT_BIT = 0x10;
const NAMES = ["CTL", "SFT", "ALT", "GUI"] as const;

/** Start and end of the LM range in the numbering the board uses, or null before one is applied. */
function layerModRange(): { first: number; last: number } | null {
    const spec = KEYCODE_NUMBERINGS[activeKeycodeVersion()];
    const span = spec && Object.entries(spec.ranges).find(([, name]) => name === "QK_LAYER_MOD")?.[0];
    if (!span) return null;
    const [first, size] = span.split("/").map(Number);
    return { first, last: first + size };
}

export function layerModKeycode(layer: number, mods: number): number | null {
    const range = layerModRange();
    return range ? range.first | ((layer & 0xf) << 5) | (mods & 0x1f) : null;
}

/** LM(1, MOD_LCTL|MOD_LSFT) for a code in the LM range, else null. */
export function layerModString(keynum: number): string | null {
    const range = layerModRange();
    if (!range || keynum <= range.first || keynum > range.last) return null;
    const layer = ((keynum - range.first) >> 5) & 0xf;
    const mods = (keynum - range.first) & 0x1f;
    if (mods & RIGHT_BIT && !(mods & 0xf)) return null;
    const side = mods & RIGHT_BIT ? "R" : "L";
    const parts = NAMES.filter((_, i) => mods & (1 << i)).map((n) => `MOD_${side}${n}`);
    return `LM(${layer}, ${parts.length ? parts.join("|") : "0"})`;
}

/** The code for LM(layer, MOD_LCTL|...) text, else null. */
export function parseLayerMod(text: string): number | null {
    if (!layerModRange()) return null;
    const m = text.match(/^LM\(\s*(\d+)\s*,\s*([\w|\s]+?)\s*\)$/);
    if (!m) return null;
    const layer = Number(m[1]);
    if (layer > 0xf) return null;
    let mods = 0;
    let side: string | null = null;
    for (const part of m[2].split("|").map((p) => p.trim())) {
        if (part === "0") continue;
        const pm = part.match(/^MOD_([LR])(CTL|SFT|ALT|GUI)$/);
        if (!pm) return null;
        if (side && side !== pm[1]) return null;
        side = pm[1];
        mods |= 1 << NAMES.indexOf(pm[2] as (typeof NAMES)[number]);
    }
    if (side === "R") mods |= RIGHT_BIT;
    return layerModKeycode(layer, mods);
}
