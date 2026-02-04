import { useState } from "react";

import QwertyKeyboard from "@/components/Keyboards/QwertyKeyboard";
import { Button } from "@/components/ui/button";
import { useKeyBinding } from "@/contexts/KeyBindingContext";
import { useLayer } from "@/contexts/LayerContext";
import { useLayoutSettings } from "@/contexts/LayoutSettingsContext";
import { useVial } from "@/contexts/VialContext";
import { hoverBackgroundClasses, hoverBorderClasses, hoverHeaderClasses } from "@/utils/colors";
import { cn } from "@/lib/utils";
import { KeyboardInfo, KeyContent } from "@/types/vial.types";
import { Key } from "@/components/Key";
import { getKeyContents } from "@/utils/keys";
import { keyService } from "@/services/key.service";
import { CODEMAP } from "@/constants/keygen";
import { MATRIX_COLS } from "@/constants/svalboard-layout";

import { BUTTON_TO_KEYCODE_MAP, LAYOUTS } from "@/components/Keyboards/layouts";

const getKeyCodeForButton = (keyboard: KeyboardInfo, button: string): string | undefined => {
    const k = BUTTON_TO_KEYCODE_MAP[button] || BUTTON_TO_KEYCODE_MAP[button.toLowerCase()];
    if (k) return k;
    const customKeycode = keyboard.custom_keycodes?.findIndex((ck) => ck.name === button);
    if (customKeycode === undefined || customKeycode < 0) return button;
    return `USER${customKeycode?.toString().padStart(2, "0")}`;
};

export const modifierOptions = ["Shift", "Ctrl", "Alt", "Gui"] as const;
export type Modifier = typeof modifierOptions[number];

// Helper to apply modifiers to a keycode
const MODIFIER_MAP: Record<number, string> = {
    1: "LCTL",
    2: "LSFT",
    3: "C_S",
    4: "LALT",
    5: "LCA",
    6: "LSA",
    7: "MEH",
    8: "LGUI",
    9: "LCG",
    10: "SGUI",
    11: "LSCG",
    12: "LAG",
    13: "LCAG",
    14: "LSAG",
    15: "HYPR",
};

// Mod-Tap variants (hold for modifier, tap for keycode)
const MOD_TAP_MAP: Record<number, string> = {
    1: "LCTL_T",
    2: "LSFT_T",
    3: "C_S_T",
    4: "LALT_T",
    5: "LCA_T",
    6: "LSA_T",
    7: "MEH_T",
    8: "LGUI_T",
    9: "LCG_T",
    10: "SGUI_T",
    11: "LSCG_T",
    12: "LAG_T",
    13: "LCAG_T",
    14: "LSAG_T",
    15: "HYPR_T",
};

// One-Shot Modifier keycodes (standalone, don't wrap a keycode)
const ONE_SHOT_MAP: Record<number, string> = {
    1: "OSM(MOD_LCTL)",
    2: "OSM(MOD_LSFT)",
    3: "OSM(MOD_LCTL|MOD_LSFT)",
    4: "OSM(MOD_LALT)",
    5: "OSM(MOD_LCTL|MOD_LALT)",
    6: "OSM(MOD_LSFT|MOD_LALT)",
    7: "OSM(MOD_MEH)",
    8: "OSM(MOD_LGUI)",
    9: "OSM(MOD_LCTL|MOD_LGUI)",
    10: "OSM(MOD_LSFT|MOD_LGUI)",
    11: "OSM(MOD_LCTL|MOD_LSFT|MOD_LGUI)",
    12: "OSM(MOD_LALT|MOD_LGUI)",
    13: "OSM(MOD_LCTL|MOD_LALT|MOD_LGUI)",
    14: "OSM(MOD_LSFT|MOD_LALT|MOD_LGUI)",
    15: "OSM(MOD_HYPR)",
};

