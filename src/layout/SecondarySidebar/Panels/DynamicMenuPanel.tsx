import { selectPointingMenu, type PointingMenuSection } from "@/utils/pointing-menu";
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { CustomUIRenderer } from "@/components/CustomUI";
import { customValueService } from "@/services/custom-value.service";
import { useChanges } from "@/contexts/ChangesContext";
import { useVial } from "@/contexts/VialContext";
import type { CustomUIMenuItem } from "@/types/vial.types";

/**
 * A custom-value SET (0x07) only updates the device's runtime value; it must be
 * followed by a SAVE (0x09) to persist to EEPROM, or the change is lost on the
 * next power cycle. We debounce the save per channel so dragging a slider (which
 * emits many onChange events) results in a single EEPROM write on settle rather
 * than one per tick.
 */
const CUSTOM_VALUE_SAVE_DEBOUNCE_MS = 600;

interface DynamicMenuPanelProps {
    menuIndex: number;
    /** When true, renders controls in a horizontal flow layout (for BottomPanel) */
    horizontal?: boolean;
    /** Let the containing panel own scrolling when this menu is embedded. */
    embedded?: boolean;
    section?: PointingMenuSection;
}

/**
 * Dynamic panel that renders a VIA3 custom UI menu
 * Seeds values from kbinfo.custom_values (loaded at connect time),
 * then refreshes from USB if connected for latest state.
 * On value change, updates both the keyboard and kbinfo.custom_values.
 */
