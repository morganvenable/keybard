/**
 * PreviewKey - A read-only key for layer previews
 * Non-interactive (no drag/selection) but shows full-size popup on hover
 */

import React, { useState } from "react";
import { createPortal } from "react-dom";
import { KeyContent } from "@/types/keyboard.types";
import { useKeyDrag } from "@/hooks/useKeyDrag";
import { useId } from "react";
import { Key } from "./Key";

export interface PreviewKeyProps {
    x: number;
    y: number;
    w: number;
    h: number;
    keycode: string;
    label: string;
    keyContents?: KeyContent;
    layerColor?: string;
    layerColorStyle?: React.CSSProperties;
    unitSize?: number;
    /** Use tiny text for very small previews */
    tiny?: boolean;
    /** Position in the matrix (for drag payload) */
    pos?: number;
}

// Full-size key for hover popup
const POPUP_UNIT_SIZE = 60;

export const PreviewKey: React.FC<PreviewKeyProps> = ({
    x, y, w, h, keycode, label, keyContents, layerColor = "primary", layerColorStyle, unitSize = 30, tiny = false, pos = 0
}) => {
    const [isHovered, setIsHovered] = useState(false);
    const [popupPosition, setPopupPosition] = useState({ x: 0, y: 0 });
    const uniqueId = useId();

    const drag = useKeyDrag({
        uniqueId,
        keycode,
        label,
        row: 0,
        col: pos,
        layerIndex: 0,
        layerColor,
        isRelative: true,
        keyContents,
        w,
        h,
        variant: "small",
        unitSize
    });

    // Removed unused data processing functions that are now handled by Key.tsx

    const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
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

    // Determine the variant based on the unitSize or tiny flag
    const keyVariant = tiny ? "small" : (unitSize && unitSize > 40) ? "default" : "small";

    return (
        <>
            {/* The actual key in the preview (handles both mini size and full size when floating) */}
            <Key
                x={x} y={y} w={w} h={h}
                row={0} col={pos}
                keycode={keycode}
                label={label}
                keyContents={keyContents}
                layerColor={layerColor}
                style={layerColorStyle}
                variant={keyVariant}
                unitSize={unitSize}
                disableHover
                disableTooltip
                disableDrag={false} // Allow drag to work
                onMouseEnter={(e) => {
                    handleMouseEnter(e);
                    drag.handleMouseEnter();
                }}
                onMouseLeave={() => {
                    handleMouseLeave();
                    drag.handleMouseLeave();
                }}
                onMouseDown={drag.handleMouseDown}
                onMouseUp={drag.handleMouseUp}
                className="absolute"
            />

            {/* Full-size popup on hover (only for mini previews) */}
            {isHovered && (!unitSize || unitSize <= 40) && createPortal(
                <Key
                    x={0} y={0} w={w} h={h}
                    row={0} col={pos}
                    keycode={keycode}
                    label={label}
                    keyContents={keyContents}
                    layerColor={layerColor}
                    variant="default"
                    unitSize={POPUP_UNIT_SIZE}
                    disableHover
                    disableTooltip
                    disableDrag
                    className="fixed z-[9999] pointer-events-none shadow-2xl border-2"
                    style={{
                        ...layerColorStyle,
                        left: `${popupPosition.x}px`,
                        top: `${popupPosition.y}px`,
                        transform: "translate(-50%, -100%)",
                    }}
                />,
                document.body
            )}
        </>
    );
};

export default PreviewKey;
