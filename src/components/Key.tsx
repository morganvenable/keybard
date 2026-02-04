import React, { useMemo } from "react";
import { cn } from "@/lib/utils";
import { colorClasses, hoverContainerTextClasses } from "@/utils/colors";
import { KeyContent } from "@/types/vial.types";
import { getHeaderIcons, getCenterContent, getTypeIcon } from "@/utils/key-icons";
import { useKeyDrag } from "@/hooks/useKeyDrag";
import { getPendingChangeClassName } from "@/constants/pending-change-styles";

export interface KeyProps {
    x: number;
    y: number;
    w: number;
    h: number;
    keycode: string;
    label: string;
    row: number;
    col: number;
    layerIndex?: number;
    selected?: boolean;
    selectedSubsection?: "full" | "inner" | null;
    onClick?: (row: number, col: number) => void;
    onSubsectionClick?: (row: number, col: number, subsection: "full" | "inner") => void;
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
    disableTooltip?: boolean;
    hasPendingChange?: boolean;
    forceLabel?: boolean;
    dragW?: number;
    dragH?: number;
}

/**
 * Renders a single key in the keyboard layout.
 */
export const Key: React.FC<KeyProps> = (props) => {
    const {
        x, y, w, h, keycode, label, row, col, layerIndex = 0, layerColor = "primary",
        selected = false, selectedSubsection = null, onClick, onSubsectionClick, keyContents,
        isRelative = false, className = "", headerClassName = "bg-black/30", variant = "default",
        hoverBorderColor, hoverBackgroundColor, hoverLayerColor, disableHover = false,
        hasPendingChange = false, forceLabel = false, dragW, dragH
    } = props;

    const uniqueId = React.useId();
    const drag = useKeyDrag({
        uniqueId, keycode, label, row, col, layerIndex, layerColor,
        isRelative, keyContents, w, h, dragW, dragH, variant, onClick, disableHover
    });

    const isSmall = variant === "small";
    const isMedium = variant === "medium";

    // --- Data processing ---
    const keyData = useMemo(() => {
        let displayLabel = label;
        let bottomStr = "";
        let topLabel: React.ReactNode = "";

        if (keyContents?.type === "modmask") {
            // Modifier+key combo (e.g., LGUI(TAB))
            // Show key in center, modifier on BOTTOM
            const keysArr = keyContents.str?.split("\n") || [];
            const keyStr = keysArr[0] || "";

            // Show the key in center (blank if no base key)
            if (keyStr === "" || keyStr === "KC_NO") {
                displayLabel = "";
            } else {
                displayLabel = keyStr;
            }

            // If forceLabel is true, use the provided label instead of the derived one
            if (forceLabel) {
                displayLabel = label;
            }

            // Show modifier on bottom (e.g., "LGUI" from "LGUI(TAB)")
            const modMatch = keycode.match(/^([A-Z]+)\(/);
            bottomStr = modMatch ? modMatch[1] : (keyContents.top || "MOD");

            // Smart Override for International Keys (e.g. UK Shift+3 = £)
            // Use case-insensitive check so 'q' doesn't override 'Q' (which would hide the badge)
            // AND ensure we only hide the badge if it is a SHIFT modifier. We don't want to hide CTRL/ALT/GUI.
            // AND only do this for single characters. If it's a word (e.g. "PRTSC" vs "KC_PSCREEN"), keep the badge.
            if (label &&
                label.toUpperCase() !== keyStr.toUpperCase() &&
                label !== "KC_NO" &&
                label !== "KC_TRNS" &&
                displayLabel !== "" &&
                displayLabel.length === 1 &&
                (bottomStr === "LSFT" || bottomStr === "RSFT")
            ) {
                displayLabel = label;
                bottomStr = "";
            }

            // Clean Shifted Characters: If just Shift modifier and single char label that is likely a symbol (not a letter), hide the badge
            // This hides badge for '!', '@', etc but KEEPS it for 'A', 'S' (as requested)
            // Also explicitly hide for our smart overrides which are usually symbols
            // EXCLUDE Numpad keys (which contain KC_P or KC_KP) as requested
            if ((bottomStr === "LSFT" || bottomStr === "RSFT") &&
                displayLabel.length === 1 &&
                !/[a-zA-Z]/.test(displayLabel) &&
                !keycode.includes("KC_P") && !keycode.includes("KC_KP")) {
                bottomStr = "";
            }
        } else if (keyContents?.type === "modtap") {
            // Modifier-tap key (e.g., LGUI_T(KC_TAB))
            // Show key in center, modifier_T in top header
            const keysArr = keyContents.str?.split("\n") || [];
            const keyStr = keysArr[0] || "";

            if (keyStr === "" || keyStr === "KC_NO") {
                displayLabel = "";
            } else {
                displayLabel = keyStr;
            }
            // Extract modifier prefix from keycode (e.g., "LGUI_T(KC_TAB)" -> "LGUI_T")
            const modMatch = keycode.match(/^(\w+_T)\(/);
            topLabel = keyContents.top || (modMatch ? modMatch[1] : "MOD_T");
        } else if (keyContents?.type === "layerhold") {
            // Layer-tap key (e.g., LT1(KC_ENTER))
            // Show key in center, LT# in header
            // Note: For LT keys, KC_NO means no tap action - show blank (not "(kc)")
            const ltMatch = keycode.match(/^LT(\d+)/);
            topLabel = ltMatch ? `LT${ltMatch[1]}` : "LT";
            const keysArr = keyContents.str?.split("\n") || [];
            displayLabel = keysArr[0] || "";
            // Don't show "(kc)" for LT keys - just leave blank when no tap key
            if (displayLabel === "KC_NO") {
                displayLabel = "";
            }
        } else if (keyContents?.type === "tapdance") {
            displayLabel = keyContents.tdid?.toString() || "";
        } else if (keyContents?.type === "macro") {
            displayLabel = keyContents.top?.replace("M", "") || "";
        } else if (keyContents?.type === "user") {
            displayLabel = keyContents.str || "";
        } else if (keyContents?.type === "OSM") {
            topLabel = "OSM";
            displayLabel = keyContents.str || "";
        }

        if (displayLabel === "KC_NO") displayLabel = "";

        const { icons, isMouse } = getHeaderIcons(keycode, displayLabel);
        if (icons.length > 0) {
            topLabel = <div className="flex items-center justify-center gap-1">{icons}</div>;
        }

        const centerContent = getCenterContent(displayLabel, keycode, isMouse);
        return { displayLabel, bottomStr, topLabel, centerContent };
    }, [label, keyContents, keycode]);

    // --- Styling logic ---
    const styles = useMemo(() => {
        const boxStyle: React.CSSProperties = {
            left: isRelative ? undefined : `${x * drag.currentUnitSize}px`,
            top: isRelative ? undefined : `${y * drag.currentUnitSize}px`,
            width: `${w * drag.currentUnitSize}px`,
            height: `${h * drag.currentUnitSize}px`,
        };

        const shouldShrinkText = ["user", "OSM"].includes(keyContents?.type || "") ||
            (typeof keyData.centerContent === "string" && (keyData.centerContent.length > 5 || (keyData.centerContent.length === 5 && keyData.centerContent.toUpperCase().includes("W"))));

        const textStyle: React.CSSProperties = shouldShrinkText ? { whiteSpace: "pre-line", fontSize: "0.6rem", wordWrap: "break-word" } : {};
        const bottomTextStyle: React.CSSProperties = keyData.bottomStr.length > 4 ? { whiteSpace: "pre-line", fontSize: "0.6rem", wordWrap: "break-word" } : {};

        const colorClass = colorClasses[layerColor] || colorClasses["primary"];
        const effectiveHoverColor = hoverLayerColor || layerColor;
        const hoverTextClass = hoverContainerTextClasses[effectiveHoverColor] || hoverContainerTextClasses["primary"];

        // Get pending change styling if applicable
        const pendingChangeClass = hasPendingChange ? getPendingChangeClassName() : "";

        // For subsection keys, only highlight container if "full" is selected
        // For "inner" selection, the container should not be red
        const isSubsectionKeyType = keyContents?.type === "layerhold" || keyContents?.type === "modtap";
        const shouldHighlightContainer = selected && (!isSubsectionKeyType || selectedSubsection === "full");

        const containerClasses = cn(
            "flex flex-col items-center justify-between cursor-pointer transition-all duration-200 ease-in-out uppercase group overflow-hidden select-none",
            !isRelative && "absolute",
            isSmall ? "rounded-[5px] border" : isMedium ? "rounded-[5px] border-2" : "rounded-md border-2",
            (shouldHighlightContainer || drag.isDragHover)
                ? "bg-red-500 text-white border-kb-gray"
                : drag.isDragSource
                    ? cn(colorClass, "bg-kb-light-grey border-kb-light-grey opacity-60")
                    : cn(
                        colorClass, "border-kb-gray",
                        // For subsection keys with inner selected, still show selection border
                        selected && isSubsectionKeyType && selectedSubsection === "inner" && "border-red-500",
                        !disableHover && (hoverBorderColor || "hover:border-red-500"),
                        !disableHover && hoverBackgroundColor,
                        !disableHover && hoverTextClass
                    ),
            pendingChangeClass,
            className
        );

        return { boxStyle, textStyle, bottomTextStyle, containerClasses };
    }, [x, y, w, h, drag, isRelative, isSmall, isMedium, keyContents, keyData, layerColor, hoverLayerColor, selected, selectedSubsection, disableHover, hoverBorderColor, hoverBackgroundColor, hasPendingChange, className]);

    const headerClass = cn(
        "whitespace-nowrap w-full text-center font-semibold py-0 transition-colors duration-200 text-white",
        isSmall ? "text-[10px] rounded-t-[4px]" : isMedium ? "text-[11px] rounded-t-[4px]" : "text-sm rounded-t-sm",
        headerClassName
    );

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onClick?.(row, col);
    };

    // Subsection click handlers for compound keys (LT, mod-tap)
    const handleFullClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onSubsectionClick) {
            onSubsectionClick(row, col, "full");
        } else if (onClick) {
            onClick(row, col);
        }
    };

    const handleInnerClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onSubsectionClick) {
            onSubsectionClick(row, col, "inner");
        } else if (onClick) {
            onClick(row, col);
        }
    };

    // Check if this is a compound key that supports subsection selection
    const isSubsectionKey = keyContents?.type === "layerhold" || keyContents?.type === "modtap";

    // --- Sub-renderer for layer keys ---
    if (keyContents?.type === "layer") {
        const targetLayer = keyContents?.top?.split("(")[1]?.replace(")", "") || "";
        return (
            <div
                className={styles.containerClasses}
                style={styles.boxStyle}
                onClick={handleClick}
                onMouseEnter={drag.handleMouseEnter}
                onMouseLeave={drag.handleMouseLeave}
                onMouseDown={drag.handleMouseDown}
                onMouseUp={drag.handleMouseUp}
                title={props.disableTooltip ? undefined : keycode}
            >
                <span className={headerClass}>{keyContents?.layertext}</span>
                <div className={cn("flex flex-row h-full w-full items-center justify-center", isSmall ? "gap-1" : isMedium ? "gap-1.5" : "gap-2")}>
                    <div className={cn("text-center justify-center items-center flex font-semibold", isSmall ? "text-[13px]" : (isMedium || targetLayer.length > 1) ? "text-[14px]" : "text-[16px]")}>
                        {targetLayer}
                    </div>
                    {getTypeIcon("layer", variant)}
                </div>
            </div>
        );
    }

    // --- Render compound keys with subsection support (LT, mod-tap) ---
    if (isSubsectionKey) {
        const isHeaderSelected = selected && selectedSubsection === "full";
        const isInnerSelected = selected && selectedSubsection === "inner";

        return (
            <div
                className={styles.containerClasses}
                style={styles.boxStyle}
                onMouseEnter={drag.handleMouseEnter}
                onMouseLeave={drag.handleMouseLeave}
                onMouseDown={drag.handleMouseDown}
                onMouseUp={drag.handleMouseUp}
                title={props.disableTooltip ? undefined : keycode}
            >
                {/* Header - clicking selects the full key */}
                <span
                    className={cn(
                        headerClass,
                        "flex items-center justify-center cursor-pointer",
                        isSmall ? "text-[8px] min-h-[10px]" : isMedium ? "text-[10px] min-h-[14px]" : "min-h-[1.2rem]",
                        isHeaderSelected && "bg-red-600 ring-1 ring-red-400"
                    )}
                    onClick={handleFullClick}
                >
                    {keyData.topLabel}
                </span>

                {keyContents && getTypeIcon(keyContents.type || "", variant)}

                {/* Center - clicking selects just the inner keycode */}
                <div
                    className={cn(
                        "text-center w-full h-full justify-center items-center flex font-semibold cursor-pointer",
                        isSmall ? "text-[10px] px-0.5" : isMedium ? "text-[12px] px-1" : (typeof keyData.centerContent === 'string' && keyData.centerContent.length === 1 ? "text-[16px]" : "text-[15px]"),
                        isInnerSelected && "bg-red-500/50 ring-1 ring-red-400"
                    )}
                    style={styles.textStyle}
                    onClick={handleInnerClick}
                >
                    {keyData.centerContent}
                </div>

                {keyData.bottomStr !== "" && (
                    <span className={cn(headerClass, "flex items-center justify-center rounded-t-none", isSmall ? "text-[8px] min-h-[10px] rounded-b-[4px]" : isMedium ? "text-[10px] min-h-[14px] rounded-b-[4px]" : "min-h-5 rounded-b-sm")} style={styles.bottomTextStyle}>
                        {keyData.bottomStr}
                    </span>
                )}
            </div>
        );
    }

    // --- Regular key render ---
    return (
        <div
            className={styles.containerClasses}
            style={styles.boxStyle}
            onClick={handleClick}
            onMouseEnter={drag.handleMouseEnter}
            onMouseLeave={drag.handleMouseLeave}
            onMouseDown={drag.handleMouseDown}
            onMouseUp={drag.handleMouseUp}
            title={props.disableTooltip ? undefined : keycode}
        >
            {keyData.topLabel && (
                <span className={cn(headerClass, "flex items-center justify-center", isSmall ? "text-[8px] min-h-[10px]" : isMedium ? "text-[10px] min-h-[14px]" : "min-h-[1.2rem]")}>
                    {keyData.topLabel}
                </span>
            )}

            {keyContents && getTypeIcon(keyContents.type || "", variant)}

            <div
                className={cn("text-center w-full h-full justify-center items-center flex font-semibold", isSmall ? "text-[10px] px-0.5" : isMedium ? "text-[12px] px-1" : (typeof keyData.centerContent === 'string' && keyData.centerContent.length === 1 ? "text-[16px]" : "text-[15px]"))}
                style={styles.textStyle}
            >
                {keyData.centerContent}
            </div>

            {keyData.bottomStr !== "" && (
                <span className={cn(headerClass, "flex items-center justify-center rounded-t-none", isSmall ? "text-[8px] min-h-[10px] rounded-b-[4px]" : isMedium ? "text-[10px] min-h-[14px] rounded-b-[4px]" : "min-h-5 rounded-b-sm")} style={styles.bottomTextStyle}>
                    {keyData.bottomStr}
                </span>
            )}
        </div>
    );
};
