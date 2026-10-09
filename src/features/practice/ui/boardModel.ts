// What every key of the Practice board shows (spec §5.2 "Board", §6.7 hints).
// Pure, so the hint rules are tested without rendering Key.tsx.
//
// - Lesson letters on the displayed layer: included (layer face) or locked (dashed).
// - Every other key: light gray with a dimmed legend.
// - Next key: ink ring. When the next character lives on another layer than the
//   one displayed, the ringed key shows that character on its layer's face.
// - Prerequisites of the next character (layer hold, Shift): ink ring and step
//   badges 1…n, the target n+1; an alternative path's prerequisite gets the
//   dashed outline instead of the ring.
// - Cluster hint: a soft backdrop in the target layer's color behind the next
//   key's cluster (finger keys share a matrix row).
import { SVALBOARD_LAYOUT } from "@/constants/svalboard-layout";
import type { KeyboardInfo, KeyContent } from "@/types/keyboard.types";
import { getLabelForKeycode } from "@/components/Keyboards/layouts";
import { getKeyLabel, getKeycodeName } from "@/utils/layers";
import { type KeymapResolution, type Path, resolveBinding } from "../keymap/resolver";
import type { Hints } from "../state/settings";
import { layerColorHex, layerColorName } from "./format";

export type BoardKeyState = "included" | "locked" | "other";

export interface BoardKeyView {
    index: number;
    row: number;
    col: number;
    x: number;
    y: number;
    w: number;
    h: number;
    keycode: string;
    label: string;
    keyContents?: KeyContent;
    /** Key.tsx layer color name for the face. */
    layerColor: string;
    state: BoardKeyState;
    /** Ink ring: the next key or a prerequisite on the primary path. */
    ring: boolean;
    /** Dashed ink outline: a prerequisite only on an alternative path. */
    alternative: boolean;
    /** Step badge number, or null. */
    step: number | null;
    /** This key's cluster gets the backdrop (and pulses with a new key). */
    inCluster: boolean;
    /** The character this key types on the displayed layer, if any. */
    char: number | null;
}

export interface BoardView {
    keys: BoardKeyView[];
    /** Board size in key units. */
    width: number;
    height: number;
    displayedLayer: number;
    /** Cluster backdrop in key units, with its color, or null. */
    cluster: { x: number; y: number; w: number; h: number; color: string } | null;
}

export interface BoardInput {
    keyboard: Pick<KeyboardInfo, "keymap" | "keylayout" | "rows" | "cols" | "cosmetic"> & Partial<KeyboardInfo>;
    resolution: KeymapResolution | null;
    layoutId: string;
    defaultLayer: number;
    /** Layer shown; the next character's layer in Keymap-only mode once typing started (§5.2). */
    displayedLayer: number;
    /** Live · USB: the effective layer mask, for transparency through every active layer. Else default + displayed. */
    displayedMask?: number | null;
    included: ReadonlySet<number>;
    locked: ReadonlySet<number>;
    /** The next character, or null (no lesson, or hints off). */
    next: number | null;
    hints: Hints;
    legends: boolean;
    /** No lesson (empty and error wells): every key light gray, no ring (§5.2). */
    noLesson?: boolean;
}

type LayoutEntry = { x: number; y: number; w: number; h: number; row?: number; col?: number };

export function boardLayout(keyboard: Pick<KeyboardInfo, "keylayout" | "cols">): { index: number; row: number; col: number; layout: LayoutEntry }[] {
    const layout: Record<string, LayoutEntry> = keyboard.keylayout && Object.keys(keyboard.keylayout).length ? keyboard.keylayout : SVALBOARD_LAYOUT;
    const cols = keyboard.cols || 6;
    return Object.entries(layout).flatMap(([id, raw]) => {
        const pos = Number(id);
        if (![raw.x, raw.y, raw.w ?? 1, raw.h ?? 1].every((v) => Number.isFinite(Number(v)))) return [];
        const row = typeof raw.row === "number" ? raw.row : Math.floor(pos / cols);
        const col = typeof raw.col === "number" ? raw.col : pos % cols;
        return [{ index: row * cols + col, row, col, layout: { x: Number(raw.x), y: Number(raw.y), w: Number(raw.w ?? 1), h: Number(raw.h ?? 1) } }];
    });
}

/** Board size in key units. */
export function boardSize(keyboard: Pick<KeyboardInfo, "keylayout" | "cols">): { width: number; height: number } {
    let width = 0, height = 0;
    for (const { layout } of boardLayout(keyboard)) {
        width = Math.max(width, layout.x + layout.w);
        height = Math.max(height, layout.y + layout.h);
    }
    return { width, height };
}