// Reverse map: modifier mask → which Modifier[] toggles are on
const MASK_TO_MODIFIERS: Record<number, Modifier[]> = {
    1: ["Ctrl"], 2: ["Shift"], 3: ["Ctrl", "Shift"],
    4: ["Alt"], 5: ["Ctrl", "Alt"], 6: ["Shift", "Alt"], 7: ["Ctrl", "Shift", "Alt"],
    8: ["Gui"], 9: ["Ctrl", "Gui"], 10: ["Shift", "Gui"], 11: ["Ctrl", "Shift", "Gui"],
    12: ["Alt", "Gui"], 13: ["Ctrl", "Alt", "Gui"], 14: ["Shift", "Alt", "Gui"], 15: ["Ctrl", "Shift", "Alt", "Gui"],
};

// Decompose a numeric keycode into { modifiers, baseKeycode, isModTap }
// QK_MODS range: 0x0100-0x1FFF  (modifier + key)
// QK_MOD_TAP range: 0x2000-0x3FFF (mod-tap)
const decomposeKeycode = (numericKeycode: number): { modifiers: Modifier[], baseKeycode: string, isModTap: boolean } | null => {
    if (numericKeycode >= 0x2000 && numericKeycode <= 0x3FFF) {
        // Mod-tap: bits [12:8] = mod mask (left mods in bits 0-3 of that nibble)
        const modBits = (numericKeycode >> 8) & 0x1F;
        const mask = modBits & 0x0F;
        const baseCode = numericKeycode & 0xFF;
        const baseStr = baseCode in CODEMAP ? (CODEMAP[baseCode] as string) : null;
        const mods = MASK_TO_MODIFIERS[mask];
        if (baseStr && mods) {
            return { modifiers: mods, baseKeycode: baseStr, isModTap: true };
        }
    } else if (numericKeycode >= 0x0100 && numericKeycode <= 0x1FFF) {
        // QK_MODS: bits [12:8] = mod mask
        const modBits = (numericKeycode >> 8) & 0x1F;
        const mask = modBits & 0x0F;
        const baseCode = numericKeycode & 0xFF;
        const baseStr = baseCode in CODEMAP ? (CODEMAP[baseCode] as string) : null;
        const mods = MASK_TO_MODIFIERS[mask];
        if (baseStr && mods) {
            return { modifiers: mods, baseKeycode: baseStr, isModTap: false };
        }
    }
    return null;
};

// Helper to get modifier bitmask
const getModifierMask = (activeModifiers: Modifier[]): number => {
    const hasCtrl = activeModifiers.includes("Ctrl");
    const hasShift = activeModifiers.includes("Shift");
    const hasAlt = activeModifiers.includes("Alt");
    const hasGui = activeModifiers.includes("Gui");
    return (hasCtrl ? 1 : 0) | (hasShift ? 2 : 0) | (hasAlt ? 4 : 0) | (hasGui ? 8 : 0);
};

// Get the OSM keycode string for the currently active modifiers (or null if none)
const getOsmKeycode = (activeModifiers: Modifier[]): string | null => {
    if (activeModifiers.length === 0) return null;
    const mask = getModifierMask(activeModifiers);
    return ONE_SHOT_MAP[mask] || null;
};

// Helper to apply modifiers to a keycode
const applyModifiers = (keycode: string, activeModifiers: Modifier[], isModTap: boolean) => {
    if (activeModifiers.length === 0) return keycode;

    const mask = getModifierMask(activeModifiers);
    const modMap = isModTap ? MOD_TAP_MAP : MODIFIER_MAP;
    const modifierFunc = modMap[mask];
    return modifierFunc ? `${modifierFunc}(${keycode})` : keycode;
};

interface Props {
    isPicker?: boolean;
}

