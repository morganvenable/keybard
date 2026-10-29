import type { CustomUIMenuItem } from "@/types/keyboard.types";
import { developerSettingsCopy } from "./developer-settings-copy";
import { TIMING_KEYS, TURBO_KEY } from "./scan-timing";

// Firmware places these board-wide controls in its Pointing Device menu.
// Route by stable value IDs so translated/renamed labels do not change placement.
const developerKeys = new Set([
    "id_scan_prewait_us", "id_scan_postwait_us",
    "id_scan_period_us", "id_scan_idle_period_ms", "id_scan_idle_after_ms",
    "id_scan_deep_after_s", "id_scan_deep_period_ms", "id_idle_rgb_dim",
    "id_idle_cpu_sleep", "id_idle_low_clock", "id_idle_long_nap",
    "id_scan_deep_clock_idx", "id_idle_pointer_rest",
]);

// Never shown, whatever the firmware's menu says. The scan waits in µs are the
// only timing controls; older firmware still lists its turbo preset.
const hiddenKeys = new Set([TURBO_KEY]);

export type PointingMenuSection = "all" | "pointing" | "developer";

function withoutHidden(items: CustomUIMenuItem[]): CustomUIMenuItem[] {
    let changed = false;
    const out = items.flatMap(item => {
        if (typeof item.content?.[0] === "string") {
            if (!hiddenKeys.has(item.content[0])) return [item];
            changed = true;
            return [];
        }
        const before = (item.content ?? []) as CustomUIMenuItem[];
        const content = withoutHidden(before);
        if (content === before) return [item];
        changed = true;
        return content.length ? [{ ...item, content }] : [];
    });
    return changed ? out : items;
}

/** A scan wait never goes below 1 µs here: on older firmware 0 meant "the preset". */
function timingCopy(item: CustomUIMenuItem, key: string): Partial<CustomUIMenuItem> {
    if (!(TIMING_KEYS as readonly string[]).includes(key) || !Array.isArray(item.options)) return {};
    const [min, max, ...rest] = item.options as number[];
    return Number(min) < 1 ? { options: [1, max, ...rest] } : {};
}

/** Partition the display tree without changing firmware definitions or value references. */
export function selectPointingMenu(items: CustomUIMenuItem[], section: PointingMenuSection): CustomUIMenuItem[] {
    if (section === "all") return withoutHidden(items);
    const selected = items.flatMap(item => {
        if (typeof item.content?.[0] === "string") {
            const key = item.content[0];
            if (hiddenKeys.has(key)) return [];
            const isDeveloper = developerKeys.has(key);
            return isDeveloper === (section === "developer")
                ? [section === "developer" ? { ...item, ...developerSettingsCopy[key], ...timingCopy(item, key) } : item] : [];
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
