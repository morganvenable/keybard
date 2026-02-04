import React from "react";
import { ArrowRight, Plus, X } from "lucide-react";
import OnOffToggle from "@/components/ui/OnOffToggle";

import SidebarItemRow from "@/layout/SecondarySidebar/components/SidebarItemRow";
import { useLayer } from "@/contexts/LayerContext";
import { useLayoutSettings } from "@/contexts/LayoutSettingsContext";
import { usePanels } from "@/contexts/PanelsContext";
import { useVial } from "@/contexts/VialContext";
import { vialService } from "@/services/vial.service";
import { hoverBackgroundClasses, hoverBorderClasses, hoverHeaderClasses } from "@/utils/colors";
import { getKeyContents } from "@/utils/keys";
import { Key } from "@/components/Key";
import { KeyContent } from "@/types/vial.types";
import { cn } from "@/lib/utils";

const ENABLED_BIT = 1 << 7;

const OverridesPanel: React.FC = () => {
    const { keyboard, setKeyboard } = useVial();
    const { selectedLayer } = useLayer();
    const { layoutMode } = useLayoutSettings();
    const {
        setItemToEdit,
        setBindingTypeToEdit,
        setAlternativeHeader,
    } = usePanels();

    const isHorizontal = layoutMode === "bottombar";

    if (!keyboard) return null;

    const layerColorName = keyboard?.cosmetic?.layer_colors?.[selectedLayer] || "primary";
    const hoverBorderColor = hoverBorderClasses[layerColorName] || hoverBorderClasses["primary"];
    const hoverBackgroundColor = hoverBackgroundClasses[layerColorName] || hoverBackgroundClasses["primary"];
    const hoverHeaderClass = hoverHeaderClasses[layerColorName] || hoverHeaderClasses["primary"];

    const overrides = keyboard.key_overrides || [];

    const handleEdit = (index: number) => {
        setItemToEdit(index);
        setBindingTypeToEdit("overrides");
        setAlternativeHeader(true);
    };

    const clearOverride = async (index: number) => {
        if (!keyboard.key_overrides) return;
        const updatedOverrides = [...keyboard.key_overrides];
        updatedOverrides[index] = {
            ...updatedOverrides[index],
            trigger: "KC_NO",
            replacement: "KC_NO",
            options: 0,
            layers: 0,
            negative_mod_mask: 0,
            suppressed_mods: 0,
            trigger_mods: 0
        };
        const updatedKeyboard = { ...keyboard, key_overrides: updatedOverrides };
        setKeyboard(updatedKeyboard);

        try {
            await vialService.updateKeyoverride(updatedKeyboard, index);
            await vialService.saveViable();
        } catch (err) {
            console.error("Failed to clear override:", err);
        }
    };

    const findFirstEmptyOverride = (): number => {
        if (!keyboard.key_overrides) return 0;
        for (let i = 0; i < keyboard.key_overrides.length; i++) {
            const o = keyboard.key_overrides[i];
            const hasTrigger = o.trigger && o.trigger !== "KC_NO";
            const hasRepl = o.replacement && o.replacement !== "KC_NO";
            if (!hasTrigger && !hasRepl) return i;
        }
        return keyboard.key_overrides.length;
    };

    const handleAddOverride = () => {
        const emptyIndex = findFirstEmptyOverride();
        if (!keyboard.key_overrides || emptyIndex >= keyboard.key_overrides.length) return;
        handleEdit(emptyIndex);
    };

    const updateOverrideOption = (index: number, bit: number, checked: boolean) => {
        if (!keyboard) return;
        const updatedKeyboard = JSON.parse(JSON.stringify(keyboard));
        let options = updatedKeyboard.key_overrides?.[index].options || 0;
        if (checked) options |= bit;
        else options &= ~bit;
        if (updatedKeyboard.key_overrides?.[index]) {
            updatedKeyboard.key_overrides[index].options = options;
        }
        setKeyboard(updatedKeyboard);
    };

    const renderSmallKey = (content: KeyContent, idx: number, overrideIndex: number) => {
        const hasContent = (content?.top && content.top !== "KC_NO") || (content?.str && content.str !== "KC_NO" && content.str !== "");
        return (
            <div key={idx} className="relative w-[30px] h-[30px]">
                <Key
                    isRelative
                    x={0} y={0} w={1} h={1} row={-1} col={-1}
                    keycode={content?.top || "KC_NO"}
                    label={content?.str || ""}
                    keyContents={content}
                    layerColor={hasContent ? "sidebar" : undefined}
                    className={hasContent ? "border-kb-gray" : "bg-transparent border border-kb-gray-border"}
                    headerClassName={hasContent ? "bg-kb-sidebar-dark" : "text-black"}
                    variant="small"
                    onClick={() => handleEdit(overrideIndex)}
                    disableTooltip={true}
                />
            </div>
        );
    };

    // Horizontal grid layout for bottom panel
    if (isHorizontal) {
        return (
            <div className="flex flex-row gap-3 h-full items-start pt-2">
                {overrides.map((override, i) => {
                    const isEnabled = (override.options & ENABLED_BIT) !== 0;
                    const isDefined = (override.trigger && override.trigger !== "KC_NO") || (override.replacement && override.replacement !== "KC_NO") || isEnabled;

                    if (!isDefined) return null;

                    const triggerContent = getKeyContents(keyboard, override.trigger || "KC_NO") as KeyContent;
                    const replacementContent = getKeyContents(keyboard, override.replacement || "KC_NO") as KeyContent;

                    return (
                        <div
                            key={i}
                            className={cn(
                                "relative flex flex-col bg-gray-50 rounded-lg p-2 cursor-pointer hover:bg-gray-100 transition-colors min-w-[90px] group",
                                !isEnabled && "opacity-50"
                            )}
                            onClick={() => handleEdit(i)}
                        >
                            {/* Delete button */}
                            <button
                                className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    clearOverride(i);
                                }}
                                title="Clear override"
                            >
                                <X className="w-3 h-3 text-white" />
                            </button>
                            <div className="flex flex-row items-center justify-between mb-1">
                                <span className="text-xs font-bold text-slate-600">OR {i}</span>
                                <OnOffToggle
                                    value={isEnabled}
                                    onToggle={(val) => updateOverrideOption(i, ENABLED_BIT, val)}
                                    className="scale-75 origin-right" // Make it smaller for horizontal view if needed, or keep standard size
                                />
                            </div>
                            <div className="flex flex-row items-center justify-center gap-1">
                                {renderSmallKey(triggerContent, 0, i)}
                                <ArrowRight className="w-3 h-3 text-gray-400 mx-0.5" />
                                {renderSmallKey(replacementContent, 1, i)}
                            </div>
                        </div>
                    );
                })}
                {/* Add new override button */}
                {findFirstEmptyOverride() < (overrides.length || 0) && (
                    <button
                        className="flex flex-col items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-lg p-2 min-w-[60px] h-[70px] transition-colors border-2 border-dashed border-gray-300 hover:border-gray-400"
                        onClick={handleAddOverride}
                        title="Add new override"
                    >
                        <Plus className="w-6 h-6 text-gray-400" />
                    </button>
                )}
                {overrides.filter(o => (o.trigger && o.trigger !== "KC_NO") || (o.replacement && o.replacement !== "KC_NO")).length === 0 && (
                    <div className="text-center text-gray-500 py-4 px-6">
                        No overrides configured.
                    </div>
                )}
            </div>
        );
    }

    // Vertical list layout for sidebar (original)
    return (
        <section className="space-y-3 h-full max-h-full flex flex-col pt-3">
            <div className="flex flex-col overflow-auto flex-grow scrollbar-thin">
                {overrides.map((override, i) => {
                    const isEnabled = (override.options & ENABLED_BIT) !== 0;
                    const isDefined = (override.trigger && override.trigger !== "KC_NO") || (override.replacement && override.replacement !== "KC_NO");

                    const triggerContent = getKeyContents(keyboard, override.trigger || "KC_NO") as KeyContent;
                    const replacementContent = getKeyContents(keyboard, override.replacement || "KC_NO") as KeyContent;

                    const rowChildren = isDefined ? (
                        <div className="flex flex-row items-center w-full">
                            <div className="flex flex-row items-center gap-1 ml-4 overflow-hidden">
                                {renderSmallKey(triggerContent, 0, i)}
                                <ArrowRight className="w-3 h-3 text-black mx-1" />
                                {renderSmallKey(replacementContent, 1, i)}
                            </div>
                        </div>
                    ) : undefined;

                    const rowAction = isDefined ? (
                        <OnOffToggle
                            value={isEnabled}
                            onToggle={(val) => updateOverrideOption(i, ENABLED_BIT, val)}
                        />
                    ) : undefined;

                    // Still pass KeyContent type for consistency, though preview key is hidden
                    const keyContents = { type: "override" } as KeyContent;

                    return (
                        <SidebarItemRow
                            key={i}
                            index={i}
                            keyboard={keyboard}
                            label={i.toString()}
                            keyContents={keyContents}
                            onEdit={handleEdit}
                            hoverBorderColor={hoverBorderColor}
                            hoverBackgroundColor={hoverBackgroundColor}
                            hoverLayerColor={layerColorName}
                            hoverHeaderClass={hoverHeaderClass}
                            showPreviewKey={false}
                            action={rowAction}
                            dimmed={!!(isDefined && !isEnabled)}
                            className="py-4"
                        >
                            {rowChildren}
                        </SidebarItemRow>
                    );
                })}
                {overrides.length === 0 && (
                    <div className="text-center text-gray-500 mt-10">
                        No overrides found.
                    </div>
                )}
            </div>
        </section>
    );
};

export default OverridesPanel;
