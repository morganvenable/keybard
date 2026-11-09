import { Key } from "@/components/Key";
import { useKeyBinding } from "@/contexts/KeyBindingContext";
import { useLayer } from "@/contexts/LayerContext";
import { useLayoutSettings } from "@/contexts/LayoutSettingsContext";
import { useKeyboard } from "@/contexts/KeyboardContext";
import { hoverBackgroundClasses, hoverBorderClasses, hoverHeaderClasses } from "@/utils/colors";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Modifier, modifierOptions, applyModifiers } from "@/utils/modifierUtils";
import { getKeyContents } from "@/utils/keys";
import { KeyContent } from "@/types/keyboard.types";
import ModifierSideToggle from "@/components/ModifierSideToggle";
import { useModifierSide } from "@/hooks/useModifierSide";
import { pointingKeyDescription } from "@/constants/pointing-key-info";

interface Props {
    compact?: boolean;
    variant?: "small" | "medium" | "default";
    /** The bottom tray: each group is a column that keeps its width and scrolls sideways with the rest. */
    columns?: boolean;
    /** Only the AutoMouse keys, one row with no heading, for the AutoMouse section. */
    only?: "automouse";
}

const MouseKeysSection = ({ compact, variant: variantOverride, columns, only }: Props) => {
    const { assignKeycode } = useKeyBinding();
    const { keyboard } = useKeyboard();
    const { selectedLayer } = useLayer();
    const { keyVariant } = useLayoutSettings();
    const [activeModifiers, setActiveModifiers] = useState<Modifier[]>([]);
    const [modifierSide, setModifierSide] = useModifierSide();

    const layerColorName = keyboard?.cosmetic?.layer_colors?.[selectedLayer] || "primary";
    const hoverBorderColor = hoverBorderClasses[layerColorName] || hoverBorderClasses["primary"];
    const hoverBackgroundColor = hoverBackgroundClasses[layerColorName] || hoverBackgroundClasses["primary"];

    const hoverHeaderClass = hoverHeaderClasses[layerColorName] || hoverHeaderClasses["primary"];
    const effectiveVariant = variantOverride || (compact ? "small" : keyVariant);
    const keySizeClass = effectiveVariant === 'small' ? 'h-[30px] w-[30px]' : effectiveVariant === 'medium' ? 'h-[45px] w-[45px]' : 'h-[60px] w-[60px]';

    const handleModifierToggle = (mod: Modifier) => {
        if (activeModifiers.includes(mod)) {
            setActiveModifiers(activeModifiers.filter((m) => m !== mod));
        } else {
            setActiveModifiers([...activeModifiers, mod]);
        }
    };

    const handleClearModifiers = () => {
        setActiveModifiers([]);
    };

    // Row 1: Mouse 1-5 buttons
    const mouseButtons = [
        { keycode: "KC_BTN1", label: "Mouse 1" },
        { keycode: "KC_BTN2", label: "Mouse 2" },
        { keycode: "KC_BTN3", label: "Mouse 3" },
        { keycode: "KC_BTN4", label: "Mouse 4" },
        { keycode: "KC_BTN5", label: "Mouse 5" },
    ];

    // Sniper and Boost, as they always were: one row each, the momentary 2x, 3x, 5x then their toggles.
    // Toggle labels are "NxTG" (4 chars after the family word is stripped) so they stay at the
    // variant's native text size instead of falling into Key.tsx's long-label shrink/wrap rule,
    // which cropped "TOGGLE" at the small and medium key sizes. Matches the firmware shortName "Sniper\n2xTG".
    const sniperKeys = [
        { keycode: "SV_SNIPER_2", label: "Sniper 2x" },
        { keycode: "SV_SNIPER_3", label: "Sniper 3x" },
        { keycode: "SV_SNIPER_5", label: "Sniper 5x" },
        { keycode: "SV_SNIPER_2_TG", label: "Sniper 2xTG" },
        { keycode: "SV_SNIPER_3_TG", label: "Sniper 3xTG" },
        { keycode: "SV_SNIPER_5_TG", label: "Sniper 5xTG" },
    ];
    const boostKeys = [
        { keycode: "SV_BOOST_2", label: "Boost 2x" },
        { keycode: "SV_BOOST_3", label: "Boost 3x" },
        { keycode: "SV_BOOST_5", label: "Boost 5x" },
        { keycode: "SV_BOOST_2_TG", label: "Boost 2xTG" },
        { keycode: "SV_BOOST_3_TG", label: "Boost 3xTG" },
        { keycode: "SV_BOOST_5_TG", label: "Boost 5xTG" },
    ];

    // Each key below is offered unless the connected firmware has no such key. The labels match
    // the layout's (CUSTOM_KEYCODE_LABELS).
    const firmwareKeycodes = keyboard?.custom_keycodes;
    const firmwareHas = (name: string) => !firmwareKeycodes || firmwareKeycodes.some((ck) => ck.name === name);
    const optional = (keycode: string, label: string, fullName?: string) => (firmwareHas(keycode) ? [{ keycode, label, ...(fullName ? { fullName } : {}) }] : []);
    // Scroll: the scroll toggles, then Velocity Scroll (hold to scroll at a speed set by how far the
    // pointer moves) and its toggle. Natural Scroll and Axis Lock are settings under the hand cards,
    // and Drag Scroll is not offered; all three are hidden in custom-keycode-homes.ts.
    // Scroll is two sets. First the keys that act while held or until pressed again, kept in memory
    // only. Then the per-hand scroll toggles, which flip a saved setting and write it to the
    // keyboard's flash on every press (write_eeprom_kb), and which the firmware ignores while Auto
    // Mouse has the mouse layer on (BAD_KEYCODE_CONDITONAL in keymap_support.c).
    const scrollKeys = [
        ...optional("SV_SCROLL_TOGGLE", "Scroll Toggle"),
        ...optional("SV_VELOCITY_SCROLL", "Velocity Scroll"),
        ...optional("SV_VELOCITY_SCROLL_TOGGLE", "Velocity Scroll Toggle"),
    ];
    const savedScrollKeys = [
        ...optional("SV_LEFT_SCROLL_TOGGLE", "Left Scroll Toggle"),
        ...optional("SV_RIGHT_SCROLL_TOGGLE", "Right Scroll Toggle"),
    ];
    // TrackPoint: Fix Drift recalibrates a TrackPoint, the only module whose driver has a
    // recalibrate step. Offered on every board: keys are layout content, and modules change.
    const trackpointKeys = [
        ...optional("SV_RECALIBRATE_POINTER", "Fix Drift"),
    ];
    // AutoMouse: drawn inside the AutoMouse section, after its settings (only="automouse").
    const autoMouseKeys = [
        ...optional("SV_TOGGLE_AUTOMOUSE", "AutoMouse Toggle"),
        // Key.tsx drops "Mouse" and "Timer" from a label (the mouse and clock icons stand for them), which left
        // just "KEY": the tile reads "Layer Time" with the clock icon, and its name on hover is the full one.
        ...optional("SV_MH_CHANGE_TIMEOUTS", "Layer Time", "Mouse Key Timer"),
    ];
    // DPI, one pair per hand: the least used keys (the hand cards set DPI; Sniper and Boost change it
    // on the fly), so they come last.
    const dpiKeys = [
        ...optional("SV_LEFT_DPI_INC", "Left DPI +"),
        ...optional("SV_LEFT_DPI_DEC", "Left DPI -"),
        ...optional("SV_RIGHT_DPI_INC", "Right DPI +"),
        ...optional("SV_RIGHT_DPI_DEC", "Right DPI -"),
    ];

    // Every key row in this section MUST go through renderKey so it picks up the
    // same effectiveVariant / keySizeClass. Do not render <Key> directly in the
    // panels that embed this section (see CLAUDE.md: key sizing consistency).
    const renderKey = (k: { keycode: string; label: string; fullName?: string }, withModifiers: boolean = false) => {
        const finalKeycode = withModifiers ? applyModifiers(k.keycode, activeModifiers, false, modifierSide) : k.keycode;
        const keyContents = keyboard ? getKeyContents(keyboard, finalKeycode) : undefined;

        // Force label usage "Mouse 1" so getHeaderIcons sees "Mouse" and adds the icon
        // Key.tsx getCenterContent will strip "Mouse" and show "1"
        // Key.tsx shouldOverrideForInternational won't fire for "Mouse 1" (length > 1) so Shift badge stays
        return (
            <Key
                key={k.keycode}
                x={0}
                y={0}
                w={1}
                h={1}
                row={0}
                col={0}
                keycode={finalKeycode}
                label={k.label}
                fullName={k.fullName}
                description={pointingKeyDescription(k.keycode)}
                forceLabel={true}
                keyContents={keyContents as KeyContent | undefined}
                layerColor="sidebar"
                headerClassName={`bg-kb-sidebar-dark ${hoverHeaderClass}`}
                isRelative
                variant={effectiveVariant}
                className={keySizeClass}
                hoverBorderColor={hoverBorderColor}
                hoverBackgroundColor={hoverBackgroundColor}
                hoverLayerColor={layerColorName}
                onClick={() => assignKeycode(finalKeycode)}
                disableTooltip={true}
            />
        );
    };

    const title = (text: string) => (
        <span className={compact ? "text-[9px] font-bold text-slate-500 dark:text-neutral-400 uppercase" : "font-semibold text-lg text-kb-ink"}>{text}</span>
    );
    // One key group, every key in sight: the panel has no More keys rows, the least used group is last.
    const group = (name: string, keys: { keycode: string; label: string; fullName?: string }[]) => {
        if (!keys.length) return null;
        return (
            <div className={cn("flex flex-col gap-1", columns && "w-[15rem] shrink-0")} data-key-group={name}>
                {title(name)}
                <div className="flex flex-wrap gap-1">{keys.map((k) => renderKey(k, false))}</div>
            </div>
        );
    };

    if (only === "automouse") {
        if (!autoMouseKeys.length) return null;
        return <div className="flex flex-wrap gap-1" data-key-group="AutoMouse">{autoMouseKeys.map((k) => renderKey(k, false))}</div>;
    }

    // The Scroll group: the momentary and session keys, then the saved per-hand toggles under their
    // own heading and one note on where to put them.
    const scrollGroup = () => {
        if (!scrollKeys.length && !savedScrollKeys.length) return null;
        return (
            <div className={cn("flex flex-col gap-1", columns && "w-[15rem] shrink-0")} data-key-group="Scroll">
                {title("Scroll")}
                {scrollKeys.length > 0 && <div className="flex flex-wrap gap-1">{scrollKeys.map((k) => renderKey(k, false))}</div>}
                {savedScrollKeys.length > 0 && (
                    <div className={cn("flex flex-col gap-1", compact ? "pt-1" : "pt-2")} data-key-subgroup="saved">
                        <span className={compact ? "text-[9px] font-bold text-slate-500 dark:text-neutral-400 uppercase" : "text-sm font-semibold text-kb-ink"}>
                            Saved on the keyboard
                        </span>
                        <p className={cn("text-slate-500 dark:text-neutral-400", compact ? "text-[10px] leading-snug" : "text-xs")} data-saved-note>
                            Each press changes a setting saved in the keyboard's memory. Keep these keys off the mouse layer, where the keyboard ignores them, and away from spots you press often, since every press writes to its flash.
                        </p>
                        <div className="flex flex-wrap gap-1">{savedScrollKeys.map((k) => renderKey(k, false))}</div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className={columns ? "flex flex-row flex-nowrap items-start gap-4" : compact ? "flex min-w-0 flex-wrap items-start gap-4" : "flex min-w-0 flex-col gap-4"}>
            <div className={cn("flex flex-col gap-1", columns && "w-[15rem] shrink-0")} data-key-group="Mouse Buttons">
                <span className={compact ? "text-[9px] font-bold text-slate-500 dark:text-neutral-400 uppercase" : "font-semibold text-lg text-kb-ink"}>
                    Mouse Buttons
                </span>
                {/* Row 1: Mouse buttons */}
                <div className="flex flex-wrap gap-1">
                    {mouseButtons.map((k) => renderKey(k, true))}
                </div>
            </div>

            {/* Modifiers section */}
            <div className={cn("flex flex-col gap-2", columns && "w-[15rem] shrink-0")} data-key-group="Modifiers">
                <div className={compact ? "flex items-center gap-2" : "flex items-center gap-3"}>
                    <span className={compact ? "text-[9px] font-bold text-slate-500 dark:text-neutral-400 uppercase" : "font-semibold text-lg text-kb-ink"}>
                        Modifiers
                    </span>
                    <ModifierSideToggle side={modifierSide} onChange={setModifierSide} compact={compact} />
                </div>
                {compact ? (
                    // Compact modifier choices wrap with the available panel width.
                    <div className="flex flex-wrap gap-1">
                        <Button
                            type="button"
                            variant={activeModifiers.length === 0 ? "default" : "secondary"}
                            size="sm"
                            className={cn(
                                "rounded-md px-2 py-0.5 h-6 transition-all text-[10px] font-medium border-none",
                                activeModifiers.length === 0 ? "bg-kb-active text-kb-active-fg shadow-sm" : "bg-kb-gray-medium text-slate-700 dark:text-neutral-200 hover:bg-kb-surface dark:hover:bg-neutral-700"
                            )}
                            onClick={handleClearModifiers}
                            title="Clear modifiers"
                        >
                            None
                        </Button>
                        {modifierOptions.map((modifier) => {
                            const isActive = activeModifiers.includes(modifier);
                            return (
                                <Button
                                    key={modifier}
                                    type="button"
                                    variant={isActive ? "default" : "secondary"}
                                    size="sm"
                                    className={cn(
                                        "rounded-md px-2 py-0.5 h-6 transition-all text-[11px] font-medium border-none",
                                        isActive ? "bg-kb-active text-kb-active-fg shadow-sm" : "bg-kb-gray-medium text-slate-700 dark:text-neutral-200 hover:bg-kb-surface dark:hover:bg-neutral-700"
                                    )}
                                    onClick={() => handleModifierToggle(modifier)}
                                    title={modifier}
                                >
                                    {modifier.toUpperCase()}
                                </Button>
                            );
                        })}
                    </div>
                ) : (
                    // Standard Vertical Layout - Matches BasicKeyboards.tsx exactly
                    <div className="flex flex-wrap items-center gap-1">
                        <Button
                            type="button"
                            variant={activeModifiers.length === 0 ? "default" : "secondary"}
                            size="sm"
                            className={cn(
                                "rounded-md h-8 transition-all text-sm font-bold border-none w-[84px]",
                                activeModifiers.length === 0 ? "bg-kb-active text-kb-active-fg shadow-sm" : "bg-kb-gray-medium text-slate-700 dark:text-neutral-200 hover:bg-kb-surface dark:hover:bg-neutral-700"
                            )}
                            onClick={handleClearModifiers}
                            title="Clear modifiers"
                        >
                            None
                        </Button>
                        {modifierOptions.map((modifier) => {
                            const isActive = activeModifiers.includes(modifier);
                            return (
                                <Button
                                    key={modifier}
                                    type="button"
                                    variant={isActive ? "default" : "secondary"}
                                    size="sm"
                                    className={cn(
                                        "rounded-md h-8 transition-all text-sm font-bold border-none w-[84px]",
                                        isActive ? "bg-kb-active text-kb-active-fg shadow-sm" : "bg-kb-gray-medium text-slate-700 dark:text-neutral-200 hover:bg-kb-surface dark:hover:bg-neutral-700"
                                    )}
                                    onClick={() => handleModifierToggle(modifier)}
                                >
                                    {modifier.toUpperCase()}
                                </Button>
                            );
                        })}
                    </div>
                )}
            </div>

            {group("Sniper Keys", sniperKeys)}
            {group("Boost", boostKeys)}
            {scrollGroup()}
            {group("TrackPoint", trackpointKeys)}
            {group("DPI", dpiKeys)}
        </div>
    );
};

export default MouseKeysSection;
