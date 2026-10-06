/**
 * LayerCard - A card component for displaying individual layers in the library
 * Focused on copy/paste workflow for individual layers
 */

import type { FC } from "react";
import { Check, Clock, Copy, Loader2, Tag, Trash2, User, Keyboard } from "lucide-react";
import CopyIcon from "@/components/icons/CopyIcon";
import { useState, useMemo } from "react";

import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import type { LayerEntry } from "@/types/layer-library";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { colorClasses } from "@/utils/colors";
import { useKeyboard } from "@/contexts/KeyboardContext";
import { SVALBOARD_LAYOUT, MATRIX_COLS } from "@/constants/svalboard-layout";
import { PreviewKey } from "@/components/PreviewKey";
import { getKeyLabel, getKeycodeName } from "@/utils/layers";

/** Miniature keyboard preview using real key rendering, grayed out for empty keys */
const MiniKeyboardPreview: FC<{
    keymap: number[];
    layerColor?: string;
    layerColorStyle?: React.CSSProperties;
    unitSize?: number;
    className?: string;
}> = ({ keymap, layerColor = "primary", layerColorStyle, unitSize = 15, className }) => {
    const { keyboard } = useKeyboard();
    const layout = (keyboard?.keylayout && Object.keys(keyboard.keylayout).length > 0)
        ? keyboard.keylayout as Record<number, { x: number; y: number; w: number; h: number; row?: number; col?: number }>
        : SVALBOARD_LAYOUT;
    const matrixCols = keyboard?.cols || MATRIX_COLS;

    let maxX = 0, maxY = 0;
    for (const k of Object.values(layout)) {
        maxX = Math.max(maxX, k.x + k.w);
        maxY = Math.max(maxY, k.y + k.h);
    }

    const mockKeyboard = keyboard ? { ...keyboard, keymap: [keymap] } : {
        keymap: [keymap], rows: 5, cols: matrixCols,
    };

    return (
        <div
            className={cn("relative flex-shrink-0", className)}
            style={{ width: maxX * unitSize, height: maxY * unitSize }}
        >
            {Object.entries(layout).map(([matrixPos, k]) => {
                const pos = Number(matrixPos);
                const keycode = keymap[pos] || 0;
                const { label, keyContents } = getKeyLabel(mockKeyboard as any, keycode);
                const keycodeName = getKeycodeName(keycode);

                return (
                    <PreviewKey
                        key={pos}
                        x={k.x}
                        y={k.y}
                        w={k.w}
                        h={k.h}
                        keycode={keycodeName}
                        label={label}
                        keyContents={keyContents}
                        layerColor={layerColor}
                        layerColorStyle={layerColorStyle}
                        unitSize={unitSize}
                        tiny={unitSize <= 18}
                        pos={pos}
                    />
                );
            })}
        </div>
    );
};

interface LayerCardProps {
    layer: LayerEntry;
    onCopy: (layer: LayerEntry) => void | Promise<void>;
    onDelete?: (layer: LayerEntry) => void | Promise<void>;
    onClick?: (layer: LayerEntry) => void;
    className?: string;
    /** Compact mode for horizontal/bottom bar layout */
    compact?: boolean;
}

