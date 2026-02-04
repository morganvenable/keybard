/**
 * PreviewKey - A read-only key for layer previews
 * Non-interactive (no drag/selection) but shows full-size popup on hover
 */

import React, { useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { colorClasses } from "@/utils/colors";
import { KeyContent } from "@/types/vial.types";
import { getHeaderIcons, getCenterContent, getTypeIcon } from "@/utils/key-icons";

export interface PreviewKeyProps {
    x: number;
    y: number;
    w: number;
    h: number;
    keycode: string;
    label: string;
    keyContents?: KeyContent;
    layerColor?: string;
    unitSize?: number;
    /** Use tiny text for very small previews */
    tiny?: boolean;
}

// Full-size key for hover popup
const POPUP_UNIT_SIZE = 60;

export const PreviewKey: React.FC<PreviewKeyProps> = ({
    x, y, w, h, keycode, label, keyContents, layerColor = "primary", unitSize = 30, tiny = false,
}) => {
    const [isHovered, setIsHovered] = useState(false);
    const [popupPosition, setPopupPosition] = useState({ x: 0, y: 0 });

    // --- Data processing (simplified from Key.tsx) ---
    const keyData = useMemo(() => {
        let displayLabel = label;
        let bottomStr = "";
        let topLabel: React.ReactNode = "";

        if (keyContents?.type === "modmask") {
            const keysArr = keyContents.str?.split("\n") || [];
            const keyStr = keysArr[0] || "";
            displayLabel = keyStr === "" || keyStr === "KC_NO" ? "(kc)" : keyStr;
            const modMatch = keycode.match(/^([A-Z]+)\(/);
            bottomStr = modMatch ? modMatch[1] : (keyContents.top || "MOD");
        } else if (keyContents?.type === "modtap") {
            const keysArr = keyContents.str?.split("\n") || [];
            const keyStr = keysArr[0] || "";
            displayLabel = keyStr === "" || keyStr === "KC_NO" ? "(kc)" : keyStr;
            const modMatch = keycode.match(/^(\w+_T)\(/);
            topLabel = modMatch ? modMatch[1] : "MOD_T";
        } else if (keyContents?.type === "layerhold") {
            const ltMatch = keycode.match(/^LT(\d+)/);
            topLabel = ltMatch ? `LT${ltMatch[1]}` : "LT";
            const keysArr = keyContents.str?.split("\n") || [];
            displayLabel = keysArr[0] || "";
            if (displayLabel === "KC_NO") displayLabel = "";
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

        const { icons } = getHeaderIcons(keycode, displayLabel);
        if (icons.length > 0) {
            topLabel = <div className="flex items-center justify-center gap-1">{icons}</div>;
        }

        const centerContent = getCenterContent(displayLabel, keycode, false);
        return { displayLabel, bottomStr, topLabel, centerContent };
    }, [label, keyContents, keycode]);

    const colorClass = colorClasses[layerColor] || colorClasses["primary"];

    const handleMouseEnter = (e: React.MouseEvent) => {
        const rect = e.currentTarget.getBoundingClientRect();
        // Position popup above and centered on the key
        setPopupPosition({
            x: rect.left + rect.width / 2,
            y: rect.top - 10,
        });
        setIsHovered(true);
    };

    const handleMouseLeave = () => {
        setIsHovered(false);
    };

    // Render the key content (shared between mini and popup)
    const renderKeyContent = (size: "small" | "large" | "tiny") => {
        const isTiny = size === "tiny";
        const isSmall = size === "small" || isTiny;
        const headerClass = cn(
            "whitespace-nowrap w-full text-center font-semibold py-0 text-white bg-black/30",
            isTiny ? "text-[4px] leading-[6px] rounded-t-[2px]" :
                isSmall ? "text-[8px] rounded-t-[4px]" : "text-sm rounded-t-sm"
        );

        return (
            <>
                {keyData.topLabel && (
                    <span className={cn(headerClass, "flex items-center justify-center", isTiny ? "min-h-[6px]" : isSmall ? "min-h-[10px]" : "min-h-[1.2rem]")}>
                        {isTiny ? null : keyData.topLabel}
                    </span>
                )}
                {!isTiny && keyContents && getTypeIcon(keyContents.type || "", isSmall ? "small" : "default")}
                <div className={cn(
                    "text-center w-full h-full justify-center items-center flex font-semibold overflow-hidden",
                    isTiny ? "text-[6px] leading-[8px] px-0" :
                        isSmall ? "text-[10px] px-0.5" : "text-[15px]"
                )}>
                    {keyData.centerContent}
                </div>
                {keyData.bottomStr && (
                    <span className={cn(headerClass, "flex items-center justify-center rounded-t-none", isTiny ? "min-h-[6px] rounded-b-[2px]" : isSmall ? "min-h-[10px] rounded-b-[4px]" : "min-h-5 rounded-b-sm")}>
                        {isTiny ? null : keyData.bottomStr}
                    </span>
                )}
            </>
        );
    };

    // Layer key special rendering
    if (keyContents?.type === "layer") {
        const targetLayer = keyContents?.top?.split("(")[1]?.replace(")", "") || "";
        return (
            <>
                <div
                    className={cn(
                        "absolute flex flex-col items-center justify-between cursor-default uppercase overflow-hidden select-none rounded-[5px] border",
                        colorClass, "border-kb-gray"
                    )}
                    style={{
                        left: `${x * unitSize}px`,
                        top: `${y * unitSize}px`,
                        width: `${w * unitSize}px`,
                        height: `${h * unitSize}px`,
                    }}
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                >
                    <span className={cn(
                        "whitespace-nowrap w-full text-center font-semibold py-0 text-white bg-black/30",
                        tiny ? "text-[4px] leading-[6px] rounded-t-[2px]" : "text-[8px] rounded-t-[4px]"
                    )}>
                        {tiny ? null : keyContents?.layertext}
                    </span>
                    <div className="flex flex-row h-full w-full items-center justify-center gap-1">
                        <div className={cn(
                            "text-center justify-center items-center flex font-semibold",
                            tiny ? "text-[6px] leading-[8px]" : "text-[13px]"
                        )}>
                            {targetLayer}
                        </div>
                        {getTypeIcon("layer", "small")}
                    </div>
                </div>

                {/* Full-size popup on hover */}
                {isHovered && createPortal(
                    <div
                        className="fixed z-[9999] pointer-events-none"
                        style={{
                            left: `${popupPosition.x}px`,
                            top: `${popupPosition.y}px`,
                            transform: "translate(-50%, -100%)",
                        }}
                    >
                        <div
                            className={cn(
                                "flex flex-col items-center justify-between uppercase overflow-hidden select-none rounded-md border-2 shadow-lg",
                                colorClass, "border-kb-gray"
                            )}
                            style={{
                                width: `${w * POPUP_UNIT_SIZE}px`,
                                height: `${h * POPUP_UNIT_SIZE}px`,
                            }}
                        >
                            <span className="whitespace-nowrap w-full text-center font-semibold py-0 text-white bg-black/30 text-sm rounded-t-sm min-h-[1.2rem]">
                                {keyContents?.layertext}
                            </span>
                            <div className="flex flex-row h-full w-full items-center justify-center gap-2">
                                <div className="text-center justify-center items-center flex font-semibold text-[16px]">
                                    {targetLayer}
                                </div>
                                {getTypeIcon("layer", "default")}
                            </div>
                        </div>
                    </div>,
                    document.body
                )}
            </>
        );
    }

    return (
        <>
            {/* Mini key in preview */}
            <div
                className={cn(
                    "absolute flex flex-col items-center justify-between cursor-default uppercase overflow-hidden select-none rounded-[5px] border",
                    colorClass, "border-kb-gray"
                )}
                style={{
                    left: `${x * unitSize}px`,
                    top: `${y * unitSize}px`,
                    width: `${w * unitSize}px`,
                    height: `${h * unitSize}px`,
                }}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
            >
                {renderKeyContent(tiny ? "tiny" : "small")}
            </div>

            {/* Full-size popup on hover */}
            {isHovered && createPortal(
                <div
                    className="fixed z-[9999] pointer-events-none"
                    style={{
                        left: `${popupPosition.x}px`,
                        top: `${popupPosition.y}px`,
                        transform: "translate(-50%, -100%)",
                    }}
                >
                    <div
                        className={cn(
                            "flex flex-col items-center justify-between uppercase overflow-hidden select-none rounded-md border-2 shadow-lg",
                            colorClass, "border-kb-gray"
                        )}
                        style={{
                            width: `${w * POPUP_UNIT_SIZE}px`,
                            height: `${h * POPUP_UNIT_SIZE}px`,
                        }}
                    >
                        {renderKeyContent("large")}
                    </div>
                </div>,
                document.body
            )}
        </>
    );
};

export default PreviewKey;
