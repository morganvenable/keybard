import React from "react";
import { useKeyboard } from "@/contexts/KeyboardContext";
import { selectPointingMenu } from "@/utils/pointing-menu";
import type { CustomUIMenuItem } from "@/types/keyboard.types";
import DynamicMenuPanel from "./DynamicMenuPanel";

/**
 * The menu that carries the firmware's developer tuning values, or -1. Found by
 * value id: older firmware has them under Pointing Device > Advanced, newer
 * firmware in a top-level "Power and scanning" menu.
 */
export function developerTuningMenuIndex(menus: CustomUIMenuItem[] | undefined): number {
    return menus?.findIndex((menu) => selectPointingMenu((menu.content ?? []) as CustomUIMenuItem[], "developer").length > 0) ?? -1;
}

/**
 * Scan and idle tuning: the `developer` section of the keyboard definition's
 * menu (scan period, idle and deep-idle timing, clocks, idle RGB dimming,
 * pointer rest). It is developer-only and has no customer home in the editor.
 * Kept in its own component so it can move or be renamed without touching
 * the panel that hosts it (today, Settings > Power and scanning).
 */
const DeveloperTuningSection: React.FC<{ title?: string; bare?: boolean }> = ({ title = "Tuning", bare = false }) => {
    const { keyboard } = useKeyboard();
    const menuIndex = developerTuningMenuIndex(keyboard?.menus);
    if (menuIndex < 0) return null;
    // Inside a Settings card the card's own heading names it.
    if (bare) return <div className="px-3 py-2" data-power-section><DynamicMenuPanel menuIndex={menuIndex} section="developer" embedded /></div>;
    return (
        <section aria-labelledby="developer-tuning-heading" className="flex flex-col gap-2">
            <h3 id="developer-tuning-heading" className="font-semibold text-lg text-kb-ink">{title}</h3>
            <p className="text-xs text-muted-foreground">
                Scan timing and power saving for the whole board. Changes follow your update mode.
            </p>
            <DynamicMenuPanel menuIndex={menuIndex} section="developer" embedded />
        </section>
    );
};

export default DeveloperTuningSection;
