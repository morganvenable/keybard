import { Key } from "@/components/Key";
import { useKeyBinding } from "@/contexts/KeyBindingContext";
import { useLayer } from "@/contexts/LayerContext";
import { useLayoutSettings } from "@/contexts/LayoutSettingsContext";
import { useVial } from "@/contexts/VialContext";

import { hoverBackgroundClasses, hoverBorderClasses, hoverHeaderClasses } from "@/utils/colors";

interface Props {
    compact?: boolean;
    variant?: "small" | "medium" | "default";
}

const ExtraFunctionKeys = ({ compact, variant: variantOverride }: Props) => {
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

    // F13-F24 keys
    const keys = Array.from({ length: 12 }, (_, i) => ({
        keycode: `KC_F${i + 13}`,
        label: `F${i + 13}`
    }));

    return (
        <div className="flex flex-col gap-1">
            <span className={compact ? "text-[9px] font-bold text-slate-500 uppercase" : "font-semibold text-lg text-slate-700"}>
                F13-F24
            </span>
            <div className="flex flex-wrap gap-1">
                {keys.map((k) => (
                    <Key
                        key={k.keycode}
                        x={0}
                        y={0}
                        w={1}
                        h={1}
                        row={0}
                        col={0}
                        keycode={k.keycode}
                        label={k.label}
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
                ))}
            </div>
        </div>
    );
};

export default ExtraFunctionKeys;