const BasicKeyboards = ({ isPicker }: Props) => {
    const [activeModifiers, setActiveModifiers] = useState<Modifier[]>([]);
    // Track whether the selected key is a modifier-type key (so we know whether to auto-write)
    const [selectedKeyModType, setSelectedKeyModType] = useState<'mods' | 'modtap' | null>(null);
    const { assignKeycode, assignKeycodeTo, isBinding, selectedTarget } = useKeyBinding();
    const { keyboard } = useVial();
    const { selectedLayer } = useLayer();
    const { keyVariant, layoutMode, internationalLayout, setInternationalLayout } = useLayoutSettings();

    const isHorizontal = layoutMode === "bottombar";



    const layerColorName = keyboard?.cosmetic?.layer_colors?.[selectedLayer] || "primary";
    const hoverBorderColor = hoverBorderClasses[layerColorName] || hoverBorderClasses["primary"];
    const hoverBackgroundColor = hoverBackgroundClasses[layerColorName] || hoverBackgroundClasses["primary"];
    const hoverHeaderClass = hoverHeaderClasses[layerColorName] || hoverHeaderClasses["primary"];

    // Compute the base keycode (inner key stripped of modifiers) from the selected key
    const getBaseKeycode = (): string => {
        if (!keyboard?.keymap || !selectedTarget || selectedTarget.type !== "keyboard") return "KC_NO";
        const { layer, row, col } = selectedTarget;
        if (layer === undefined || row === undefined || col === undefined) return "KC_NO";
        const matrixCols = keyboard.cols || MATRIX_COLS;
        const matrixPos = row * matrixCols + col;
        const numericKeycode = keyboard.keymap[layer]?.[matrixPos];
        if (numericKeycode === undefined) return "KC_NO";

        const decomposed = decomposeKeycode(numericKeycode);
        if (decomposed) return decomposed.baseKeycode;

        // Not a modifier key — use the keycode string directly
        const str = numericKeycode in CODEMAP ? (CODEMAP[numericKeycode] as string) : null;
        return str || "KC_NO";
    };

    const baseKeycode = getBaseKeycode();
    const hasModifiers = activeModifiers.length > 0;

    // Three constructed keycodes: plain modifier, mod-tap, one-shot
    const modifierKeycode = hasModifiers ? applyModifiers(baseKeycode, activeModifiers, false) : baseKeycode;
    const modifierContents = keyboard ? getKeyContents(keyboard, modifierKeycode) : undefined;

    const modTapKeycode = hasModifiers ? applyModifiers(baseKeycode, activeModifiers, true) : null;
    const modTapContents = modTapKeycode && keyboard ? getKeyContents(keyboard, modTapKeycode) : undefined;

    const osmKeycode = getOsmKeycode(activeModifiers);
    const osmContents = osmKeycode && keyboard ? getKeyContents(keyboard, osmKeycode) : undefined;

    const handleClearModifiers = () => {
        // Always write the base keycode back (strips any modifier/mod-tap wrapper, keeps the key)
        if (isBinding && keyboard && selectedTarget?.type === "keyboard") {
            assignKeycodeTo(selectedTarget, baseKeycode, { skipAdvance: true });
        }
        setActiveModifiers([]);
        setSelectedKeyModType(null);
    };

    const handleModifierToggle = (modifier: Modifier) => {
        setActiveModifiers((prev) => {
            const next = prev.includes(modifier)
                ? prev.filter((item) => item !== modifier)
                : [...prev, modifier];

            // Auto-write for plain keys, QK_MODS, and QK_MOD_TAP
            // For mod-tap keys, preserve mod-tap type; otherwise use plain modifier
            if (isBinding && keyboard && selectedTarget?.type === "keyboard"
                && (selectedKeyModType !== null || baseKeycode !== "KC_NO")) {
                const isModTap = selectedKeyModType === 'modtap';
                const newKeycode = next.length > 0
                    ? applyModifiers(baseKeycode, next, isModTap)
                    : baseKeycode;
                assignKeycodeTo(selectedTarget, newKeycode, { skipAdvance: true });
            }

            return next;
        });
    };

    const handleKeyClick = (keycode: string) => {
        if (!isBinding || !keyboard) return;

        // Ensure we translate names like 'SV_...' to actual keycodes if needed
        const mappedKeycode = getKeyCodeForButton(keyboard, keycode) || keycode;
        // Blank and Transparent keys are never modified
        const isBlank = keycode === "KC_NO" || keycode === "KC_TRNS";
        const finalKeycode = isBlank ? mappedKeycode : applyModifiers(mappedKeycode, activeModifiers, false);
        assignKeycode(finalKeycode);

    };

    const handleKeyboardInput = (button: string) => {
        if (!isBinding || !keyboard) return;
        handleKeyClick(button);
    };

    const numpadKeys = [
        { keycode: "KC_PSCR", label: "PrtSc" }, { keycode: "KC_SLCK", label: "ScrLk" }, { keycode: "KC_PAUS", label: "Pause" },
        { keycode: "KC_NLCK", label: "NumLk" }, { keycode: "KC_PEQL", label: "=" }, { keycode: "KC_KP_SLASH", label: "/" }, { keycode: "KC_KP_ASTERISK", label: "*" },

        { keycode: "KC_INS", label: "Ins" }, { keycode: "KC_HOME", label: "Home" }, { keycode: "KC_PGUP", label: "PgUp" },
        { keycode: "KC_KP_7", label: "7" }, { keycode: "KC_KP_8", label: "8" }, { keycode: "KC_KP_9", label: "9" }, { keycode: "KC_KP_MINUS", label: "-" },

        { keycode: "KC_DEL", label: "Del" }, { keycode: "KC_END", label: "End" }, { keycode: "KC_PGDN", label: "PgDn" },
        { keycode: "KC_KP_4", label: "4" }, { keycode: "KC_KP_5", label: "5" }, { keycode: "KC_KP_6", label: "6" }, { keycode: "KC_KP_PLUS", label: "+" },

        { keycode: "BLANK", label: "" }, { keycode: "KC_UP", label: "Up" }, { keycode: "BLANK", label: "" },
        { keycode: "KC_KP_1", label: "1" }, { keycode: "KC_KP_2", label: "2" }, { keycode: "KC_KP_3", label: "3" }, { keycode: "KC_KP_ENTER", label: "Enter" },

        { keycode: "KC_LEFT", label: "Left" }, { keycode: "KC_DOWN", label: "Down" }, { keycode: "KC_RGHT", label: "Right" },
        { keycode: "KC_KP_0", label: "0" }, { keycode: "KC_KP_DOT", label: "." },
    ];


    const blankKeys = [
        { keycode: "KC_NO", label: "" },
        { keycode: "KC_TRNS", label: "▽" },
    ];

    // F1-F24 function keys
    const functionKeys = Array.from({ length: 24 }, (_, i) => ({
        keycode: `KC_F${i + 1}`,
        label: `F${i + 1}`
    }));

    // Grid column sizing based on keyVariant (in pixels)
    const numpadKeySize = keyVariant === 'small' ? 30 : keyVariant === 'medium' ? 45 : 60;

    const renderKeyGrid = (keys: { keycode: string, label: string, useServiceLabel?: boolean }[], gridColSize?: number, variantOverride?: "small" | "medium" | "default") => {
        const effectiveVariant = variantOverride || keyVariant;
        const keySizeClass = effectiveVariant === 'small' ? 'h-[30px] w-[30px]' : effectiveVariant === 'medium' ? 'h-[45px] w-[45px]' : 'h-[60px] w-[60px]';

        const gridStyle = gridColSize ? {
            display: 'grid',
            gridTemplateColumns: `repeat(7, ${gridColSize}px)`,
            gap: '4px'
        } : undefined;

        return (
            <div className={cn(!gridColSize && "flex flex-wrap gap-1")} style={gridStyle}>
                {keys.map((k, i) => {
                    if (k.keycode === "BLANK") {
                        return <div key={`blank-${i}`} className={keySizeClass} />;
                    }

                    const finalKeycode = (k.keycode === "BLANK" || k.keycode === "KC_NO" || k.keycode === "KC_TRNS")
                        ? k.keycode
                        : applyModifiers(k.keycode, activeModifiers, false);

                    const keyContents = keyboard ? getKeyContents(keyboard, finalKeycode) : undefined;
                    // Use custom label for numpad keys, otherwise fall back to keyService
                    const displayLabel = k.useServiceLabel ? (keyService.define(k.keycode)?.str || k.label || k.keycode) : (k.label || k.keycode);
                    const isDoubleHeight = k.keycode === "KC_KP_ENTER";



                    return (
                        <Key
                            key={`${k.keycode}-${i}`}
                            x={0} y={0} w={1} h={1} row={0} col={0}
                            keycode={finalKeycode}
                            label={displayLabel}
                            keyContents={keyContents as KeyContent | undefined}
                            layerColor="sidebar"
                            headerClassName={`bg-kb-sidebar-dark ${hoverHeaderClass}`}
                            isRelative
                            variant={effectiveVariant}
                            className={cn(
                                keySizeClass,
                                isDoubleHeight ? "row-span-2" : ""
                            )}
                            hoverBorderColor={hoverBorderColor}
                            hoverBackgroundColor={hoverBackgroundColor}
                            hoverLayerColor={layerColorName}
                            onClick={() => handleKeyClick(k.keycode)}
                            disableTooltip={true}
                        />
                    );
                })}
            </div>
        );
    };

    // Compact horizontal layout for bottom panel
    if (isHorizontal) {
        return (
            <div className="flex flex-row gap-3 h-full items-start">
                {/* Left column: Language selector + Modifiers */}
                <div className="flex flex-col gap-1 flex-shrink-0">
                    {/* Language selector at top */}
                    <select
                        className="border rounded text-[10px] text-slate-600 py-0.5 px-1 border-gray-200 bg-gray-50 !outline-none focus:border-gray-300 cursor-pointer w-full mb-1"
                        value={internationalLayout}
                        onChange={(e) => setInternationalLayout(e.target.value)}
                        title="Keyboard layout"
                    >
                        {Object.values(LAYOUTS).map((kb: any) => (
                            <option key={kb.value} value={kb.value}>
                                {kb.value.toUpperCase()}
                            </option>
                        ))}
                    </select>

                    {/* Modifiers section */}
                    <span className="text-[9px] font-bold text-slate-500 uppercase">Modifiers</span>
                    <Button
                        type="button"
                        variant={activeModifiers.length === 0 ? "default" : "secondary"}
                        size="sm"
                        className={cn(
                            "rounded-md px-2 py-0.5 h-6 transition-all text-[10px] font-medium border-none w-full",
                            activeModifiers.length === 0 ? "bg-kb-sidebar-dark text-white shadow-sm" : "bg-kb-gray-medium text-slate-700 hover:bg-white"
                        )}
                        onClick={handleClearModifiers}
                        title="Clear modifiers"
                    >
                        None
                    </Button>

                    {/* Modifier 2x2 grid */}
                    <div className="grid grid-cols-2 gap-0.5">
                        {modifierOptions.map((modifier) => {
                            const isActive = activeModifiers.includes(modifier);
                            return (
                                <Button
                                    key={modifier}
                                    type="button"
                                    variant={isActive ? "default" : "secondary"}
                                    size="sm"
                                    className={cn(
                                        "rounded-md px-0.5 py-0.5 h-6 transition-all text-[8px] font-medium border-none",
                                        isActive ? "bg-kb-sidebar-dark text-white shadow-sm" : "bg-kb-gray-medium text-slate-700 hover:bg-white"
                                    )}
                                    onClick={() => handleModifierToggle(modifier)}
                                    title={modifier}
                                >
                                    {modifier.toUpperCase()}
                                </Button>
                            );
                        })}
                    </div>

                    {/* Three constructed keys: Modifier, Mod-Tap, One-Shot */}
                    <div className="border-t border-gray-200 pt-1 mt-1 flex flex-col gap-1">
                        <span className="text-[7px] font-bold text-slate-400 uppercase">Modifier</span>
                        <div className={cn(!hasModifiers && "opacity-30 pointer-events-none")}>
                            <Key
                                x={0} y={0} w={1} h={1} row={0} col={0}
                                keycode={modifierKeycode}
                                label={modifierContents?.str || modifierKeycode}
                                keyContents={modifierContents as KeyContent | undefined}
                                layerColor={hasModifiers ? layerColorName : "sidebar"}
                                headerClassName={hasModifiers ? `bg-kb-sidebar-dark ${hoverHeaderClass}` : "bg-kb-sidebar-dark"}
                                isRelative variant="small" className="h-[30px] w-full"
                                onClick={hasModifiers ? () => assignKeycode(modifierKeycode) : undefined}
                                hoverBorderColor={hasModifiers ? hoverBorderColor : undefined}
                                hoverBackgroundColor={hasModifiers ? hoverBackgroundColor : undefined}
                                hoverLayerColor={hasModifiers ? layerColorName : undefined}
                                disableHover={!hasModifiers}
                                disableTooltip={true}
                            />
                        </div>
                        <span className="text-[7px] font-bold text-slate-400 uppercase">Mod-Tap</span>
                        <div className={cn(!hasModifiers && "opacity-30 pointer-events-none")}>
                            <Key
                                x={0} y={0} w={1} h={1} row={0} col={0}
                                keycode={modTapKeycode || "KC_NO"}
                                label={modTapContents?.str || modTapKeycode || ""}
                                keyContents={modTapContents as KeyContent | undefined}
                                layerColor={hasModifiers ? layerColorName : "sidebar"}
                                headerClassName={hasModifiers ? `bg-kb-sidebar-dark ${hoverHeaderClass}` : "bg-kb-sidebar-dark"}
                                isRelative variant="small" className="h-[30px] w-full"
                                onClick={modTapKeycode ? () => assignKeycode(modTapKeycode) : undefined}
                                hoverBorderColor={hasModifiers ? hoverBorderColor : undefined}
                                hoverBackgroundColor={hasModifiers ? hoverBackgroundColor : undefined}
                                hoverLayerColor={hasModifiers ? layerColorName : undefined}
                                disableHover={!hasModifiers}
                                disableTooltip={true}
                            />
                        </div>
                        <span className="text-[7px] font-bold text-slate-400 uppercase">One-Shot</span>
                        <div className={cn(!hasModifiers && "opacity-30 pointer-events-none")}>
                            <Key
                                x={0} y={0} w={1} h={1} row={0} col={0}
                                keycode={osmKeycode || "OSM(MOD_LCTL)"}
                                label={osmContents?.str || "OSM"}
                                keyContents={osmContents || (keyboard ? getKeyContents(keyboard, "OSM(MOD_LCTL)") : undefined)}
                                layerColor={hasModifiers ? layerColorName : "sidebar"}
                                headerClassName={hasModifiers ? `bg-kb-sidebar-dark ${hoverHeaderClass}` : "bg-kb-sidebar-dark"}
                                isRelative variant="small" className="h-[30px] w-full"
                                onClick={osmKeycode ? () => assignKeycode(osmKeycode) : undefined}
                                hoverBorderColor={hasModifiers ? hoverBorderColor : undefined}
                                hoverBackgroundColor={hasModifiers ? hoverBackgroundColor : undefined}
                                hoverLayerColor={hasModifiers ? layerColorName : undefined}
                                disableHover={!hasModifiers}
                                disableTooltip={true}
                            />
                        </div>
                    </div>
                </div>

                {/* QWERTY keyboard - main content, no language selector here */}
                <div className="flex-shrink-0">
                    <QwertyKeyboard onKeyPress={handleKeyboardInput} activeModifiers={activeModifiers} hideLanguageSelector disableTooltip={true} />
                </div>

                {/* Blank/Transparent keys */}
                <div className="flex flex-col gap-1 flex-shrink-0">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Blank</span>
                    <div className="flex flex-col gap-1">
                        {blankKeys.map((k, i) => {
                            const keyContents = keyboard ? getKeyContents(keyboard, k.keycode) : undefined;
                            return (
                                <Key
                                    key={`${k.keycode}-${i}`}
                                    x={0} y={0} w={1} h={1} row={0} col={0}
                                    keycode={k.keycode}
                                    label={k.label || k.keycode}
                                    keyContents={keyContents as KeyContent | undefined}
                                    layerColor="sidebar"
                                    headerClassName={`bg-kb-sidebar-dark ${hoverHeaderClass}`}
                                    isRelative
                                    variant="small"
                                    hoverBorderColor={hoverBorderColor}
                                    hoverBackgroundColor={hoverBackgroundColor}
                                    hoverLayerColor={layerColorName}
                                    onClick={() => handleKeyClick(k.keycode)}
                                    disableTooltip={true}
                                />
                            );
                        })}
                    </div>
                </div>

                {/* Numpad section - compact grid */}
                <div className="flex flex-col gap-1 flex-shrink-0">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Numpad</span>
                    <div className="grid grid-cols-7 gap-0.5">
                        {numpadKeys.map((k, i) => {
                            if (k.keycode === "BLANK") {
                                return <div key={`blank-${i}`} className="w-[30px] h-[30px]" />;
                            }
                            const keyContents = keyboard ? getKeyContents(keyboard, k.keycode) : undefined;
                            const displayLabel = k.label || k.keycode;
                            return (
                                <Key
                                    key={`${k.keycode}-${i}`}
                                    x={0} y={0} w={1} h={1} row={0} col={0}
                                    keycode={k.keycode}
                                    label={displayLabel}
                                    keyContents={keyContents as KeyContent | undefined}
                                    layerColor="sidebar"
                                    headerClassName={`bg-kb-sidebar-dark ${hoverHeaderClass}`}
                                    isRelative
                                    variant="small"
                                    hoverBorderColor={hoverBorderColor}
                                    hoverBackgroundColor={hoverBackgroundColor}
                                    hoverLayerColor={layerColorName}
                                    onClick={() => handleKeyClick(k.keycode)}
                                    disableTooltip={true}
                                />
                            );
                        })}
                    </div>
                </div>

                {/* Function Keys section */}
                <div className="flex flex-col gap-1 flex-shrink-0">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Function Keys</span>
                    <div className="flex flex-wrap gap-0.5 max-w-[260px]">
                        {functionKeys.map((k) => {
                            const keyContents = keyboard ? getKeyContents(keyboard, k.keycode) : undefined;
                            return (
                                <Key
                                    key={k.keycode}
                                    x={0} y={0} w={1} h={1} row={0} col={0}
                                    keycode={k.keycode}
                                    label={k.label}
                                    keyContents={keyContents as KeyContent | undefined}
                                    layerColor="sidebar"
                                    headerClassName={`bg-kb-sidebar-dark ${hoverHeaderClass}`}
                                    isRelative
                                    variant="small"
                                    className="h-[30px] w-[30px]"
                                    hoverBorderColor={hoverBorderColor}
                                    hoverBackgroundColor={hoverBackgroundColor}
                                    hoverLayerColor={layerColorName}
                                    onClick={() => handleKeyClick(k.keycode)}
                                    disableTooltip={true}
                                />
                            );
                        })}
                    </div>
                </div>
            </div>
        );
    }

    // Standard vertical layout for sidebar
    return (
        <div className="space-y-6 relative">
            {isPicker && (
                <div className="pb-2">
                    <span className="font-semibold text-xl text-slate-700">Keyboard Keys</span>
                </div>
            )}

            <div className="flex flex-col gap-2">
                <div className="flex flex-row items-center justify-start">
                    <select
                        className="font-semibold text-lg text-slate-700 bg-transparent border-none p-0 cursor-pointer outline-none focus:ring-0"
                        value={internationalLayout}
                        onChange={(e) => setInternationalLayout(e.target.value)}
                    >
                        {Object.values(LAYOUTS).map((kb: any) => (
                            <option key={kb.value} value={kb.value}>
                                {kb.label}
                            </option>
                        ))}
                    </select>
                </div>
                <QwertyKeyboard onKeyPress={handleKeyboardInput} activeModifiers={activeModifiers} hideLanguageSelector disableTooltip={true} />
            </div>

            <section className="flex flex-col gap-2">
                <span className="font-semibold text-lg text-slate-700">Modifiers</span>
                <div className="flex flex-wrap items-center gap-1">
                    <Button
                        type="button"
                        variant={activeModifiers.length === 0 ? "default" : "secondary"}
                        size="sm"
                        className={cn(
                            "rounded-md px-6 h-8 transition-all text-sm font-bold border-none",
                            activeModifiers.length === 0 ? "bg-kb-sidebar-dark text-white shadow-sm" : "bg-kb-gray-medium text-slate-700 hover:bg-white"
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
                                    "rounded-md px-6 h-8 transition-all text-sm font-bold border-none",
                                    isActive ? "bg-kb-sidebar-dark text-white shadow-sm" : "bg-kb-gray-medium text-slate-700 hover:bg-white"
                                )}
                                onClick={() => handleModifierToggle(modifier)}
                            >
                                {modifier.toUpperCase()}
                            </Button>
                        );
                    })}
                </div>
            </section>

            <section className="flex flex-col gap-2">
                <span className="font-semibold text-lg text-slate-700">Mod-Tap and One-Shot Modifier</span>
                {(() => {
                    const dimClass = "opacity-30 pointer-events-none";
                    return (
                        <div className="flex items-end gap-3">
                            <div className={cn("flex flex-col gap-0.5", !hasModifiers && dimClass)}>
                                <Key
                                    x={0} y={0} w={1} h={1} row={0} col={0}
                                    keycode={modTapKeycode || "KC_NO"}
                                    label={""}
                                    keyContents={hasModifiers
                                        ? (modTapContents as KeyContent)
                                        : { type: "modtap", str: "MT", top: "MT" } as KeyContent
                                    }
                                    layerColor="sidebar"
                                    headerClassName="bg-kb-sidebar-dark"
                                    isRelative variant={keyVariant}
                                    className={keyVariant === 'small' ? 'h-[30px] w-[30px]' : keyVariant === 'medium' ? 'h-[45px] w-[45px]' : 'h-[60px] w-[60px]'}
                                    onClick={modTapKeycode ? () => assignKeycode(modTapKeycode) : undefined}
                                    disableHover={!hasModifiers}
                                    disableTooltip={true}
                                />
                            </div>
                            <div className={cn("flex flex-col gap-0.5", !hasModifiers && dimClass)}>
                                <Key
                                    x={0} y={0} w={1} h={1} row={0} col={0}
                                    keycode={osmKeycode || "OSM(MOD_LCTL)"}
                                    label={""}
                                    keyContents={hasModifiers
                                        ? (osmContents as KeyContent)
                                        : { type: "OSM", str: "OSM", top: "OSM" } as KeyContent
                                    }
                                    layerColor="sidebar"
                                    headerClassName="bg-kb-sidebar-dark"
                                    isRelative variant={keyVariant}
                                    className={keyVariant === 'small' ? 'h-[30px] w-[30px]' : keyVariant === 'medium' ? 'h-[45px] w-[45px]' : 'h-[60px] w-[60px]'}
                                    onClick={osmKeycode ? () => assignKeycode(osmKeycode) : undefined}
                                    disableHover={!hasModifiers}
                                    disableTooltip={true}
                                />
                            </div>
                        </div>
                    );
                })()}
            </section>

            <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                    <span className="font-semibold text-lg text-slate-700">Blank and Transparent</span>
                    {renderKeyGrid(blankKeys)}
                </div>
                <div className="flex flex-col gap-2">
                    <span className="font-semibold text-lg text-slate-700">Numpad</span>
                    {renderKeyGrid(numpadKeys, numpadKeySize)}
                </div>
                <div className="flex flex-col gap-2">
                    <span className="font-semibold text-lg text-slate-700">Function Keys</span>
                    {renderKeyGrid(functionKeys)}
                </div>
            </div>
        </div >
    );
};

export default BasicKeyboards;