export const LayerCard: FC<LayerCardProps> = ({
    layer,
    onCopy,
    onDelete,
    onClick,
    className,
    compact = false,
}) => {
    const [justCopied, setJustCopied] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleCopy = async (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent opening preview
        setIsLoading(true);
        setError(null);
        try {
            await onCopy(layer);
            setJustCopied(true);
            setTimeout(() => setJustCopied(false), 2000);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to copy');
            setTimeout(() => setError(null), 3000);
        } finally {
            setIsLoading(false);
        }
    };

    const handleClick = () => {
        onClick?.(layer);
    };

    // Format date relative to now
    const formatDate = (dateStr: string): string => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;
        if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
        if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
        return date.toLocaleDateString();
    };

    // Get layer color class
    const layerColorClass = useMemo(() => {
        const colorName = layer.layerColor || "primary";
        return colorClasses[colorName] || "bg-kb-primary";
    }, [layer.layerColor]);


    // Compact mode for horizontal/bottom bar layout - wide card with mini keyboard preview
    if (compact) {
        return (
            <div
                onClick={handleClick}
                className={cn(
                    "border rounded-lg p-2 bg-kb-surface shadow-sm hover:shadow-md transition-shadow group/card",
                    "border-gray-200 dark:border-neutral-700 w-[340px] h-full flex-shrink-0 flex flex-col",
                    onClick && "cursor-pointer",
                    className
                )}
            >
                {/* Header row: color dot + name + key count + delete */}
                <div className="flex items-center gap-1.5 mb-1">
                    <div
                        className={cn("w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-sm", layerColorClass)}
                    />
                    <h3 className="font-semibold text-xs text-gray-900 dark:text-neutral-100 truncate flex-1">
                        {layer.name}
                    </h3>
                    <span className="text-[9px] px-1 py-0.5 rounded font-medium bg-gray-100 text-gray-600 dark:bg-neutral-800 dark:text-neutral-300 flex-shrink-0">
                        {layer.keyCount} keys
                    </span>
                    {onDelete && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onDelete(layer); }}
                            className="text-gray-300 dark:text-neutral-500 hover:text-red-500 dark:hover:text-red-400 flex-shrink-0"
                        >
                            <Trash2 className="w-3 h-3" />
                        </button>
                    )}
                </div>

                {/* Mini keyboard preview - real key rendering */}
                <div className="flex items-center justify-center bg-gray-50 dark:bg-neutral-800/60 rounded p-1 flex-1 min-h-0 overflow-hidden">
                    <MiniKeyboardPreview
                        keymap={layer.keymap}
                        layerColor={layer.layerColor || "primary"}
                        unitSize={12}
                    />
                </div>

                {/* Footer: place button */}
                <div className="flex items-center justify-end gap-1 mt-1">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant={justCopied ? "default" : error ? "destructive" : "outline"}
                                size="icon"
                                className={cn(
                                    "h-7 w-7 rounded-full flex items-center justify-center p-0 opacity-0 group-hover/card:opacity-100 transition-all",
                                    justCopied && "bg-green-500 hover:bg-green-600 border-green-500 text-white"
                                )}
                                onClick={handleCopy}
                                disabled={isLoading}
                                title="" // Clear native title
                            >
                                {isLoading ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                ) : justCopied ? (
                                    <Check className="w-3.5 h-3.5" />
                                ) : error ? (
                                    <span className="text-[8px]">!</span>
                                ) : (
                                    <CopyIcon className="w-3.5 h-3.5" />
                                )}
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Copy Layer</p>
                        </TooltipContent>
                    </Tooltip>
                </div>
            </div>
        );
    }

    return (
        <div
            onClick={handleClick}
            className={cn(
                "border rounded-lg p-4 bg-kb-surface shadow-sm hover:shadow-md transition-shadow",
                "border-gray-200 dark:border-neutral-700",
                onClick && "cursor-pointer",
                className
            )}
        >
            {/* Header */}
            <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        {/* Layer color indicator */}
                        <div
                            className={cn(
                                "w-3 h-3 rounded-full flex-shrink-0 shadow-sm",
                                layerColorClass
                            )}
                        />
                        <h3 className="font-semibold text-gray-900 dark:text-neutral-100 truncate">
                            {layer.name}
                        </h3>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-neutral-300 line-clamp-2">
                        {layer.description || "No description"}
                    </p>
                </div>
                <div className="flex items-center gap-1">
                    {/* Key count badge */}
                    <span className="text-xs px-2 py-1 rounded-full font-medium bg-gray-100 text-gray-700 dark:bg-neutral-800 dark:text-neutral-200 flex items-center gap-1">
                        <Keyboard className="w-3 h-3" />
                        {layer.keyCount}
                    </span>
                    {/* Delete button */}
                    {onDelete && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-gray-400 dark:text-neutral-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40"
                            onClick={(e) => {
                                e.stopPropagation();
                                onDelete(layer);
                            }}
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                    )}
                </div>
            </div>

            {/* Keyboard Preview */}
            <div className="flex items-center justify-center bg-gray-50 dark:bg-neutral-800/60 rounded-lg p-2 mb-3 overflow-hidden">
                <MiniKeyboardPreview
                    keymap={layer.keymap}
                    layerColor={layer.layerColor || "primary"}
                    unitSize={18}
                />
            </div>

            {/* Meta info */}
            <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-neutral-400 mb-3">
                <span className="flex items-center gap-1">
                    <User className="w-3 h-3" />
                    {layer.author || "Anonymous"}
                </span>
                <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDate(layer.updatedAt)}
                </span>
            </div>

            {/* Tags */}
            {layer.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                    {layer.tags.slice(0, 4).map(tag => (
                        <span
                            key={tag}
                            className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-neutral-300 rounded"
                        >
                            <Tag className="w-2.5 h-2.5" />
                            {tag}
                        </span>
                    ))}
                    {layer.tags.length > 4 && (
                        <span className="text-xs text-gray-500 dark:text-neutral-400">
                            +{layer.tags.length - 4}
                        </span>
                    )}
                </div>
            )}

            {/* Actions */}
            <div className="flex flex-col gap-2">
                <Button
                    variant={justCopied ? "default" : error ? "destructive" : "outline"}
                    size="sm"
                    className="flex-1"
                    onClick={handleCopy}
                    disabled={isLoading}
                >
                    {isLoading ? (
                        <>
                            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                            Loading...
                        </>
                    ) : justCopied ? (
                        <>
                            <Check className="w-4 h-4 mr-1" />
                            Copied!
                        </>
                    ) : error ? (
                        <>
                            {error}
                        </>
                    ) : (
                        <>
                            <Copy className="w-4 h-4 mr-1" />
                            Copy Layer
                        </>
                    )}
                </Button>
            </div>
        </div>
    );
};

// Keep old name for backwards compatibility
export const LayoutCard = LayerCard;

export default LayerCard;
