import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLayoutSettings } from "@/contexts/LayoutSettingsContext";
import { useVial } from "@/contexts/VialContext";
import { vialService } from "@/services/vial.service";
import type { FragmentInstance, KeyboardInfo } from "@/types/vial.types";

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
    const [updating, setUpdating] = useState<number | "bulk" | null>(null);
    const { layoutMode } = useLayoutSettings();

    const isHorizontal = layoutMode === "bottombar";
    const fragmentService = vialService.getFragmentService();

    const applyLocalSelections = useCallback((
        baseKeyboard: KeyboardInfo,
        selections: Array<{ instanceId: string; fragmentName: string }>
    ) => {
        const newKeyboard = { ...baseKeyboard };
        const oldState = baseKeyboard.fragmentState;
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

        selections.forEach(({ instanceId, fragmentName }) => {
            newKeyboard.fragmentState?.userSelections.set(instanceId, fragmentName);
        });

        const fragmentComposer = vialService.getFragmentComposer();
        const composedLayout = fragmentComposer.composeLayout(newKeyboard);
        if (Object.keys(composedLayout).length > 0) {
            newKeyboard.keylayout = { ...composedLayout };
            console.log("Fragment layout recomposed:", Object.keys(composedLayout).length, "keys");
        }

        setKeyboard(newKeyboard);
    }, [setKeyboard]);

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
            applyLocalSelections(keyboard, [{ instanceId: instance.id, fragmentName: newFragmentName }]);
            console.log("Fragment selection updated", deviceSuccess ? "(saved to device)" : "(local only)");

            if (deviceSuccess) {
                try {
                    await vialService.saveSvil();
                } catch (e) {
                    console.error("Failed to save fragment selection:", e);
                }
            }
        } catch (error) {
            console.error("Failed to update fragment selection:", error);
        } finally {
            setUpdating(null);
        }
    }, [keyboard, fragmentService, applyLocalSelections]);

    const resolveDefaultFragmentName = useCallback((instance: FragmentInstance): string | undefined => {
        const options = instance.fragment_options ?? [];
        if (options.length === 0) return undefined;

        const isThumb = instance.id.toLowerCase().includes("thumb");
        const findByName = (pattern: RegExp) => options.find((opt) => pattern.test(opt.fragment))?.fragment;
        const findByMatrixSize = (size: number) => options.find((opt) => opt.matrix_map.length === size)?.fragment;
        const fallback = options.find((opt) => opt.default)?.fragment ?? options[0]?.fragment;

        if (isThumb) {
            return (
                findByName(/thumb/i) ||
                findByName(/finger[_-]?6|6key|_6\b|6\b/i) ||
                findByMatrixSize(6) ||
                fallback
            );
        }

        return (
            findByName(/finger[_-]?5|5key|_5\b|5\b/i) ||
            findByMatrixSize(5) ||
            fallback
        );
    }, []);

    const handleApplyDefault = useCallback(async () => {
        if (!keyboard) return;

        const instances = fragmentService.getSelectableInstances(keyboard);
        const updates: Array<{
            idx: number;
            instance: FragmentInstance;
            fragmentName: string;
        }> = [];

        for (const { idx, instance } of instances) {
            const hwFragmentId = safeMapGet(keyboard.fragmentState?.hwDetection, idx);
            const hwDetected = hwFragmentId !== undefined && hwFragmentId !== 0xff;
            const allowOverride = instance.allow_override !== false;
            if (hwDetected && !allowOverride) {
                continue;
            }

            const targetFragment = resolveDefaultFragmentName(instance);
            if (!targetFragment) continue;

            const currentFragment = fragmentService.resolveFragment(keyboard, idx, instance);
            if (currentFragment === targetFragment) continue;

            updates.push({ idx, instance, fragmentName: targetFragment });
        }

        if (updates.length === 0) return;

        setUpdating("bulk");

        let deviceUpdated = false;
        for (const update of updates) {
            const optionIdx = fragmentService.getOptionIndex(update.instance, update.fragmentName);
            try {
                const success = await vialService.updateFragmentSelection(keyboard, update.idx, optionIdx);
                deviceUpdated = deviceUpdated || success;
            } catch {
                // Continue updating local state even if device is not connected
            }
        }

        applyLocalSelections(
            keyboard,
            updates.map(({ instance, fragmentName }) => ({ instanceId: instance.id, fragmentName }))
        );

        if (deviceUpdated) {
            try {
                await vialService.saveSvil();
            } catch (e) {
                console.error("Failed to save default fragment selections:", e);
            }
        }

        setUpdating(null);
    }, [keyboard, fragmentService, resolveDefaultFragmentName, applyLocalSelections]);

    // Check if keyboard has fragments
    if (!keyboard || !fragmentService.hasFragments(keyboard)) {
        return (
            <section className="space-y-3 h-full max-h-full flex flex-col pt-0">
                <div className="text-center text-gray-500 mt-10">
                    No fragment configuration available for this keyboard.
                </div>
            </section>
        );
    }

    const selectableInstances = fragmentService.getSelectableInstances(keyboard);

    if (selectableInstances.length === 0) {
        return (
            <section className="space-y-3 h-full max-h-full flex flex-col pt-0">
                <div className="text-center text-gray-500 mt-10">
                    No selectable fragment positions available.
                </div>
            </section>
        );
    }

    const getSide = (instanceId: string): "left" | "right" | "other" => {
        if (instanceId.startsWith("left")) return "left";
        if (instanceId.startsWith("right")) return "right";
        return "other";
    };

    const formatInstanceLabel = (displayName: string): string => {
        return displayName.replace(/^Left\s+/i, "").replace(/^Right\s+/i, "");
    };

    const leftInstances = selectableInstances.filter(({ instance }) => getSide(instance.id) === "left");
    const rightInstances = selectableInstances.filter(({ instance }) => getSide(instance.id) === "right");
    const otherInstances = selectableInstances.filter(({ instance }) => getSide(instance.id) === "other");

    // Horizontal layout for bottom panel
    if (isHorizontal) {
        return (
            <div className="flex flex-row gap-3 h-full items-start flex-wrap content-start">
                <div className="w-full">
                    <Button
                        type="button"
                        variant="default"
                        size="sm"
                        className="rounded-full px-4 bg-black text-white hover:bg-gray-800"
                        onClick={handleApplyDefault}
                        disabled={updating !== null}
                    >
                        Default
                    </Button>
                </div>
                {leftInstances.length > 0 && (
                    <div className="flex flex-col gap-2">
                        <span className="text-[10px] font-bold text-black uppercase">Left</span>
                        <div className="flex flex-row gap-3 flex-wrap">
                            {leftInstances.map(({ idx, instance }) => {
                                const options = fragmentService.getFragmentOptions(instance);
                                const currentFragment = fragmentService.resolveFragment(keyboard, idx, instance);
                                const instanceDisplayName = formatInstanceLabel(fragmentService.getInstanceDisplayName(instance.id));
                                const isUpdating = updating === idx || updating === "bulk";

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
                    </div>
                )}
                {rightInstances.length > 0 && (
                    <div className="flex flex-col gap-2">
                        <span className="text-[10px] font-bold text-black uppercase">Right</span>
                        <div className="flex flex-row gap-3 flex-wrap">
                            {rightInstances.map(({ idx, instance }) => {
                                const options = fragmentService.getFragmentOptions(instance);
                                const currentFragment = fragmentService.resolveFragment(keyboard, idx, instance);
                                const instanceDisplayName = formatInstanceLabel(fragmentService.getInstanceDisplayName(instance.id));
                                const isUpdating = updating === idx || updating === "bulk";

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
                    </div>
                )}
                {otherInstances.map(({ idx, instance }) => {
                    const options = fragmentService.getFragmentOptions(instance);
                    const currentFragment = fragmentService.resolveFragment(keyboard, idx, instance);
                    const instanceDisplayName = fragmentService.getInstanceDisplayName(instance.id);
                    const isUpdating = updating === idx || updating === "bulk";

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
                <div>
                    <Button
                        type="button"
                        variant="default"
                        size="sm"
                        className="rounded-full px-4 bg-black text-white hover:bg-gray-800"
                        onClick={handleApplyDefault}
                        disabled={updating !== null}
                    >
                        Default
                    </Button>
                </div>
                {leftInstances.length > 0 && (
                    <div className="flex flex-col gap-2">
                        <div className="text-sm font-semibold text-black">Left</div>
                        {leftInstances.map(({ idx, instance }) => {
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
                            const isUpdating = updating === idx || updating === "bulk";

                            // Build label with detection info
                            const instanceDisplayName = formatInstanceLabel(fragmentService.getInstanceDisplayName(instance.id));
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
                )}
                {rightInstances.length > 0 && (
                    <div className="flex flex-col gap-2">
                        <div className="text-sm font-semibold text-black">Right</div>
                        {rightInstances.map(({ idx, instance }) => {
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
                            const isUpdating = updating === idx || updating === "bulk";

                            // Build label with detection info
                            const instanceDisplayName = formatInstanceLabel(fragmentService.getInstanceDisplayName(instance.id));
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
                )}
                {otherInstances.map(({ idx, instance }) => {
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
                    const isUpdating = updating === idx || updating === "bulk";

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
