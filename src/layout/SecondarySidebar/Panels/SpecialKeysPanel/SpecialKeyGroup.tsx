import { Key } from "@/components/Key";
import { useKeyBinding } from "@/contexts/KeyBindingContext";
import { useLayer } from "@/contexts/LayerContext";
import { useLayoutSettings } from "@/contexts/LayoutSettingsContext";
import { useKeyboard } from "@/contexts/KeyboardContext";
import { keyService } from "@/services/key.service";
import { readableKeyLabel } from "@/lib/tileLabel";
import type { SpecialKeyDef } from "@/constants/special-key-groups";

import { hoverBackgroundClasses, hoverBorderClasses, hoverHeaderClasses } from "@/utils/colors";

interface Props {
    title: string;
    keys: SpecialKeyDef[];
    note?: string;
    compact?: boolean;
    variant?: "small" | "medium" | "default";
    sort?: boolean;
    /** Smaller heading, for a group inside More keys. */
    nested?: boolean;
}

const SpecialKeyGroup = ({ title, keys, note, compact, variant: variantOverride, sort = true, nested }: Props) => {
    const { assignKeycode } = useKeyBinding();
    const { keyboard } = useKeyboard();
    const { selectedLayer } = useLayer();
    const { keyVariant } = useLayoutSettings();

    const layerColorName = keyboard?.cosmetic?.layer_colors?.[selectedLayer] || "primary";
    const hoverBorderColor = hoverBorderClasses[layerColorName] || hoverBorderClasses["primary"];
    const hoverBackgroundColor = hoverBackgroundClasses[layerColorName] || hoverBackgroundClasses["primary"];
    const hoverHeaderClass = hoverHeaderClasses[layerColorName] || hoverHeaderClasses["primary"];
    const effectiveVariant = variantOverride || (compact ? "small" : keyVariant);
    const keySizeClass = effectiveVariant === "small" ? "h-[30px] w-[30px]" : effectiveVariant === "medium" ? "h-[45px] w-[45px]" : "h-[60px] w-[60px]";

    const shown = keys.map((key) => ({
        ...key,
        displayLabel: key.fixedLabel ? key.label : readableKeyLabel(keyService.define(key.keycode)?.str, key.label),
    }));
    if (sort) shown.sort((a, b) => a.displayLabel.localeCompare(b.displayLabel));

    const headingClass = compact
        ? "text-[9px] font-bold text-slate-500 dark:text-neutral-400 uppercase"
        : nested
          ? "font-semibold text-base text-kb-ink"
          : "font-semibold text-lg text-kb-ink";

    return (
        <div className="flex flex-col gap-1" data-testid="special-group">
            <span className={headingClass}>{title}</span>
            {note && <span className="text-xs text-kb-gray-border">{note}</span>}
            <div className="flex flex-wrap gap-1">
                {shown.map((key) => (
                    <Key
                        key={key.keycode}
                        x={0}
                        y={0}
                        w={1}
                        h={1}
                        row={0}
                        col={0}
                        keycode={key.keycode}
                        label={key.displayLabel}
                        fullName={key.label}
                        layerColor="sidebar"
                        headerClassName={`bg-kb-sidebar-dark ${hoverHeaderClass}`}
                        isRelative
                        variant={effectiveVariant}
                        className={keySizeClass}
                        hoverBorderColor={hoverBorderColor}
                        hoverBackgroundColor={hoverBackgroundColor}
                        hoverLayerColor={layerColorName}
                        onClick={() => assignKeycode(key.keycode)}
                        disableTooltip={true}
                    />
                ))}
            </div>
        </div>
    );
};

export default SpecialKeyGroup;
