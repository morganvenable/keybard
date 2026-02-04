import "./BindingEditorContainer.css";

import { FC, useCallback, useState, useEffect, useRef, KeyboardEvent } from "react";

import ComboIcon from "@/components/ComboIcon";
import MacrosIcon from "@/components/icons/MacrosIcon";
import OnOffToggle from "@/components/ui/OnOffToggle";
import OverridesIcon from "@/components/icons/Overrides";
import { usePanels } from "@/contexts/PanelsContext";
import { cn } from "@/lib/utils";
import { X, Repeat, ListOrdered, GripHorizontal } from "lucide-react";
import { LeaderOptions, AltRepeatKeyOptions } from "@/types/vial.types";
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



const BindingEditorContainer: FC<Props> = ({ shouldClose, inline = false }) => {
    const { itemToEdit, handleCloseEditor, bindingTypeToEdit } = usePanels();
    const [isClosing, setIsClosing] = useState(false);
    const [yOffset, setYOffset] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const isDraggingRef = useRef(false);
    const startYRef = useRef(0);
    const startOffsetRef = useRef(0);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        isDraggingRef.current = true;
        setIsDragging(true);
        startYRef.current = e.clientY;
        startOffsetRef.current = yOffset;
        document.body.style.cursor = "ns-resize";
        e.preventDefault();
        e.stopPropagation();
    }, [yOffset]);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDraggingRef.current) return;
            const deltaY = e.clientY - startYRef.current;
            setYOffset(startOffsetRef.current + deltaY);
        };

        const handleMouseUp = () => {
            if (isDraggingRef.current) {
                isDraggingRef.current = false;
                setIsDragging(false);
                document.body.style.cursor = "";
            }
        };

        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseup", handleMouseUp);

        return () => {
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mouseup", handleMouseUp);
        };
    }, []);

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
        : cn("absolute top-1/2", bindingTypeToEdit === "overrides" ? "w-[600px] right-[-600px]" : bindingTypeToEdit === "leaders" ? "w-[520px] right-[-520px]" : "w-[450px] right-[-450px]");

    const panelClasses = inline
        ? cn("bg-kb-gray-medium p-0 flex flex-col w-full overflow-hidden")
        : cn("binding-editor bg-kb-gray-medium rounded-r-2xl p-0 flex flex-col w-full min-h-[500px] shadow-[4px_0_16px_rgba(0,0,0,0.1)] overflow-hidden", isClosing ? "binding-editor--exit" : "binding-editor--enter");

    // Icon sizes: smaller for inline mode
    const iconSize = inline ? "w-10 h-10" : "w-14 h-14";
    const iconWidth = inline ? "w-10" : "w-14";
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
                <div className={cn("flex flex-col items-start", iconWidth)}>
                    <div className={cn("flex flex-col bg-black rounded-sm flex-shrink-0 items-center", iconSize)}>
                        <div className={cn("text-white", iconInnerSize)}>{icon}</div>
                        <span className={cn("text-white", iconTextSize)}>{itemToEdit}</span>
                    </div>

                    {bindingTypeToEdit === "leaders" && keyboard?.leaders && itemToEdit !== null && (
                        <div className="mt-[20px]">
                            <OnOffToggle
                                value={(keyboard.leaders[itemToEdit]?.options & LeaderOptions.ENABLED) !== 0}
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
                        </div>
                    )}
                    {bindingTypeToEdit === "overrides" && keyboard?.key_overrides && itemToEdit !== null && (
                        <div className="mt-[20px]">
                            <OnOffToggle
                                value={(keyboard.key_overrides[itemToEdit]?.options & (1 << 7)) !== 0}
                                onToggle={async (enabled) => {
                                    const updatedKeyboard = JSON.parse(JSON.stringify(keyboard));
                                    let options = updatedKeyboard.key_overrides[itemToEdit].options;
                                    if (enabled) options |= (1 << 7);
                                    else options &= ~(1 << 7);
                                    updatedKeyboard.key_overrides[itemToEdit].options = options;
                                    setKeyboard(updatedKeyboard);
                                    await vialService.saveViable();
                                }}
                            />
                        </div>
                    )}
                    {bindingTypeToEdit === "altrepeat" && keyboard?.alt_repeat_keys && itemToEdit !== null && (
                        <div className="mt-[20px]">
                            <OnOffToggle
                                value={(keyboard.alt_repeat_keys[itemToEdit]?.options & AltRepeatKeyOptions.ENABLED) !== 0}
                                onToggle={async (enabled) => {
                                    const updatedKeyboard = JSON.parse(JSON.stringify(keyboard));
                                    let options = updatedKeyboard.alt_repeat_keys[itemToEdit].options;
                                    if (enabled) options |= AltRepeatKeyOptions.ENABLED;
                                    else options &= ~AltRepeatKeyOptions.ENABLED;
                                    updatedKeyboard.alt_repeat_keys[itemToEdit].options = options;
                                    setKeyboard(updatedKeyboard);
                                    try {
                                        await vialService.updateAltRepeatKey(updatedKeyboard, itemToEdit);
                                        await vialService.saveViable();
                                    } catch (err) {
                                        console.error("Failed to update alt-repeat key:", err);
                                    }
                                }}
                            />
                        </div>
                    )}
                </div>
            );
        }
        return null;
    };

    return (
        <div
            className={containerClasses}
            style={{
                ...(!inline ? { transform: `translateY(calc(-50% + ${yOffset}px))` } : { transform: `translateY(${yOffset}px)` }),
                transition: isDragging ? "none" : "transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)"
            }}
        >
            <div className={panelClasses} onAnimationEnd={handleAnimationEnd}>
                <div
                    className="w-full h-6 flex items-center justify-center cursor-ns-resize hover:bg-black/5 transition-colors group z-20"
                    onMouseDown={handleMouseDown}
                >
                    <GripHorizontal className="h-4 w-4 text-gray-400 group-hover:text-gray-600" />
                </div>
                <div className={inline ? "p-3 pt-0" : "p-5 pt-0"}>
                    <div className={cn(
                        "flex flex-row w-full items-start justify-between",
                        inline ? "pr-3 pt-2 pb-2 pl-4" : "pr-5 pt-2 pb-[6px] pl-[84px]"
                    )}>
                        <div className="flex flex-row items-start">
                            {renderHeaderIcon()}
                            <div className={cn("flex items-center", inline ? "h-10 pl-3" : "h-14 pl-[20px]")}>
                                <div className={cn("font-normal", inline ? "text-lg" : "text-xl")}>
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
                            </div>
                        </div>
                        {!isEditingTitle && !inline && (
                            <div className="h-14 flex items-center">
                                <button
                                    type="button"
                                    onClick={handleAnimatedClose}
                                    className="rounded-sm p-1 text-kb-gray-border transition-all hover:text-black focus:outline-none focus:text-black cursor-pointer"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </div>
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
        </div>
    );
};

export default BindingEditorContainer;
