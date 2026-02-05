import { FC, useState, useEffect } from "react";
import { ArrowRight } from "lucide-react";
import OnOffToggle from "@/components/ui/OnOffToggle";

import { useKeyBinding } from "@/contexts/KeyBindingContext";
import { usePanels } from "@/contexts/PanelsContext";
import { useVial } from "@/contexts/VialContext";
import { cn } from "@/lib/utils";

import OverrideModifierSelector from "./OverrideModifierSelector";

interface Props { }

const TABS = ["Trigger", "Negative", "Suspended"] as const;
type TabType = typeof TABS[number];

const OPTIONS = [
    { label: "Active on trigger down", bit: 1 << 0 },
    { label: "Active on mod down", bit: 1 << 1 },
    { label: "Active on negative mod down", bit: 1 << 2 },
    { label: "Active trigger mod activates", bit: 1 << 3 },
    { label: "Reregister trigger on deactivate", bit: 1 << 4 },
    { label: "No unregister on other key down", bit: 1 << 5 },
] as const;



const ENABLED_BIT = 1 << 7;

import { vialService } from "@/services/vial.service";
import EditorKey from "./EditorKey";

const OverrideEditor: FC<Props> = () => {
    const { keyboard, setKeyboard } = useVial();
    const { itemToEdit, setPanelToGoBack, setAlternativeHeader } = usePanels();
    const { selectOverrideKey, selectedTarget } = useKeyBinding();
    const [activeTab, setActiveTab] = useState<TabType>("Trigger");

    const overrideIndex = itemToEdit!;
    const override = keyboard?.key_overrides?.[overrideIndex];

    useEffect(() => {
        if (!keyboard?.key_overrides || itemToEdit === null) return;
        const entry = keyboard.key_overrides[itemToEdit];
        if (!entry) return;

        const hasTrigger = entry.trigger !== "KC_NO" && entry.trigger !== "";
        const hasReplacement = entry.replacement !== "KC_NO" && entry.replacement !== "";
        const isEmpty = !hasTrigger && !hasReplacement;
        const isEnabled = (entry.options & ENABLED_BIT) !== 0;

        if (isEmpty && !isEnabled) {
            console.log("Auto-enabling empty override", itemToEdit);
            const updatedOverrides = [...keyboard.key_overrides];
            const newOptions = (entry.options || 0) | ENABLED_BIT;

            updatedOverrides[itemToEdit] = {
                ...entry,
                options: newOptions
            };

            const updatedKeyboard = { ...keyboard, key_overrides: updatedOverrides };
            setKeyboard(updatedKeyboard);

            vialService.updateKeyoverride(updatedKeyboard, itemToEdit)
                .catch(err => console.error("Failed to auto-enable override:", err));
        }
    }, [itemToEdit]);

    useEffect(() => {
        selectOverrideKey(overrideIndex, "trigger");
        setPanelToGoBack("overrides");
        setAlternativeHeader(true);
    }, []);

    const isSlotSelected = (slot: "trigger" | "replacement") => {
        return (
            selectedTarget?.type === "override" &&
            selectedTarget.overrideId === overrideIndex &&
            selectedTarget.overrideSlot === slot
        );
    };

    const getActiveMask = () => {
        if (!override) return 0;
        switch (activeTab) {
            case "Trigger": return override.trigger_mods;
            case "Negative": return override.negative_mod_mask;
            case "Suspended": return override.suppressed_mods;
        }
    };

    const updateMask = (newMask: number) => {
        if (!keyboard || !override) return;
        const updatedKeyboard = JSON.parse(JSON.stringify(keyboard));
        const ovr = updatedKeyboard.key_overrides[overrideIndex];
        switch (activeTab) {
            case "Trigger": ovr.trigger_mods = newMask; break;
            case "Negative": ovr.negative_mod_mask = newMask; break;
            case "Suspended": ovr.suppressed_mods = newMask; break;
        }
        setKeyboard(updatedKeyboard);
    };

    const updateOption = (bit: number, checked: boolean) => {
        if (!keyboard || !override) return;
        const updatedKeyboard = JSON.parse(JSON.stringify(keyboard));
        let options = updatedKeyboard.key_overrides[overrideIndex].options;
        if (checked) options |= bit;
        else options &= ~bit;
        updatedKeyboard.key_overrides[overrideIndex].options = options;
        setKeyboard(updatedKeyboard);
    };

    const updateLayer = (layer: number, active: boolean) => {
        if (!keyboard || !override) return;
        const updatedKeyboard = JSON.parse(JSON.stringify(keyboard));
        let layers = updatedKeyboard.key_overrides[overrideIndex].layers;
        if (active) layers |= (1 << layer);
        else layers &= ~(1 << layer);
        updatedKeyboard.key_overrides[overrideIndex].layers = layers;
        setKeyboard(updatedKeyboard);
    };

    const clearKey = (slot: "trigger" | "replacement") => {
        if (!keyboard || !override) return;
        const updatedKeyboard = JSON.parse(JSON.stringify(keyboard));
        const ovr = updatedKeyboard.key_overrides[overrideIndex];
        if (slot === "trigger") ovr.trigger = "KC_NO";
        else ovr.replacement = "KC_NO";
        setKeyboard(updatedKeyboard);
    };

    const currentMask = getActiveMask();

    const renderOverrideKey = (label: string, slot: "trigger" | "replacement") => {
        if (!override) return null;
        const keycode = slot === "trigger" ? override.trigger : override.replacement;
        const isSelected = isSlotSelected(slot);

        return (
            <div className="flex flex-col items-center gap-2 relative">
                <span className="text-sm font-bold text-slate-600">{label}</span>
                <EditorKey
                    keycode={keycode}
                    selected={isSelected}
                    onClick={() => selectOverrideKey(overrideIndex, slot)}
                    onClear={() => clearKey(slot)}
                    size="w-[60px] h-[60px]"
                    // OverrideEditor renders trash at "-left-10" which is default for EditorKey
                    trashOffset="-left-10"
                    wrapperClassName="relative w-[60px] h-[60px] group/override-key"
                    variant="default"
                    label={undefined}
                    labelClassName={undefined}
                />
            </div>
        );
    };

    if (!override) return <div className="p-5">Override not found</div>;

    return (
        <div className="flex flex-col gap-2 py-6 pl-[84px] pr-5 pb-4">
            {/* Active Switch */}
            {/* Active Toggle */}


            <div className="flex flex-row gap-8 justify-start items-center">
                {renderOverrideKey("Trigger", "trigger")}
                <div className="pt-6 text-black -mr-1">
                    <ArrowRight className="w-6 h-6" />
                </div>
                {renderOverrideKey("Replacement", "replacement")}
            </div>

            {/* Tabs */}
            <div className="flex flex-row items-center bg-gray-200/50 p-1 rounded-lg border border-gray-400/50 w-full mt-4">
                {TABS.map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={cn(
                            "flex-1 py-1.5 text-xs uppercase tracking-wider rounded-md transition-all font-bold border-none",
                            activeTab === tab
                                ? "bg-black text-white shadow-md"
                                : "text-gray-500 hover:text-black hover:bg-white/50"
                        )}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {/* Modifiers Section */}
            <OverrideModifierSelector value={currentMask} onChange={updateMask} />

            {/* Layers Section */}
            <div className="flex flex-col gap-1.5">
                <span className="font-semibold text-lg text-slate-700">Layers</span>
                <div className="grid grid-cols-8 gap-2 w-fit">
                    {Array.from({ length: 16 }).map((_, i) => {
                        const isActive = (override.layers & (1 << i)) !== 0;
                        return (
                            <div
                                key={i}
                                className={cn(
                                    "w-10 h-10 flex items-center justify-center rounded-md cursor-pointer transition-colors text-sm font-medium",
                                    isActive
                                        ? "bg-kb-sidebar-dark text-white hover:bg-white hover:text-black"
                                        : "bg-kb-gray-medium text-slate-700 hover:bg-white hover:text-black"
                                )}
                                onClick={() => updateLayer(i, !isActive)}
                            >
                                {i}
                            </div>
                        );
                    })}
                </div>
            </div>



            {/* Options Switches */}
            <div className="flex flex-col gap-1 mt-2">
                {OPTIONS.map((opt) => (
                    <div key={opt.label} className="flex flex-row items-center justify-between py-1">
                        <div className="flex flex-col gap-0.5">
                            <span className="text-sm font-medium text-slate-700">{opt.label}</span>
                        </div>
                        <OnOffToggle
                            value={(override.options & opt.bit) !== 0}
                            onToggle={(val) => updateOption(opt.bit, val)}
                        />
                    </div>
                ))}
            </div>
        </div>
    );
};

export default OverrideEditor;
