/**
 * Fitting a key tile's label into its tile.
 *
 * A tile's label used to be one centered flex item. A word wider than the tile could
 * not wrap (overflow-wrap does not lower a flex item's min-content width), so the item
 * grew past both edges and the tile's overflow:hidden cut both ends off: "Repeat" read
 * "EPEA", "Leader" read "EADE".
 *
 * The plan, tried in order, stopping at the first that fits:
 *   1. the full name at the tile's normal size, wrapped only between words;
 *   2. the full name, shrinking half a pixel at a time down to the readable minimum,
 *      using as many lines as the tile's height holds;
 *   3. a curated short name (SHORT_TILE_LABELS), the same way;
 *   4. only if even that fails, the smallest size with the name broken inside a word.
 * Whatever is drawn, the tile's tooltip and accessible name carry the full name.
 */

export type TileSize = "default" | "medium" | "small";

/** Smallest legend size, in px: below this a semibold capital label is not readable. One floor
 *  for every tile size: readability is a property of the text, not of the tile. */
export const TILE_LABEL_MIN_PX: Record<TileSize, number> = { default: 6.5, medium: 6.5, small: 6.5 };

/** Line height of a fitted label, as a multiple of its font size. */
export const TILE_LABEL_LINE_HEIGHT = 1.1;

/** The most lines a label may use, per tile size. */
export const TILE_LABEL_MAX_LINES: Record<TileSize, number> = { default: 4, medium: 3, small: 3 };

/**
 * Short names for the labels too long for a tile even on several lines at the readable
 * minimum (Settings > Key size: Small, 30px tiles, unless noted). Keyed by keycode, and used
 * only when the full name cannot fit: each word of a label must fit the tile's width, and
 * at 6.5px a 30px tile holds about six capitals. The full name stays in the tooltip.
 */
export const SHORT_TILE_LABELS: Readonly<Record<string, string>> = {
    // Media: "Browser" is seven capitals. The group and tooltip say which program.
    KC_WBAK: "Back",
    KC_WFWD: "Fwd",
    KC_WFAV: "Favs",
    KC_WHOM: "Home",
    KC_WREF: "Reload",
    KC_WSCH: "Search",
    KC_WSTP: "Stop",
    // "(macOS)" is seven characters.
    KC_MFFD: "Next Track mac",
    KC_MRWD: "Prev Track mac",
    // Board and firmware: ten capitals (also too wide for Medium and Normal tiles).
    RESET: "Boot",
    SV_OUTPUT_STATUS: "Status",
    // Magic keys: "Unswap" is six wide capitals; QMK's own word for it is "norm".
    CL_NORM: "Norm Ctrl Caps",
    EC_NORM: "Norm Esc Caps",
    AG_NORM: "Norm Alt GUI",
    CG_NORM: "Norm Ctl GUI",
    BS_NORM: "Norm \\ BS",
    // Overrides: "Overrides" is nine capitals.
    KO_TOGG: "Ovrd Toggle",
    KO_ON: "Ovrd On",
    KO_OFF: "Ovrd Off",
    // System extras.
    KC_CONTROL_PANEL: "Ctrl Panel",
    KC_MISSION_CONTROL: "Msn Ctrl",
    KC_LAUNCHPAD: "Lnch Pad",
    KC_ASSISTANT: "Assist",
    // Standard Keys, More keys: "Locking" is seven capitals.
    KC_LCAP: "Lock Caps",
    KC_LNUM: "Lock Num",
    KC_LSCR: "Lock Scroll",
    // Svalboard pointing keys.
    SV_NATURAL_SCROLL_TOGGLE: "Nat Scroll",
    SV_TOGGLE_AUTOMOUSE: "AM Toggle",
};

export interface TileLabelPlan {
    lines: string[];
    fontPx: number;
    /** The short name was drawn instead of the full name. */
    short: boolean;
    /** Nothing fit whole: a word is broken (last resort; the browser check fails on it). */
    broken: boolean;
}

export interface TileLabelBox {
    /** Room for text, px (the tile's inner width less padding). */
    widthPx: number;
    /** Room for lines, px. */
    heightPx: number;
}

export type MeasureText = (text: string, fontPx: number) => number;

/**
 * The words of a label. Spaces and line breaks separate words; a hyphen or slash
 * inside a word may also end a line ("Auto-|shift", "On/|Off"), and stays with the
 * part before it.
 */
export function tileLabelWords(label: string): { text: string; joinNext: boolean }[] {
    const words: { text: string; joinNext: boolean }[] = [];
    for (const chunk of label.split(/\s+/).filter(Boolean)) {
        const parts = chunk.split(/(?<=[\p{L}\p{N}][-/])(?=[\p{L}\p{N}])/u);
        parts.forEach((p, i) => words.push({ text: p, joinNext: i < parts.length - 1 }));
    }
    return words;
}

