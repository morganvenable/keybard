import { FC, useEffect, useState, useRef } from "react";

import PlusIcon from "@/components/icons/Plus";
import { useKeyBinding } from "@/contexts/KeyBindingContext";
import { usePanels } from "@/contexts/PanelsContext";
import { useVial } from "@/contexts/VialContext";
import { DragItem } from "@/contexts/DragContext";
import { MacroAction } from "@/types/vial.types";
import { ArrowDown } from "lucide-react";
import MacroEditorKey from "./MacroEditorKey";
import MacroEditorText from "./MacroEditorText";
import { useBindingChanges } from "@/hooks/useBindingChanges";
import { isEditorInput } from "@/utils/editor-input";

const MacroEditor: FC = () => {
    const [actions, setActions] = useState<MacroAction[]>([]);
    const [focusIndex, setFocusIndex] = useState<number | null>(null);
    const hasAppliedInitialSelection = useRef(false);
    const { keyboard, setKeyboard } = useVial();
    const { itemToEdit, setPanelToGoBack, setAlternativeHeader, initialEditorSlot } = usePanels();
    const { selectComboKey: _selectComboKey, selectMacroKey, selectedTarget, clearSelection } = useKeyBinding();
    const persistBinding = useBindingChanges();

    useEffect(() => {
        setPanelToGoBack("macros");
        setAlternativeHeader(true);
    }, []);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!e.defaultPrevented && !isEditorInput(e.target) && (e.key === "Delete" || e.key === "Backspace")) {
                e.preventDefault();
                // Ensure we are not typing in an input
                const target = e.target as HTMLElement;
                if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;

                if (selectedTarget && selectedTarget.type === "macro" && selectedTarget.macroId === itemToEdit) {
                    const indexToDelete = selectedTarget.macroIndex;
                    if (indexToDelete !== undefined && indexToDelete >= 0 && indexToDelete < actions.length) {
                        e.preventDefault();
                        const newActions = actions.map(action => [...action] as MacroAction);
                        newActions.splice(indexToDelete, 1);
                        void updateActions(newActions);
                        clearSelection();
                    }
                }
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [selectedTarget, actions, itemToEdit, clearSelection]);

    // Load macros
    useEffect(() => {
        if (!keyboard?.macros || itemToEdit === null) return;
        const currMacro = keyboard.macros[itemToEdit];
        const newActions = currMacro?.actions || [];

        // Only update local state if different from keyboard state
        if (JSON.stringify(newActions) !== JSON.stringify(actions)) {
            setActions(newActions);
        }
    }, [itemToEdit, keyboard]);

    // Reset initial selection flag when itemToEdit changes
    useEffect(() => {
        hasAppliedInitialSelection.current = false;
    }, [itemToEdit]);

    // Handle initial selection
    useEffect(() => {
        if (initialEditorSlot !== null && initialEditorSlot !== undefined && actions.length > 0 && !hasAppliedInitialSelection.current) {
            const index = initialEditorSlot;
            const action = actions[index];
            if (action) {
                hasAppliedInitialSelection.current = true;
                const [type] = action;
                if (["text", "delay"].includes(type)) {
                    setFocusIndex(index);
                    selectMacroKey(itemToEdit!, -1) // Clear key selection if any
                } else {
                    selectMacroKey(itemToEdit!, index);
                    setFocusIndex(null);
                }
            }
        }
    }, [initialEditorSlot, actions, itemToEdit, selectMacroKey]);

    // Manual helper to update both local state and keyboard context
    const updateActions = async (newActions: MacroAction[]) => {
        setActions(newActions);

        if (!keyboard || itemToEdit === null) return;

        const updatedKeyboard = { ...keyboard };

        // Properly shallow copy the macros array
        if (!updatedKeyboard.macros) {
            updatedKeyboard.macros = [];
        } else {
            updatedKeyboard.macros = [...updatedKeyboard.macros];
        }

        updatedKeyboard.macros[itemToEdit] = {
            ...(updatedKeyboard.macros[itemToEdit] || {}),
            mid: itemToEdit,
            actions: newActions,
        };
        setKeyboard(updatedKeyboard);

        await persistBinding(updatedKeyboard, "macro", itemToEdit);
    };

    const handleAddItem = (type: string) => {
        const newAction: MacroAction = [type, ""];
        const newActions: MacroAction[] = [...actions, newAction];
        updateActions(newActions);

        if (["down", "up", "tap"].includes(type)) {
            // Need to update local selection context after state update
            setTimeout(() => {
                selectMacroKey(itemToEdit!, newActions.length - 1);
            }, 0);
        } else if (["text", "delay"].includes(type)) {
            setFocusIndex(newActions.length - 1);
        }
    };

    const handleDeleteItem = (index: number) => {
        const newActions = actions.map(action => [...action] as MacroAction);
        newActions.splice(index, 1);
        updateActions(newActions);
        clearSelection();
    };

    const handleTextChange = (index: number, value: string | number) => {
        const newActions = actions.map(action => [...action] as MacroAction);
        newActions[index][1] = value;
        updateActions(newActions);
    };

    const AddButton = ({ type, label }: { type: string; label: string }) => {
        return (
            <button
                className="bg-black cursor-pointer text-white pl-[19px] pr-[22px] py-2 rounded-full hover:bg-gray-600 transition flex flex-row gap-2 items-center"
                onClick={() => handleAddItem(type)}
            >
                <PlusIcon className="h-5 w-5" /> {label}
            </button>
        );
    };
    const handleDrop = (index: number, item: DragItem) => {
        if (item.editorType === "macro" && item.editorId === itemToEdit && item.editorSlot !== undefined) {
            const sourceIndex = item.editorSlot as number;
            const targetIndex = index;
            if (sourceIndex === targetIndex) return;

            const newActions = actions.map(action => [...action] as MacroAction);
            // Swap action values
            const temp = newActions[sourceIndex];
            newActions[sourceIndex] = newActions[targetIndex];
            newActions[targetIndex] = temp;

            updateActions(newActions);
            // Update selection to follow the swapped item if needed, 
            // but usually simplistic swap is enough visually.
        } else {
            const newActions = actions.map(action => [...action] as MacroAction);
            if (newActions[index]) {
                newActions[index][1] = item.keycode;
                updateActions(newActions);
            }
        }
    };

    return (
        <div
            className="flex flex-col items-start pl-[84px] gap-1 pt-5 pb-20 w-full"
            onClick={(e) => {
                // Should only clear if clicking the background, not a child element
                if (e.target === e.currentTarget) {
                    clearSelection();
                    setFocusIndex(null);
                }
            }}
        >
            <div className="flex flex-col gap-1 w-full">
                {actions.map((item, index) => (
                    <div className="flex flex-col gap-1 w-full" key={index}>
                        {item[0] === "text" && (
                            <MacroEditorText
                                type="text"
                                value={item[1]}
                                onChange={(value) => handleTextChange(index, value)}
                                onDelete={() => handleDeleteItem(index)}
                                autoFocus={index === focusIndex}
                            />
                        )}
                        {item[0] === "delay" && (
                            <MacroEditorText
                                type="delay"
                                value={item[1]}
                                onChange={(value) => handleTextChange(index, value)}
                                onDelete={() => handleDeleteItem(index)}
                                autoFocus={index === focusIndex}
                            />
                        )}
                        {["down", "up", "tap"].includes(item[0]) && (
                            <MacroEditorKey
                                binding={item[1] as string}
                                index={index}
                                label={item[0].charAt(0).toUpperCase() + item[0].slice(1)}
                                onDelete={() => handleDeleteItem(index)}
                                onDrop={(draggedItem) => handleDrop(index, draggedItem)}
                                onClick={() => {
                                    selectMacroKey(itemToEdit!, index);
                                    setFocusIndex(null);
                                }}
                            />
                        )}
                        {index < actions.length - 1 && <ArrowDown className="w-6 h-6 text-black ml-[18px]" />}
                    </div>
                ))}
            </div>
            <div className="flex flex-col gap-[14px]">
                {actions.length > 0 && <ArrowDown className="w-6 h-6 text-black ml-[18px]" />}
                <AddButton type="tap" label="Key Tap" />
                <AddButton type="down" label="Key Down" />
                <AddButton type="up" label="Key Up" />
                <AddButton type="text" label="Text" />
                <AddButton type="delay" label="Delay" />
            </div>
        </div>
    );
};

export default MacroEditor;
