import { Key } from "@/components/Key";
import { useKeyBinding } from "@/contexts/KeyBindingContext";
import { useLayer } from "@/contexts/LayerContext";
import { useLayoutSettings } from "@/contexts/LayoutSettingsContext";
import { useVial } from "@/contexts/VialContext";
import { keyService } from "@/services/key.service";
import { hoverBackgroundClasses, hoverBorderClasses, hoverHeaderClasses } from "@/utils/colors";

interface Props {
    compact?: boolean;
    variant?: "small" | "medium" | "default";
}

/**
 * Mouse Keys section for the Pointing Devices panel
 * Shows Mouse 1-5 buttons on first row and 6 sniper keys on second row
 */
const MouseKeysSection = ({ compact, variant: variantOverride }: Props) => {
    const { assignKeycode } = useKeyBinding();
    const { keyboard } = useVial();
    const { selectedLayer } = useLayer();
    const { keyVariant } = useLayoutSettings();

    const layerColorName = keyboard?.cosmetic?.layer_colors?.[selectedLayer] || "primary";
    const hoverBorderColor = hoverBorderClasses[layerColorName] || hoverBorderClasses["primary"];
    const hoverBackgroundColor = hoverBackgroundClasses[layerColorName] || hoverBackgroundClasses["primary"];
    const hoverHeaderClass = hoverHeaderClasses[layerColorName] || hoverHeaderClasses["primary"];
    const effectiveVariant = variantOverride || (compact ? "small" : keyVariant);
    const keySizeClass = effectiveVariant === 'small' ? 'h-[30px] w-[30px]' : effectiveVariant === 'medium' ? 'h-[45px] w-[45px]' : 'h-[60px] w-[60px]';

    // Row 1: Mouse 1-5 buttons
    const mouseButtons = [
        { keycode: "KC_BTN1", label: "Mouse 1" },
        { keycode: "KC_BTN2", label: "Mouse 2" },
        { keycode: "KC_BTN3", label: "Mouse 3" },
        { keycode: "KC_BTN4", label: "Mouse 4" },
        { keycode: "KC_BTN5", label: "Mouse 5" },
    ];

    // Row 2: 6 sniper keys
    const sniperKeys = [
        { keycode: "SV_SNIPER_2", label: "Sniper 2x" },
        { keycode: "SV_SNIPER_3", label: "Sniper 3x" },
        { keycode: "SV_SNIPER_5", label: "Sniper 5x" },
        { keycode: "SV_SNIPER_2_TG", label: "Sniper 2x Tgl" },
        { keycode: "SV_SNIPER_3_TG", label: "Sniper 3x Tgl" },
        { keycode: "SV_SNIPER_5_TG", label: "Sniper 5x Tgl" },
    ];

    const renderKey = (k: { keycode: string; label: string }) => {
        const displayLabel = keyService.define(k.keycode)?.str || k.label;
        return (
            <Key
                key={k.keycode}
                x={0}
                y={0}
                w={1}
                h={1}
                row={0}
                col={0}
                keycode={k.keycode}
                label={displayLabel}
                layerColor="sidebar"
                headerClassName={`bg-kb-sidebar-dark ${hoverHeaderClass}`}
                isRelative
                variant={effectiveVariant}
                className={keySizeClass}
                hoverBorderColor={hoverBorderColor}
                hoverBackgroundColor={hoverBackgroundColor}
                hoverLayerColor={layerColorName}
                onClick={() => assignKeycode(k.keycode)}
                disableTooltip={true}
            />
        );
    };

    return (
        <div className="flex flex-col gap-1">
            <span className={compact ? "text-[9px] font-bold text-slate-500 uppercase" : "font-semibold text-lg text-slate-700"}>
                Mouse Keys
            </span>
            {/* Row 1: Mouse buttons */}
            <div className="flex flex-wrap gap-1">
                {mouseButtons.map(renderKey)}
            </div>
            {/* Row 2: Sniper keys */}
            <div className="flex flex-wrap gap-1">
                {sniperKeys.map(renderKey)}
            </div>
        </div>
    );
};

export default MouseKeysSection;
