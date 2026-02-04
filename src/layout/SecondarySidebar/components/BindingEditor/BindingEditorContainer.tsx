import "./BindingEditorContainer.css";

import { FC, useCallback, useState, useEffect, useRef, KeyboardEvent } from "react";

import ComboIcon from "@/components/ComboIcon";
import MacrosIcon from "@/components/icons/MacrosIcon";
import OverridesIcon from "@/components/icons/Overrides";
import { usePanels } from "@/contexts/PanelsContext";
import { cn } from "@/lib/utils";
import { X, Repeat, ListOrdered } from "lucide-react";
import { LeaderOptions } from "@/types/vial.types";
import { vialService } from "@/services/vial.service";
import { Input } from "@/components/ui/input";
import AltRepeatEditor from "./AltRepeatEditor";
import LeaderEditor from "./LeaderEditor";
import ComboEditor from "./ComboEditor";
import MacroEditor from "./MacroEditor";
import OverrideEditor from "./OverrideEditor";
import TapdanceEditor from "./TapdanceEditor";
import { useVial } from "@/contexts/VialContext";
import { getKeyContents } from "@/utils/keys";
import { Key } from "@/components/Key";
import { KeyContent } from "@/types/vial.types";

interface Props {
    shouldClose?: boolean;
    inline?: boolean; // When true, renders inline without absolute positioning (for overlay mode)
}

const icons = {
    macros: <MacrosIcon />,
    combos: <ComboIcon />,
    overrides: <OverridesIcon />,
    altrepeat: <Repeat className="w-5 h-5" />,
    leaders: <ListOrdered className="w-5 h-5" />,
};

const labels = {
    tapdances: "Tap Dance Keys",
    macros: "Macro Key",
    combos: "Combo",
    overrides: "Override",
    altrepeat: "Alt-Repeat Key",
    leaders: "Leader Sequence",
};

const LeaderToggle: FC<{ isEnabled: boolean; onToggle: (enabled: boolean) => void }> = ({ isEnabled, onToggle }) => (
    <div className="flex flex-row items-center gap-0.5 bg-gray-200/50 p-0.5 rounded-md border border-gray-400/50 ml-3">
        <button
            onClick={() => onToggle(true)}
            className={cn(
                "px-2 py-0.5 text-[10px] uppercase tracking-wide rounded-[4px] transition-all font-bold border",
                isEnabled
                    ? "bg-black text-white shadow-sm border-black"
                    : "text-gray-500 border-transparent hover:text-black hover:bg-white hover:shadow-sm"
            )}
        >
            ON
        </button>
        <button
            onClick={() => onToggle(false)}
            className={cn(
                "px-2 py-0.5 text-[10px] uppercase tracking-wide rounded-[4px] transition-all font-bold border",
                !isEnabled
                    ? "bg-black text-white shadow-sm border-black"
                    : "text-gray-500 border-transparent hover:text-black hover:bg-white hover:shadow-sm"
            )}
        >
            OFF
        </button>
    </div>
);

