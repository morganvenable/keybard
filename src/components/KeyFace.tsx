import React, { useMemo } from "react";
import { cn } from "@/lib/utils";
import { colorClasses, hoverContainerTextClasses, isHexColor, textClassForHex } from "@/utils/colors";
import { KeyContent } from "@/types/keyboard.types";
import { getHeaderIcons, getCenterContent, getTypeIcon } from "@/utils/key-icons";
import { getKeyDisplayText } from "@/utils/key-display";

/**
 * What a key looks like, with no drag, hover tracking or context reads: the editor's
 * Key wraps it with those, and the Keybard Host overlay draws it directly, so both
 * draw the same key.
 */
export interface KeyFaceProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
    x: number;
    y: number;
    w: number;
    h: number;
    keycode: string;
    label: string;
    /** Pixels per key unit. */
    unitSize: number;
    /** The international layout id the legends follow (LayoutSettingsContext in the editor). */
    internationalLayout: string;
    selected?: boolean;
    title?: string;
    keyContents?: KeyContent;
    layerColor?: string;
    isRelative?: boolean;
    className?: string;
    headerClassName?: string;
    variant?: "default" | "medium" | "small";
    hoverBorderColor?: string;
    hoverBackgroundColor?: string;
    hoverLayerColor?: string;
    disableHover?: boolean;
    hasPendingChange?: boolean;
    forceLabel?: boolean;
    style?: React.CSSProperties;
    /** Drag state from the editor: another key is dragged over this one. */
    isDragHover?: boolean;
    /** Drag state from the editor: this key is being dragged. */
    isDragSource?: boolean;
}

