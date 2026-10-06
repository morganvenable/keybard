/**
 * LayerRow - A single layer entry in a LayoutGroupCard
 * Shows full-width keyboard preview with layer info and Place button
 * Can be dragged to place on current layer
 */

import type { FC } from "react";
import { createPortal } from "react-dom";
import { useRef, useEffect, useState, useMemo, useCallback } from "react";
import { GripHorizontal, Check, Trash2, X } from "lucide-react";
import CopyIcon from "@/components/icons/CopyIcon";
import Maximize2Icon from "./icons/Maximize2Icon";

import type { ImportedLayer } from "@/types/layer-library";
import { Button } from "@/components/ui/button";
import { MiniKeyboardPreview } from "@/components/MiniKeyboardPreview";
import { cn } from "@/lib/utils";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { colorClasses } from "@/utils/colors";
import { useKeyboard } from "@/contexts/KeyboardContext";
import { useLayoutLibrary } from "@/contexts/LayoutLibraryContext";
import { useLayoutSettings } from "@/contexts/LayoutSettingsContext";
import { useDrag } from "@/contexts/DragContext";
import { layerLibraryService } from "@/services/layer-library.service";
import { SVALBOARD_LAYOUT } from "@/constants/svalboard-layout";
import { THUMB_OFFSET_U } from "@/constants/keyboard-visuals";

interface LayerRowProps {
    /** The layer to display */
    layer: ImportedLayer;
    /** Source layout name (for display) */
    sourceLayout: string;
    /** Optional callback to delete this layer from imported layouts */
    onDelete?: () => void;
    /** Optional search query for highlighting matches */
    searchQuery?: string;
    /** Compact mode for horizontal layout */
    compact?: boolean;
}

// Small unit size used by Key component in "small" variant
const SMALL_UNIT_SIZE = 30;

