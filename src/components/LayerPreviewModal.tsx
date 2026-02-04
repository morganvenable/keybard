/**
 * LayerPreviewModal - Shows a preview of a layer from the library
 * Uses the same key rendering as the main keyboard editor
 */

import type { FC } from "react";
import { Copy, Check } from "lucide-react";
import { useState } from "react";

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { LayerEntry } from "@/types/layer-library";
import { useVial } from "@/contexts/VialContext";
import { Key } from "@/components/Key";
import { getKeyLabel, getKeycodeName } from "@/utils/layers";
import { SVALBOARD_LAYOUT, MATRIX_COLS } from "@/constants/svalboard-layout";
import { headerClasses } from "@/utils/colors";
import { cn } from "@/lib/utils";

interface LayerPreviewModalProps {
    layer: LayerEntry | null;
    isOpen: boolean;
    onClose: () => void;
    onCopy: (layer: LayerEntry) => void;
}

export const LayerPreviewModal: FC<LayerPreviewModalProps> = ({
    layer,
    isOpen,
    onClose,
    onCopy,
}) => {
    const { keyboard } = useVial();
    const [justCopied, setJustCopied] = useState(false);

    if (!layer) return null;

    // Get the layout to use - prefer current keyboard's layout, fallback to default
    const keyboardLayout = (keyboard?.keylayout && Object.keys(keyboard.keylayout).length > 0)
        ? keyboard.keylayout as Record<number, { x: number; y: number; w: number; h: number; row?: number; col?: number }>
        : SVALBOARD_LAYOUT;

    const matrixCols = keyboard?.cols || MATRIX_COLS;
    const layerColor = layer.layerColor || "primary";
    const headerClass = headerClasses[layerColor] || headerClasses["primary"];

    // Calculate keyboard dimensions first to determine unit size
    const calculateKeyboardSize = () => {
        let maxX = 0;
        let maxY = 0;
        Object.values(keyboardLayout).forEach((key) => {
            maxX = Math.max(maxX, key.x + key.w);
            maxY = Math.max(maxY, key.y + key.h);
        });
        return { maxX, maxY };
    };

    const { maxX, maxY } = calculateKeyboardSize();

    // Calculate unit size to fit within a reasonable modal width
    // Account for dialog padding (48px each side) and preview container padding (32px)
    const maxModalWidth = Math.min(window.innerWidth - 64, 1200); // Max modal width with screen margin
    const availableWidth = maxModalWidth - 48 - 48 - 32; // Dialog padding + preview padding
    const previewUnitSize = Math.min(35, Math.floor(availableWidth / maxX));

    const width = maxX * previewUnitSize;
    const height = maxY * previewUnitSize;

    // Calculate modal width to fit the keyboard preview exactly
    const modalWidth = width + 48 + 48 + 32 + 16; // keyboard + dialog padding + preview padding + extra margin

    // Handle copy
    const handleCopy = async () => {
        await onCopy(layer);
        setJustCopied(true);
        setTimeout(() => setJustCopied(false), 2000);
    };

    // Create a mock keyboard info to get labels
    const mockKeyboard = keyboard ? {
        ...keyboard,
        keymap: [layer.keymap],
    } : {
        keymap: [layer.keymap],
        rows: 5,
        cols: matrixCols,
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent
                className="max-h-[90vh] overflow-hidden flex flex-col"
                style={{ width: `${modalWidth}px`, maxWidth: '95vw' }}
            >
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-3">
                        {/* Layer color indicator */}
                        <div
                            className={cn(
                                "w-4 h-4 rounded-full flex-shrink-0",
                                headerClass
                            )}
                        />
                        {layer.name}
                    </DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-auto">
                    {/* Layer Info */}
                    <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
                        {layer.description && (
                            <p className="mb-2">{layer.description}</p>
                        )}
                        <p>
                            <span className="font-medium">Author:</span> {layer.author || "Anonymous"}
                            {layer.tags.length > 0 && (
                                <span className="ml-4">
                                    <span className="font-medium">Tags:</span> {layer.tags.join(", ")}
                                </span>
                            )}
                        </p>
                    </div>

                    {/* Keyboard Preview */}
                    <div className="flex items-center justify-center p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
                        <div
                            className="keyboard-layout relative"
                            style={{
                                width: `${width}px`,
                                height: `${height}px`,
                            }}
                        >
                            {Object.entries(keyboardLayout).map(([matrixPos, layout]) => {
                                const pos = Number(matrixPos);
                                const row = typeof layout.row === 'number' ? layout.row : Math.floor(pos / matrixCols);
                                const col = typeof layout.col === 'number' ? layout.col : pos % matrixCols;

                                // Get keycode from the layer's keymap
                                const keycode = layer.keymap[pos] || 0;
                                const { label, keyContents } = getKeyLabel(mockKeyboard as any, keycode);
                                const keycodeName = getKeycodeName(keycode);

                                return (
                                    <Key
                                        key={`preview-${pos}`}
                                        x={layout.x}
                                        y={layout.y}
                                        w={layout.w}
                                        h={layout.h}
                                        keycode={keycodeName}
                                        label={label}
                                        row={row}
                                        col={col}
                                        selected={false}
                                        keyContents={keyContents}
                                        layerColor={layerColor}
                                        headerClassName={headerClass}
                                        variant="small"
                                        disableHover={true}
                                        disableTooltip={true}
                                    />
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Footer with Copy button */}
                <div className="flex justify-between items-center pt-4 border-t">
                    <p className="text-sm text-gray-500">
                        {layer.keyCount} keys • Click Copy to paste into your layer
                    </p>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={onClose}>
                            Close
                        </Button>
                        <Button onClick={handleCopy} disabled={justCopied}>
                            {justCopied ? (
                                <>
                                    <Check className="w-4 h-4 mr-2" />
                                    Copied!
                                </>
                            ) : (
                                <>
                                    <Copy className="w-4 h-4 mr-2" />
                                    Copy Layer
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default LayerPreviewModal;
