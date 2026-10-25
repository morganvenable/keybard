import "./app-aware.css";
import { cn } from "@/lib/utils";
import type { LegendLook } from "./proto";

/** How a key shows its hold in the prototype. */
export interface KeyAppHold {
    text: string;
    /** normal: All apps is selected. own: this app's hold. inherited: from All apps.
     *  removed: this app has no hold here. */
    state: "normal" | "own" | "inherited" | "removed";
    look: LegendLook;
    /** Full sentence for the key's accessible label and tooltip. */
    title: string;
}

/** The small hold legend on a key (the tap stays the big legend). */
export function HoldLegend({ hold, variant }: { hold: KeyAppHold; variant: "default" | "medium" | "small" }) {
    const height = variant === "small" ? 10 : variant === "medium" ? 13 : 16;
    const fontSize = variant === "small" ? 7.5 : variant === "medium" ? 9 : 10.5;
    const own = hold.state === "own" || hold.state === "removed";
    return (
        <span
            className={cn(
                "kb-hold",
                `kb-hold--${hold.look}`,
                own ? "kb-hold--own" : `kb-hold--${hold.state}`,
                hold.state === "removed" && "kb-hold--removed",
            )}
            style={{ height, fontSize }}
            data-app-hold={hold.state}
            aria-hidden="true"
        >
            {own && hold.look !== "b" && <span className="kb-hold__dot" />}
            <span className="kb-hold__text truncate">{hold.state === "removed" ? "hold" : hold.text}</span>
        </span>
    );
}
