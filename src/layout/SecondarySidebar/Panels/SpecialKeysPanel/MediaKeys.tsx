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

const MediaKeys = ({ compact, variant: variantOverride }: Props) => {
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

    const keys = [
        { keycode: "KC_AGIN", label: "Again" },
        { keycode: "KC_BRID", label: "Bright. Down" },
        { keycode: "KC_BRIU", label: "Bright. Up" },
        { keycode: "KC_WBAK", label: "Browser Back" },
        { keycode: "KC_WFAV", label: "Browser Fav." },
        { keycode: "KC_WFWD", label: "Browser Forward" },
        { keycode: "KC_WHOM", label: "Browser Home" },
        { keycode: "KC_WREF", label: "Browser Refresh" },
        { keycode: "KC_WSCH", label: "Browser Search" },
        { keycode: "KC_WSTP", label: "Browser Stop" },
        { keycode: "KC_CALC", label: "Calc" },
        { keycode: "KC_COPY", label: "Copy" },
        { keycode: "KC_CUT", label: "Cut" },
        { keycode: "KC_EJCT", label: "Eject" },
        { keycode: "KC_EXEC", label: "Exec" },
        { keycode: "KC_FIND", label: "Find" },
        { keycode: "KC_HELP", label: "Help" },
        { keycode: "KC_LCAP", label: "Locking Caps" },
        { keycode: "KC_LNUM", label: "Locking Num" },
        { keycode: "KC_LSCR", label: "Locking Scroll" },
        { keycode: "KC_MAIL", label: "Mail" },
        { keycode: "KC_MNXT", label: "Media Next" },
        { keycode: "KC_MPLY", label: "Media Play" },
        { keycode: "KC_MSEL", label: "Media Player" },
        { keycode: "KC_MPRV", label: "Media Prev" },
        { keycode: "KC_MSTP", label: "Media Stop" },
        { keycode: "KC_MUTE", label: "Mute" },
        { keycode: "KC_MYCM", label: "My PC" },
        { keycode: "KC_MFFD", label: "Next Track (macOS)" },
        { keycode: "KC_PSTE", label: "Paste" },
        { keycode: "KC_PWR", label: "Power" },
        { keycode: "KC_MRWD", label: "Prev Track (macOS)" },
        { keycode: "KC_SLCT", label: "Select" },
        { keycode: "KC_SLEP", label: "Sleep" },
        { keycode: "KC_STOP", label: "Stop" },
        { keycode: "KC_UNDO", label: "Undo" },
        { keycode: "KC_VOLU", label: "Vol +" },
        { keycode: "KC_VOLD", label: "Vol -" },
        { keycode: "KC_WAKE", label: "Wake" },
    ];

    // Compact mode shows all keys with smaller styling
    const displayKeys = keys;

    return (
        <div className="flex flex-col gap-1">
            <span className={compact ? "text-[9px] font-bold text-slate-500 uppercase" : "font-semibold text-lg text-slate-700"}>
                Media
            </span>
            <div className="flex flex-wrap gap-1">
                {displayKeys
                    .map((k) => ({ ...k, displayLabel: keyService.define(k.keycode)?.str || k.label }))
                    .sort((a, b) => a.displayLabel.localeCompare(b.displayLabel))
                    .map((k) => (
                        <Key
                            key={k.keycode}
                            x={0}
                            y={0}
                            w={1}
                            h={1}
                            row={0}
                            col={0}
                            keycode={k.keycode}
                            label={k.displayLabel}
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

export default MediaKeys;
