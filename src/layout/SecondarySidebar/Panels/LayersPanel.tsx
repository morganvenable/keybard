import { useLayerNames } from "@/hooks/useLayerNames";
import { useState } from "react";

import SidebarItemRow from "@/layout/SecondarySidebar/components/SidebarItemRow";
import { Button } from "@/components/ui/button";
import { Key } from "@/components/Key";
import { useKeyBinding } from "@/contexts/KeyBindingContext";
import { useLayer } from "@/contexts/LayerContext";
import { useLayoutSettings } from "@/contexts/LayoutSettingsContext";
import { useVial } from "@/contexts/VialContext";
import { cn } from "@/lib/utils";
import { svalService } from "@/services/sval.service";
import { KeyContent } from "@/types/vial.types";
import { CODEMAP } from "@/constants/keygen";
import { hoverBackgroundClasses, hoverBorderClasses, hoverHeaderClasses } from "@/utils/colors";
import { getKeyContents } from "@/utils/keys";
import DescriptionBlock from "@/layout/SecondarySidebar/components/DescriptionBlock";

/**
 * Valid layer modifiers supported by the UI
 */
const LAYER_MODIFIERS = ["MO", "DF", "PDF", "TG", "TT", "OSL", "TO", "LT"] as const;
type LayerModifier = (typeof LAYER_MODIFIERS)[number];

const MODIFIER_NAMES: Record<LayerModifier, string> = {
    MO: "Momentary",
    DF: "Default Layer",
    PDF: "Persistent Default Layer",
    TG: "Toggle Layer",
    TT: "Tap Toggle",
    OSL: "One Shot Layer",
    TO: "To Layer",
    LT: "Layer Tap",
};

const MODIFIER_DESCRIPTIONS: Record<LayerModifier, string> = {
    DF: "Switches the default layer. The default layer is the always-active base layer that other layers stack on top of. This might be used to switch from QWERTY to Dvorak layout. Note that this is a temporary switch that only persists until the keyboard loses power.",
    PDF: "Sets a persistent default layer. This switch, which will last through a power loss, might be used to switch from QWERTY to Dvorak layout and only switch again when you want to.",
    MO: "Momentarily activates the layer. As soon as you let go of the key, the layer is deactivated.",
    LT: "Momentarily activates the layer when held, and sends the tapped key when tapped. Only supports layers 0-15.",
    OSL: "Momentarily activates the layer until the next key is pressed.",
    TG: "Toggles the layer, activating it if it's inactive and vice versa.",
    TO: "Activates the layer and de-activates all other layers (except your default layer). This replaces your current active layers, and is activated on keydown.",
    TT: "Layer Tap-Toggle. Hold to activate while held (like MO). Repeated taps toggle the layer on or off (like TG). Default is 5 taps; change with TAPPING_TOGGLE.",
};

/**
 * Main panel for managing and selecting layers.
 */
interface Props {
    isPicker?: boolean;
}