const BindingEditorContainer: FC<Props> = ({ shouldClose, inline = false }) => {
    const { itemToEdit, handleCloseEditor, bindingTypeToEdit } = usePanels();
    const [isClosing, setIsClosing] = useState(false);

    useEffect(() => {
        if (shouldClose && !isClosing) {
            setIsClosing(true);
        }
    }, [shouldClose, isClosing]);

    const handleAnimatedClose = useCallback(() => {
        if (isClosing) {
            return;
        }

        setIsClosing(true);
    }, [isClosing]);

    const handleAnimationEnd = useCallback(() => {
        if (isClosing) {
            handleCloseEditor();
        }
    }, [handleCloseEditor, isClosing]);

    const { keyboard, setKeyboard } = useVial();
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [editTitleValue, setEditTitleValue] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);

    const handleStartEditingTitle = () => {
        if (!keyboard || bindingTypeToEdit !== "macros" || itemToEdit === null) return;
        const currentName = keyboard.cosmetic?.macros?.[itemToEdit.toString()] || `Macro Key ${itemToEdit}`;
        setEditTitleValue(currentName);
        setIsEditingTitle(true);
    };

    const handleSaveTitle = () => {
        if (!keyboard || bindingTypeToEdit !== "macros" || itemToEdit === null) {
            setIsEditingTitle(false);
            return;
        }

        const cosmetic = JSON.parse(JSON.stringify(keyboard.cosmetic || {}));
        if (!cosmetic.macros) cosmetic.macros = {};

        if (editTitleValue.trim() === "" || editTitleValue.trim() === `Macro Key ${itemToEdit}`) {
            delete cosmetic.macros[itemToEdit.toString()];
        } else {
            cosmetic.macros[itemToEdit.toString()] = editTitleValue;
        }

        setKeyboard({ ...keyboard, cosmetic });
        setIsEditingTitle(false);
    };

    const handleTitleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            handleSaveTitle();
        } else if (e.key === "Escape") {
            setIsEditingTitle(false);
        }
    };

    // In inline mode, render without absolute positioning for overlay use
    const containerClasses = inline
        ? cn("flex flex-col", bindingTypeToEdit === "overrides" ? "w-[600px]" : "w-full")
        : cn("absolute top-1/2 -translate-y-1/2", bindingTypeToEdit === "overrides" ? "w-[600px] right-[-600px]" : bindingTypeToEdit === "leaders" ? "w-[520px] right-[-520px]" : "w-[450px] right-[-450px]");

    const panelClasses = inline
        ? cn("bg-kb-gray-medium p-3 flex flex-col w-full")
        : cn("binding-editor bg-kb-gray-medium rounded-r-2xl p-5 flex flex-col w-full min-h-[500px] shadow-[4px_0_16px_rgba(0,0,0,0.1)]", isClosing ? "binding-editor--exit" : "binding-editor--enter");

    // Icon sizes: smaller for inline mode
    const iconSize = inline ? "w-10 h-10" : "w-14 h-14";
    const iconInnerSize = inline ? "h-4 w-4 mt-2" : "h-5 w-5 mt-3";
    const iconTextSize = inline ? "text-xs" : "text-sm";

    const renderHeaderIcon = () => {
        if (bindingTypeToEdit === "tapdances" && itemToEdit !== null && keyboard) {
            const keycode = `TD(${itemToEdit})`;
            const keyContents = getKeyContents(keyboard, keycode) as KeyContent;
            return (
                <div className={cn("relative", iconSize)}>
                    <Key
                        isRelative
                        x={0}
                        y={0}
                        w={1}
                        h={1}
                        row={-1}
                        col={-1}
                        keycode={keycode}
                        label={itemToEdit.toString()}
                        keyContents={keyContents}
                        layerColor="sidebar"
                        variant={inline ? "small" : "default"}
                        disableTooltip={true}
                    />
                </div>
            );
        }

        const icon = (icons as any)[bindingTypeToEdit!];
        if (icon) {
            return (
                <div className={cn("flex flex-col bg-black rounded-sm flex-shrink-0 items-center", iconSize)}>
                    <div className={cn("text-white", iconInnerSize)}>{icon}</div>
                    <span className={cn("text-white", iconTextSize)}>{itemToEdit}</span>
                </div>
            );
        }
        return null;
    };

    return (
        <div className={containerClasses}>
            <div className={panelClasses} onAnimationEnd={handleAnimationEnd}>
                <div className={cn(
                    "flex flex-row w-full items-center justify-between",
                    inline ? "pr-3 pt-2 pb-2 pl-4" : "pr-5 pt-2 pb-5 pl-[84px]"
                )}>
                    <div className="flex flex-row items-center">
                        {renderHeaderIcon()}
                        <div className={cn("font-normal", inline ? "pl-3 text-lg" : "pl-5 text-xl")}>
                            {bindingTypeToEdit === "macros" ? (
                                isEditingTitle ? (
                                    <div className="flex items-center gap-2 bg-white rounded-md px-1 py-0.5 border border-black shadow-sm">
                                        <Input
                                            ref={inputRef}
                                            value={editTitleValue}
                                            onChange={(e) => setEditTitleValue(e.target.value)}
                                            onBlur={handleSaveTitle}
                                            onKeyDown={handleTitleKeyDown}
                                            className="h-auto py-1 px-2 text-lg font-bold border-none focus-visible:ring-0 w-auto min-w-[130px] select-text"
                                            autoFocus
                                        />
                                    </div>
                                ) : (
                                    <div
                                        className="cursor-pointer hover:bg-black/5 rounded-md px-2 py-1 transition-colors"
                                        onClick={handleStartEditingTitle}
                                        title="Click to rename"
                                    >
                                        {keyboard?.cosmetic?.macros?.[itemToEdit!.toString()] || `Macro Key ${itemToEdit}`}
                                    </div>
                                )
                            ) : bindingTypeToEdit === "combos" ? (
                                `Combo ${itemToEdit}`
                            ) : bindingTypeToEdit === "tapdances" ? (
                                `Tap Dance Key ${itemToEdit}`
                            ) : bindingTypeToEdit === "overrides" ? (
                                `Override ${itemToEdit}`
                            ) : bindingTypeToEdit === "altrepeat" ? (
                                `Alt-Repeat Key ${itemToEdit}`
                            ) : bindingTypeToEdit === "leaders" ? (
                                `Leader Sequence ${itemToEdit}`
                            ) : (
                                (labels as any)[bindingTypeToEdit!]
                            )}
                        </div>
                        {bindingTypeToEdit === "leaders" && keyboard?.leaders && itemToEdit !== null && (
                            <LeaderToggle
                                isEnabled={(keyboard.leaders[itemToEdit]?.options & LeaderOptions.ENABLED) !== 0}
                                onToggle={async (enabled) => {
                                    const updatedKeyboard = JSON.parse(JSON.stringify(keyboard));
                                    let options = updatedKeyboard.leaders[itemToEdit].options;
                                    if (enabled) options |= LeaderOptions.ENABLED;
                                    else options &= ~LeaderOptions.ENABLED;
                                    updatedKeyboard.leaders[itemToEdit].options = options;
                                    setKeyboard(updatedKeyboard);
                                    try {
                                        await vialService.updateLeader(updatedKeyboard, itemToEdit);
                                        await vialService.saveViable();
                                    } catch (err) {
                                        console.error("Failed to update leader:", err);
                                    }
                                }}
                            />
                        )}
                    </div>
                    {!isEditingTitle && !inline && (
                        <button
                            type="button"
                            onClick={handleAnimatedClose}
                            className="rounded-sm p-1 text-kb-gray-border transition-all hover:text-black focus:outline-none focus:text-black cursor-pointer"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    )}
                </div>
                {bindingTypeToEdit === "tapdances" && <TapdanceEditor />}
                {bindingTypeToEdit === "combos" && <ComboEditor />}
                {bindingTypeToEdit === "overrides" && <OverrideEditor />}
                {bindingTypeToEdit === "macros" && <MacroEditor />}
                {bindingTypeToEdit === "altrepeat" && <AltRepeatEditor />}
                {bindingTypeToEdit === "leaders" && <LeaderEditor />}
            </div>
        </div>
    );
};

export default BindingEditorContainer;