const DynamicMenuPanel: React.FC<DynamicMenuPanelProps> = ({ menuIndex, horizontal = false, embedded = false, section = "all" }) => {
    const { keyboard, isConnected } = useVial();
    const { queue } = useChanges();
    const [values, setValues] = useState<Map<string, number>>(new Map());
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Pending debounced EEPROM saves, keyed by channel.
    const saveTimersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

    // Get the menu for this panel
    const menu = keyboard?.menus?.[menuIndex];
    const displayItems = useMemo(() => selectPointingMenu(
        (menu?.content ?? []) as CustomUIMenuItem[], section,
    ), [menu, section]);

    // Debounced persist of a channel's custom values to EEPROM.
    const scheduleSave = useCallback((channel: number) => {
        const timers = saveTimersRef.current;
        const existing = timers.get(channel);
        if (existing) clearTimeout(existing);
        timers.set(channel, setTimeout(() => {
            timers.delete(channel);
            customValueService.save(channel).catch(err =>
                console.error(`Failed to persist custom values (channel ${channel}):`, err));
        }, CUSTOM_VALUE_SAVE_DEBOUNCE_MS));
    }, []);

    // Flush any pending saves immediately (e.g. on unmount) so a change made
    // right before the panel closes still reaches EEPROM.
    useEffect(() => {
        const timers = saveTimersRef.current;
        return () => {
            for (const [channel, timer] of timers) {
                clearTimeout(timer);
                customValueService.save(channel).catch(err =>
                    console.error(`Failed to persist custom values (channel ${channel}):`, err));
            }
            timers.clear();
        };
    }, []);

    // Load values when panel opens or keyboard connects
    useEffect(() => {
        if (!menu) {
            setLoading(false);
            return;
        }

        const loadValues = async () => {
            setLoading(true);
            setError(null);
            try {
                // First: seed from kbinfo.custom_values (instant, no USB)
                if (keyboard?.custom_values) {
                    customValueService.populateCacheFromEntries(keyboard.custom_values);
                }

                // If connected: fetch fresh values from USB for latest state
                if (isConnected) {
                    await customValueService.loadMenuValues([menu]);
                }

                setValues(customValueService.getCache());
            } catch (err) {
                console.error("Failed to load custom values:", err);
                setError("Failed to load settings from keyboard");
            } finally {
                setLoading(false);
            }
        };

        loadValues();
    }, [menu, isConnected, keyboard?.custom_values]);

    // Handle value changes - update USB, cache, and kbinfo.custom_values
    const handleValueChange = useCallback(async (key: string, value: number) => {
        if (!menu || !isConnected) return;

        // Optimistically update local state so UI reflects change immediately
        setValues(prev => new Map(prev).set(key, value));

        await queue(
            `custom_ui_${key}`,
            async () => {
                try {
                    await customValueService.setValue(key, value, [menu]);

                    // Persist to EEPROM so the change survives a power cycle.
                    // A SET alone only updates the runtime value. Debounced per
                    // channel so slider drags don't thrash the flash.
                    const itemsWithRefs = customValueService.extractAllItemsWithRefs([menu]);
                    const found = itemsWithRefs.find(({ ref }) => ref.key === key);
                    if (found) scheduleSave(found.ref.channel);

                    // Update kbinfo.custom_values so export stays current
                    if (keyboard?.custom_values) {
                        const entry = keyboard.custom_values.find(e => e.key === key);
                        if (entry) {
                            const width = found ? customValueService.getByteWidth(found.item) : entry.data.length;
                            entry.data = customValueService.intToBytes(value, width);
                        }
                    }
                } catch (err) {
                    console.error(`Failed to set ${key}:`, err);
                }
            },
            { type: "custom_ui" as any }
        );
    }, [menu, isConnected, queue, keyboard, scheduleSave]);

    // Handle button clicks (special actions)
    const handleButtonClick = useCallback(async (key: string) => {
        if (!menu || !isConnected) return;

        // For buttons, we typically send a value of 1 to trigger the action
        try {
            await customValueService.setValue(key, 1, [menu]);

            // Persist to EEPROM (debounced per channel), same as value changes.
            const itemsWithRefs = customValueService.extractAllItemsWithRefs([menu]);
            const found = itemsWithRefs.find(({ ref }) => ref.key === key);
            if (found) scheduleSave(found.ref.channel);
        } catch (err) {
            console.error(`Failed to execute ${key}:`, err);
        }
    }, [menu, isConnected, scheduleSave]);

    // No menu found
    if (!menu) {
        return (
            <section className={`${embedded ? "" : "h-full "}flex flex-col items-center justify-center p-4`}>
                <p className="text-muted-foreground">Menu not found</p>
            </section>
        );
    }

    // Not connected
    if (!isConnected) {
        return (
            <section className={`${embedded ? "" : "h-full "}flex flex-col p-4`}>
                <h2 className="text-lg font-semibold mb-4">{menu.label}</h2>
                <p className="text-muted-foreground">Connect to a keyboard to view settings</p>
            </section>
        );
    }

    // Loading
    if (loading) {
        return (
            <section className={`${embedded ? "" : "h-full "}flex flex-col p-4`}>
                <h2 className="text-lg font-semibold mb-4">{menu.label}</h2>
                <p className="text-muted-foreground">Loading settings...</p>
            </section>
        );
    }

    // Error
    if (error) {
        return (
            <section className={`${embedded ? "" : "h-full "}flex flex-col p-4`}>
                <h2 className="text-lg font-semibold mb-4">{menu.label}</h2>
                <p className="text-red-500">{error}</p>
            </section>
        );
    }

    // Render the menu
    // Horizontal mode: compact flowing layout for bottom panel
    // Vertical mode: title on top, controls stacked below
    if (horizontal) {
        return (
            <section className={embedded ? "px-2 py-1" : "h-full overflow-auto px-2 py-1"}>
                <CustomUIRenderer
                    items={displayItems}
                    values={values}
                    onValueChange={handleValueChange}
                    onButtonClick={handleButtonClick}
                    horizontal
                    compact
                />
            </section>
        );
    }

    return (
        <section className={embedded ? "" : "h-full flex flex-col overflow-hidden"}>
            <div className={embedded ? "pb-4" : "flex-1 overflow-auto pb-4"}>
                <CustomUIRenderer
                    items={displayItems}
                    values={values}
                    onValueChange={handleValueChange}
                    onButtonClick={handleButtonClick}
                />
            </div>
        </section>
    );
};

export default DynamicMenuPanel;
