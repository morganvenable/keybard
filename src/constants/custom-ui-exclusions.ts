/**
 * VIA3 Custom UI Menu Exclusions
 *
 * Menus listed here have custom UI implementations in KeyBard-NG
 * and should not be auto-generated from the keyboard definition.
 */

/**
 * Menu labels to exclude from auto-generation
 * These menus have dedicated custom implementations
 */
export const EXCLUDED_MENU_LABELS = [
    'Layer Colors',     // Uses existing layer color picker
    'Layer Lights',     // Alternative name for layer colors
    'Lighting',         // Covered by existing lighting controls
    'Pointing Devices', // Now a static sidebar item
    'Pointing Device',  // Singular variant - content rendered in unified PointingPanel
    'Power and scanning', // Firmware's idle and scan menu - rendered in Settings > Power and scanning
] as const;

/**
 * Check if a menu should be excluded from auto-generation
 */
export function isExcludedMenu(label: string | undefined): boolean {
    if (!label) return false;
    return EXCLUDED_MENU_LABELS.includes(label as typeof EXCLUDED_MENU_LABELS[number]);
}

/**
 * Get an icon name for a menu based on its label
 * Used for sidebar display
 */
export function getIconForMenu(label: string | undefined): string {
    if (!label) return 'settings';

    const labelLower = label.toLowerCase();

    if (labelLower.includes('pointing') || labelLower.includes('mouse') || labelLower.includes('trackball')) {
        return 'mouse';
    }
    if (labelLower.includes('light') || labelLower.includes('rgb') || labelLower.includes('led')) {
        return 'lightbulb';
    }
    if (labelLower.includes('audio') || labelLower.includes('sound')) {
        return 'volume';
    }
    if (labelLower.includes('display') || labelLower.includes('oled') || labelLower.includes('screen')) {
        return 'monitor';
    }
    if (labelLower.includes('power') || labelLower.includes('battery') || labelLower.includes('sleep')) {
        return 'battery';
    }

    return 'settings';
}
