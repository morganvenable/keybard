import { useBindingChanges } from "@/hooks/useBindingChanges";
import { useChanges } from "@/contexts/ChangesContext";
import React, { useState, useEffect } from "react";
import { Plus, ArrowRightFromLine } from "lucide-react";

import ComboIcon from "@/components/ComboIcon";
import OnOffToggle from "@/components/ui/OnOffToggle";
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
import DescriptionBlock from "@/layout/SecondarySidebar/components/DescriptionBlock";

const CombosPanel: React.FC = () => {
    const { keyboard, isConnected, setKeyboard } = useVial();
    const { queue } = useChanges();
    const persistBinding = useBindingChanges();
    const { assignKeycode } = useKeyBinding();
    const { selectedLayer } = useLayer();
    const { layoutMode } = useLayoutSettings();
    const {
        setItemToEdit,
        setBindingTypeToEdit,
        setAlternativeHeader,
        setInitialEditorSlot,
    } = usePanels();
    const [saving, setSaving] = useState(false);
    const [timeoutInput, setTimeoutInput] = useState<string>("");

    const isHorizontal = layoutMode === "bottombar";

    if (!keyboard) return null;

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

    // Sync local input state when keyboard state changes externally
    useEffect(() => {
        setTimeoutInput(String(comboTimeout));
    }, [comboTimeout]);

    const handleTimeoutBlur = async () => {
        if (!isConnected) return;
        const newVal = parseInt(timeoutInput) || 0;
        const clamped = Math.max(0, Math.min(10000, newVal));
        setTimeoutInput(String(clamped));
        if (clamped === comboTimeout) return;

        setSaving(true);
        try {
            const updated = {
                ...keyboard,
                settings: { ...keyboard.settings, [COMBO_TIMEOUT_QSID]: clamped }
            };
            setKeyboard(updated);
            await queue(`QMK setting ${COMBO_TIMEOUT_QSID}`, async () => {
                await qmkService.push(updated, COMBO_TIMEOUT_QSID);
                await vialService.saveSvil();
            }, { writeKey: `qmk:${COMBO_TIMEOUT_QSID}` });
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

    const handleEdit = (index: number, slot?: number) => {
        setItemToEdit(index);
        setBindingTypeToEdit("combos");
        setAlternativeHeader(true);
        if (slot !== undefined) {
            setInitialEditorSlot(slot);
        }
    };

    const isEnabled = (options: number) => {
        return (options & ComboOptions.ENABLED) !== 0;
    };

    const handleToggleEnabled = async (index: number, e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (!keyboard.combos) return;

        const entry = keyboard.combos[index];
        const newOptions = entry.options ^ ComboOptions.ENABLED;

        const updatedCombos = [...keyboard.combos];
        updatedCombos[index] = { ...entry, options: newOptions };

        const updatedKeyboard = { ...keyboard, combos: updatedCombos };
        setKeyboard(updatedKeyboard);

        await persistBinding(updatedKeyboard, "combo", index);
    };

    const isKeyAssigned = (content: KeyContent | undefined) => {
        if (!content) return false;
        const top = content.top;
        const str = content.str;
        return (top && top !== "KC_NO" && top !== "TRNS") || (str && str !== "KC_NO" && str !== "");
    };

    // Shared small key renderer
    const renderSmallKey = (content: KeyContent, idx: number, comboIndex: number, slot: number) => {
        const hasContent = isKeyAssigned(content);
        const label = (() => {
            const str = content?.str;
            if (!str) return "";
            const parts = str.split('\n');
            if (parts.length === 1) return parts[0];
            const keycode = content?.top || "";
            if (content?.type === 'modmask' && (keycode.includes("S(") || keycode.includes("LSFT") || keycode.includes("RSFT"))) {
                return parts[0];
            }
            return parts[parts.length - 1];
        })();
        return (
            <div key={idx} className="relative w-[30px] h-[30px]">
                <Key
                    isRelative
                    x={0} y={0} w={1} h={1} row={-1} col={-1}
                    keycode={content?.top || "KC_NO"}
                    label={label}
                    keyContents={content}
                    layerColor={hasContent ? "sidebar" : undefined}
                    className={hasContent ? "border-kb-gray" : "bg-transparent border border-kb-gray-border"}
                    headerClassName={hasContent ? "bg-kb-sidebar-dark" : "text-black"}
                    variant="small"
                    onClick={() => handleEdit(comboIndex, slot)}
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
                            {/* Header with icon and label */}
                            <div className="flex flex-row items-center gap-2 mb-2">
                                <div className="w-5 h-5 text-slate-600 flex-shrink-0">
                                    <ComboIcon />
                                </div>
                                <span className="text-xs font-bold text-slate-600">Combo {i}</span>
                                <OnOffToggle
                                    value={enabled}
                                    onToggle={() => handleToggleEnabled(i)}
                                    className="ml-auto scale-75 origin-right"
                                />
                            </div>
                            <div className="flex flex-row items-center justify-center gap-1 flex-wrap">
                                {inputs.map((input, idx) => (
                                    <React.Fragment key={input.id}>
                                        {idx > 0 && <Plus className="w-2 h-2 text-gray-400" />}
                                        {renderSmallKey(input.content, input.id, i, input.id)}
                                    </React.Fragment>
                                ))}
                                <ArrowRightFromLine className="w-3 h-3 text-gray-400 mx-1" />
                                {renderSmallKey(result, 4, i, 4)}
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
        <section className="space-y-3 flex flex-col pt-0">
            <div className="flex flex-col">
                <DescriptionBlock>
                    A chording type solution for adding custom actions. It lets you hit multiple keys at once and produce a different effect. For instance, hitting A and B within the combo term would hit ESC instead, or have it perform even more complex tasks.
                </DescriptionBlock>
                {/* Combo Timeout Setting */}
                {isTimeoutSupported && isConnected && (
                    <div className="px-3 pb-3 pt-3 border-t border-b border-gray-200 dark:border-gray-700">
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex flex-col">
                                <span className="text-sm font-medium">Combo Timeout</span>
                                <span className="text-xs text-muted-foreground">0-10000 ms</span>
                            </div>
                            <Input
                                type="number"
                                value={timeoutInput}
                                min={0}
                                max={10000}
                                onChange={(e) => setTimeoutInput(e.target.value)}
                                onBlur={handleTimeoutBlur}
                                disabled={saving}
                                className={cn("w-24 text-right select-text", saving && "opacity-50")}
                            />
                        </div>
                    </div>
                )}
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
                                    {renderSmallKey(input.content, input.id, i, input.id)}
                                </React.Fragment>
                            ))}
                            <ArrowRightFromLine className="w-3 h-3 text-black mx-1" />
                            {renderSmallKey(result, 4, i, 4)}
                            <OnOffToggle
                                value={enabled}
                                onToggle={() => handleToggleEnabled(i)}
                                className="ml-auto mr-2"
                            />
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