/** Greedy wrap at word boundaries; null when one word alone is wider than the room. */
function wrap(words: { text: string; joinNext: boolean }[], fontPx: number, widthPx: number, measure: MeasureText): string[] | null {
    const lines: string[] = [];
    let line = "";
    let joined = false; // the previous word joins this one without a space
    for (const w of words) {
        if (measure(w.text, fontPx) > widthPx) return null;
        const candidate = line === "" ? w.text : line + (joined ? "" : " ") + w.text;
        if (line === "" || measure(candidate, fontPx) <= widthPx) {
            line = candidate;
        } else {
            lines.push(line);
            line = w.text;
        }
        joined = w.joinNext;
    }
    if (line !== "") lines.push(line);
    return lines;
}

function sizes(nominalPx: number, minPx: number): number[] {
    const out: number[] = [];
    for (let px = nominalPx; px >= minPx - 1e-9; px -= 0.5) out.push(Math.round(px * 2) / 2);
    if (out.length === 0) out.push(nominalPx);
    return out;
}

function fit(label: string, box: TileLabelBox, nominalPx: number, minPx: number, maxLines: number, measure: MeasureText): { lines: string[]; fontPx: number } | null {
    const words = tileLabelWords(label);
    if (words.length === 0) return { lines: [], fontPx: nominalPx };
    for (const px of sizes(nominalPx, minPx)) {
        const lines = wrap(words, px, box.widthPx, measure);
        if (!lines) continue;
        const roomLines = Math.max(1, Math.floor((box.heightPx + 0.01) / (px * TILE_LABEL_LINE_HEIGHT)));
        if (lines.length <= Math.min(maxLines, roomLines)) return { lines, fontPx: px };
    }
    return null;
}

/** Break characters onto lines at the given size (the last resort). */
function breakChars(label: string, fontPx: number, widthPx: number, measure: MeasureText): string[] {
    const lines: string[] = [];
    let line = "";
    for (const ch of Array.from(label.replace(/\s+/g, " ").trim())) {
        if (line !== "" && measure(line + ch, fontPx) > widthPx) {
            lines.push(line.trim());
            line = ch === " " ? "" : ch;
        } else {
            line += ch;
        }
    }
    if (line.trim() !== "") lines.push(line.trim());
    return lines;
}

export interface PlanTileLabelOptions {
    size: TileSize;
    /** The size the label is drawn at when it fits as it is. */
    nominalPx: number;
    measure: MeasureText;
    /** A curated short name, tried only when the full name cannot fit. */
    shortLabel?: string;
}

export function planTileLabel(label: string, box: TileLabelBox, opts: PlanTileLabelOptions): TileLabelPlan {
    const { size, measure } = opts;
    const minPx = Math.min(TILE_LABEL_MIN_PX[size], opts.nominalPx);
    const maxLines = TILE_LABEL_MAX_LINES[size];
    const full = fit(label, box, opts.nominalPx, minPx, maxLines, measure);
    if (full) return { ...full, short: false, broken: false };
    if (opts.shortLabel && opts.shortLabel !== label) {
        const short = fit(opts.shortLabel, box, opts.nominalPx, minPx, maxLines, measure);
        if (short) return { ...short, short: true, broken: false };
    }
    const text = opts.shortLabel ?? label;
    return { lines: breakChars(text, minPx, box.widthPx, measure), fontPx: minPx, short: !!opts.shortLabel, broken: true };
}

/** The short name for a keycode, if it has one. */
export function shortTileLabel(keycode: string): string | undefined {
    return SHORT_TILE_LABELS[keycode];
}

/**
 * A text measurer for the given CSS font (family and weight), with a cache. Canvas when
 * there is one; otherwise (tests) an estimate of 0.62 em per character.
 */
export function canvasMeasurer(fontFamily: string, fontWeight: string, upper: boolean): MeasureText {
    let ctx: CanvasRenderingContext2D | null = null;
    try {
        if (typeof document !== "undefined") ctx = document.createElement("canvas").getContext("2d");
    } catch {
        ctx = null;
    }
    const cache = new Map<string, number>();
    return (text: string, fontPx: number) => {
        const t = upper ? text.toUpperCase() : text;
        const key = `${fontPx}|${t}`;
        const hit = cache.get(key);
        if (hit !== undefined) return hit;
        let w: number;
        if (ctx) {
            ctx.font = `${fontWeight} ${fontPx}px ${fontFamily}`;
            w = ctx.measureText(t).width;
        } else {
            w = Array.from(t).length * fontPx * 0.62;
        }
        cache.set(key, w);
        return w;
    };
}

/**
 * Turns a raw keycode name ("QK_MAGIC_TOGGLE_NKRO", "KC_MS_BTN6") into the given
 * readable name: such names are what the keycode table holds for keys it has no legend for.
 */
export function readableKeyLabel(str: string | undefined, fallback: string): string {
    if (!str) return fallback;
    return /^[A-Z][A-Z0-9]*_[A-Z0-9_]+$/.test(str) ? fallback : str;
}
