import { useState, useCallback } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLayoutSettings } from "@/contexts/LayoutSettingsContext";
import { useVial } from "@/contexts/VialContext";
import { vialService } from "@/services/vial.service";
import type { FragmentInstance } from "@/types/vial.types";

/**
 * Safely get a value from something that might be a Map or a plain object
 * (handles JSON deserialization where Maps become objects)
 */
function safeMapGet<K extends string | number, V>(
    mapOrObj: Map<K, V> | Record<string, V> | undefined,
    key: K
): V | undefined {
    if (!mapOrObj) return undefined;
    if (mapOrObj instanceof Map) {
        return mapOrObj.get(key);
    }
    // Plain object - convert key to string for lookup
    return (mapOrObj as Record<string, V>)[String(key)];
}

/**
 * Fragment Selections Panel
 *
 * Allows users to select which physical component (fragment) is installed
 * at each position. Hardware-detected components are shown and some may
 * be locked depending on the keyboard configuration.
 */
const FragmentsPanel: React.FC = () => {
    const { keyboard, setKeyboard } = useVial();
    const [updating, setUpdating] = useState<number | null>(null);
    const { layoutMode } = useLayoutSettings();

    const isHorizontal = layoutMode === "bottombar";
    const fragmentService = vialService.getFragmentService();

    // Handle fragment selection change
    const handleSelectionChange = useCallback(async (
        instanceIdx: number,
        instance: FragmentInstance,
        newFragmentName: string
    ) => {
        if (!keyboard) return;

        setUpdating(instanceIdx);

        try {
            // Get option index for the selected fragment
            const optionIdx = fragmentService.getOptionIndex(instance, newFragmentName);

            // Try to update on device (will fail if not connected, but that's OK)
            let deviceSuccess = false;
            try {
                deviceSuccess = await vialService.updateFragmentSelection(keyboard, instanceIdx, optionIdx);
            } catch (e) {
                console.log("Device not connected, updating locally only");
            }

            // Always update local state (works in demo mode and connected mode)
            const newKeyboard = { ...keyboard };

            // Clone fragmentState and its Maps to ensure React detects the change
            // Need to create new Map references, not just shallow copy the object
            const oldState = keyboard.fragmentState;
            const newHwDetection: Map<number, number> = oldState?.hwDetection instanceof Map
                ? new Map(oldState.hwDetection)
                : new Map(Object.entries(oldState?.hwDetection ?? {}).map(([k, v]) => [Number(k), v as number]));
            const newEepromSelections: Map<number, number> = oldState?.eepromSelections instanceof Map
                ? new Map(oldState.eepromSelections)
                : new Map(Object.entries(oldState?.eepromSelections ?? {}).map(([k, v]) => [Number(k), v as number]));
            const newUserSelections: Map<string, string> = oldState?.userSelections instanceof Map
                ? new Map(oldState.userSelections)
                : new Map(Object.entries(oldState?.userSelections ?? {}).map(([k, v]) => [k, v as string]));

            newKeyboard.fragmentState = {
                hwDetection: newHwDetection,
                eepromSelections: newEepromSelections,
                userSelections: newUserSelections,
            };

            newKeyboard.fragmentState.userSelections.set(instance.id, newFragmentName);

            // Recompose keyboard layout with new fragment selection
            const fragmentComposer = vialService.getFragmentComposer();
            const composedLayout = fragmentComposer.composeLayout(newKeyboard);
            if (Object.keys(composedLayout).length > 0) {
                // Create a new object reference to ensure React detects the change
                newKeyboard.keylayout = { ...composedLayout };
                console.log("Fragment layout recomposed:", Object.keys(composedLayout).length, "keys", deviceSuccess ? "(saved to device)" : "(local only)");
            }

            setKeyboard(newKeyboard);
        } catch (error) {
            console.error("Failed to update fragment selection:", error);
        } finally {
            setUpdating(null);
        }
    }, [keyboard, setKeyboard, fragmentService]);

    // Check if keyboard has fragments
    if (!keyboard || !fragmentService.hasFragments(keyboard)) {
        return (
            <section className="space-y-3 h-full max-h-full flex flex-col pt-3">
                <div className="text-center text-gray-500 mt-10">
                    No fragment configuration available for this keyboard.
                </div>
            </section>
        );
    }

    const selectableInstances = fragmentService.getSelectableInstances(keyboard);

    if (selectableInstances.length === 0) {
        return (
            <section className="space-y-3 h-full max-h-full flex flex-col pt-3">
                <div className="text-center text-gray-500 mt-10">
                    No selectable fragment positions available.
                </div>
            </section>
        );
    }

    // Horizontal layout for bottom panel
    if (isHorizontal) {
        return (
            <div className="flex flex-row gap-3 h-full items-start flex-wrap content-start">
                {selectableInstances.map(({ idx, instance }) => {
                    const options = fragmentService.getFragmentOptions(instance);
                    const currentFragment = fragmentService.resolveFragment(keyboard, idx, instance);
                    const instanceDisplayName = fragmentService.getInstanceDisplayName(instance.id);
                    const isUpdating = updating === idx;

                    return (
                        <div key={instance.id} className="flex flex-col gap-1 min-w-[120px]">
                            <span className="text-[9px] font-bold text-slate-500 uppercase truncate">
                                {instanceDisplayName}
                            </span>
                            <Select
                                value={currentFragment}
                                onValueChange={(value) => handleSelectionChange(idx, instance, value)}
                                disabled={isUpdating}
                            >
                                <SelectTrigger className="h-7 text-xs">
                                    <SelectValue placeholder="Select" />
                                </SelectTrigger>
                                <SelectContent>
                                    {options.map((fragmentName) => (
                                        <SelectItem key={fragmentName} value={fragmentName} className="text-xs">
                                            {fragmentService.getFragmentDisplayName(keyboard, fragmentName)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    );
                })}
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <div className="flex flex-col overflow-auto scrollbar-thin px-4 gap-3 py-2">
                {selectableInstances.map(({ idx, instance }) => {
                    const options = fragmentService.getFragmentOptions(instance);
                    const currentFragment = fragmentService.resolveFragment(keyboard, idx, instance);

                    // Get hardware detection info (safe access handles Map or object)
                    const hwFragmentId = safeMapGet(keyboard.fragmentState?.hwDetection, idx);
                    const hwDetected = hwFragmentId !== undefined && hwFragmentId !== 0xff;
                    const hwFragmentName = hwDetected
                        ? fragmentService.getFragmentNameById(keyboard, hwFragmentId)
                        : undefined;

                    const allowOverride = instance.allow_override !== false;
                    const isLocked = hwDetected && !allowOverride;
                    const isUpdating = updating === idx;

                    // Build label with detection info
                    const instanceDisplayName = fragmentService.getInstanceDisplayName(instance.id);
                    let statusText = "";
                    if (hwDetected && hwFragmentName) {
                        const hwDisplayName = fragmentService.getFragmentDisplayName(keyboard, hwFragmentName);
                        statusText = isLocked
                            ? `Locked: ${hwDisplayName}`
                            : `Detected: ${hwDisplayName}`;
                    }

                    return (
                        <div
                            key={instance.id}
                            className="flex flex-row items-center p-3 gap-4 panel-layer-item group/item rounded-md"
                        >
                            <div className="flex flex-col items-start gap-1 shrink-0 w-[100px]">
                                <Label className="text-sm font-medium">
                                    {instanceDisplayName}
                                </Label>
                                {statusText && (
                                    <span className={`text-xs ${isLocked ? 'text-amber-600' : 'text-blue-600'}`}>
                                        {statusText}
                                    </span>
                                )}
                            </div>

                            <Select
                                value={currentFragment}
                                onValueChange={(value) => handleSelectionChange(idx, instance, value)}
                                disabled={isLocked || isUpdating}
                            >
                                <SelectTrigger className="flex-1 min-w-0">
                                    <SelectValue placeholder="Select fragment" />
                                </SelectTrigger>
                                <SelectContent>
                                    {options.map((fragmentName) => (
                                        <SelectItem key={fragmentName} value={fragmentName}>
                                            {fragmentService.getFragmentDisplayName(keyboard, fragmentName)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default FragmentsPanel;
