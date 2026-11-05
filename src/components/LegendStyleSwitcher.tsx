import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { LEGEND_STYLES, setLegendStyle, useLegendStyle, useLegendStyleParam, type LegendStyle } from "@/lib/legendStyle";

const NAMES: Record<LegendStyle | "off", string> = {
    stacked: "Stacked",
    diagonal: "Diagonal",
    corner: "Corner",
    keycap: "Keycap",
    off: "Off",
};

/**
 * Review switcher for the dual-legend prototype. Shown only when the URL has
 * ?legendStyle; a choice rewrites the param in place, so the URL is the state.
 */
export default function LegendStyleSwitcher() {
    const present = useLegendStyleParam();
    const style = useLegendStyle();
    if (!present) return null;
    const choices = [...LEGEND_STYLES, "off"] as const;
    return createPortal(
        <div
            role="radiogroup"
            aria-label="Shifted legends"
            data-legend-switcher=""
            className="fixed bottom-2 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-1 rounded-full border border-kb-gray-border bg-kb-popover px-2 py-1 text-xs font-medium text-kb-ink shadow-sm"
        >
            <span className="px-1">Shifted legends</span>
            {choices.map(choice => {
                const active = (style ?? "off") === choice;
                return (
                    <button
                        key={choice}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        data-legend-choice={choice}
                        onClick={() => setLegendStyle(choice)}
                        className={cn(
                            "cursor-pointer rounded-full px-2 py-0.5",
                            active ? "bg-kb-ink text-kb-popover" : "hover:underline underline-offset-2"
                        )}
                    >
                        {NAMES[choice]}
                    </button>
                );
            })}
        </div>,
        document.body
    );
}