export const KeyFace = React.forwardRef<HTMLDivElement, KeyFaceProps>((props, ref) => {
    const {
        x, y, w, h, keycode, label, unitSize, internationalLayout, layerColor = "primary",
        selected = false, title, keyContents,
        isRelative = false, className = "", headerClassName = "bg-black/30", variant = "default",
        hoverBorderColor, hoverBackgroundColor, hoverLayerColor, disableHover = false,
        hasPendingChange = false, forceLabel = false, style, isDragHover = false, isDragSource = false,
        ...rest
    } = props;

    const isSmall = variant === "small";
    const isMedium = variant === "medium";

    // --- Data processing ---
    const keyData = useMemo(() => {
        return processKeyData(keycode, label, keyContents, forceLabel, internationalLayout);
    }, [label, keyContents, keycode, forceLabel, internationalLayout]);

    // --- Styling logic ---
    const styles = useMemo(() => {
        const boxStyle: React.CSSProperties = {
            left: isRelative ? undefined : `${x * unitSize}px`,
            top: isRelative ? undefined : `${y * unitSize}px`,
            width: `${w * unitSize}px`,
            height: `${h * unitSize}px`,
            ...style
        };

        // Check if the key is "crowded" (has both top label/icon AND bottom badge)
        // usage: keyData.topLabel can be a ReactNode (icon) or string
        const hasTop = !!keyData.topLabel;
        const hasBottom = keyData.bottomStr !== "";
        const isCrowded = hasTop && hasBottom;

        const shouldShrinkText = ["user", "OSM"].includes(keyContents?.type || "") ||
            (typeof keyData.centerContent === "string" && (keyData.centerContent.length > 5 || (keyData.centerContent.length === 5 && keyData.centerContent.toUpperCase().includes("W"))));

        // Small keys have 24px of usable width (30 - 2px border - 2x2px padding). A plain
        // single-line label of 4+ characters overruns that at the native 10px: "2XTG" in
        // Inter 600 measures 26.8px at 10px and 8.5px is the largest size at which it fits
        // (see the sniper/boost toggle labels in MouseKeysSection). Medium and default
        // keys have room to spare, so only the small variant is capped.
        const isCompactSmallLabel = isSmall && !shouldShrinkText &&
            typeof keyData.centerContent === "string" && keyData.centerContent.length >= 4;

        // Dynamic center text sizing based on crowding and variant
        let fontSize: string | undefined;
        if (isCrowded) {
            fontSize = isSmall ? "0.5rem" : isMedium ? "0.6rem" : "13px";
        } else if (shouldShrinkText) {
            fontSize = "0.6rem";
        } else if (isCompactSmallLabel) {
            fontSize = "8.5px";
        }

        const textStyle: React.CSSProperties = {
            whiteSpace: shouldShrinkText ? "pre-line" : undefined,
            fontSize,
            wordWrap: shouldShrinkText ? "break-word" : undefined
        };

        // For subsection keys, only highlight container if "full" is selected
        // For "inner" selection, the container should not be red
        const shouldHighlightContainer = selected;

        const bottomTextStyle: React.CSSProperties = keyData.bottomStr.length > 4 ? { whiteSpace: "pre-line", fontSize: "0.6rem", wordWrap: "break-word" } : {};

        // A custom hex layer color has no class; draw it inline, with readable text.
        const customHex = isHexColor(layerColor) ? layerColor : undefined;
        const colorClass = customHex ? textClassForHex(customHex) : (colorClasses[layerColor] || colorClasses["primary"]);
        if (customHex && !shouldHighlightContainer && !isDragHover && !isDragSource && !style?.backgroundColor) boxStyle.backgroundColor = customHex;
        const effectiveHoverColor = hoverLayerColor || layerColor;
        const hoverTextClass = hoverContainerTextClasses[effectiveHoverColor] || hoverContainerTextClasses["primary"];




        const containerClasses = cn(
            "flex flex-col items-center justify-start cursor-pointer transition-all duration-200 ease-in-out uppercase group overflow-hidden select-none", // Changed justify-between to justify-start
            !isRelative && "absolute",
            // 1. Regular Key: 1px border stroke (border instead of border-2)
            isSmall ? "rounded-[5px] border" : isMedium ? "rounded-[5px] border" : "rounded-md border",

            (shouldHighlightContainer || isDragHover)
                ? "bg-red-500 text-white border-kb-key-border ring-2 ring-red-500 ring-offset-1 ring-offset-background" // Selected: Red BG + Red Ring
                : isDragSource
                    ? cn(colorClass, "bg-kb-light-grey border-kb-light-grey opacity-60 dark:bg-neutral-700 dark:border-neutral-700")
                    : cn(
                        colorClass, "border-kb-key-border",
                        // Hover: Use ring-inset instead of border-2 to prevent shifting
                        !disableHover && (hoverBorderColor || "hover:border-red-500 hover:ring-2 hover:ring-inset hover:ring-red-500"),
                        !disableHover && hoverBackgroundColor,
                        !disableHover && hoverTextClass
                    ),
            // Pending: Thicker Red Border (2px) - Only if NOT selected/active
            hasPendingChange && (!shouldHighlightContainer && !isDragHover) && "border-2 border-red-500",
            className
        );

        return { boxStyle, textStyle, bottomTextStyle, containerClasses };
    }, [x, y, w, h, unitSize, isDragHover, isDragSource, isRelative, isSmall, isMedium, keyContents, keyData, layerColor, hoverLayerColor, selected, disableHover, hoverBorderColor, hoverBackgroundColor, hasPendingChange, className, style]);

    // Forced height logic for strict grid alignment without !important
    const forcedHeight = isSmall ? "10px" : isMedium ? "14px" : "18px";
    const headerStyle: React.CSSProperties = {
        height: forcedHeight,
        flexShrink: 0,
        flexGrow: 0
    };

    const headerClass = cn(
        headerClassName, // Move to start so local classes override it
        "whitespace-nowrap w-full text-center font-semibold py-0 transition-colors duration-200 text-white flex items-center justify-center leading-none",
        isSmall
            ? "text-[10px] rounded-t-[4px]"
            : isMedium
                ? "text-[11px] rounded-t-[4px]"
                : "text-sm rounded-t-sm"
    );

    // --- Sub-renderer for layer keys ---
    if (keyContents?.type === "layer") {
        const targetLayer = keyContents?.top?.split("(")[1]?.replace(")", "") || "";
        return (
            <div
                ref={ref}
                className={styles.containerClasses}
                style={styles.boxStyle}
                title={title}
                {...rest}
            >
                <span className={headerClass} style={headerStyle}>{keyContents?.layertext}</span>
                <div className={cn("flex flex-row flex-1 w-full items-center justify-center", isSmall ? "gap-1" : isMedium ? "gap-1.5" : "gap-2")}>
                    <div className={cn("text-center justify-center items-center flex font-semibold", isSmall ? "text-[13px]" : (isMedium || targetLayer.length > 1) ? "text-[14px]" : "text-[16px]")}>
                        {targetLayer}
                    </div>
                    {getTypeIcon("layer", variant)}
                </div>
            </div>
        );
    }

    // --- Regular key render ---
    return (
        <div
            ref={ref}
            className={styles.containerClasses}
            style={styles.boxStyle}
            title={title}
            {...rest}
        >
            {keyData.topLabel && (
                <span className={cn(headerClass)} style={headerStyle}>
                    {keyData.topLabel}
                </span>
            )}

            {keyContents && getTypeIcon(keyContents.type || "", variant)}

            <div
                className={cn("text-center w-full flex-1 justify-center items-center flex font-semibold", isSmall ? "text-[10px] px-0.5" : isMedium ? "text-[12px] px-1" : (typeof keyData.centerContent === 'string' && keyData.centerContent.length === 1 ? "text-[16px]" : "text-[15px]"))}
                style={styles.textStyle}
            >
                {keyData.centerContent}
            </div>

            {keyData.bottomStr !== "" && (
                <span className={cn(headerClass, "rounded-t-none rounded-b-sm")} style={{ ...styles.bottomTextStyle, ...headerStyle }}>
                    {keyData.bottomStr}
                </span>
            )}
        </div>
    );
});
KeyFace.displayName = "KeyFace";

// --- Helper Functions ---

function processKeyData(
    keycode: string,
    label: string,
    keyContents: KeyContent | undefined,
    forceLabel: boolean,
    layoutId: string
) {
    const text = getKeyDisplayText(keycode, label, keyContents, forceLabel, layoutId);
    const { displayLabel, bottomStr } = text;
    let topLabel: React.ReactNode = text.topLabel;
    const { icons, isMouse } = getHeaderIcons(keycode, displayLabel);
    if (icons.length > 0) {
        topLabel = <div className="flex items-center justify-center gap-1">{icons}</div>;
    }

    const centerContent = getCenterContent(displayLabel, keycode, isMouse);
    return { displayLabel, bottomStr, topLabel, centerContent };
}