function charOn(resolution: KeymapResolution | null, index: number, layer: number): number | null {
    if (!resolution) return null;
    return resolution.charAt(index, layer, "n") ?? resolution.charAt(index, layer, "f");
}

export function boardView(input: BoardInput): BoardView {
    const { keyboard, resolution, layoutId, defaultLayer, included, locked, hints, legends } = input;
    const keymap = keyboard.keymap ?? [];
    const next = input.noLesson ? null : input.next;
    const primary: Path | null = next != null && resolution ? resolution.primary(next) : null;
    const showNext = hints !== "off" && primary != null;
    const displayed = input.displayedLayer;
    const mask = input.displayedMask != null ? input.displayedMask >>> 0 : ((1 << defaultLayer) | (1 << displayed)) >>> 0;

    // Steps: primary prerequisites 1…n, the target n+1 (only when there are prerequisites).
    const steps = new Map<number, number>();
    const alternatives = new Set<number>();
    if (showNext && primary) {
        primary.prereqs.forEach((p, i) => steps.set(p.index, i + 1));
        // A combo's keys are all the target (M3): each gets the target's ring and step.
        if (primary.prereqs.length) for (const t of primary.targets) steps.set(t, primary.prereqs.length + 1);
        for (const path of resolution!.pathsOf(primary.char).slice(1)) {
            if (path.index !== primary.index) continue;
            for (const p of path.prereqs) if (!steps.has(p.index)) alternatives.add(p.index);
        }
    }
    const targetColor = primary ? layerColorName(keyboard, primary.layer) : "primary";

    let width = 0, height = 0;
    const keys: BoardKeyView[] = boardLayout(keyboard).map(({ index, row, col, layout }) => {
        width = Math.max(width, layout.x + layout.w);
        height = Math.max(height, layout.y + layout.h);
        const { code, layer } = resolveBinding(keymap, index, mask);
        const char = charOn(resolution, index, layer);
        const isTarget = showNext && primary!.targets.includes(index);
        const isPrereq = showNext && primary!.prereqs.some((p) => p.index === index);
        const isAlternative = alternatives.has(index);
        // The ringed target shows the character it will type, on its layer's face (§5.2).
        // A combo's keys keep their own legends: none of them types the character alone.
        const showsTarget = isTarget && primary!.targets.length === 1 && (layer !== primary!.layer || char !== primary!.char);
        let keycode = "", label = "", keyContents: KeyContent | undefined = { type: "text", str: "" };
        if (legends) {
            if (showsTarget) {
                label = String.fromCodePoint(primary!.char);
                keyContents = undefined;
            } else {
                keycode = getKeycodeName(code);
                const fallback = getKeyLabel(keyboard as KeyboardInfo, code);
                label = getLabelForKeycode(keycode, layoutId) || fallback.label;
                keyContents = fallback.keyContents;
            }
        }
        const lessonChar = showsTarget ? primary!.char : char;
        const state: BoardKeyState = input.noLesson || lessonChar == null ? "other"
            : included.has(lessonChar) || (isTarget && !locked.has(lessonChar)) ? "included"
            : locked.has(lessonChar) ? "locked" : "other";
        const layerColor = showsTarget || isPrereq || isAlternative ? targetColor : layerColorName(keyboard, layer);
        return {
            index, row, col, ...layout, keycode, label, keyContents, layerColor,
            state: isPrereq || isAlternative ? "included" : state,
            ring: isTarget || isPrereq,
            alternative: isAlternative,
            step: steps.get(index) ?? (isAlternative ? 1 : null),
            inCluster: false,
            char: lessonChar,
        };
    });

    let cluster: BoardView["cluster"] = null;
    if (showNext && hints === "next-cluster") {
        const target = keys.find((k) => k.index === primary!.index);
        if (target) {
            const members = keys.filter((k) => k.row === target.row);
            for (const k of members) k.inCluster = true;
            const pad = 0.12;
            const x = Math.min(...members.map((k) => k.x)) - pad;
            const y = Math.min(...members.map((k) => k.y)) - pad;
            cluster = {
                x, y,
                w: Math.max(...members.map((k) => k.x + k.w)) + pad - x,
                h: Math.max(...members.map((k) => k.y + k.h)) + pad - y,
                color: layerColorHex(keyboard, primary!.layer),
            };
        }
    }
    return { keys, width, height, displayedLayer: displayed, cluster };
}

/** The layer the board shows (§5.2): Keymap only, the next character's layer once typing started; else the base. */
export function displayedLayerFor(resolution: KeymapResolution | null, next: number | null, started: boolean, defaultLayer: number): number {
    if (!started || next == null || !resolution) return defaultLayer;
    return resolution.primary(next)?.layer ?? defaultLayer;
}
