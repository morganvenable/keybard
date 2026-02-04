import { Key } from "@/components/Key";
import { useKeyBinding } from "@/contexts/KeyBindingContext";
import { useLayer } from "@/contexts/LayerContext";
import { useLayoutSettings } from "@/contexts/LayoutSettingsContext";
import { useVial } from "@/contexts/VialContext";
import { keyService } from "@/services/key.service";

import { hoverBackgroundClasses, hoverBorderClasses, hoverHeaderClasses } from "@/utils/colors";

const FunctionKeys = () => {
    const { assignKeycode } = useKeyBinding();
    const { keyboard } = useVial();
    const { selectedLayer } = useLayer();
    const { keyVariant } = useLayoutSettings();

    const layerColorName = keyboard?.cosmetic?.layer_colors?.[selectedLayer] || "primary";
    const hoverBorderColor = hoverBorderClasses[layerColorName] || hoverBorderClasses["primary"];
    const hoverBackgroundColor = hoverBackgroundClasses[layerColorName] || hoverBackgroundClasses["primary"];
    const hoverHeaderClass = hoverHeaderClasses[layerColorName] || hoverHeaderClasses["primary"];

    const keys = Array.from({ length: 12 }, (_, i) => {
        const num = i + 13;
        return {
            label: `F${num}`,
            keycode: `KC_F${num}`,
        };
    });

    return (
        <div className="flex flex-col gap-2">
            <span className="font-semibold text-lg text-slate-700">Extra Function Keys</span>
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
                        label={keyService.define(k.keycode)?.str || k.label}
                        layerColor="sidebar"
                        headerClassName={`bg-kb-sidebar-dark ${hoverHeaderClass}`}
                        isRelative
                        variant={keyVariant}
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

export default FunctionKeys;
