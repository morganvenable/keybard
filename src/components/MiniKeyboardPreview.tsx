/**
 * MiniKeyboardPreview - Full-width keyboard visualization for layer cards
 * Shows actual key labels using PreviewKey components (non-interactive)
 * Hovering a key shows full-size popup
 */

import type { FC } from "react";
import { useMemo } from "react";
import { useKeyboard } from "@/contexts/KeyboardContext";
import { SVALBOARD_LAYOUT } from "@/constants/svalboard-layout";
import { THUMB_OFFSET_U } from "@/constants/keyboard-visuals";
import { PreviewKey } from "./PreviewKey";
import { getKeyLabel, getKeycodeName } from "@/utils/layers";

interface MiniKeyboardPreviewProps {
    /** Flat array of keycodes for this layer */
    keymap: number[];
    /** Layer color for styling */
    layerColor?: string;
    layerColorStyle?: React.CSSProperties;
    /** Optional unit size for keys (defaults to 30) */
    unitSize?: number;
}

export const MiniKeyboardPreview: FC<MiniKeyboardPreviewProps> = ({
    keymap,
    layerColor = "primary",
    layerColorStyle,
    unitSize = 30,
}) => {
    const { keyboard } = useKeyboard();

    // Get the layout to use - prefer current keyboard's layout, fallback to default
    const keyboardLayout = useMemo(() => {
        if (keyboard?.keylayout && Object.keys(keyboard.keylayout).length > 0) {
            return keyboard.keylayout as Record<number, { x: number; y: number; w: number; h: number }>;
        }
        return SVALBOARD_LAYOUT;
    }, [keyboard?.keylayout]);

    // Check if using fragment layout (no thumb offset needed)
    const useFragmentLayout = keyboard?.keylayout && Object.keys(keyboard.keylayout).length > 0;

    // Calculate keyboard dimensions at small unit size
    const dimensions = useMemo(() => {
        let maxX = 0;
        let maxY = 0;

        Object.values(keyboardLayout).forEach((key) => {
            const yPos = (!useFragmentLayout && key.y >= 6) ? key.y + THUMB_OFFSET_U : key.y;
            maxX = Math.max(maxX, key.x + key.w);
            maxY = Math.max(maxY, yPos + key.h);
        });

        return {
            width: maxX * unitSize,
            height: maxY * unitSize,
        };
    }, [keyboardLayout, useFragmentLayout, unitSize]);

    // Create a mock keyboard info for getKeyLabel
    const mockKeyboardInfo = useMemo(() => ({
        ...keyboard,
        keymap: [keymap], // Wrap in array as layer 0
    } as any), [keyboard, keymap]);

    return (
        <div
            className="relative"
            style={{
                width: `${dimensions.width}px`,
                height: `${dimensions.height}px`,
            }}
        >
            {Object.entries(keyboardLayout).map(([matrixPos, layout]) => {
                const pos = Number(matrixPos);
                const keycode = keymap[pos] || 0;

                const { label, keyContents } = getKeyLabel(mockKeyboardInfo, keycode);
                const keycodeName = getKeycodeName(keycode);

                // Apply thumb offset for non-fragment layouts
                const yPos = (!useFragmentLayout && layout.y >= 6) ? layout.y + THUMB_OFFSET_U : layout.y;

                return (
                    <PreviewKey
                        key={`preview-${pos}`}
                        x={layout.x}
                        y={yPos}
                        w={layout.w}
                        h={layout.h}
                        keycode={keycodeName}
                        label={label}
                        keyContents={keyContents}
                        layerColor={layerColor}
                        layerColorStyle={layerColorStyle}
                        unitSize={unitSize}
                        pos={pos}
                    />
                );
            })}
        </div>
    );
};

export default MiniKeyboardPreview;
