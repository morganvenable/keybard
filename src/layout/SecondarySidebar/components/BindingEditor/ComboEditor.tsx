import { FC, useEffect, useRef } from "react";

import { useKeyBinding } from "@/contexts/KeyBindingContext";
import { usePanels } from "@/contexts/PanelsContext";
import { useVial } from "@/contexts/VialContext";
import { useLayoutSettings } from "@/contexts/LayoutSettingsContext";
import { getKeyContents } from "@/utils/keys";
import { ArrowRight, Trash2 } from "lucide-react";
import { Key } from "@/components/Key";

import { useLayer } from "@/contexts/LayerContext";
import { hoverBackgroundClasses, hoverBorderClasses } from "@/utils/colors";

interface Props { }

const ComboEditor: FC<Props> = () => {
    const { keyboard } = useVial();
    const { setPanelToGoBack, setAlternativeHeader, itemToEdit } = usePanels();
    const { selectComboKey, selectedTarget, assignKeycode } = useKeyBinding();
    const { selectedLayer } = useLayer();
    const { layoutMode } = useLayoutSettings();
    const hasAutoSelected = useRef(false);

    const isHorizontal = layoutMode === "bottombar";
    const keySize = isHorizontal ? "w-[45px] h-[45px]" : "w-[60px] h-[60px]";
    const keyVariant = isHorizontal ? "medium" : "default";

    const layerColorName = keyboard?.cosmetic?.layer_colors?.[selectedLayer] || "primary";
    const hoverBorderColor = hoverBorderClasses[layerColorName] || hoverBorderClasses["primary"];
    const hoverBackgroundColor = hoverBackgroundClasses[layerColorName] || hoverBackgroundClasses["primary"];

    const currCombo = (keyboard as any).combos?.[itemToEdit!] as import("@/types/vial.types").ComboEntry;
    const keys = {
        0: getKeyContents(keyboard!, currCombo.keys[0]),
        1: getKeyContents(keyboard!, currCombo.keys[1]),
        2: getKeyContents(keyboard!, currCombo.keys[2]),
        3: getKeyContents(keyboard!, currCombo.keys[3]),
        4: getKeyContents(keyboard!, currCombo.output),
    };

    // Check if a specific combo slot is selected
    const isSlotSelected = (slot: number) => {
        return selectedTarget?.type === "combo" && selectedTarget.comboId === itemToEdit && selectedTarget.comboSlot === slot;
    };

    useEffect(() => {
        setPanelToGoBack("combos");
        setAlternativeHeader(true);
        console.log("currCombo", currCombo);

        // Auto-select the first key slot when the editor opens (only once)
        if (itemToEdit !== null && !hasAutoSelected.current) {
            hasAutoSelected.current = true;
            selectComboKey(itemToEdit, 0);
        }
    }, [itemToEdit, setPanelToGoBack, setAlternativeHeader, selectComboKey]);

    const renderKey = (content: any, slot: number) => {
        const isSelected = isSlotSelected(slot);
        const hasContent = (content?.top && content.top !== "KC_NO") || (content?.str && content.str !== "KC_NO" && content.str !== "");

        let keyColor: string | undefined;
        let keyClassName: string;
        let headerClass: string;

        if (isSelected) {
            keyColor = undefined;
            keyClassName = "border-2 border-red-600";
            headerClass = "bg-black/20";
        } else if (hasContent) {
            keyColor = "sidebar";
            keyClassName = "border-kb-gray";
            headerClass = "bg-kb-sidebar-dark";
        } else {
            keyColor = undefined;
            keyClassName = "bg-transparent border-2 border-black";
            headerClass = "text-black";
        }

        const trashOffset = isHorizontal ? "-left-8" : "-left-10";
        const trashSize = isHorizontal ? "w-3 h-3" : "w-4 h-4";

        return (
            <div className={`relative ${keySize} group/key`}>
                <Key
                    isRelative
                    x={0} y={0} w={1} h={1} row={-1} col={-1}
                    keycode={content?.top || "KC_NO"}
                    label={content?.str || ""}
                    keyContents={content}
                    selected={isSelected}
                    onClick={() => selectComboKey(itemToEdit!, slot)}
                    layerColor={keyColor}
                    className={keyClassName}
                    headerClassName={headerClass}
                    hoverBorderColor={hoverBorderColor}
                    hoverBackgroundColor={hoverBackgroundColor}
                    hoverLayerColor={layerColorName}
                    variant={keyVariant}
                    disableTooltip={true}
                />

                {hasContent && (
                    <div className={`absolute ${trashOffset} top-0 h-full flex items-center justify-center opacity-0 group-hover/key:opacity-100 transition-opacity`}>
                        <button
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full"
                            onClick={(e) => {
                                e.stopPropagation();
                                selectComboKey(itemToEdit!, slot);
                                setTimeout(() => assignKeycode("KC_NO"), 0);
                            }}
                            title="Clear key"
                        >
                            <Trash2 className={trashSize} />
                        </button>
                    </div>
                )}
            </div>
        );
    };

    // Horizontal layout: 2x2 grid of input keys + arrow + output
    if (isHorizontal) {
        return (
            <div className="flex flex-row items-center gap-6 px-6 py-3">
                <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-slate-500 mb-1">Input Keys</span>
                    <div className="grid grid-cols-2 gap-2">
                        <div className="flex flex-col items-center">
                            <span className="text-[10px] text-gray-400 mb-0.5">1</span>
                            {renderKey(keys[0], 0)}
                        </div>
                        <div className="flex flex-col items-center">
                            <span className="text-[10px] text-gray-400 mb-0.5">2</span>
                            {renderKey(keys[1], 1)}
                        </div>
                        <div className="flex flex-col items-center">
                            <span className="text-[10px] text-gray-400 mb-0.5">3</span>
                            {renderKey(keys[2], 2)}
                        </div>
                        <div className="flex flex-col items-center">
                            <span className="text-[10px] text-gray-400 mb-0.5">4</span>
                            {renderKey(keys[3], 3)}
                        </div>
                    </div>
                </div>
                <ArrowRight className="h-5 w-5 flex-shrink-0 text-gray-600" />
                <div className="flex flex-col items-center">
                    <span className="text-xs font-medium text-slate-500 mb-1">Output</span>
                    {renderKey(keys[4], 4)}
                </div>
            </div>
        );
    }

    // Vertical layout (sidebar mode)
    return (
        <div className="flex flex-row items-center px-20 gap-8 pt-5">
            <div className="flex flex-col gap-0 py-8">
                {renderKey(keys[0], 0)}
                <div className="text-center text-xl">+</div>
                {renderKey(keys[1], 1)}
                <div className="text-center text-xl">+</div>
                {renderKey(keys[2], 2)}
                <div className="text-center text-xl">+</div>
                {renderKey(keys[3], 3)}
            </div>
            <ArrowRight className="h-6 w-6 flex-shrink-0" />
            <div className="flex flex-col gap-6 py-8 flex-shrink-1">
                {renderKey(keys[4], 4)}
            </div>
        </div>
    );
};

export default ComboEditor;
