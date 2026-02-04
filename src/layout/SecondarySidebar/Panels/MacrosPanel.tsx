import React from "react";
import { ArrowRight, Plus, X } from "lucide-react";
import { Key } from "@/components/Key";
import { vialService } from "@/services/vial.service";

import SidebarItemRow from "@/layout/SecondarySidebar/components/SidebarItemRow";
import { useKeyBinding } from "@/contexts/KeyBindingContext";
import { useLayer } from "@/contexts/LayerContext";
import { useLayoutSettings } from "@/contexts/LayoutSettingsContext";
import { usePanels } from "@/contexts/PanelsContext";
import { useVial } from "@/contexts/VialContext";
import { hoverBackgroundClasses, hoverBorderClasses, hoverHeaderClasses } from "@/utils/colors";
import { getKeyContents } from "@/utils/keys";
import { KeyContent } from "@/types/vial.types";

interface Props {
    isPicker?: boolean;
}

const MacrosPanel: React.FC<Props> = ({ isPicker }) => {
    const { keyboard, setKeyboard } = useVial();
    const { assignKeycode } = useKeyBinding();
    const { selectedLayer } = useLayer();
    const { layoutMode } = useLayoutSettings();
    const {
        setItemToEdit,
        setBindingTypeToEdit,
        setAlternativeHeader,
        setPanelToGoBack,
    } = usePanels();

    const isHorizontal = layoutMode === "bottombar";

    if (!keyboard) return null;

    const clearMacro = async (index: number) => {
        if (!keyboard.macros) return;
        const updatedMacros = [...keyboard.macros];
        updatedMacros[index] = { mid: index, actions: [] };
        const updatedKeyboard = { ...keyboard, macros: updatedMacros };
        setKeyboard(updatedKeyboard);

        try {
            await vialService.updateMacros(updatedKeyboard);
            await vialService.saveViable();
        } catch (err) {
            console.error("Failed to clear macro:", err);
        }
    };

    const findFirstEmptyMacro = (): number => {
        if (!keyboard.macros) return 0;
        for (let i = 0; i < keyboard.macros.length; i++) {
            if (!keyboard.macros[i]?.actions?.length) return i;
        }
        return keyboard.macros.length;
    };

    const handleAddMacro = () => {
        const emptyIndex = findFirstEmptyMacro();
        if (emptyIndex < (keyboard.macros?.length || 0)) {
            handleEdit(emptyIndex);
        }
    };

    const layerColorName = keyboard?.cosmetic?.layer_colors?.[selectedLayer] || "primary";
    const hoverBorderColor = hoverBorderClasses[layerColorName] || hoverBorderClasses["primary"];
    const hoverBackgroundColor = hoverBackgroundClasses[layerColorName] || hoverBackgroundClasses["primary"];
    const hoverHeaderClass = hoverHeaderClasses[layerColorName] || hoverHeaderClasses["primary"];

    const macros = keyboard.macros || [];

    const handleEdit = (index: number) => {
        setItemToEdit(index);
        setBindingTypeToEdit("macros");
        setAlternativeHeader(true);
        setPanelToGoBack("macros");
    };

    const renderAction = (action: any, idx: number, macroIndex: number) => {
        const [type, value] = action;

        if (["tap", "down", "up"].includes(type)) {
            const actionKeycode = value || "KC_NO";
            const actionKeyContents = getKeyContents(keyboard!, actionKeycode);

            return (
                <div className="w-[30px] h-[30px] relative flex-shrink-0" key={idx}>
                    <Key
                        isRelative
                        x={0}
                        y={0}
                        w={1}
                        h={1}
                        row={-1}
                        col={-1}
                        keycode={actionKeycode}
                        label={actionKeyContents?.str || ""}
                        keyContents={actionKeyContents}
                        variant="small"
                        layerColor="sidebar"
                        className="border-kb-gray"
                        headerClassName="bg-kb-sidebar-dark"
                        onClick={() => handleEdit(macroIndex)}
                        disableTooltip={true}
                    />
                </div>
            );
        } else if (type === "text") {
            return (
                <div key={idx} className="flex items-center justify-center bg-black border border-black rounded text-[10px] px-2 h-[30px] whitespace-nowrap max-w-[100px] overflow-hidden text-ellipsis shadow-sm font-medium text-white">
                    "{value}"
                </div>
            );
        } else if (type === "delay") {
            return (
                <div key={idx} className="flex items-center justify-center bg-black border border-black rounded text-[10px] px-2 h-[30px] shadow-sm font-medium text-white">
                    {value}ms
                </div>
            );
        }
        return null;
    };

    // Horizontal grid layout for bottom panel
    if (isHorizontal) {
        return (
            <div className="flex flex-row gap-3 h-full items-start pt-2">
                {macros.map((macroEntry, i) => {
                    const actions = macroEntry?.actions || [];
                    const hasActions = actions.length > 0;
                    const customName = keyboard.cosmetic?.macros?.[i.toString()];

                    if (!hasActions) return null;

                    const macroKeycode = `M${i}`;
                    const macroKeyContents = getKeyContents(keyboard, macroKeycode) as KeyContent;

                    return (
                        <div
                            key={i}
                            className="relative flex flex-col bg-gray-50 rounded-lg p-2 cursor-pointer hover:bg-gray-100 transition-colors min-w-[100px] max-w-[180px] group"
                            onClick={() => handleEdit(i)}
                        >
                            {/* Delete button */}
                            <button
                                className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    clearMacro(i);
                                }}
                                title="Clear macro"
                            >
                                <X className="w-3 h-3 text-white" />
                            </button>
                            {/* Header with draggable macro key and label */}
                            <div className="flex flex-row items-center gap-2 mb-2">
                                <div className="w-[30px] h-[30px] relative" onClick={(e) => e.stopPropagation()}>
                                    <Key
                                        isRelative
                                        x={0}
                                        y={0}
                                        w={1}
                                        h={1}
                                        row={-1}
                                        col={-1}
                                        keycode={macroKeycode}
                                        label={i.toString()}
                                        keyContents={macroKeyContents}
                                        variant="small"
                                        layerColor="sidebar"
                                        className="border-kb-gray"
                                        headerClassName="bg-kb-sidebar-dark"
                                        onClick={() => assignKeycode(macroKeycode)}
                                        disableTooltip={true}
                                    />
                                </div>
                                <span className="text-xs font-bold text-slate-600 truncate">
                                    {customName || `Macro ${i}`}
                                </span>
                            </div>
                            <div className="flex flex-row items-center gap-0.5 flex-wrap justify-center">
                                {actions.slice(0, 4).map((action, idx) => (
                                    <React.Fragment key={idx}>
                                        {idx > 0 && <ArrowRight className="w-2 h-2 text-gray-400 flex-shrink-0" />}
                                        {renderAction(action, idx, i)}
                                    </React.Fragment>
                                ))}
                                {actions.length > 4 && (
                                    <span className="text-[10px] text-gray-400 ml-1">+{actions.length - 4}</span>
                                )}
                            </div>
                        </div>
                    );
                })}
                {/* Add new macro button */}
                {findFirstEmptyMacro() < (macros.length || 0) && (
                    <button
                        className="flex flex-col items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-lg p-2 min-w-[60px] h-[80px] transition-colors border-2 border-dashed border-gray-300 hover:border-gray-400"
                        onClick={handleAddMacro}
                        title="Add new macro"
                    >
                        <Plus className="w-6 h-6 text-gray-400" />
                    </button>
                )}
                {macros.filter(m => m?.actions?.length > 0).length === 0 && (
                    <div className="text-center text-gray-500 py-4 px-6">
                        No macros configured.
                    </div>
                )}
            </div>
        );
    }

    // Vertical list layout for sidebar (original)
    return (
        <section className="space-y-3 h-full max-h-full flex flex-col pt-3">
            {isPicker && (
                <div className="pb-2">
                    <span className="font-semibold text-xl text-slate-700">Macros</span>
                </div>
            )}
            <div className="flex flex-col overflow-auto flex-grow scrollbar-thin">
                {macros.map((macroEntry, i) => {
                    const keycode = `M${i}`;
                    const keyContents = getKeyContents(keyboard, keycode) as KeyContent;

                    const actions = macroEntry?.actions || [];
                    const hasActions = actions.length > 0;

                    const rowChildren = hasActions ? (
                        <div className="flex flex-row items-center gap-1 w-full overflow-hidden mask-linear-fade">
                            {actions.map((action, idx) => (
                                <React.Fragment key={idx}>
                                    {idx > 0 && <ArrowRight className="w-3 h-3 text-gray-400 flex-shrink-0" />}
                                    {renderAction(action, idx, i)}
                                </React.Fragment>
                            ))}
                        </div>
                    ) : undefined;

                    return (
                        <SidebarItemRow
                            key={i}
                            index={i}
                            keyboard={keyboard}
                            keycode={keycode}
                            label={i.toString()}
                            hasCustomName={!!keyboard.cosmetic?.macros?.[i.toString()]}
                            customName={keyboard.cosmetic?.macros?.[i.toString()]}
                            keyContents={keyContents}
                            onEdit={isPicker ? undefined : handleEdit}
                            onAssignKeycode={assignKeycode}
                            hoverBorderColor={hoverBorderColor}
                            hoverBackgroundColor={hoverBackgroundColor}
                            hoverLayerColor={layerColorName}
                            hoverHeaderClass={hoverHeaderClass}
                        >
                            {rowChildren}
                        </SidebarItemRow>
                    );
                })}
                {macros.length === 0 && (
                    <div className="text-center text-gray-500 mt-10">
                        No macros found.
                    </div>
                )}
            </div>
        </section>
    );
};

export default MacrosPanel;
