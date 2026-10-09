// Text and color helpers shared by Practice's pages and panels.
import { getColorByName, layerColors } from "@/utils/colors";
import type { KeyboardInfo } from "@/types/keyboard.types";
import { placeOf, type KeyPlace } from "../keymap/geometry";
import type { Path, Prereq } from "../keymap/resolver";
import type { SpeedUnit } from "../state/settings";
import type { LessonType } from "../types";

/** Lesson type names, as the type control shows them (§5.2). */
export const LESSON_TYPE_LABELS: Record<LessonType, string> = { guided: "Guided", drill: "Drill", words: "Words", custom: "Custom" };

/** A stored lesson type id as its name; an unknown id as it is. */
export function lessonTypeLabel(type: string): string {
    return (LESSON_TYPE_LABELS as Record<string, string>)[type] ?? type;
}

/** A speed in CPM shown in the chosen unit: WPM with one decimal, CPM whole. */
export function formatSpeed(cpm: number | null | undefined, unit: SpeedUnit): string {
    if (cpm == null || !Number.isFinite(cpm)) return "—";
    return unit === "wpm" ? (cpm / 5).toFixed(1) : String(Math.round(cpm));
}

export function speedValue(cpm: number, unit: SpeedUnit): number {
    return unit === "wpm" ? cpm / 5 : cpm;
}

/** "31.6 words per minute" for screen readers and accessible names. */
export function spokenSpeed(cpm: number | null | undefined, unit: SpeedUnit): string {
    if (cpm == null || !Number.isFinite(cpm)) return "no speed yet";
    return `${formatSpeed(cpm, unit)} ${unit === "wpm" ? "words" : "characters"} per minute`;
}

export function formatPercent(fraction: number | null | undefined, digits = 0): string {
    if (fraction == null || !Number.isFinite(fraction)) return "—";
    return (fraction * 100).toFixed(digits);
}

/** "12 min", "1 h 5 min". */
export function formatDuration(ms: number): string {
    const minutes = Math.round(ms / 60_000);
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    return minutes % 60 ? `${hours} h ${minutes % 60} min` : `${hours} h`;
}

export function formatDate(ts: number): string {
    return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function formatDateTime(ts: number): string {
    return new Date(ts).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/** A character as Practice shows it: a visible stand-in for whitespace. */
export function charLabel(codePoint: number): string {
    if (codePoint === 0x20) return "Space";
    if (codePoint === 0x0a) return "Enter";
    if (codePoint === 0x09) return "Tab";
    return String.fromCodePoint(codePoint);
}

const FINGER_NAMES = { thumb: "thumb", index: "index", middle: "middle", ring: "ring", pinky: "pinky" } as const;

/** "L-pinky N", "R-thumb T5". */
export function placeName(place: KeyPlace | null): string {
    if (!place) return "unknown key";
    return `${place.hand === "left" ? "L" : "R"}-${FINGER_NAMES[place.finger]} ${place.key}`;
}

/** "left pinky north" for screen readers. */
export function spokenPlace(place: KeyPlace | null): string {
    if (!place) return "unknown key";
    const directions: Record<string, string> = { C: "center", N: "north", S: "south", E: "east", W: "west", "2S": "double south" };
    return `${place.hand} ${place.finger} ${directions[place.key] ?? place.key}`;
}

function prereqChip(p: Prereq, cols: number): string {
    const where = placeName(placeOf(p.index, cols));
    if (p.kind === "shift") return `shift ${where}`;
    if (p.kind === "oneshot") return `tap ${where}`;
    return `hold ${where}`;
}

/** P5 header chips (§5.7): `Layer 1` `hold R-thumb T5` `L-pinky N`. */
export function pathChips(path: Path, cols: number): string[] {
    return [`Layer ${path.layer}`, ...path.prereqs.map((p) => prereqChip(p, cols)), placeName(placeOf(path.index, cols))];
}

/** "or hold L-thumb T1" for an alternative path's prerequisites. */
export function alternativeText(path: Path, primary: Path, cols: number): string {
    const extra = path.prereqs.filter((p) => !primary.prereqs.some((q) => q.index === p.index));
    if (path.index !== primary.index) return `or ${[...path.prereqs.map((p) => prereqChip(p, cols)), placeName(placeOf(path.index, cols))].join(" + ")}`;
    return extra.length ? `or ${extra.map((p) => prereqChip(p, cols)).join(" + ")}` : "";
}

/** Layer color name for a layer (`cosmetic.layer_colors`), as Key.tsx takes it. */
export function layerColorName(keyboard: Pick<KeyboardInfo, "cosmetic"> | null | undefined, layer: number): string {
    return keyboard?.cosmetic?.layer_colors?.[layer] || "primary";
}

/** The layer color as a hex value, for data drawn with inline styles (underlines, cluster backdrops). */
export function layerColorHex(keyboard: Pick<KeyboardInfo, "cosmetic"> | null | undefined, layer: number): string {
    return getColorByName(layerColorName(keyboard, layer))?.hex ?? layerColors[0].hex;
}

/** A hex color with alpha, for soft data backdrops. */
export function withAlpha(hex: string, alpha: number): string {
    const value = hex.replace("#", "");
    const n = parseInt(value.length === 3 ? value.split("").map((c) => c + c).join("") : value, 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/** Layer name from `cosmetic.layer`, else "Layer N". */
export function layerName(keyboard: Pick<KeyboardInfo, "cosmetic"> | null | undefined, layer: number): string {
    const name = keyboard?.cosmetic?.layer?.[layer];
    return name && name.trim() ? name : `Layer ${layer}`;
}
