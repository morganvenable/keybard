import { FC, useEffect } from "react";
import { ArrowRight, Trash2 } from "lucide-react";
import OnOffToggle from "@/components/ui/OnOffToggle";

import { Key } from "@/components/Key";
import { useKeyBinding } from "@/contexts/KeyBindingContext";
import { usePanels } from "@/contexts/PanelsContext";
import { useVial } from "@/contexts/VialContext";
import { getKeyContents } from "@/utils/keys";
import { AltRepeatKeyOptions } from "@/types/vial.types";
import { vialService } from "@/services/vial.service";

const OPTIONS = [
    { label: "Default to alternate", bit: AltRepeatKeyOptions.DEFAULT_TO_ALT, description: "Use alternate key as default output" },
    { label: "Bidirectional", bit: AltRepeatKeyOptions.BIDIRECTIONAL, description: "Mapping works both ways" },
    { label: "Ignore mod handedness", bit: AltRepeatKeyOptions.IGNORE_MOD_HANDEDNESS, description: "Ignore left/right modifier distinction" },
] as const;

const AltRepeatEditor: FC = () => {
    const { keyboard, setKeyboard } = useVial();
    const { itemToEdit, setPanelToGoBack, setAlternativeHeader } = usePanels();
    const { selectAltRepeatKey, selectedTarget } = useKeyBinding();

    const altRepeatIndex = itemToEdit!;
    const altRepeatEntry = keyboard?.alt_repeat_keys?.[altRepeatIndex];

    useEffect(() => {
        if (!keyboard?.alt_repeat_keys || itemToEdit === null) return;

        const entry = keyboard.alt_repeat_keys[itemToEdit];
        if (!entry) return;

        const hasKeycode = entry.keycode !== "KC_NO" && entry.keycode !== "";
        const hasAltKeycode = entry.alt_keycode !== "KC_NO" && entry.alt_keycode !== "";
        const isEmpty = !hasKeycode && !hasAltKeycode;
        const isEnabled = (entry.options & AltRepeatKeyOptions.ENABLED) !== 0;

        if (isEmpty && !isEnabled) {
            console.log("Auto-enabling empty alt repeat", itemToEdit);
            const updatedKeys = [...keyboard.alt_repeat_keys];
            const newOptions = (entry.options || 0) | AltRepeatKeyOptions.ENABLED;

            updatedKeys[itemToEdit] = {
                ...entry,
                options: newOptions
            };

            const updatedKeyboard = { ...keyboard, alt_repeat_keys: updatedKeys };
            setKeyboard(updatedKeyboard);

            vialService.updateAltRepeatKey(updatedKeyboard, itemToEdit)
                .catch(err => console.error("Failed to auto-enable alt repeat:", err));
        }

        selectAltRepeatKey(altRepeatIndex, "keycode");
        setPanelToGoBack("altrepeat");
        setAlternativeHeader(true);
    }, [altRepeatIndex, selectAltRepeatKey, setPanelToGoBack, setAlternativeHeader]);

    const isSlotSelected = (slot: "keycode" | "alt_keycode") => {
        return (
            selectedTarget?.type === "altrepeat" &&
            selectedTarget.altRepeatId === altRepeatIndex &&
            selectedTarget.altRepeatSlot === slot
        );
    };

    const updateOption = async (bit: number, checked: boolean) => {
        if (!keyboard || !altRepeatEntry) return;
        const updatedKeyboard = JSON.parse(JSON.stringify(keyboard));
        let options = updatedKeyboard.alt_repeat_keys[altRepeatIndex].options;
        if (checked) options |= bit;
        else options &= ~bit;
        updatedKeyboard.alt_repeat_keys[altRepeatIndex].options = options;
        setKeyboard(updatedKeyboard);

        try {
            await vialService.updateAltRepeatKey(updatedKeyboard, altRepeatIndex);
            await vialService.saveViable(); // Persist to EEPROM
        } catch (err) {
            console.error("Failed to update alt-repeat key:", err);
        }
    };

    const clearKey = async (slot: "keycode" | "alt_keycode") => {
        if (!keyboard || !altRepeatEntry) return;
        const updatedKeyboard = JSON.parse(JSON.stringify(keyboard));
        updatedKeyboard.alt_repeat_keys[altRepeatIndex][slot] = "KC_NO";
        setKeyboard(updatedKeyboard);

        try {
            await vialService.updateAltRepeatKey(updatedKeyboard, altRepeatIndex);
            await vialService.saveViable(); // Persist to EEPROM
        } catch (err) {
            console.error("Failed to update alt-repeat key:", err);
        }
    };

    const renderKey = (label: string, slot: "keycode" | "alt_keycode") => {
        if (!altRepeatEntry) return null;
        const keycode = altRepeatEntry[slot];
        const keyContents = getKeyContents(keyboard!, keycode || "KC_NO");
        const isSelected = isSlotSelected(slot);
        const hasContent = keycode && keycode !== "KC_NO";

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

        return (
            <div className="flex flex-col items-center gap-2 relative">
                <span className="text-sm font-bold text-slate-600">{label}</span>
                <div className="relative w-[60px] h-[60px] group/altrepeat-key">
                    <Key
                        isRelative
                        x={0}
                        y={0}
                        w={1}
                        h={1}
                        row={-1}
                        col={-1}
                        keycode={keycode || "KC_NO"}
                        label={keyContents?.str || ""}
                        keyContents={keyContents}
                        selected={isSelected}
                        onClick={() => selectAltRepeatKey(altRepeatIndex, slot)}
                        layerColor={keyColor}
                        className={keyClassName}
                        headerClassName={headerClass}
                        disableTooltip={true}
                    />
                    {hasContent && (
                        <div className="absolute -left-10 top-0 h-full flex items-center justify-center opacity-0 group-hover/altrepeat-key:opacity-100 group-hover/altrepeat-key:pointer-events-auto pointer-events-none transition-opacity">
                            <button
                                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    clearKey(slot);
                                }}
                                title="Clear key"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    if (!altRepeatEntry) return <div className="p-5">Alt-repeat entry not found</div>;



    return (
        <div className="flex flex-col gap-2 py-6 pl-[84px] pr-5 pb-4">


            {/* Key Slots */}
            <div className="flex flex-row gap-8 justify-start items-center">
                {renderKey("Trigger", "keycode")}
                <div className="pt-6 text-black -mr-1">
                    <ArrowRight className="w-6 h-6" />
                </div>
                {renderKey("Alternate", "alt_keycode")}
            </div>

            {/* Options Switches */}
            <div className="flex flex-col gap-1 mt-2">
                <span className="font-semibold text-lg text-slate-700">Options</span>
                {OPTIONS.map((opt) => (
                    <div key={opt.bit} className="flex flex-row items-center justify-between py-1">
                        <div className="flex flex-col gap-0.5">
                            <span className="text-sm font-medium text-slate-700">{opt.label}</span>
                            <span className="text-xs text-slate-500">{opt.description}</span>
                        </div>
                        <OnOffToggle
                            value={(altRepeatEntry?.options & opt.bit) !== 0}
                            onToggle={(val) => updateOption(opt.bit, val)}
                        />
                    </div>
                ))}
            </div>
        </div>
    );
};

export default AltRepeatEditor;
