import { Key } from "@/components/Key";
import { useKeyBinding } from "@/contexts/KeyBindingContext";
import { useLayer } from "@/contexts/LayerContext";
import { useLayoutSettings } from "@/contexts/LayoutSettingsContext";
import { useKeyboard } from "@/contexts/KeyboardContext";
import { keyService } from "@/services/key.service";
import { customKeycodeShortName } from "@/constants/custom-keycode-labels";
import { customKeycodesAt } from "@/constants/custom-keycode-homes";

import { hoverBackgroundClasses, hoverBorderClasses, hoverHeaderClasses } from "@/utils/colors";

interface Props {
    compact?: boolean;
    variant?: "small" | "medium" | "default";
}

const SvalboardKeys = ({ compact, variant: variantOverride }: Props) => {
    const { assignKeycode } = useKeyBinding();
    const { keyboard } = useKeyboard();
    const { selectedLayer } = useLayer();
    const { keyVariant } = useLayoutSettings();

    const layerColorName = keyboard?.cosmetic?.layer_colors?.[selectedLayer] || "primary";
    const hoverBorderColor = hoverBorderClasses[layerColorName] || hoverBorderClasses["primary"];
    const hoverBackgroundColor = hoverBackgroundClasses[layerColorName] || hoverBackgroundClasses["primary"];
    const hoverHeaderClass = hoverHeaderClasses[layerColorName] || hoverHeaderClasses["primary"];
    const effectiveVariant = variantOverride || (compact ? "small" : keyVariant);
    const keySizeClass = effectiveVariant === 'small' ? 'h-[30px] w-[30px]' : effectiveVariant === 'medium' ? 'h-[45px] w-[45px]' : 'h-[60px] w-[60px]';

    const keys = customKeycodesAt(keyboard?.custom_keycodes, "svalboard").map((ck) => ({
        keycode: ck.name,
        label: customKeycodeShortName(ck).replace(/\n/g, " "),
    }));
    if (keys.length === 0) return null;

    return (
        <div className="flex flex-col gap-1">
            <span className={compact ? "text-[9px] font-bold text-slate-500 dark:text-neutral-400 uppercase" : "font-semibold text-lg text-kb-ink"}>
                Svalboard
            </span>
            <div className="flex flex-wrap gap-1">
                {keys.map((k) => {
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
                })}
            </div>
        </div>
    );
};

export default SvalboardKeys;
