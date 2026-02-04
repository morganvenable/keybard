/**
 * KeyProofRow - Renders a single key at all 3 sizes for comparison
 */

import type { FC } from "react";
import { Key } from "@/components/Key";
import type { KeyContent } from "@/types/vial.types";

interface KeyProofRowProps {
    keycode: string;
    description?: string;
    keyContents?: KeyContent;
    layerColor: string;
    selected: boolean;
    hasPendingChange: boolean;
}

const KeyProofRow: FC<KeyProofRowProps> = ({
    keycode,
    description,
    keyContents,
    layerColor,
    selected,
    hasPendingChange,
}) => {
    // Get display label from keyContents or keycode
    const label = keyContents?.str || keycode.replace("KC_", "");

    return (
        <div className="flex flex-row items-center gap-4 py-2 px-3 hover:bg-gray-50 rounded-lg transition-colors">
            {/* Key info */}
            <div className="w-40 shrink-0">
                <div className="font-mono text-xs text-gray-600">{keycode}</div>
                {description && (
                    <div className="text-xs text-gray-400 truncate">{description}</div>
                )}
            </div>

            {/* Key previews at all 3 sizes */}
            <div className="flex flex-row items-center gap-6">
                {/* Default size (60px) */}
                <div className="flex flex-col items-center gap-1">
                    <span className="text-[10px] text-gray-400 uppercase font-semibold">Default</span>
                    <Key
                        x={0}
                        y={0}
                        w={1}
                        h={1}
                        keycode={keycode}
                        label={label}
                        row={0}
                        col={0}
                        layerColor={layerColor}
                        keyContents={keyContents}
                        isRelative={true}
                        disableHover={true}
                        selected={selected}
                        hasPendingChange={hasPendingChange}
                        variant="default"
                        disableTooltip={true}
                    />
                </div>

                {/* Medium size (45px) */}
                <div className="flex flex-col items-center gap-1">
                    <span className="text-[10px] text-gray-400 uppercase font-semibold">Medium</span>
                    <Key
                        x={0}
                        y={0}
                        w={1}
                        h={1}
                        keycode={keycode}
                        label={label}
                        row={0}
                        col={0}
                        layerColor={layerColor}
                        keyContents={keyContents}
                        isRelative={true}
                        disableHover={true}
                        selected={selected}
                        hasPendingChange={hasPendingChange}
                        variant="medium"
                        disableTooltip={true}
                    />
                </div>

                {/* Small size (30px) */}
                <div className="flex flex-col items-center gap-1">
                    <span className="text-[10px] text-gray-400 uppercase font-semibold">Small</span>
                    <Key
                        x={0}
                        y={0}
                        w={1}
                        h={1}
                        keycode={keycode}
                        label={label}
                        row={0}
                        col={0}
                        layerColor={layerColor}
                        keyContents={keyContents}
                        isRelative={true}
                        disableHover={true}
                        selected={selected}
                        hasPendingChange={hasPendingChange}
                        variant="small"
                        disableTooltip={true}
                    />
                </div>
            </div>
        </div>
    );
};

export default KeyProofRow;
