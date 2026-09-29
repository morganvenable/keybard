import { FC, useEffect, useState } from "react";

import { Input } from "@/components/ui/input";
import { useKeyBinding } from "@/contexts/KeyBindingContext";
import { usePanels } from "@/contexts/PanelsContext";
import { useVial } from "@/contexts/VialContext";
import { useLayoutSettings } from "@/contexts/LayoutSettingsContext";
import { useDebounce } from "@uidotdev/usehooks";
import { TapdanceEntry } from "@/types/vial.types";
import { DragItem } from "@/contexts/DragContext";
import { vialService } from "@/services/vial.service";
import { isTapdanceKeycode } from "@/utils/keys";

import EditorKey from "./EditorKey";

const TapdanceEditor: FC = () => {
    const { keyboard, setKeyboard } = useVial();
    const { setPanelToGoBack, setAlternativeHeader, itemToEdit, initialEditorSlot } = usePanels();
    const { keyVariant, layoutMode } = useLayoutSettings();
    const currTapDance: TapdanceEntry | undefined = keyboard?.tapdances?.[itemToEdit!];
    const { selectTapdanceKey, selectedTarget } = useKeyBinding();

    const isHorizontal = layoutMode === "bottombar";

    // Responsive key sizes - use medium keys in horizontal mode for better focus
    const effectiveVariant = isHorizontal ? "medium" : keyVariant;
    const keySizeClass = effectiveVariant === 'small' ? 'w-[30px] h-[30px]' : effectiveVariant === 'medium' ? 'w-[45px] h-[45px]' : 'w-[60px] h-[60px]';
    const gapClass = isHorizontal ? 'gap-6' : (effectiveVariant === 'small' ? 'gap-3' : effectiveVariant === 'medium' ? 'gap-4' : 'gap-6');
    const paddingClass = isHorizontal ? 'px-6 py-4' : (effectiveVariant === 'small' ? 'pl-10 pb-20 pt-4' : effectiveVariant === 'medium' ? 'pl-14 pb-20 pt-6' : 'pl-[84px] pb-20 pt-8');
    const labelClass = effectiveVariant === 'small' ? 'text-xs' : effectiveVariant === 'medium' ? 'text-sm' : 'text-sm';

    const isSlotSelected = (slot: string) => {
        return selectedTarget?.type === "tapdance" && selectedTarget.tapdanceId === itemToEdit && selectedTarget.tapdanceSlot === slot;
    };

    const [tapMs, setTapMs] = useState(200);
    const debouncedTapMs = useDebounce(tapMs, 300);

    useEffect(() => {
        if (currTapDance) {
            setTapMs(currTapDance.tapping_term);
        }
    }, [itemToEdit]); // Use itemToEdit instead of currTapDance to avoid infinite loop

    const keys = {
        tap: currTapDance?.tap ?? "KC_NO",
        doubletap: currTapDance?.doubletap ?? "KC_NO",
        hold: currTapDance?.hold ?? "KC_NO",
        taphold: currTapDance?.taphold ?? "KC_NO",
    };

    useEffect(() => {
        setPanelToGoBack("tapdances");
        setAlternativeHeader(true);
    }, []);

    // Auto-select first slot when editor opens
    useEffect(() => {
        if (itemToEdit !== null && itemToEdit !== undefined) {
            selectTapdanceKey(itemToEdit, initialEditorSlot || "tap");
        }
    }, [itemToEdit, selectTapdanceKey, initialEditorSlot]);

    const updateTapMs = async (ms: number) => {
        if (keyboard?.tapdances && itemToEdit !== null) {
            const tapdances = [...keyboard.tapdances];
            if (tapdances[itemToEdit]) {
                tapdances[itemToEdit] = {
                    ...tapdances[itemToEdit],
                    tapping_term: ms,
                };
            }
            const updatedKeyboard = { ...keyboard, tapdances };
            setKeyboard(updatedKeyboard);
            try {
                await vialService.updateTapdance(updatedKeyboard, itemToEdit);
                await vialService.saveSvil();
            } catch (err) {
                console.error("Failed to update tapdance tapping term:", err);
            }
        }
    };
    useEffect(() => {
        updateTapMs(debouncedTapMs);
    }, [debouncedTapMs]);

    const updateKeyAssignment = async (slot: string, keycode: string) => {
        if (!keyboard?.tapdances || itemToEdit === null) return;
        // Prohibit nesting a tap dance inside a tap dance (drag-drop path). Nesting
        // triggers an infinite-recursion render crash. Clearing (KC_NO) is always allowed.
        if (isTapdanceKeycode(keycode)) {
            console.warn(
                `Blocked: cannot place a tap dance inside tap dance ${itemToEdit} (${slot}). Tap dances cannot contain other tap dances.`
            );
            return;
        }
        const tapdances = [...keyboard.tapdances];
        if (tapdances[itemToEdit]) {
            tapdances[itemToEdit] = {
                ...tapdances[itemToEdit],
                [slot]: keycode
            };
        }
        const updatedKeyboard = { ...keyboard, tapdances };
        setKeyboard(updatedKeyboard);
        try {
            await vialService.updateTapdance(updatedKeyboard, itemToEdit);
            await vialService.saveSvil();
        } catch (err) {
            console.error("Failed to update tapdance key:", err);
        }
    };

    // Handle Delete/Backspace for selected key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Delete" || e.key === "Backspace") {
                if (selectedTarget?.type === "tapdance" && selectedTarget.tapdanceId === itemToEdit && selectedTarget.tapdanceSlot) {
                    updateKeyAssignment(selectedTarget.tapdanceSlot, "KC_NO");
                }
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [selectedTarget, itemToEdit]);

    const handleDrop = async (slot: string, item: DragItem) => {
        if (item.editorType === "tapdance" && item.editorId === itemToEdit && item.editorSlot !== undefined) {
            const sourceSlot = item.editorSlot as keyof TapdanceEntry;
            const targetSlot = slot as keyof TapdanceEntry;
            if (sourceSlot === targetSlot) return;

            if (!keyboard?.tapdances || itemToEdit === null) return;
            const tapdances = [...keyboard.tapdances];

            if (tapdances[itemToEdit]) {
                const td = { ...tapdances[itemToEdit] };
                const sourceVal = td[sourceSlot];
                const targetVal = td[targetSlot];

                (td as Record<string, unknown>)[sourceSlot] = targetVal;
                (td as Record<string, unknown>)[targetSlot] = sourceVal;

                tapdances[itemToEdit] = td;
            }
            const updatedKeyboard = { ...keyboard, tapdances };
            setKeyboard(updatedKeyboard);
            try {
                await vialService.updateTapdance(updatedKeyboard, itemToEdit);
                await vialService.saveSvil();
            } catch (err) {
                console.error("Failed to update tapdance swap:", err);
            }
        } else {
            updateKeyAssignment(slot, item.keycode);
        }
    };

    const renderTapdanceKey = (label: string, keycode: string, type: "tap" | "hold" | "doubletap" | "taphold") => {
        const isSelected = isSlotSelected(type);
        const trashOffset = effectiveVariant === 'small' ? '-left-6' : effectiveVariant === 'medium' ? '-left-8' : '-left-10';
        const trashSize = effectiveVariant === 'small' ? 'w-3 h-3' : 'w-4 h-4';

        // Horizontal mode: label on top, key below
        if (isHorizontal) {
            return (
                <div className="flex flex-col items-center gap-1 group">
                    <span className={`${labelClass} font-medium text-slate-600`}>{label}</span>
                    <EditorKey
                        keycode={keycode}
                        selected={isSelected}
                        onClick={() => selectTapdanceKey(itemToEdit!, type)}
                        onClear={() => updateKeyAssignment(type, "KC_NO")}
                        onDrop={(item) => handleDrop(type, item)}
                        size={keySizeClass}
                        trashOffset="-bottom-5 left-1/2 -translate-x-1/2" // Custom offset for bottom center trash
                        // Note: EditorKey defaults to left-side trash. Overriding trashOffset might need wrapper adjustment or CSS.
                        // Wait, EditorKey implementation uses: `absolute ${trashOffset} top-0 h-full flex ...`
                        // Using `bottom-5` with `top-0` and `h-full` might conflict or stretch. 
                        // EditorKey's trash container is `top-0 h-full`. So vertical centering is enforced.
                        // The original TapdanceEditor horizontal mode used: `absolute -bottom-5 left-1/2 ...` OUTSIDE the Key but inside relative wrapper.
                        // Usage: `top-0` is hardcoded in EditorKey.
                        // I might need to make `EditorKey` more flexible if I want EXACT original layout.
                        // Or just accept the default left trash. "Code tidy up" often implies "UI consistency" too.
                        // Standardizing on left/side trash is probably better for consistency.
                        // Let's use standard side trash.
                        trashSize={trashSize}
                        variant={effectiveVariant}
                        wrapperClassName={`relative ${keySizeClass}`}
                        label={undefined}
                        labelClassName={undefined}
                        editorType="tapdance"
                        editorId={itemToEdit!}
                        editorSlot={type}
                    />
                </div>
            );
        }

        // Vertical mode: key on left, label on right
        return (
            <div className="relative w-full">
                <div className={`flex flex-row items-center gap-3 peer`}>
                    <EditorKey
                        keycode={keycode}
                        selected={isSelected}
                        onClick={() => selectTapdanceKey(itemToEdit!, type)}
                        onClear={() => updateKeyAssignment(type, "KC_NO")}
                        onDrop={(item) => handleDrop(type, item)}
                        size={keySizeClass}
                        trashOffset={trashOffset}
                        trashSize={trashSize}
                        variant={effectiveVariant}
                        wrapperClassName={`relative ${keySizeClass}`}
                        label={undefined}
                        labelClassName={undefined}
                        editorType="tapdance"
                        editorId={itemToEdit!}
                        editorSlot={type}
                    />
                    <span className={`${labelClass} font-medium text-slate-600`}>{label}</span>
                </div>
            </div>
        );
    };

    // Horizontal layout: 2x2 quad of keys + ms input
    if (isHorizontal) {
        return (
            <div className="flex flex-row items-center gap-10 px-8 py-3">
                {/* 2x2 grid of tap dance keys */}
                <div className="grid grid-cols-2 gap-5">
                    {renderTapdanceKey("Tap", keys.tap, "tap")}
                    {renderTapdanceKey("Hold", keys.hold, "hold")}
                    {renderTapdanceKey("Tap-Hold", keys.taphold, "taphold")}
                    {renderTapdanceKey("Double-Tap", keys.doubletap, "doubletap")}
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
            {renderTapdanceKey("Tap", keys.tap, "tap")}
            {renderTapdanceKey("Hold", keys.hold, "hold")}
            {renderTapdanceKey("Tap-Hold", keys.taphold, "taphold")}
            {renderTapdanceKey("Double-Tap", keys.doubletap, "doubletap")}

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
