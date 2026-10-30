import { Key } from "@/components/Key";
import { useKeyBinding } from "@/contexts/KeyBindingContext";
import { useLayer } from "@/contexts/LayerContext";
import { useLayoutSettings } from "@/contexts/LayoutSettingsContext";
import { useKeyboard } from "@/contexts/KeyboardContext";
import { keyService } from "@/services/key.service";

import { hoverBackgroundClasses, hoverBorderClasses, hoverHeaderClasses } from "@/utils/colors";

interface Props {
    compact?: boolean;
    variant?: "small" | "medium" | "default";
}

/**
 * QMK's International 1-9 and Language 1-9 keys (KC_INT1..9, KC_LNG1..9): the JIS conversion keys
 * (Henkan 変換, Muhenkan 無変換, Kana かな), Korean Han/Yeong and Hanja, and the Mac Kana/Eisu keys.
 * Each is named by the keycode table's title (src/constants/keygen.ts) and labeled by its legend.
 */
export const INTERNATIONAL_KEYCODES = [
    "KC_RO", "KC_KANA", "KC_JYEN", "KC_HENK", "KC_MHEN",
    "KC_INTERNATIONAL_6", "KC_INTERNATIONAL_7", "KC_INTERNATIONAL_8", "KC_INTERNATIONAL_9",
    "KC_LANG1", "KC_LANG2", "KC_LANGUAGE_3", "KC_LANGUAGE_4", "KC_LANGUAGE_5",
    "KC_LANGUAGE_6", "KC_LANGUAGE_7", "KC_LANGUAGE_8", "KC_LANGUAGE_9",
] as const;

const InternationalKeys = ({ compact, variant: variantOverride }: Props) => {
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

    return (
        <div className="flex flex-col gap-1" data-international-keys="">
            <span className={compact ? "text-[9px] font-bold text-slate-500 dark:text-neutral-400 uppercase" : "font-semibold text-lg text-kb-ink"}>
                International
            </span>
            <div className="flex flex-wrap gap-1">
                {INTERNATIONAL_KEYCODES.map((keycode) => {
                    const def = keyService.define(keycode);
                    const name = def?.title || keycode;
                    return (
                        <Key
                            key={keycode}
                            x={0}
                            y={0}
                            w={1}
                            h={1}
                            row={0}
                            col={0}
                            keycode={keycode}
                            label={def?.str || keycode}
                            layerColor="sidebar"
                            headerClassName={`bg-kb-sidebar-dark ${hoverHeaderClass}`}
                            isRelative
                            variant={effectiveVariant}
                            className={keySizeClass}
                            hoverBorderColor={hoverBorderColor}
                            hoverBackgroundColor={hoverBackgroundColor}
                            hoverLayerColor={layerColorName}
                            onClick={() => assignKeycode(keycode)}
                            title={name}
                            aria-label={name}
                            data-picker-keycode={keycode}
                        />
                    );
                })}
            </div>
        </div>
    );
};

export default InternationalKeys;