export const LayerRow: FC<LayerRowProps> = ({
    layer,
    sourceLayout,
    onDelete,
    searchQuery = "",
    compact = false,
}) => {
    const { keyboard } = useKeyboard();
    const { startDrag, isDragging } = useDrag();
    const { copyLayer } = useLayoutLibrary();
    const { keyVariant } = useLayoutSettings();
    const containerRef = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(0.5);
    const [justCopied, setJustCopied] = useState(false);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [isMaximized, setIsMaximized] = useState(false);

    // Convert ImportedLayer to LayerEntry for the clipboard
    const layerEntry = useMemo(() =>
        layerLibraryService.importedLayerToLayerEntry(layer, sourceLayout),
        [layer, sourceLayout]
    );

    // Floating panel drag state
    const floatingRef = useRef<HTMLDivElement>(null);
    const [floatingPos, setFloatingPos] = useState<{ x: number; y: number } | null>(null);
    const dragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

    // Full-size unit size matches the main keyboard's current key variant
    const fullUnitSize = keyVariant === 'small' ? 30 : keyVariant === 'medium' ? 45 : 60;

    // Handle drag start for the entire layer
    const handleDragStart = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        startDrag({
            keycode: "",
            label: layer.name,
            type: "layer",
            component: "Layer",
            layerData: layerEntry,
            sourceId: `layer-${sourceLayout}-${layer.index}`,
        }, e);
    }, [layer, sourceLayout, startDrag, layerEntry]);

    // Get the layout to calculate dimensions
    const keyboardLayout = (keyboard?.keylayout && Object.keys(keyboard.keylayout).length > 0)
        ? keyboard.keylayout as Record<number, { x: number; y: number; w: number; h: number }>
        : SVALBOARD_LAYOUT;

    const useFragmentLayout = keyboard?.keylayout && Object.keys(keyboard.keylayout).length > 0;

    // Calculate keyboard extents in key units (layout-independent)
    const keyExtents = useMemo(() => {
        let maxX = 0;
        let maxY = 0;

        Object.values(keyboardLayout).forEach((key) => {
            const yPos = (!useFragmentLayout && key.y >= 6) ? key.y + THUMB_OFFSET_U : key.y;
            maxX = Math.max(maxX, key.x + key.w);
            maxY = Math.max(maxY, yPos + key.h);
        });

        return { maxX, maxY };
    }, [keyboardLayout, useFragmentLayout]);

    // Mini dimensions (always at SMALL_UNIT_SIZE)
    const dimensions = useMemo(() => ({
        width: keyExtents.maxX * SMALL_UNIT_SIZE,
        height: keyExtents.maxY * SMALL_UNIT_SIZE,
    }), [keyExtents]);

    // Full-size dimensions (at main keyboard's unit size)
    const fullDimensions = useMemo(() => ({
        width: keyExtents.maxX * fullUnitSize,
        height: keyExtents.maxY * fullUnitSize,
    }), [keyExtents, fullUnitSize]);

    // Calculate scale to fit container width
    useEffect(() => {
        const updateScale = () => {
            if (containerRef.current) {
                const containerWidth = containerRef.current.clientWidth;
                const newScale = Math.min(1, containerWidth / Math.max(1, dimensions.width));
                setScale(newScale);
            }
        };

        updateScale();
        window.addEventListener("resize", updateScale);

        // Also observe container size changes
        const observer = new ResizeObserver(updateScale);
        if (containerRef.current) {
            observer.observe(containerRef.current);
        }

        return () => {
            window.removeEventListener("resize", updateScale);
            observer.disconnect();
        };
    }, [dimensions.width, compact]);

    // We no longer need floatingScale as we render natively at fullUnitSize

    // Center floating panel on screen when first opened
    useEffect(() => {
        if (isMaximized && !floatingPos) {
            const panelWidth = fullDimensions.width + 48; // padding
            const panelHeight = fullDimensions.height + 60; // header + padding
            setFloatingPos({
                x: Math.max(16, (window.innerWidth - panelWidth) / 2),
                y: Math.max(16, (window.innerHeight - panelHeight) / 2),
            });
        }
        if (!isMaximized) {
            setFloatingPos(null);
        }
    }, [isMaximized, fullDimensions.width, fullDimensions.height, floatingPos]);

    // Floating panel drag handlers
    const handleFloatingDragStart = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!floatingRef.current || !floatingPos) return;
        dragOffsetRef.current = {
            x: e.clientX - floatingPos.x,
            y: e.clientY - floatingPos.y,
        };

        const handleMouseMove = (me: MouseEvent) => {
            setFloatingPos({
                x: me.clientX - dragOffsetRef.current.x,
                y: me.clientY - dragOffsetRef.current.y,
            });
        };
        const handleMouseUp = () => {
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);
        };
        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseup", handleMouseUp);
    }, [floatingPos]);

    const resolvedColorName = useMemo(() => {
        return layer.color || keyboard?.cosmetic?.layer_colors?.[layer.index] || "primary";
    }, [layer.color, layer.index, keyboard?.cosmetic?.layer_colors]);

    // Highlight matching text if search query is provided
    const highlightMatch = (text: string): React.ReactNode => {
        if (!searchQuery) return text;

        const lowerText = text.toLowerCase();
        const lowerQuery = searchQuery.toLowerCase();
        const index = lowerText.indexOf(lowerQuery);

        if (index === -1) return text;

        return (
            <>
                {text.slice(0, index)}
                <mark className="bg-yellow-200 dark:bg-yellow-800 dark:text-yellow-100 px-0.5 rounded">
                    {text.slice(index, index + searchQuery.length)}
                </mark>
                {text.slice(index + searchQuery.length)}
            </>
        );
    };

    // Calculate the scaled container height plus 8px extra below the keys
    const extraHeight = 8;
    const scaledHeight = (dimensions.height * scale) + extraHeight;
    const canDelete = typeof onDelete === "function";

    const handleDeleteConfirm = () => {
        if (!onDelete) return;
        onDelete();
        setIsDeleteConfirmOpen(false);
    };

    return (
        <div
            className={cn(
                "px-1 py-1 transition-colors group/row",
                compact ? "min-w-0" : "px-2 py-1",
                isDragging && "opacity-50"
            )}
        >
            <div className={cn(
                "rounded-sm bg-kb-gray flex flex-col",
                compact ? "p-1.5" : "p-2"
            )}>
                {/* Layer header */}
                <Tooltip>
                    <TooltipTrigger asChild>
                        <div className={cn(
                            "relative flex items-center justify-start transition-colors hover:bg-black/5 group-hover/row:bg-black/5 dark:hover:bg-white/5 dark:group-hover/row:bg-white/5 rounded-t-md rounded-b-none cursor-grab active:cursor-grabbing",
                            compact
                                ? "-mx-1.5 -mt-1.5 px-2.5 pt-1.5 pb-1 mb-1"
                                : "-mx-2 -mt-2 px-3 pt-2 pb-1.5 mb-2"
                        )}
                            onMouseDown={handleDragStart}
                        >
                            <div className="flex min-w-0 items-center gap-2">
                                {/* Layer color indicator - shows LED hardware color if available */}
                                <div
                                    className={cn(
                                        "w-3 h-3 rounded-full flex-shrink-0 shadow-sm",
                                        colorClasses[resolvedColorName] || "bg-kb-primary"
                                    )}
                                />
                                {/* Layer index */}
                                <span className="text-sm font-mono text-gray-500 dark:text-neutral-400 font-bold">
                                    {layer.index}
                                </span>
                                {/* Layer name */}
                                <span className="text-sm font-medium text-gray-900 dark:text-neutral-100 truncate">
                                    {highlightMatch(layer.name)}
                                </span>
                            </div>

                            {/* Centered drag handle indicator */}
                            <div className="absolute left-1/2 -translate-x-1/2 pointer-events-none text-gray-400 dark:text-neutral-400">
                                <GripHorizontal className="w-4 h-4" />
                            </div>

                            {/* Maximize button moved to title bar */}
                            <div className="flex shrink-0 items-center ml-auto">
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 rounded-full flex items-center justify-center p-0 transition-all hover:bg-black/10 dark:hover:bg-white/10 text-gray-500 dark:text-neutral-400 dark:hover:text-neutral-100"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setIsMaximized(true);
                                            }}
                                            onMouseDown={(e) => e.stopPropagation()}
                                            aria-label={`Enlarge ${layer.name} preview`}
                                        >
                                            <Maximize2Icon className="w-3.5 h-3.5" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>Maximize</p>
                                    </TooltipContent>
                                </Tooltip>
                            </div>
                        </div>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Drag and drop to replace a layer</p>
                    </TooltipContent>
                </Tooltip>

                {/* Full-width keyboard preview with scaling */}
                <div
                    ref={containerRef}
                    className="overflow-hidden relative"
                    style={{
                        height: `${scaledHeight}px`,
                    }}
                >
                    <div

                        style={{
                            transform: `scale(${scale})`,
                            transformOrigin: "top left",
                            width: `${dimensions.width}px`,
                            height: `${dimensions.height}px`,
                        }}
                    >
                        <MiniKeyboardPreview
                            keymap={layer.keymap}
                            layerColor={resolvedColorName}
                        />
                    </div>

                    {/* Note: Maximize button moved to layer header */}

                    {/* Hover action: delete in bottom-left */}
                    {canDelete && (
                        <div className="absolute bottom-1 left-1 opacity-0 group-hover/row:opacity-100 focus-within:opacity-100 transition-all z-10">
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setIsDeleteConfirmOpen(true);
                                        }}
                                        className="h-8 w-8 rounded-full flex items-center justify-center p-0 text-kb-gray-border transition-all hover:bg-red-500 hover:text-white focus:outline-none cursor-pointer bg-kb-gray-medium"
                                        aria-label={`Delete ${layer.name}`}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Delete Layer</p>
                                </TooltipContent>
                            </Tooltip>
                        </div>
                    )}

                    {/* Copy button in bottom-right */}
                    <div className="absolute bottom-1 right-1 opacity-0 group-hover/row:opacity-100 focus-within:opacity-100 transition-all z-10">
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant={justCopied ? "default" : "outline"}
                                    size="icon"
                                    className={cn(
                                        "h-8 w-8 rounded-full flex items-center justify-center p-0 transition-all",
                                        justCopied ? "bg-kb-active hover:bg-kb-active/90 border-kb-active text-kb-active-fg" : "bg-kb-surface shadow-sm"
                                    )}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        copyLayer(layerEntry, true);
                                        setJustCopied(true);
                                        setTimeout(() => setJustCopied(false), 2000);
                                    }}
                                    aria-label={`Copy ${layer.name}`}
                                >
                                    {justCopied ? (
                                        <Check className="w-4 h-4" />
                                    ) : (
                                        <CopyIcon className="w-4 h-4" />
                                    )}
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Copy Layer</p>
                            </TooltipContent>
                        </Tooltip>
                    </div>
                </div>
            </div>

            {/* Floating maximized panel via portal */}
            {isMaximized && floatingPos && createPortal(
                <TooltipProvider delayDuration={0}>
                <div
                    ref={floatingRef}
                    className="fixed z-[9999] max-h-[calc(100dvh-2rem)] rounded-xl bg-kb-gray shadow-2xl dark:ring-1 dark:ring-white/10 flex flex-col select-none group/floating"
                    style={{
                        width: `min(${fullDimensions.width + 64}px, calc(100vw - 2rem))`,
                        left: `clamp(16px, ${floatingPos.x}px, calc(100vw - min(${fullDimensions.width + 64}px, 100vw - 2rem) - 16px))`,
                        top: `clamp(16px, ${floatingPos.y}px, calc(100dvh - 64px))`,
                    }}
                >
                    {/* Floating panel header – draggable */}
                    <div
                        className="relative flex shrink-0 items-center justify-between px-4 pt-3 pb-2.5 cursor-grab active:cursor-grabbing rounded-t-xl transition-colors hover:bg-black/5 group-hover/floating:bg-black/5 dark:hover:bg-white/5 dark:group-hover/floating:bg-white/5"
                        onMouseDown={handleFloatingDragStart}
                    >
                        <div className="flex min-w-0 items-center gap-2">
                            <div
                                className={cn(
                                    "w-3 h-3 rounded-full flex-shrink-0 shadow-sm",
                                    colorClasses[resolvedColorName] || "bg-kb-primary"
                                )}
                            />
                            <span className="text-sm font-mono text-gray-500 dark:text-neutral-400 font-bold">
                                {layer.index}
                            </span>
                            <span className="text-sm font-medium text-gray-900 dark:text-neutral-100">
                                {layer.name}
                            </span>
                        </div>

                        {/* Centered drag handle */}
                        <div className="absolute left-1/2 -translate-x-1/2 pointer-events-none text-gray-400 dark:text-neutral-400">
                            <GripHorizontal className="w-5 h-5" />
                        </div>

                        <div className="flex min-w-0 items-center gap-2">
                            {/* Close button */}
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 rounded-full flex items-center justify-center p-0 transition-all hover:bg-black/10 dark:hover:bg-white/10 text-gray-500 dark:text-neutral-400 dark:hover:text-neutral-100"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsMaximized(false);
                                }}
                                onMouseDown={(e) => e.stopPropagation()}
                                aria-label="Close enlarged preview"
                            >
                                <X className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>

                    {/* Full-size keyboard preview */}
                    <div className="p-4 pb-12 overflow-auto min-h-0 relative">
                        <MiniKeyboardPreview
                            keymap={layer.keymap}
                            layerColor={resolvedColorName}
                            unitSize={fullUnitSize}
                        />

                        {/* Hover action: delete in bottom-left */}
                        {canDelete && (
                            <div className="absolute bottom-4 left-4 transition-all z-10">
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setIsDeleteConfirmOpen(true);
                                            }}
                                            className="h-10 w-10 rounded-full flex items-center justify-center p-0 text-kb-gray-border transition-all hover:bg-red-500 hover:text-white focus:outline-none cursor-pointer bg-kb-gray-medium shadow-sm"
                                            aria-label={`Delete ${layer.name}`}
                                        >
                                            <Trash2 className="h-5 w-5" />
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>Delete Layer</p>
                                    </TooltipContent>
                                </Tooltip>
                            </div>
                        )}

                        {/* Copy button in bottom-right */}
                        <div className="absolute bottom-4 right-4 transition-all z-10">
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant={justCopied ? "default" : "outline"}
                                        size="icon"
                                        className={cn(
                                            "h-10 w-10 rounded-full flex items-center justify-center p-0 transition-all",
                                            justCopied ? "bg-kb-active hover:bg-kb-active/90 border-kb-active text-kb-active-fg" : "bg-kb-surface shadow-sm"
                                        )}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            copyLayer(layerEntry, true);
                                            setJustCopied(true);
                                            setTimeout(() => setJustCopied(false), 2000);
                                        }}
                                        aria-label={`Copy ${layer.name}`}
                                    >
                                        {justCopied ? (
                                            <Check className="w-5 h-5" />
                                        ) : (
                                            <CopyIcon className="w-5 h-5" />
                                        )}
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Copy Layer</p>
                                </TooltipContent>
                            </Tooltip>
                        </div>
                    </div>
                </div>
                </TooltipProvider>,
                document.body
            )}

            <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold">
                            Clear Layouts {layer.name}
                        </DialogTitle>
                    </DialogHeader>
                    <DialogFooter className="gap-3 sm:gap-4 mt-4">
                        <Button
                            variant="outline"
                            onClick={() => setIsDeleteConfirmOpen(false)}
                            className="rounded-full px-8 py-5 text-base border-slate-300 hover:bg-slate-50 dark:border-neutral-500 dark:hover:bg-neutral-800 transition-colors"
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleDeleteConfirm}
                            className="rounded-full px-8 py-5 text-base font-bold bg-red-600 hover:bg-red-700 transition-colors border-none"
                        >
                            Clear
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default LayerRow;