const LayersPanel = ({ isPicker }: Props) => {
    const { renameLayer, nameError } = useLayerNames();
    const [activeModifier, setActiveModifier] = useState<LayerModifier>("MO");
    const { keyboard, setKeyboard } = useVial();
    const { assignKeycode, selectedTarget } = useKeyBinding();
    const { selectedLayer } = useLayer();
    const { layoutMode } = useLayoutSettings();

    const isHorizontal = layoutMode === "bottombar";

    if (!keyboard) return null;

    // Compute the base keycode string for use in LT previews
    const getBaseKeycode = (): string => {
        if (!keyboard?.keymap || !selectedTarget || selectedTarget.type !== "keyboard") return "KC_NO";
        const { layer, row, col } = selectedTarget;
        if (layer === undefined || row === undefined || col === undefined) return "KC_NO";
        const matrixCols = keyboard.cols || 16; // Use actual columns or fallback
        const matrixPos = row * matrixCols + col;
        const numericKeycode = keyboard.keymap[layer]?.[matrixPos];
        if (numericKeycode === undefined) return "KC_NO";

        let baseCode = numericKeycode;
        // QK_MODS (0x0100), QK_MOD_TAP (0x2000), QK_LAYER_TAP (0x4000)
        if (numericKeycode >= 0x0100 && numericKeycode <= 0x4FFF) {
            baseCode = numericKeycode & 0x00FF;
        }

        // Return the string name if known
        return baseCode in CODEMAP ? (CODEMAP[baseCode] as string) : "KC_NO";
    };

    const baseKeyStr = getBaseKeycode();

    const layerColorName = keyboard?.cosmetic?.layer_colors?.[selectedLayer] || "primary";
    const hoverBorderColor = hoverBorderClasses[layerColorName] || hoverBorderClasses["primary"];
    const hoverBackgroundColor = hoverBackgroundClasses[layerColorName] || hoverBackgroundClasses["primary"];
    const hoverHeaderClass = hoverHeaderClasses[layerColorName] || hoverHeaderClasses["primary"];

    const handleColorChange = (index: number, colorName: string) => {
        if (keyboard) {
            const cosmetic = JSON.parse(JSON.stringify(keyboard.cosmetic || { layer: {}, layer_colors: {} }));
            if (!cosmetic.layer_colors) cosmetic.layer_colors = {};
            cosmetic.layer_colors[index.toString()] = colorName;
            setKeyboard({ ...keyboard, cosmetic });
        }
    };

    const handleNameChange = (index: number, name: string) => { void renameLayer(index, name); };

    const getLayerKeycode = (modifier: LayerModifier, layerIndex: number) => {
        if (modifier === "LT") {
            return `LT${layerIndex}(${baseKeyStr})`;
        }
        return `${modifier}(${layerIndex})`;
    };

    const getLayerKeyContents = (modifier: LayerModifier, layerIndex: number, keycode: string) => {
        if (modifier === "PDF") {
            const dfKeycode = `DF(${layerIndex})`;
            const dfContents = getKeyContents(keyboard, dfKeycode) as KeyContent;
            return dfContents ? { ...dfContents, layertext: "PDF", top: keycode } : dfContents;
        }
        return getKeyContents(keyboard, keycode) as KeyContent;
    };

    // Horizontal layout for bottom panel
    if (isHorizontal) {
        return (
            <div className="flex flex-row gap-3 h-full items-start flex-wrap content-start">
                {/* Modifier tabs - compact vertical */}
                <div className="flex flex-col gap-0.5 flex-shrink-0">
                    <span className="text-[9px] font-bold text-slate-500 uppercase mb-0.5">Type</span>
                    {LAYER_MODIFIERS.map((modifier) => {
                        const isActive = modifier === activeModifier;
                        return (
                            <button
                                key={modifier}
                                onClick={() => setActiveModifier(modifier)}
                                className={cn(
                                    "px-3 py-1 text-[11px] font-medium rounded-full transition-all",
                                    isActive ? "bg-gray-800 text-white shadow-sm" : "text-gray-600 hover:bg-gray-200"
                                )}
                            >
                                {modifier}
                            </button>
                        );
                    })}
                </div>

                {/* Active Modifier Legend */}
                <div className="flex flex-col gap-1 pl-1 pr-1 w-full box-border">
                    <span className="text-xs font-semibold text-black">
                        {MODIFIER_NAMES[activeModifier]}
                    </span>
                    <span className="text-xs text-slate-500 leading-relaxed max-w-[320px]">
                        {MODIFIER_DESCRIPTIONS[activeModifier]}
                    </span>
                </div>

                {/* Layer keys grid */}
                <div className="flex flex-row gap-1 flex-wrap items-start">
                    {Array.from({ length: keyboard.layers || 16 }, (_, i) => {
                        const layerName = (svalService.getLayerCosmetic(keyboard, i) || "").trim();
                        // LT uses format LT#(key) instead of LT(#)
                        const keycode = getLayerKeycode(activeModifier, i);
                        const keyContents = getLayerKeyContents(activeModifier, i, keycode);

                        return (
                            <Key
                                key={i}
                                x={0} y={0} w={1} h={1} row={-1} col={-1}
                                keycode={keycode}
                                label={layerName || i.toString()}
                                keyContents={keyContents}
                                layerColor="sidebar"
                                headerClassName={`bg-kb-sidebar-dark ${hoverHeaderClass}`}
                                isRelative
                                variant="medium"
                                hoverBorderColor={hoverBorderColor}
                                hoverBackgroundColor={hoverBackgroundColor}
                                hoverLayerColor={layerColorName}
                                onClick={() => assignKeycode(keycode)}
                                disableTooltip={true}
                            />
                        );
                    })}
                </div>
            </div>
        );
    }

    return (
        <section className="space-y-3 flex flex-col">
            {isPicker && (
                <div className="pb-2">
                    <span className="font-semibold text-xl text-black">Layer Keys</span>
                </div>
            )}
            {/* Layer Modifier Selection Tabs */}
            <div className="flex flex-wrap items-center justify-start gap-3">
                <div className="flex items-center justify-start gap-1">
                    {LAYER_MODIFIERS.map((modifier) => {
                        const isActive = modifier === activeModifier;
                        return (
                            <Button
                                key={modifier}
                                type="button"
                                variant={isActive ? "default" : "ghost"}
                                className={cn(
                                    "px-4 py-1 text-sm font-medium rounded-full transition-all min-w-[2.5rem]",
                                    isActive ? "shadow-sm bg-gray-800 text-white hover:bg-gray-700" : "text-gray-600 hover:bg-gray-200 hover:text-gray-900"
                                )}
                                onClick={() => setActiveModifier(modifier)}
                            >
                                {modifier}
                            </Button>
                        );
                    })}
                </div>
            </div>

            {/* Scrollable Layer List */}
            <div className="flex flex-col">
                {nameError && <p role="alert" className="text-red-600">{nameError}</p>}
                <DescriptionBlock wrapText={false}>
                    <span className="text-md font-medium text-black">
                        {MODIFIER_NAMES[activeModifier]}
                    </span>
                    <span className="text-sm text-slate-500 leading-relaxed max-w-[560px]">
                        {MODIFIER_DESCRIPTIONS[activeModifier]}
                    </span>
                </DescriptionBlock>
                <div className="pr-[26px]">
                    {Array.from({ length: keyboard.layers || 16 }, (_, i) => {
                        const layerName = (svalService.getLayerCosmetic(keyboard, i) || "").trim();
                        const hasCustomName = layerName !== "";
                        const layerColor = keyboard?.cosmetic?.layer_colors?.[i] ?? "primary";
                        // LT uses format LT#(key) instead of LT(#)
                        const keycode = getLayerKeycode(activeModifier, i);
                        const keyContents = getLayerKeyContents(activeModifier, i, keycode);

                        return (
                            <SidebarItemRow
                                key={i}
                                index={i}
                                keyboard={keyboard}
                                keycode={keycode}
                                label={i.toString()}
                                keyContents={keyContents}
                                color={layerColor}
                                hasCustomName={hasCustomName}
                                customName={layerName}
                                onAssignKeycode={assignKeycode}
                                onColorChange={isPicker ? undefined : handleColorChange}
                                onNameChange={isPicker ? undefined : handleNameChange}
                                hoverBorderColor={hoverBorderColor}
                                hoverBackgroundColor={hoverBackgroundColor}
                                hoverLayerColor={layerColorName}
                                hoverHeaderClass={hoverHeaderClass}
                            />
                        );
                    })}
                </div>
            </div>
        </section>
    );
};

export default LayersPanel;
