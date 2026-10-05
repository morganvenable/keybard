import { useChanges } from "@/contexts/ChangesContext";
import React, { useId, useState } from "react";
import { ChevronDown } from "lucide-react";

import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { useVial } from "@/contexts/VialContext";
import { QMK_SETTINGS } from "@/constants/qmk-settings";
import { qmkService } from "@/services/qmk.service";
import { vialService } from "@/services/vial.service";
import { cn } from "@/lib/utils";
import type { QMKSettingsField } from "@/types/qmk";

// TODO: Remove "Combo" and "Leader Key" sections from this panel after the timing
// settings are fully tested in their respective feature panels (CombosPanel, LeadersPanel).
// These duplicates exist temporarily to allow side-by-side comparison during testing.

const QMKSettingsPanel: React.FC = () => {
    const { keyboard, setKeyboard } = useVial();
    const { queue } = useChanges();
    const panelId = useId();
    const [expanded, setExpanded] = useState<Record<string, boolean>>({
        "Magic": false,
        "Grave Escape": false,
        "Tap-Hold": true,
        "Auto Shift": false,
        "Combo": false,
        "One Shot Keys": false,
        "Mouse keys": false,
        "Leader Key": true, // Default open since user needs this for leader sequences
    });
    const [saving, setSaving] = useState<Record<string, boolean>>({});

    if (!keyboard) return null;

    // Check if keyboard has QMK settings
    if (!keyboard.settings || Object.keys(keyboard.settings).length === 0) {
        return (
            <section className="space-y-3 flex flex-col pt-0">
                <div className="px-4 text-center text-muted-foreground">
                    <p className="font-medium">No QMK Settings Available</p>
                    <p className="text-sm mt-2">
                        This keyboard does not support QMK settings, or settings have not been loaded yet.
                    </p>
                </div>
            </section>
        );
    }

    const toggleSection = (name: string) => {
        setExpanded(prev => ({ ...prev, [name]: !prev[name] }));
    };

    // Get value from settings, accounting for bit fields
    const getBoolValue = (qsid: number, bit?: number): boolean => {
        const value = keyboard.settings?.[qsid] ?? 0;
        if (bit === undefined) {
            // Standalone boolean - non-zero is true
            return value !== 0;
        }
        // Bit field - extract specific bit
        return ((value >> bit) & 1) === 1;
    };

    const getIntValue = (qsid: number): number => {
        return keyboard.settings?.[qsid] ?? 0;
    };

    // Check if a QSID is supported by this keyboard
    const isSupported = (qsid: number): boolean => {
        return keyboard.settings?.[qsid] !== undefined;
    };

    // Handle boolean toggle (with or without bit field)
    const handleBoolToggle = async (qsid: number, bit: number | undefined, checked: boolean) => {
        const key = `${qsid}-${bit ?? 'full'}`;
        setSaving(prev => ({ ...prev, [key]: true }));

        try {
            let newVal: number;
            if (bit === undefined) {
                // Standalone boolean
                newVal = checked ? 1 : 0;
            } else {
                // Bit field
                const currentVal = keyboard.settings?.[qsid] ?? 0;
                newVal = checked
                    ? currentVal | (1 << bit)      // Set bit
                    : currentVal & ~(1 << bit);    // Clear bit
            }

            const updated = {
                ...keyboard,
                settings: { ...keyboard.settings, [qsid]: newVal }
            };
            setKeyboard(updated);

            await queue(`QMK setting ${qsid}`, async () => {
                await qmkService.push(updated, qsid);
                await vialService.saveSvil();
            }, { writeKey: `qmk:${qsid}` });
        } catch (err) {
            console.error("Failed to update QMK setting:", err);
        } finally {
            setSaving(prev => ({ ...prev, [key]: false }));
        }
    };

    // Handle integer change
    const handleIntChange = async (qsid: number, value: number, min: number, max: number) => {
        const key = `${qsid}-int`;
        setSaving(prev => ({ ...prev, [key]: true }));

        try {
            const clamped = Math.max(min, Math.min(max, value));
            const updated = {
                ...keyboard,
                settings: { ...keyboard.settings, [qsid]: clamped }
            };
            setKeyboard(updated);

            await queue(`QMK setting ${qsid}`, async () => {
                await qmkService.push(updated, qsid);
                await vialService.saveSvil();
            }, { writeKey: `qmk:${qsid}` });
        } catch (err) {
            console.error("Failed to update QMK setting:", err);
        } finally {
            setSaving(prev => ({ ...prev, [key]: false }));
        }
    };

    // Render a single field
    const renderField = (field: QMKSettingsField, index: number) => {
        // Check if this QSID is supported
        if (!isSupported(field.qsid)) {
            return null;
        }

        if (field.type === "boolean") {
            const key = `${field.qsid}-${field.bit ?? 'full'}`;
            const isSaving = saving[key];
            const checked = getBoolValue(field.qsid, field.bit);

            return (
                <div
                    key={`${field.qsid}-${field.bit ?? 'full'}-${index}`}
                    className="flex flex-row items-center justify-between py-2 px-1"
                >
                    <span className="text-sm">{field.title}</span>
                    <Switch
                        aria-label={field.title}
                        checked={checked}
                        onCheckedChange={(c) => handleBoolToggle(field.qsid, field.bit, c)}
                        disabled={isSaving}
                        className={cn(isSaving && "opacity-50")}
                    />
                </div>
            );
        }

        if (field.type === "integer") {
            const key = `${field.qsid}-int`;
            const isSaving = saving[key];
            const value = getIntValue(field.qsid);

            return (
                <div
                    key={`${field.qsid}-${index}`}
                    className="flex flex-row items-center justify-between py-2 px-1 gap-4"
                >
                    <div className="flex flex-col flex-1 min-w-0">
                        <span className="text-sm">{field.title}</span>
                        <span className="text-xs text-muted-foreground">
                            Range: {field.min} - {field.max}
                        </span>
                    </div>
                    <Input
                        type="number"
                        aria-label={field.title}
                        value={value}
                        min={field.min}
                        max={field.max}
                        onChange={(e) => {
                            const newVal = parseInt(e.target.value) || 0;
                            handleIntChange(field.qsid, newVal, field.min, field.max);
                        }}
                        disabled={isSaving}
                        className={cn("w-24 text-right select-text", isSaving && "opacity-50")}
                    />
                </div>
            );
        }

        return null;
    };

    // Render a section
    const renderSection = (name: string, fields: QMKSettingsField[]) => {
        // Filter to only supported fields
        const supportedFields = fields.filter(f => isSupported(f.qsid));
        if (supportedFields.length === 0) {
            return null;
        }

        const isExpanded = expanded[name];

        return (
            <div key={name} className="border-b border-gray-200 dark:border-gray-700">
                <button
                    type="button"
                    aria-expanded={!!isExpanded}
                    aria-controls={`${panelId}-${encodeURIComponent(name)}`}
                    onClick={() => toggleSection(name)}
                    className="flex justify-between items-center w-full p-3 hover:bg-muted/50 transition-colors"
                >
                    <span className="font-medium text-sm">{name}</span>
                    <ChevronDown
                        className={cn(
                            "h-4 w-4 transition-transform duration-200",
                            isExpanded && "rotate-180"
                        )}
                    />
                </button>
                {isExpanded && (
                    <div id={`${panelId}-${encodeURIComponent(name)}`} className="px-3 pb-3 space-y-1">
                        {supportedFields.map((field, index) => renderField(field, index))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <section className="space-y-0 flex flex-col">
            {/* Header */}
            <div className="px-3 py-3 border-b border-gray-200 dark:border-gray-700">
                <h2 className="font-semibold text-sm">QMK Settings</h2>
                <p className="text-xs text-muted-foreground mt-1">
                    Configure firmware behavior. Changes follow your update mode.
                </p>
            </div>

            {/* Scrollable sections */}
            <div className="flex flex-col">
                {QMK_SETTINGS.tabs.map(tab => renderSection(tab.name, tab.fields))}
            </div>
        </section>
    );
};

export default QMKSettingsPanel;
