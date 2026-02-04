import { useState } from "react";

import { Key } from "@/components/Key";
import { useKeyBinding } from "@/contexts/KeyBindingContext";
import { useLayer } from "@/contexts/LayerContext";
import { useLayoutSettings } from "@/contexts/LayoutSettingsContext";
import { useVial } from "@/contexts/VialContext";
import { cn } from "@/lib/utils";
import { KeyContent } from "@/types/vial.types";
import { hoverBackgroundClasses, hoverBorderClasses, hoverHeaderClasses } from "@/utils/colors";
import { getKeyContents } from "@/utils/keys";
import OneShotModifierSelector, {
    bitmaskToOsmKeycode,
    bitmaskToModTapKeycode,
    bitmaskToLabel,
    MOD_BITS,
} from "../components/OneShotModifierSelector";

interface Props {
    isPicker?: boolean;
}

type ModifierMode = "osm" | "modtap";

// Preset bitmasks for L/R variants
const PRESET_GROUPS = [
    {
        label: "MEH",
        lMask: MOD_BITS.LCTRL | MOD_BITS.LSHIFT | MOD_BITS.LALT,
        rMask: MOD_BITS.RCTRL | MOD_BITS.RSHIFT | MOD_BITS.RALT,
    },
    {
        label: "HYPER",
        lMask: MOD_BITS.LCTRL | MOD_BITS.LSHIFT | MOD_BITS.LALT | MOD_BITS.LGUI,
        rMask: MOD_BITS.RCTRL | MOD_BITS.RSHIFT | MOD_BITS.RALT | MOD_BITS.RGUI,
    },
] as const;

