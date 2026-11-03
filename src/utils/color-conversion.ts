/**
 * Color conversion utilities for layer light colors
 * Converts between hex, RGB, and HSV (0-255 range used by QMK/Svalboard)
 */

import { layerColors } from './colors';

/**
 * Convert hex color to HSV (0-255 range for QMK compatibility)
 */
export function hexToHsv(hex: string): { hue: number; sat: number; val: number } {
    // Remove # if present
    hex = hex.replace(/^#/, '');

    // Parse RGB
    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;

    // Calculate hue (0-360)
    let h = 0;
    if (delta !== 0) {
        if (max === r) {
            h = 60 * (((g - b) / delta) % 6);
        } else if (max === g) {
            h = 60 * ((b - r) / delta + 2);
        } else {
            h = 60 * ((r - g) / delta + 4);
        }
    }
    if (h < 0) h += 360;

    // Calculate saturation (0-1)
    const s = max === 0 ? 0 : delta / max;

    // Value is just max (0-1)
    const v = max;

    // Convert to 0-255 range (QMK uses 0-255 for all HSV components)
    return {
        hue: Math.round((h / 360) * 255),
        sat: Math.round(s * 255),
        val: Math.round(v * 255),
    };
}

/**
 * Convert HSV (0-255 range) to hex color
 */
export function hsvToHex(hue: number, sat: number, val: number): string {
    // Convert from 0-255 to normalized values
    const h = (hue / 255) * 360;
    const s = sat / 255;
    const v = val / 255;

    const c = v * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = v - c;

    let r = 0, g = 0, b = 0;

    if (h >= 0 && h < 60) {
        r = c; g = x; b = 0;
    } else if (h >= 60 && h < 120) {
        r = x; g = c; b = 0;
    } else if (h >= 120 && h < 180) {
        r = 0; g = c; b = x;
    } else if (h >= 180 && h < 240) {
        r = 0; g = x; b = c;
    } else if (h >= 240 && h < 300) {
        r = x; g = 0; b = c;
    } else {
        r = c; g = 0; b = x;
    }

    const toHex = (n: number) => {
        const hex = Math.round((n + m) * 255).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    };

    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Pre-computed HSV values for KeyBard preset colors
 * Built from the led property in layerColors for hand-tuned LED values
 */
export const presetColorHsv: Record<string, { hue: number; sat: number; val: number }> =
    Object.fromEntries(
        layerColors.map(color => [color.name, color.led])
    );

/**
 * Find the closest preset color name for a given HSV value
 * Always returns the closest match (never null)
 */
export function getClosestPresetColor(hue: number, sat: number, val: number): string {
    let closestColor: string = "green"; // Default fallback
    let minDistance = Infinity;

    for (const [name, preset] of Object.entries(presetColorHsv)) {
        // Calculate distance in HSV space
        // Hue wraps around, so we need to handle that
        let hueDiff = Math.abs(preset.hue - hue);
        if (hueDiff > 127) hueDiff = 255 - hueDiff; // Handle wrap-around

        const satDiff = Math.abs(preset.sat - sat);
        const valDiff = Math.abs(preset.val - val);

        // Weight hue more heavily since it's the most perceptually important
        const distance = hueDiff * 2 + satDiff + valDiff;

        if (distance < minDistance) {
            minDistance = distance;
            closestColor = name;
        }
    }

    return closestColor;
}

/**
 * Get the hex color for a preset color name
 */
export function getPresetHex(colorName: string): string {
    const color = layerColors.find(c => c.name === colorName);
    return color?.hex || '#099e7c'; // Default to green
}

/**
 * Get LED HSV for a preset color name (hand-tuned values for hardware)
 */
export function getPresetHsv(colorName: string): { hue: number; sat: number; val: number } {
    const color = layerColors.find(c => c.name === colorName);
    return color?.led || layerColors[0].led; // Default to green
}
