import { layerColors } from "@/utils/colors";

// The Color field's swatches (docs/practice/spec.md N-15): Keybard's brand colors plus white and black,
// each with an accessible name of the color and its hex. They are values the user picks, not chrome.

export interface ColorSwatch {
    hex: string;
    /** "Brand green, #099e7c" */
    name: string;
}

const title = (name: string) => name.replace("-", " ");

export const COLOR_FIELD_SWATCHES: ColorSwatch[] = [
    ...layerColors.filter((c) => c.name !== "white").map((c) => ({ hex: c.hex.toLowerCase(), name: `Brand ${title(c.name)}, ${c.hex.toLowerCase()}` })),
    { hex: "#ffffff", name: "White, #ffffff" },
    { hex: "#000000", name: "Black, #000000" },
];

/** The overlay's color format (core.ts `preferences`). */
export const HEX_COLOR = /^#[\da-f]{6}$/i;
