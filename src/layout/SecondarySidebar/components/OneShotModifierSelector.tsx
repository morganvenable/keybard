import { FC } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface Props {
    value: number;
    onChange: (newValue: number) => void;
}

// Same bit layout as OverrideModifierSelector
const MOD_BITS = {
    LCTRL: 1,
    LSHIFT: 2,
    LALT: 4,
    LGUI: 8,
    RCTRL: 16,
    RSHIFT: 32,
    RALT: 64,
    RGUI: 128,
};

const MOD_GROUPS = [
    { label: "SHIFT", lBit: MOD_BITS.LSHIFT, rBit: MOD_BITS.RSHIFT },
    { label: "CTRL", lBit: MOD_BITS.LCTRL, rBit: MOD_BITS.RCTRL },
    { label: "ALT", lBit: MOD_BITS.LALT, rBit: MOD_BITS.RALT },
    { label: "GUI", lBit: MOD_BITS.LGUI, rBit: MOD_BITS.RGUI },
] as const;

/**
 * OneShotModifierSelector - Modifier selector with expandable L/R buttons
 *
 * Based on OverrideModifierSelector but adapted for One-Shot/Mod-Tap use.
 * When you click a modifier, it expands to show L/R toggle buttons underneath.
 */
const OneShotModifierSelector: FC<Props> = ({ value, onChange }) => {
    const isNone = value === 0;

    const handleNoneClick = () => {
        onChange(0);
    };

    const toggleGroup = (lBit: number, rBit: number) => {
        let newValue = value;
        const lActive = (value & lBit) !== 0;
        const rActive = (value & rBit) !== 0;

        if (lActive || rActive) {
            // Turn off both
            newValue &= ~lBit;
            newValue &= ~rBit;
        } else {
            // Turn on left by default
            newValue |= lBit;
        }
        onChange(newValue);
    };

    // Toggle between L and R for a modifier group
    const toggleSide = (lBit: number, rBit: number) => {
        let newValue = value;
        const lActive = (value & lBit) !== 0;

        if (lActive) {
            // Switch from L to R
            newValue &= ~lBit;
            newValue |= rBit;
        } else {
            // Switch from R to L
            newValue &= ~rBit;
            newValue |= lBit;
        }
        onChange(newValue);
    };

    return (
        <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-slate-500 dark:text-neutral-400">Modifiers</span>
            <div className="flex flex-row items-start gap-1.5 min-h-[58px]">
                {/* NONE Button */}
                <Button
                    type="button"
                    variant={isNone ? "default" : "secondary"}
                    className={cn(
                        "h-8 px-3 rounded-md font-medium transition-colors border-none text-xs",
                        isNone
                            ? "bg-kb-active text-kb-active-fg shadow-none"
                            : "bg-kb-gray-medium text-slate-700 dark:text-neutral-200 hover:bg-kb-surface dark:hover:bg-neutral-700 hover:text-kb-ink dark:hover:text-kb-ink"
                    )}
                    onClick={handleNoneClick}
                >
                    NONE
                </Button>

                {/* Modifier Groups */}
                {MOD_GROUPS.map((group) => {
                    const lActive = (value & group.lBit) !== 0;
                    const rActive = (value & group.rBit) !== 0;
                    const anyActive = lActive || rActive;
                    const isRight = rActive && !lActive;

                    return (
                        <div
                            key={group.label}
                            className={cn(
                                "flex flex-col items-center rounded-md overflow-hidden min-w-[60px] transition-[height] duration-300 ease-in-out",
                                anyActive
                                    ? "bg-kb-active text-kb-active-fg h-[58px]"
                                    : "bg-kb-gray-medium text-slate-700 dark:text-neutral-200 hover:bg-kb-surface dark:hover:bg-neutral-700 hover:text-kb-ink dark:hover:text-kb-ink h-8 delay-150"
                            )}
                        >
                            {/* Main Label */}
                            <button
                                type="button"
                                className="w-full h-8 flex items-center justify-center text-xs font-medium shrink-0 outline-none px-2"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    toggleGroup(group.lBit, group.rBit);
                                }}
                            >
                                {group.label}
                            </button>

                            {/* L/R Sliding Toggle Switch */}
                            <div className={cn(
                                "flex flex-row items-center justify-center w-full pb-1 transition-opacity duration-200",
                                anyActive ? "opacity-100 delay-150" : "opacity-0 pointer-events-none duration-100"
                            )}>
                                <button
                                    type="button"
                                    className="relative w-10 h-5 rounded-full bg-gray-600 dark:bg-neutral-500 dark:text-white flex items-center px-0.5 outline-none"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        toggleSide(group.lBit, group.rBit);
                                    }}
                                >
                                    {/* L and R labels */}
                                    <span className={cn(
                                        "absolute left-1 text-[8px] font-bold transition-opacity",
                                        isRight ? "opacity-50" : "opacity-0"
                                    )}>L</span>
                                    <span className={cn(
                                        "absolute right-1 text-[8px] font-bold transition-opacity",
                                        isRight ? "opacity-0" : "opacity-50"
                                    )}>R</span>
                                    {/* Sliding thumb */}
                                    <span className={cn(
                                        "w-4 h-4 rounded-full bg-white flex items-center justify-center text-[8px] font-bold text-black transition-transform duration-200",
                                        isRight ? "translate-x-5" : "translate-x-0"
                                    )}>
                                        {isRight ? "R" : "L"}
                                    </span>
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default OneShotModifierSelector;

/**
 * Convert bitmask to OSM keycode string
 */
export function bitmaskToOsmKeycode(mask: number): string | null {
    if (mask === 0) return null;

    const parts: string[] = [];

    // Check left modifiers
    if (mask & MOD_BITS.LCTRL) parts.push("MOD_LCTL");
    if (mask & MOD_BITS.LSHIFT) parts.push("MOD_LSFT");
    if (mask & MOD_BITS.LALT) parts.push("MOD_LALT");
    if (mask & MOD_BITS.LGUI) parts.push("MOD_LGUI");

    // Check right modifiers
    if (mask & MOD_BITS.RCTRL) parts.push("MOD_RCTL");
    if (mask & MOD_BITS.RSHIFT) parts.push("MOD_RSFT");
    if (mask & MOD_BITS.RALT) parts.push("MOD_RALT");
    if (mask & MOD_BITS.RGUI) parts.push("MOD_RGUI");

    if (parts.length === 0) return null;

    // Check for Meh/Hyper shortcuts
    const leftMeh = (mask & (MOD_BITS.LCTRL | MOD_BITS.LSHIFT | MOD_BITS.LALT)) === (MOD_BITS.LCTRL | MOD_BITS.LSHIFT | MOD_BITS.LALT);
    const leftHyper = leftMeh && (mask & MOD_BITS.LGUI);
    const rightMeh = (mask & (MOD_BITS.RCTRL | MOD_BITS.RSHIFT | MOD_BITS.RALT)) === (MOD_BITS.RCTRL | MOD_BITS.RSHIFT | MOD_BITS.RALT);
    const rightHyper = rightMeh && (mask & MOD_BITS.RGUI);

    // Only use shortcuts if all modifiers are on same side
    const hasLeft = mask & 0x0F;
    const hasRight = mask & 0xF0;

    if (hasLeft && !hasRight) {
        if (leftHyper) return "OSM(MOD_HYPR)";
        if (leftMeh && !(mask & MOD_BITS.LGUI)) return "OSM(MOD_MEH)";
    }
    if (hasRight && !hasLeft) {
        if (rightHyper) return "OSM(MOD_RCTL|MOD_RSFT|MOD_RALT|MOD_RGUI)";
        if (rightMeh && !(mask & MOD_BITS.RGUI)) return "OSM(MOD_RCTL|MOD_RSFT|MOD_RALT)";
    }

    return `OSM(${parts.join("|")})`;
}

/**
 * Convert bitmask to Mod-Tap keycode string
 */
export function bitmaskToModTapKeycode(mask: number): string | null {
    if (mask === 0) return null;

    const hasLeft = mask & 0x0F;
    const hasRight = mask & 0xF0;

    // Count active modifiers
    const lCtrl = (mask & MOD_BITS.LCTRL) !== 0;
    const lShift = (mask & MOD_BITS.LSHIFT) !== 0;
    const lAlt = (mask & MOD_BITS.LALT) !== 0;
    const lGui = (mask & MOD_BITS.LGUI) !== 0;
    const rCtrl = (mask & MOD_BITS.RCTRL) !== 0;
    const rShift = (mask & MOD_BITS.RSHIFT) !== 0;
    const rAlt = (mask & MOD_BITS.RALT) !== 0;
    const rGui = (mask & MOD_BITS.RGUI) !== 0;

    // For mod-tap, prefer single-side combinations
    if (hasLeft && !hasRight) {
        const count = [lCtrl, lShift, lAlt, lGui].filter(Boolean).length;

        if (count === 4) return "HYPR_T(kc)";
        if (count === 3 && !lGui) return "MEH_T(kc)";
        if (count === 1) {
            if (lCtrl) return "LCTL_T(kc)";
            if (lShift) return "LSFT_T(kc)";
            if (lAlt) return "LALT_T(kc)";
            if (lGui) return "LGUI_T(kc)";
        }
        if (count === 2) {
            if (lCtrl && lShift) return "C_S_T(kc)";
            if (lCtrl && lAlt) return "LCA_T(kc)";
            if (lCtrl && lGui) return "LCG_T(kc)";
            if (lShift && lAlt) return "LSA_T(kc)";
            if (lShift && lGui) return "SGUI_T(kc)";
            if (lAlt && lGui) return "LAG_T(kc)";
        }
        if (count === 3) {
            if (lCtrl && lShift && lGui) return "LCSG_T(kc)";
            if (lCtrl && lAlt && lGui) return "LCAG_T(kc)";
            if (lShift && lAlt && lGui) return "LSAG_T(kc)";
        }
    }

    if (hasRight && !hasLeft) {
        const count = [rCtrl, rShift, rAlt, rGui].filter(Boolean).length;

        if (count === 4) return "RHYP_T(kc)";
        if (count === 3 && !rGui) return "RMEH_T(kc)";
        if (count === 1) {
            if (rCtrl) return "RCTL_T(kc)";
            if (rShift) return "RSFT_T(kc)";
            if (rAlt) return "RALT_T(kc)";
            if (rGui) return "RGUI_T(kc)";
        }
        if (count === 2) {
            if (rCtrl && rShift) return "RCS_T(kc)";
            if (rCtrl && rAlt) return "RCA_T(kc)";
            if (rCtrl && rGui) return "RCG_T(kc)";
            if (rShift && rAlt) return "RSA_T(kc)";
            if (rShift && rGui) return "RSG_T(kc)";
            if (rAlt && rGui) return "RAG_T(kc)";
        }
        if (count === 3) {
            if (rCtrl && rShift && rGui) return "RCSG_T(kc)";
            if (rCtrl && rAlt && rGui) return "RCAG_T(kc)";
            if (rShift && rAlt && rGui) return "RSAG_T(kc)";
        }
    }

    // Mixed left/right - no standard mod-tap for this
    return null;
}

/**
 * Get short label for bitmask (e.g., "C+S" for Ctrl+Shift)
 */
export function bitmaskToLabel(mask: number): string {
    if (mask === 0) return "";

    const parts: string[] = [];
    const hasLeft = mask & 0x0F;
    const hasRight = mask & 0xF0;

    // Check for Hyper/Meh
    if (hasLeft && !hasRight) {
        if ((mask & 0x0F) === 0x0F) return "Hyper";
        if ((mask & 0x07) === 0x07 && !(mask & MOD_BITS.LGUI)) return "Meh";
    }
    if (hasRight && !hasLeft) {
        if ((mask & 0xF0) === 0xF0) return "R-Hyper";
        if ((mask & 0x70) === 0x70 && !(mask & MOD_BITS.RGUI)) return "R-Meh";
    }

    if (mask & MOD_BITS.LCTRL) parts.push("C");
    if (mask & MOD_BITS.RCTRL) parts.push("RC");
    if (mask & MOD_BITS.LSHIFT) parts.push("S");
    if (mask & MOD_BITS.RSHIFT) parts.push("RS");
    if (mask & MOD_BITS.LALT) parts.push("A");
    if (mask & MOD_BITS.RALT) parts.push("RA");
    if (mask & MOD_BITS.LGUI) parts.push("G");
    if (mask & MOD_BITS.RGUI) parts.push("RG");

    return parts.join("+");
}

export { MOD_BITS };
