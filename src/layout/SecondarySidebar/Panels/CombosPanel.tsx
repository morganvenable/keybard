import React, { useState } from "react";
import { ArrowRight, Plus, X } from "lucide-react";

import ComboIcon from "@/components/ComboIcon";
import SidebarItemRow from "@/layout/SecondarySidebar/components/SidebarItemRow";
import { Input } from "@/components/ui/input";
import { useKeyBinding } from "@/contexts/KeyBindingContext";
import { useLayer } from "@/contexts/LayerContext";
import { useLayoutSettings } from "@/contexts/LayoutSettingsContext";
import { usePanels } from "@/contexts/PanelsContext";
import { useVial } from "@/contexts/VialContext";
import { qmkService } from "@/services/qmk.service";
import { vialService } from "@/services/vial.service";
import { hoverBackgroundClasses, hoverBorderClasses, hoverHeaderClasses } from "@/utils/colors";
import { getKeyContents } from "@/utils/keys";
import { Key } from "@/components/Key";
import { KeyContent, ComboOptions } from "@/types/vial.types";
import { cn } from "@/lib/utils";

const CombosPanel: React.FC = () => {
    const { keyboard, setKeyboard, isConnected } = useVial();
    const { assignKeycode } = useKeyBinding();
    const { selectedLayer } = useLayer();
    const { layoutMode } = useLayoutSettings();
    const {
        setItemToEdit,
        setBindingTypeToEdit,
        setAlternativeHeader,
    } = usePanels();
    const [saving, setSaving] = useState(false);

    const isHorizontal = layoutMode === "bottombar";

    if (!keyboard) return null;

    const clearCombo = async (index: number) => {
        if (!keyboard.combos) return;
        const updatedCombos = [...keyboard.combos];
        updatedCombos[index] = {
            ...updatedCombos[index],
            keys: ["KC_NO", "KC_NO", "KC_NO", "KC_NO"],
            output: "KC_NO",
            options: ComboOptions.ENABLED,
        };
        const updatedKeyboard = { ...keyboard, combos: updatedCombos };
        setKeyboard(updatedKeyboard);

        try {
            await vialService.updateCombo(updatedKeyboard, index);
            await vialService.saveViable();
        } catch (err) {
            console.error("Failed to clear combo:", err);
        }
    };

    const findFirstEmptyCombo = (): number => {
        if (!keyboard.combos) return 0;
        for (let i = 0; i < keyboard.combos.length; i++) {
            const combo = keyboard.combos[i] as any;
            const hasInputs = combo.keys?.some((k: string) => k && k !== "KC_NO");
            const hasOutput = combo.output && combo.output !== "KC_NO";
            if (!hasInputs && !hasOutput) return i;
        }
        return keyboard.combos.length; // All full, return next index (might be out of bounds)
    };

    const handleAddCombo = () => {
        const emptyIndex = findFirstEmptyCombo();
        if (emptyIndex < (keyboard.combos?.length || 0)) {
            handleEdit(emptyIndex);
        }
    };

    // QSID 2 = Combo timeout
    const COMBO_TIMEOUT_QSID = 2;
    const isTimeoutSupported = keyboard.settings?.[COMBO_TIMEOUT_QSID] !== undefined;
    const comboTimeout = keyboard.settings?.[COMBO_TIMEOUT_QSID] ?? 50;

    const handleTimeoutChange = async (value: number) => {
        if (!isConnected) return;
        setSaving(true);
        try {
            const clamped = Math.max(0, Math.min(10000, value));
            const updated = {
                ...keyboard,
                settings: { ...keyboard.settings, [COMBO_TIMEOUT_QSID]: clamped }
            };
            setKeyboard(updated);
            await qmkService.push(updated, COMBO_TIMEOUT_QSID);
            await vialService.saveViable();
        } catch (err) {
            console.error("Failed to update combo timeout:", err);
        } finally {
            setSaving(false);
        }
    };

    const layerColorName = keyboard?.cosmetic?.layer_colors?.[selectedLayer] || "primary";
    const hoverBorderColor = hoverBorderClasses[layerColorName] || hoverBorderClasses["primary"];
    const hoverBackgroundColor = hoverBackgroundClasses[layerColorName] || hoverBackgroundClasses["primary"];
    const hoverHeaderClass = hoverHeaderClasses[layerColorName] || hoverHeaderClasses["primary"];

    const combos = keyboard.combos || [];

    const handleEdit = (index: number) => {
        setItemToEdit(index);
        setBindingTypeToEdit("combos");
        setAlternativeHeader(true);
    };

    const isEnabled = (options: number) => {
        return (options & ComboOptions.ENABLED) !== 0;
    };

    const handleToggleEnabled = async (index: number, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!keyboard.combos) return;

        const entry = keyboard.combos[index];
        const newOptions = entry.options ^ ComboOptions.ENABLED;

        const updatedCombos = [...keyboard.combos];
        updatedCombos[index] = { ...entry, options: newOptions };

        const updatedKeyboard = { ...keyboard, combos: updatedCombos };
        setKeyboard(updatedKeyboard);

        try {
            await vialService.updateCombo(updatedKeyboard, index);
            await vialService.saveViable();
        } catch (err) {
            console.error("Failed to toggle combo enabled:", err);
        }
    };

    const isKeyAssigned = (content: KeyContent | undefined) => {
        if (!content) return false;
        const top = content.top;
        const str = content.str;
        return (top && top !== "KC_NO" && top !== "TRNS") || (str && str !== "KC_NO" && str !== "");
    };

    const renderSmallKey = (content: KeyContent, idx: number, comboIndex: number) => {
        const hasContent = isKeyAssigned(content);
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
                    onClick={() => handleEdit(comboIndex)}
                    disableTooltip={true}
                />
            </div>
        );
    };

    // Horizontal grid layout for bottom panel
    if (isHorizontal) {
        return (
            <div className="flex flex-row gap-3 h-full items-start pt-2">
                {combos.map((comboEntry, i) => {
                    const combo = comboEntry as any as import("@/types/vial.types").ComboEntry;

                    const inputs = [0, 1, 2, 3].map(idx => ({
                        content: getKeyContents(keyboard, combo.keys[idx] || "KC_NO") as KeyContent,
                        id: idx
                    })).filter(k => isKeyAssigned(k.content));

                    const resultKeycode = combo.output;
                    const result = getKeyContents(keyboard, resultKeycode || "KC_NO") as KeyContent;
                    const hasAssignment = inputs.length > 0 || isKeyAssigned(result);

                    if (!hasAssignment) return null;

                    const enabled = isEnabled(combo.options);

                    return (
                        <div
                            key={i}
                            className={cn(
                                "relative flex flex-col bg-gray-50 rounded-lg p-2 cursor-pointer hover:bg-gray-100 transition-colors min-w-[100px] group",
                                !enabled && "opacity-50"
                            )}
                            onClick={() => handleEdit(i)}
                        >
                            {/* Delete button */}
                            <button
                                className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    clearCombo(i);
                                }}
                                title="Clear combo"
                            >
                                <X className="w-3 h-3 text-white" />
                            </button>
                            {/* Header with icon and label */}
                            <div className="flex flex-row items-center gap-2 mb-2">
                                <div className="w-5 h-5 text-slate-600 flex-shrink-0">
                                    <ComboIcon />
                                </div>
                                <span className="text-xs font-bold text-slate-600">Combo {i}</span>
                                <div
                                    className="ml-auto flex flex-row items-center gap-0.5 bg-gray-200/50 p-0.5 rounded-md border border-gray-300/50"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <button
                                        onClick={(e) => { if (!enabled) handleToggleEnabled(i, e); }}
                                        className={cn(
                                            "px-2 py-0.5 text-[10px] uppercase tracking-wide rounded-[3px] transition-all font-bold border",
                                            enabled
                                                ? "bg-black text-white shadow-sm border-black"
                                                : "text-gray-400 border-transparent hover:text-gray-600"
                                        )}
                                    >ON</button>
                                    <button
                                        onClick={(e) => { if (enabled) handleToggleEnabled(i, e); }}
                                        className={cn(
                                            "px-2 py-0.5 text-[10px] uppercase tracking-wide rounded-[3px] transition-all font-bold border",
                                            !enabled
                                                ? "bg-black text-white shadow-sm border-black"
                                                : "text-gray-400 border-transparent hover:text-gray-600"
                                        )}
                                    >OFF</button>
                                </div>
                            </div>
                            <div className="flex flex-row items-center justify-center gap-1 flex-wrap">
                                {inputs.map((input, idx) => (
                                    <React.Fragment key={input.id}>
                                        {idx > 0 && <Plus className="w-2 h-2 text-gray-400" />}
                                        {renderSmallKey(input.content, input.id, i)}
                                    </React.Fragment>
                                ))}
                                <ArrowRight className="w-3 h-3 text-gray-400 mx-1" />
                                {renderSmallKey(result, 4, i)}
                            </div>
                        </div>
                    );
                })}
                {/* Add new combo button */}
                {findFirstEmptyCombo() < (combos.length || 0) && (
                    <button
                        className="flex flex-col items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-lg p-2 min-w-[60px] h-[80px] transition-colors border-2 border-dashed border-gray-300 hover:border-gray-400"
                        onClick={handleAddCombo}
                        title="Add new combo"
                    >
                        <Plus className="w-6 h-6 text-gray-400" />
                    </button>
                )}
                {combos.filter(combo => {
                    const c = combo as any;
                    const inputs = [0, 1, 2, 3].map(idx => c.keys?.[idx]).filter(k => k && k !== "KC_NO");
                    return inputs.length > 0 || (c.output && c.output !== "KC_NO");
                }).length === 0 && (
                        <div className="text-center text-gray-500 py-4 px-6">
                            No combos configured.
                        </div>
                    )}
            </div>
        );
    }

    // Vertical list layout for sidebar (original)
    return (
        <section className="space-y-3 h-full max-h-full flex flex-col pt-3">
            {/* Combo Timeout Setting */}
            {isTimeoutSupported && isConnected && (
                <div className="px-3 pb-2 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex flex-col">
                            <span className="text-sm font-medium">Combo Timeout</span>
                            <span className="text-xs text-muted-foreground">0-10000 ms</span>
                        </div>
                        <Input
                            type="number"
                            value={comboTimeout}
                            min={0}
                            max={10000}
                            onChange={(e) => {
                                const newVal = parseInt(e.target.value) || 0;
                                handleTimeoutChange(newVal);
                            }}
                            disabled={saving}
                            className={cn("w-24 text-right select-text", saving && "opacity-50")}
                        />
                    </div>
                </div>
            )}

            {/* Scrollable Combos List */}
            <div className="flex flex-col overflow-auto flex-grow scrollbar-thin">
                {combos.map((comboEntry, i) => {
                    const combo = comboEntry as any as import("@/types/vial.types").ComboEntry;

                    const inputs = [0, 1, 2, 3].map(idx => ({
                        content: getKeyContents(keyboard, combo.keys[idx] || "KC_NO") as KeyContent,
                        id: idx
                    })).filter(k => isKeyAssigned(k.content));

                    const resultKeycode = combo.output;
                    const result = getKeyContents(keyboard, resultKeycode || "KC_NO") as KeyContent;
                    const hasAssignment = inputs.length > 0 || isKeyAssigned(result);

                    const enabled = isEnabled(combo.options);

                    const rowChildren = hasAssignment ? (
                        <div className="flex flex-row items-center gap-1 ml-4 overflow-hidden w-full">
                            {inputs.map((input, idx) => (
                                <React.Fragment key={input.id}>
                                    {idx > 0 && <Plus className="w-3 h-3 text-black" />}
                                    {renderSmallKey(input.content, input.id, i)}
                                </React.Fragment>
                            ))}
                            <ArrowRight className="w-3 h-3 text-black mx-1" />
                            {renderSmallKey(result, 4, i)}
                            <div
                                className="ml-auto mr-2 flex flex-row items-center gap-0.5 bg-gray-200/50 p-0.5 rounded-md border border-gray-300/50"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <button
                                    onClick={(e) => { if (!enabled) handleToggleEnabled(i, e); }}
                                    className={cn(
                                        "px-2 py-0.5 text-[10px] uppercase tracking-wide rounded-[3px] transition-all font-bold border",
                                        enabled
                                            ? "bg-black text-white shadow-sm border-black"
                                            : "text-gray-400 border-transparent hover:text-gray-600"
                                    )}
                                >ON</button>
                                <button
                                    onClick={(e) => { if (enabled) handleToggleEnabled(i, e); }}
                                    className={cn(
                                        "px-2 py-0.5 text-[10px] uppercase tracking-wide rounded-[3px] transition-all font-bold border",
                                        !enabled
                                            ? "bg-black text-white shadow-sm border-black"
                                            : "text-gray-400 border-transparent hover:text-gray-600"
                                    )}
                                >OFF</button>
                            </div>
                        </div>
                    ) : undefined;

                    const keyContents = { type: "combo" } as KeyContent;

                    return (
                        <SidebarItemRow
                            key={i}
                            index={i}
                            keyboard={keyboard}
                            label={i.toString()}
                            keycode={resultKeycode || "KC_NO"}
                            keyContents={keyContents}
                            onEdit={handleEdit}
                            onAssignKeycode={assignKeycode}
                            hoverBorderColor={hoverBorderColor}
                            hoverBackgroundColor={hoverBackgroundColor}
                            hoverLayerColor={layerColorName}
                            hoverHeaderClass={hoverHeaderClass}
                            showPreviewKey={false}
                            className={cn("py-4", !enabled && "opacity-50")}
                        >
                            {rowChildren}
                        </SidebarItemRow>
                    );
                })}

                {combos.length === 0 && (
                    <div className="text-center text-gray-500 mt-10">
                        No combos found.
                    </div>
                )}
            </div>
        </section>
    );
};

export default CombosPanel;
