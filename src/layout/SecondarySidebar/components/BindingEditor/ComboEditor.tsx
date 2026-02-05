import { FC, useEffect, useRef } from "react";

import { useKeyBinding } from "@/contexts/KeyBindingContext";
import { usePanels } from "@/contexts/PanelsContext";
import { useVial } from "@/contexts/VialContext";
import { useLayoutSettings } from "@/contexts/LayoutSettingsContext";
import { ArrowRightFromLine } from "lucide-react";

import EditorKey from "./EditorKey";
import { ComboEntry } from "@/types/vial.types";

interface Props { }

const ComboEditor: FC<Props> = () => {
    const { keyboard } = useVial();
    const { setPanelToGoBack, setAlternativeHeader, itemToEdit } = usePanels();
    const { selectComboKey, selectedTarget, assignKeycode } = useKeyBinding();
    const { layoutMode } = useLayoutSettings();
    const hasAutoSelected = useRef(false);

    const isHorizontal = layoutMode === "bottombar";
    const keySize = isHorizontal ? "w-[45px] h-[45px]" : "w-[60px] h-[60px]";
    const keyVariant = isHorizontal ? "medium" : "default";

    // Fix type assertion
    const currCombo = keyboard?.combos?.[itemToEdit!] as ComboEntry;

    // Check if a specific combo slot is selected
    const isSlotSelected = (slot: number) => {
        return selectedTarget?.type === "combo" && selectedTarget.comboId === itemToEdit && selectedTarget.comboSlot === slot;
    };

    useEffect(() => {
        setPanelToGoBack("combos");
        setAlternativeHeader(true);

        // Auto-select the first key slot when the editor opens (only once)
        if (itemToEdit !== null && !hasAutoSelected.current) {
            hasAutoSelected.current = true;
            selectComboKey(itemToEdit, 0);
        }
    }, [itemToEdit, setPanelToGoBack, setAlternativeHeader, selectComboKey]);

    const renderComboKey = (keycode: string, slot: number, label?: string) => {
        const isSelected = isSlotSelected(slot);
        const trashOffset = isHorizontal ? "-left-8" : "-left-10";
        const trashSize = isHorizontal ? "w-3 h-3" : "w-4 h-4";

        return (
            <div className="flex flex-col items-center">
                {label && <span className="text-[10px] text-gray-400 mb-0.5">{label}</span>}
                <EditorKey
                    keycode={keycode}
                    selected={isSelected}
                    onClick={() => selectComboKey(itemToEdit!, slot)}
                    onClear={() => {
                        selectComboKey(itemToEdit!, slot);
                        setTimeout(() => assignKeycode("KC_NO"), 0);
                    }}
                    size={keySize}
                    trashOffset={trashOffset}
                    trashSize={trashSize}
                    variant={keyVariant}
                    wrapperClassName={`relative ${keySize} group/key`}
                    // We don't use the built-in EditorKey label, we render it externally for consistent positioning in grid
                    label={undefined}
                    labelClassName={undefined}
                />
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
                        {renderComboKey(currCombo.keys[0], 0, "1")}
                        {renderComboKey(currCombo.keys[1], 1, "2")}
                        {renderComboKey(currCombo.keys[2], 2, "3")}
                        {renderComboKey(currCombo.keys[3], 3, "4")}
                    </div>
                </div>
                <ArrowRightFromLine className="h-5 w-5 flex-shrink-0 text-gray-600" />
                <div className="flex flex-col items-center">
                    <span className="text-xs font-medium text-slate-500 mb-1">Output</span>
                    {renderComboKey(currCombo.output, 4)}
                </div>
            </div>
        );
    }

    // Vertical layout (sidebar mode)
    return (
        <div className="flex flex-row items-center px-20 gap-8 pt-5">
            <div className="flex flex-col gap-0 py-8">
                {renderComboKey(currCombo.keys[0], 0)}
                <div className="text-center text-xl">+</div>
                {renderComboKey(currCombo.keys[1], 1)}
                <div className="text-center text-xl">+</div>
                {renderComboKey(currCombo.keys[2], 2)}
                <div className="text-center text-xl">+</div>
                {renderComboKey(currCombo.keys[3], 3)}
            </div>
            <ArrowRightFromLine className="h-6 w-6 flex-shrink-0" />
            <div className="flex flex-col gap-6 py-8 flex-shrink-1">
                {renderComboKey(currCombo.output, 4)}
            </div>
        </div>
    );
};

export default ComboEditor;
