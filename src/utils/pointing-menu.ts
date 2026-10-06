import type { CustomUIMenuItem } from "@/types/keyboard.types";
import { developerSettingsCopy } from "./developer-settings-copy";

// Firmware places these board-wide controls in its Pointing Device menu.
// Route by stable value IDs so translated/renamed labels do not change placement.
const developerKeys = new Set([
    "id_turbo_scan", "id_scan_prewait_us", "id_scan_postwait_us",
    "id_scan_period_us", "id_scan_idle_period_ms", "id_scan_idle_after_ms",
    "id_scan_deep_after_s", "id_scan_deep_period_ms", "id_idle_rgb_dim",
    "id_idle_cpu_sleep", "id_idle_low_clock", "id_idle_long_nap",
    "id_scan_deep_clock_idx", "id_idle_pointer_rest",
]);

export type PointingMenuSection = "all" | "pointing" | "developer";

/** Partition the display tree without changing firmware definitions or value references. */
export function selectPointingMenu(items: CustomUIMenuItem[], section: PointingMenuSection): CustomUIMenuItem[] {
    if (section === "all") return items;
    const selected = items.flatMap(item => {
        if (typeof item.content?.[0] === "string") {
            const isDeveloper = developerKeys.has(item.content[0]);
            return isDeveloper === (section === "developer")
                ? [section === "developer" ? { ...item, ...developerSettingsCopy[item.content[0]] } : item] : [];
        }
        const content = selectPointingMenu((item.content ?? []) as CustomUIMenuItem[], section);
        if (!content.length) return [];
        return [{ ...item, content,
            ...(section === "developer" && item.label === "Advanced" ? { label: "Key scanning and power saving" } : {}),
        }];
    });
    if (section === "developer") {
        const priority = (item: CustomUIMenuItem) =>
            item.content?.[0] === "id_scan_period_us" ? 0 : item.content?.[0] === "id_idle_cpu_sleep" ? 1 : 2;
        selected.sort((a, b) => priority(a) - priority(b));
    }
    return selected;
}
