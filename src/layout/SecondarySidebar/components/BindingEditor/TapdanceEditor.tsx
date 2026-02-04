import { FC, useEffect, useState } from "react";

import { Input } from "@/components/ui/input";
import { useKeyBinding } from "@/contexts/KeyBindingContext";
import { usePanels } from "@/contexts/PanelsContext";
import { useVial } from "@/contexts/VialContext";
import { useLayoutSettings } from "@/contexts/LayoutSettingsContext";
import { getKeyContents } from "@/utils/keys";
import { useDebounce } from "@uidotdev/usehooks";
import { Key } from "@/components/Key";

import { Trash2 } from "lucide-react";

interface Props { }

const TapdanceEditor: FC<Props> = () => {
    const { keyboard, setKeyboard } = useVial();
    const { setPanelToGoBack, setAlternativeHeader, itemToEdit } = usePanels();
    const { keyVariant, layoutMode } = useLayoutSettings();
    const currTapDance = (keyboard as any).tapdances?.[itemToEdit!];
    const { selectTapdanceKey, selectedTarget } = useKeyBinding();

    const isHorizontal = layoutMode === "bottombar";

    // Responsive key sizes - use medium keys in horizontal mode for better focus
    const effectiveVariant = isHorizontal ? "medium" : keyVariant;
    const keySizeClass = effectiveVariant === 'small' ? 'w-[30px] h-[30px]' : effectiveVariant === 'medium' ? 'w-[45px] h-[45px]' : 'w-[60px] h-[60px]';
    const gapClass = isHorizontal ? 'gap-6' : (effectiveVariant === 'small' ? 'gap-3' : effectiveVariant === 'medium' ? 'gap-4' : 'gap-6');
    const paddingClass = isHorizontal ? 'px-6 py-4' : (effectiveVariant === 'small' ? 'pl-10 py-4' : effectiveVariant === 'medium' ? 'pl-14 py-6' : 'pl-[84px] py-8');
    const labelClass = effectiveVariant === 'small' ? 'text-xs' : effectiveVariant === 'medium' ? 'text-sm' : 'text-sm';
    const isSlotSelected = (slot: string) => {
        return selectedTarget?.type === "tapdance" && selectedTarget.tapdanceId === itemToEdit && selectedTarget.tapdanceSlot === slot;
    };
    const [tapMs, setTapMs] = useState(200);
    const debouncedTapMs = useDebounce(tapMs, 300);
    useEffect(() => {
        if (currTapDance) {
            setTapMs(currTapDance.tapms);
        }
    }, [itemToEdit]); // Use itemToEdit instead of currTapDance to avoid infinite loop
    const keys = {
        tap: getKeyContents(keyboard!, currTapDance?.tap || "KC_NO"),
        doubletap: getKeyContents(keyboard!, currTapDance?.doubletap || "KC_NO"),
        hold: getKeyContents(keyboard!, currTapDance?.hold || "KC_NO"),
        taphold: getKeyContents(keyboard!, currTapDance?.taphold || "KC_NO"),
    };

    useEffect(() => {
        setPanelToGoBack("tapdances");
        setAlternativeHeader(true);
    }, []);

    // Auto-select first slot when editor opens
    useEffect(() => {
        if (itemToEdit !== null && itemToEdit !== undefined) {
            selectTapdanceKey(itemToEdit, "tap");
        }
    }, [itemToEdit, selectTapdanceKey]);

    const updateTapMs = (ms: number) => {
        if (keyboard && (keyboard as any).tapdances && itemToEdit !== null) {
            const updatedKeyboard = { ...keyboard };
            const tapdances = [...(updatedKeyboard as any).tapdances];
            if (tapdances[itemToEdit]) {
                tapdances[itemToEdit] = {
                    ...tapdances[itemToEdit],
                    tapms: ms,
                };
            }
            (updatedKeyboard as any).tapdances = tapdances;
            setKeyboard(updatedKeyboard);
        }
    };
    useEffect(() => {
        updateTapMs(debouncedTapMs);
    }, [debouncedTapMs]);

    const updateKeyAssignment = (slot: string, keycode: string) => {
        if (!keyboard || itemToEdit === null) return;
        const updatedKeyboard = { ...keyboard };
        const tapdances = [...(updatedKeyboard as any).tapdances];
        if (tapdances[itemToEdit]) {
            tapdances[itemToEdit] = {
                ...tapdances[itemToEdit],
                [slot]: keycode
            };
        }
        (updatedKeyboard as any).tapdances = tapdances;
        setKeyboard(updatedKeyboard);
    };

    // Handle Delete/Backspace for selected key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Delete" || e.key === "Backspace") {
                if (selectedTarget?.type === "tapdance" && selectedTarget.tapdanceId === itemToEdit && selectedTarget.tapdanceSlot) {
                    // Update key assignment directly instead of using assignKeycode which might context switch
                    // Actually assignKeycode uses selected target so it's fine, but consistent direct update is safer for local logic
                    updateKeyAssignment(selectedTarget.tapdanceSlot, "KC_NO");
                }
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [selectedTarget, itemToEdit]);



    const renderKey = (label: string, content: any, type: "tap" | "hold" | "doubletap" | "taphold") => {
        const isSelected = isSlotSelected(type);
        const hasContent = (content?.top && content.top !== "KC_NO") || (content?.str && content.str !== "KC_NO" && content.str !== "");

        let keyColor: string | undefined;
        let keyClassName: string;
        let headerClass: string;

        if (isSelected) {
            // Selected: Red BG (handled by Key), Red Border
            keyColor = undefined;
            keyClassName = "border-2 border-red-600";
            headerClass = "bg-black/20"; // Subtle header for red background
        } else if (hasContent) {
            // Assigned: Black Key
            keyColor = "sidebar";
            keyClassName = "border-kb-gray";
            headerClass = "bg-kb-sidebar-dark";
        } else {
            // Empty: Transparent + Black Border
            keyColor = undefined;
            keyClassName = "bg-transparent border-2 border-black";
            headerClass = "text-black";
        }

        const trashOffset = effectiveVariant === 'small' ? '-left-6' : effectiveVariant === 'medium' ? '-left-8' : '-left-10';
        const trashSize = effectiveVariant === 'small' ? 'w-3 h-3' : 'w-4 h-4';

        // Horizontal mode: label on top, key below
        if (isHorizontal) {
            return (
                <div className="flex flex-col items-center gap-1 group">
                    <span className={`${labelClass} font-medium text-slate-600`}>{label}</span>
                    <div className={`relative ${keySizeClass}`}>
                        <Key
                            isRelative
                            x={0}
                            y={0}
                            w={1}
                            h={1}
                            row={-1}
                            col={-1}
                            keycode={content?.top || "KC_NO"}
                            label={content?.str || ""}
                            keyContents={content}
                            selected={isSlotSelected(type)}
                            onClick={() => selectTapdanceKey(itemToEdit!, type)}
                            layerColor={keyColor}
                            className={keyClassName}
                            headerClassName={headerClass}
                            variant={effectiveVariant}
                            disableTooltip={true}
                        />
                        {hasContent && (
                            <button
                                className="absolute -bottom-5 left-1/2 -translate-x-1/2 p-0.5 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => updateKeyAssignment(type, "KC_NO")}
                                title="Clear key"
                            >
                                <Trash2 className="w-3 h-3" />
                            </button>
                        )}
                    </div>
                </div>
            );
        }

        // Vertical mode: key on left, label on right
        return (
            <div className="relative w-full">
                <div className={`flex flex-row items-center gap-3 peer`}>
                    <div className={`relative ${keySizeClass}`}>
                        <Key
                            isRelative
                            x={0}
                            y={0}
                            w={1}
                            h={1}
                            row={-1}
                            col={-1}
                            keycode={content?.top || "KC_NO"}
                            label={content?.str || ""}
                            keyContents={content}
                            selected={isSlotSelected(type)}
                            onClick={() => selectTapdanceKey(itemToEdit!, type)}
                            layerColor={keyColor}
                            className={keyClassName}
                            headerClassName={headerClass}
                            variant={effectiveVariant}
                            disableTooltip={true}
                        />
                    </div>
                    <span className={`${labelClass} font-medium text-slate-600`}>{label}</span>
                </div>
                {hasContent && (
                    <div className={`absolute ${trashOffset} top-0 h-full flex items-center justify-center opacity-0 peer-hover:opacity-100 hover:opacity-100 transition-opacity`}>
                        <button
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full"
                            onClick={() => updateKeyAssignment(type, "KC_NO")}
                            title="Clear key"
                        >
                            <Trash2 className={trashSize} />
                        </button>
                    </div>
                )}
            </div>
        );
    };

    // Horizontal layout: 2x2 quad of keys + ms input
    if (isHorizontal) {
        return (
            <div className="flex flex-row items-center gap-10 px-8 py-3">
                {/* 2x2 grid of tap dance keys */}
                <div className="grid grid-cols-2 gap-5">
                    {renderKey("Tap", keys.tap, "tap")}
                    {renderKey("Hold", keys.hold, "hold")}
                    {renderKey("Tap-Hold", keys.taphold, "taphold")}
                    {renderKey("Double-Tap", keys.doubletap, "doubletap")}
                </div>

                {/* Hold time input */}
                <div className="flex flex-row gap-3 items-center">
                    <span className="text-sm font-medium text-slate-600">Hold Time (ms)</span>
                    <Input
                        value={tapMs || 0}
                        type="number"
                        onChange={(e) => setTapMs(e.target.valueAsNumber || 0)}
                        min={0}
                        step={25}
                        className="w-20 h-10 bg-white text-center text-base px-2"
                    />
                </div>
            </div>
        );
    }

    // Vertical layout: keys stacked with ms input at the bottom
    return (
        <div className={`flex flex-col ${gapClass} ${paddingClass}`}>
            {renderKey("Tap", keys.tap, "tap")}
            {renderKey("Hold", keys.hold, "hold")}
            {renderKey("Tap-Hold", keys.taphold, "taphold")}
            {renderKey("Double-Tap", keys.doubletap, "doubletap")}

            <div className="flex flex-row gap-3 items-center mt-4">
                <span className="text-md font-normal text-slate-600">Milliseconds</span>
                <Input
                    value={tapMs}
                    type="number"
                    onChange={(e) => setTapMs(e.target.valueAsNumber)}
                    min={0}
                    step={25}
                    className="w-32 bg-white"
                    placeholder="Tap MS"
                />
            </div>
        </div>
    );
};

export default TapdanceEditor;
