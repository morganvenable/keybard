import { Key } from "@/components/Key";
import { cn } from "@/lib/utils";
import { charLabel } from "./format";

// A character drawn as a Key.tsx cap (docs/practice/spec.md §5.2 "Key strip", §5.7): small (30 px) in the
// strip and tables, medium (45 px) for the focused key and the P5 header. Practice caps show the
// character itself, so they keep its case.

export type CapLook = "included" | "uncalibrated" | "locked";

interface CharCapProps {
    codePoint: number;
    layerColor: string;
    variant?: "small" | "medium";
    look?: CapLook;
    className?: string;
}

const LOCKED = "bg-transparent border border-dashed border-kb-gray-border text-muted-foreground";

export function CharCap({ codePoint, layerColor, variant = "small", look = "included", className }: CharCapProps) {
    const label = charLabel(codePoint);
    return (
        <Key
            isRelative
            x={0}
            y={0}
            w={1}
            h={1}
            row={-1}
            col={-1}
            keycode=""
            label={label}
            // N-14 uncalibrated: the full face with `?` in the header strip, never an opacity change.
            keyContents={look === "uncalibrated" ? { type: "modtap", str: label, top: "?" } : { type: "text", str: label }}
            forceLabel
            layerColor={look === "locked" ? "white" : layerColor}
            variant={variant}
            disableHover
            disableDrag
            disableTooltip
            data-cap-look={look}
            className={cn("normal-case cursor-[inherit] shrink-0", look === "locked" && LOCKED, className)}
        />
    );
}

export default CharCap;