const OneShotComposerPanel = ({ isPicker }: Props) => {
    const { keyboard } = useVial();
    const { assignKeycode } = useKeyBinding();
    const { selectedLayer } = useLayer();
    const { layoutMode, keyVariant } = useLayoutSettings();

    const [mode, setMode] = useState<ModifierMode>("osm");
    const [modMask, setModMask] = useState(0);

    const isHorizontal = layoutMode === "bottombar";

    if (!keyboard) return null;

    const layerColorName = keyboard?.cosmetic?.layer_colors?.[selectedLayer] || "primary";
    const hoverBorderColor = hoverBorderClasses[layerColorName] || hoverBorderClasses["primary"];
    const hoverBackgroundColor = hoverBackgroundClasses[layerColorName] || hoverBackgroundClasses["primary"];
    const hoverHeaderClass = hoverHeaderClasses[layerColorName] || hoverHeaderClasses["primary"];

    // Generate keycode based on mode
    const composedKeycode = mode === "osm"
        ? bitmaskToOsmKeycode(modMask)
        : bitmaskToModTapKeycode(modMask);

    const hasSelection = composedKeycode !== null;
    const modLabel = bitmaskToLabel(modMask);

    const handleAssign = () => {
        if (composedKeycode) {
            assignKeycode(composedKeycode);
        }
    };

    // Get key contents for preview
    const getPreviewContents = (): KeyContent | undefined => {
        if (!composedKeycode) return undefined;
        return getKeyContents(keyboard, composedKeycode) as KeyContent;
    };

    const keySizeClass = keyVariant === 'small' ? 'h-[30px] w-[30px]' : keyVariant === 'medium' ? 'h-[45px] w-[45px]' : 'h-[60px] w-[60px]';

    // Toggle button component
    const ToggleButton = ({
        active,
        onClick,
        children,
        className,
    }: {
        active: boolean;
        onClick: () => void;
        children: React.ReactNode;
        className?: string;
    }) => (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                "px-3 py-1.5 text-xs uppercase tracking-wide rounded-md transition-all font-bold border",
                active
                    ? "bg-black text-white shadow-sm border-black"
                    : "text-gray-500 border-transparent hover:text-black hover:bg-white hover:shadow-sm",
                className
            )}
        >
            {children}
        </button>
    );

    // Horizontal layout for bottom panel
    if (isHorizontal) {
        return (
            <div className="flex flex-row gap-4 h-full items-center px-4 py-2">
                {/* Mode toggle */}
                <div className="flex flex-row items-center gap-0.5 bg-gray-200/50 p-0.5 rounded-md border border-gray-400/50">
                    <ToggleButton active={mode === "osm"} onClick={() => setMode("osm")}>
                        OSM
                    </ToggleButton>
                    <ToggleButton active={mode === "modtap"} onClick={() => setMode("modtap")}>
                        MT
                    </ToggleButton>
                </div>

                {/* Modifier selector - compact version */}
                <div className="flex-1">
                    <OneShotModifierSelector value={modMask} onChange={setModMask} />
                </div>

                {/* Preview key */}
                <div className="flex flex-col items-center gap-1">
                    <div className={cn("w-[45px] h-[45px]", !hasSelection && "opacity-40")}>
                        <Key
                            isRelative
                            x={0} y={0} w={1} h={1} row={-1} col={-1}
                            keycode={composedKeycode || "KC_NO"}
                            label={modLabel || "---"}
                            keyContents={getPreviewContents()}
                            layerColor={hasSelection ? "sidebar" : undefined}
                            headerClassName={hasSelection ? `bg-kb-sidebar-dark ${hoverHeaderClass}` : "bg-gray-300"}
                            hoverBorderColor={hoverBorderColor}
                            hoverBackgroundColor={hoverBackgroundColor}
                            hoverLayerColor={layerColorName}
                            variant="medium"
                            onClick={hasSelection ? handleAssign : undefined}
                            disableTooltip={true}
                        />
                    </div>
                </div>

                {hasSelection && (
                    <span className="text-xs text-gray-500">Click key to assign</span>
                )}
            </div>
        );
    }

    // Check if a preset matches current modMask
    const isPresetActive = (lMask: number, rMask: number) => {
        return modMask === lMask || modMask === rMask;
    };

    const isPresetLeft = (lMask: number) => modMask === lMask;

    const togglePreset = (lMask: number, rMask: number) => {
        if (modMask === lMask || modMask === rMask) {
            // Turn off preset
            setModMask(0);
        } else {
            // Turn on left by default
            setModMask(lMask);
        }
    };

    const togglePresetSide = (lMask: number, rMask: number) => {
        if (modMask === lMask) {
            // Switch from L to R
            setModMask(rMask);
        } else {
            // Switch from R to L
            setModMask(lMask);
        }
    };

    // Sidebar layout (vertical)
    return (
        <div className="flex flex-col gap-4 py-4 px-5">
            {isPicker && (
                <div className="pb-1">
                    <span className="font-semibold text-xl text-slate-700">One-Shot / Mod-Tap</span>
                </div>
            )}

            {/* Top row: Preview key on left, Mode toggle on right */}
            <div className="flex flex-row items-start gap-4">
                {/* Preview key */}
                <div className="flex flex-col items-center gap-1">
                    <div className={cn(keySizeClass, !hasSelection && "opacity-40")}>
                        <Key
                            isRelative
                            x={0} y={0} w={1} h={1} row={-1} col={-1}
                            keycode={composedKeycode || "KC_NO"}
                            label={modLabel || "---"}
                            keyContents={getPreviewContents()}
                            layerColor={hasSelection ? "sidebar" : undefined}
                            headerClassName={hasSelection ? `bg-kb-sidebar-dark ${hoverHeaderClass}` : "bg-gray-300"}
                            hoverBorderColor={hoverBorderColor}
                            hoverBackgroundColor={hoverBackgroundColor}
                            hoverLayerColor={layerColorName}
                            variant={keyVariant}
                            onClick={hasSelection ? handleAssign : undefined}
                            disableTooltip={true}
                        />
                    </div>
                    {hasSelection && (
                        <code className="bg-gray-100 px-1.5 py-0.5 rounded text-[10px] text-gray-600">{composedKeycode}</code>
                    )}
                </div>

                {/* Mode toggle */}
                <div className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium text-slate-500">Mode</span>
                    <div className="flex flex-row items-center gap-0.5 bg-gray-200/50 p-0.5 rounded-md border border-gray-400/50 w-fit">
                        <ToggleButton active={mode === "osm"} onClick={() => setMode("osm")}>
                            One-Shot
                        </ToggleButton>
                        <ToggleButton active={mode === "modtap"} onClick={() => setMode("modtap")}>
                            Mod-Tap
                        </ToggleButton>
                    </div>
                </div>
            </div>

            {/* Instruction text */}
            <span className="text-sm text-gray-400">Select modifiers below.</span>

            {/* Modifier selector with L/R drop-under buttons */}
            <OneShotModifierSelector value={modMask} onChange={setModMask} />

            {/* Presets with sliding L/R toggle */}
            <div className="flex flex-col gap-2">
                <span className="text-sm font-medium text-slate-500">Presets</span>
                <div className="flex flex-row gap-1.5 min-h-[58px]">
                    {PRESET_GROUPS.map((preset) => {
                        const anyActive = isPresetActive(preset.lMask, preset.rMask);
                        const isRight = !isPresetLeft(preset.lMask) && anyActive;

                        return (
                            <div
                                key={preset.label}
                                className={cn(
                                    "flex flex-col items-center rounded-md overflow-hidden min-w-[70px] transition-[height] duration-300 ease-in-out",
                                    anyActive
                                        ? "bg-black text-white h-[58px]"
                                        : "bg-kb-gray-medium text-slate-700 hover:bg-white hover:text-black h-8 delay-150"
                                )}
                            >
                                {/* Main Label */}
                                <button
                                    type="button"
                                    className="w-full h-8 flex items-center justify-center text-xs font-medium shrink-0 outline-none px-3"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        togglePreset(preset.lMask, preset.rMask);
                                    }}
                                >
                                    {preset.label}
                                </button>

                                {/* L/R Sliding Toggle Switch */}
                                <div className={cn(
                                    "flex flex-row items-center justify-center w-full pb-1 transition-opacity duration-200",
                                    anyActive ? "opacity-100 delay-150" : "opacity-0 pointer-events-none duration-100"
                                )}>
                                    <button
                                        type="button"
                                        className="relative w-10 h-5 rounded-full bg-gray-600 flex items-center px-0.5 outline-none"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            togglePresetSide(preset.lMask, preset.rMask);
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
        </div>
    );
};

export default OneShotComposerPanel;
