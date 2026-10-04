import type { CustomUIMenuItem } from "@/types/vial.types";

// Firmware places these board-wide controls in its Pointing Device menu.
// Route by stable value IDs so translated/renamed labels do not change placement.
const developerKeys = new Set([
    "id_turbo_scan", "id_scan_prewait_us", "id_scan_postwait_us",
    "id_scan_period_us", "id_scan_idle_period_ms", "id_scan_idle_after_ms",
    "id_scan_deep_after_s", "id_scan_deep_period_ms", "id_idle_rgb_dim",
    "id_idle_cpu_sleep", "id_idle_low_clock", "id_idle_long_nap",
    "id_scan_deep_clock_idx",
]);

export type PointingMenuSection = "all" | "pointing" | "developer";

/** Partition the display tree without changing firmware definitions or value references. */
export function selectPointingMenu(items: CustomUIMenuItem[], section: PointingMenuSection): CustomUIMenuItem[] {
    if (section === "all") return items;
    return items.flatMap(item => {
        if (typeof item.content?.[0] === "string") {
            const isDeveloper = developerKeys.has(item.content[0]);
            return isDeveloper === (section === "developer") ? [item] : [];
        }
        const content = selectPointingMenu((item.content ?? []) as CustomUIMenuItem[], section);
        if (!content.length) return [];
        return [{ ...item, content,
            ...(section === "developer" && item.label === "Advanced" ? { label: "Scan and power settings" } : {}),
        }];
    });
}
