import EditingTargetStatus from "@/components/EditingTargetStatus";
import { useLayoutImport } from "@/hooks/useLayoutImport";
import { LayoutImport } from "@/components/icons/LayoutImport";
import { LayoutExport } from "@/components/icons/LayoutExport";
import MatrixTesterIcon from "@/components/icons/MatrixTesterSvg";
import BoxIcon from "@/components/icons/BoxIcon";
import LayoutMultiLayersIcon from "@/components/icons/LayoutMultiLayersIcon";
import ThumbGrid3x2Icon from "@/components/icons/ThumbGrid3x2Icon";
import LayersActiveIcon from "@/components/icons/LayersActive";
import LayersDefaultIcon from "@/components/icons/LayersDefault";
import SquareArrowLeftIcon from "@/components/icons/SquareArrowLeft";
import SquareArrowRightIcon from "@/components/icons/SquareArrowRight";
import TelescopeIcon from "@/components/icons/TelescopeIcon";
import { ArrowLeft, ChevronDown, Unplug, Undo2, Zap } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useVial } from "@/contexts/VialContext";
import { useChanges } from "@/contexts/ChangesContext";
import { useSettings } from "@/contexts/SettingsContext";
import { cn } from "@/lib/utils";
import { svalService } from "@/services/sval.service";
import { KEYMAP } from "@/constants/keygen";

import { fileService } from "@/services/file.service";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";

import { FC, useState, useEffect, useRef } from "react";
import { usePanels } from "@/contexts/PanelsContext";
import { useLayoutSettings } from "@/contexts/LayoutSettingsContext";


interface LayerSelectorProps {
    selectedLayer: number;
    setSelectedLayer: (layer: number) => void;
    isMultiLayersActive: boolean;
    onToggleMultiLayers: () => void;
    showAllLayers: boolean;
    onToggleShowLayers: () => void;
    isLayerOrderReversed: boolean;
    onToggleLayerOrder: () => void;
    layerActiveState?: boolean[];
    onToggleLayerOn: (layer: number) => void;
    isAllTransparencyActive: boolean;
    onToggleAllTransparency: () => void;
}

interface OverviewStateSnapshot {
    isMultiLayersActive: boolean;
    is3DMode: boolean;
    isThumb3DOffsetActive: boolean;
    isAllTransparencyActive: boolean;
    showAllLayers: boolean;
    isLayerOrderReversed: boolean;
    selectedLayer: number;
}

/**
 * Component for selecting and managing active layers in the keyboard editor.
 * Displays a horizontal bar of layer tabs with a filter toggle for hiding blank layers.
 */
const LayerSelector: FC<LayerSelectorProps> = ({
    selectedLayer: _selectedLayer,
    setSelectedLayer,
    isMultiLayersActive,
    onToggleMultiLayers,
    showAllLayers,
    onToggleShowLayers,
    isLayerOrderReversed,
    onToggleLayerOrder,
    layerActiveState,
    onToggleLayerOn,
    isAllTransparencyActive,
    onToggleAllTransparency
}) => {
    const { keyboard, isConnected, connect, resetToOriginal, activeLayerIndex } = useVial();
    const { undo, undoLabel, commit, getPendingCount, getPendingChanges, clearAll, isSaving, error: saveError, setInstant, isInstant } = useChanges();
    const { updateSetting } = useSettings();
    const { is3DMode, setIs3DMode, isThumb3DOffsetActive, setIsThumb3DOffsetActive } = useLayoutSettings();
    const { activePanel, setActivePanel, setOpen, setItemToEdit, setPanelToGoBack } = usePanels();

    const liveUpdating = isInstant;
    const selectedLayer = _selectedLayer;
    const transparentKeyGlyph = KEYMAP["KC_TRNS"]?.str || "▽";



    // Import/Export / Connect state
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isExportOpen, setIsExportOpen] = useState(false);
    const [exportFormat, setExportFormat] = useState<"svil" | "vil">("svil");
    const [includeMacros, setIncludeMacros] = useState(true);

    const { handleFileImport, importReview, setFileError } = useLayoutImport();

    const handleExport = async () => {
        if (!keyboard) {
            console.error("No keyboard loaded");
            return;
        }

        try {
            if (exportFormat === "svil") {
                // Custom values are already in keyboard.custom_values (loaded at connect time)
                await fileService.downloadSvil(keyboard, includeMacros);
            } else {
                await fileService.downloadVIL(keyboard, includeMacros);
            }
            setIsExportOpen(false);
        } catch (err) {
            setFileError(err instanceof Error ? err.message : String(err));
        }
    };

    // Track container width for collapsing behavior
    const containerRef = useRef<HTMLDivElement>(null);
    const [, setContainerWidth] = useState(0);

    const [windowHeight, setWindowHeight] = useState(window.innerHeight);
    const [isHovered, setIsHovered] = useState(false);
    const [ignoreHover, setIgnoreHover] = useState(false);
    const [isOverviewActive, setIsOverviewActive] = useState(false);
    const overviewSnapshotRef = useRef<OverviewStateSnapshot | null>(null);

    useEffect(() => {
        if (!containerRef.current) return;
        const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                setContainerWidth(entry.contentRect.width);
            }
        });
        resizeObserver.observe(containerRef.current);
        return () => resizeObserver.disconnect();
    }, []);

    // Track window height for hover-only mode
    useEffect(() => {
        const handleResize = () => setWindowHeight(window.innerHeight);
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    // When vertically constrained, go into hover-only mode
    const isVerticallyConstrained = windowHeight < 550;
    const showFullBar = !isVerticallyConstrained || isHovered;

    const getDisplayOrderForState = (
        nextShowAllLayers: boolean,
        nextIsLayerOrderReversed: boolean,
        nextSelectedLayer: number = selectedLayer
    ): number[] => {
        if (!keyboard) return [];
        const allLayerIds = Array.from({ length: keyboard.layers || 16 }, (_, i) => i);
        const visibleLayerIds = allLayerIds.filter((i) => {
            const layerData = keyboard.keymap?.[i];
            const isTransparentLayer = layerData ? layerData.every((keycode) => keycode === (KEYMAP["KC_TRNS"]?.code ?? 1)) : true;
            const isLayerActive = typeof activeLayerIndex === "number"
                ? activeLayerIndex === i
                : !!layerActiveState?.[i];

            if (!nextShowAllLayers && isTransparentLayer && i !== nextSelectedLayer && !isLayerActive) {
                return false;
            }
            return true;
        });
        return nextIsLayerOrderReversed ? [...visibleLayerIds].reverse() : visibleLayerIds;
    };

    const disableOverviewWithoutRestore = () => {
        if (!isOverviewActive) return;
        overviewSnapshotRef.current = null;
        setIsOverviewActive(false);
    };

    const handleOverviewToggle = () => {
        if (isOverviewActive) {
            const snapshot = overviewSnapshotRef.current;
            overviewSnapshotRef.current = null;
            setIsOverviewActive(false);
            if (!snapshot) return;

            if (isMultiLayersActive !== snapshot.isMultiLayersActive) onToggleMultiLayers();
            if (is3DMode !== snapshot.is3DMode) setIs3DMode(snapshot.is3DMode);
            if (isThumb3DOffsetActive !== snapshot.isThumb3DOffsetActive) setIsThumb3DOffsetActive(snapshot.isThumb3DOffsetActive);
            if (isAllTransparencyActive !== snapshot.isAllTransparencyActive) onToggleAllTransparency();
            if (showAllLayers !== snapshot.showAllLayers) onToggleShowLayers();
            if (isLayerOrderReversed !== snapshot.isLayerOrderReversed) onToggleLayerOrder();
            if (selectedLayer !== snapshot.selectedLayer) setSelectedLayer(snapshot.selectedLayer);
            return;
        }

        overviewSnapshotRef.current = {
            isMultiLayersActive,
            is3DMode,
            isThumb3DOffsetActive,
            isAllTransparencyActive,
            showAllLayers,
            isLayerOrderReversed,
            selectedLayer,
        };
        setIsOverviewActive(true);

        if (activePanel === "matrixtester") {
            setActivePanel(null);
        }
        if (!isMultiLayersActive) onToggleMultiLayers();
        if (!is3DMode) setIs3DMode(true);
        if (!isThumb3DOffsetActive) setIsThumb3DOffsetActive(true);
        if (!isAllTransparencyActive) onToggleAllTransparency();
        if (showAllLayers) onToggleShowLayers();
        if (!isLayerOrderReversed) onToggleLayerOrder();

        const overviewDisplayOrder = getDisplayOrderForState(false, true);
        if (overviewDisplayOrder.length > 0) {
            setSelectedLayer(overviewDisplayOrder[0]);
        }
    };

    // If tracked controls change while overview is active, auto-disable overview and keep current states.
    useEffect(() => {
        if (!isOverviewActive) return;
        const stillInOverviewPreset =
            isMultiLayersActive &&
            is3DMode &&
            isThumb3DOffsetActive &&
            isAllTransparencyActive &&
            !showAllLayers &&
            isLayerOrderReversed;

        if (!stillInOverviewPreset) {
            overviewSnapshotRef.current = null;
            setIsOverviewActive(false);
        }
    }, [
        isOverviewActive,
        isMultiLayersActive,
        is3DMode,
        isThumb3DOffsetActive,
        isAllTransparencyActive,
        showAllLayers,
        isLayerOrderReversed
    ]);

    if (!keyboard) return null;

    const handleSelectLayer = (layer: number) => () => {
        setSelectedLayer(layer);
    };

    const shouldRenderLayerTab = (i: number) => {
        const layerData = keyboard.keymap?.[i];
        const isTransparentLayer = layerData ? layerData.every((keycode) => keycode === (KEYMAP["KC_TRNS"]?.code ?? 1)) : true;
        const isLayerActive = typeof activeLayerIndex === "number"
            ? activeLayerIndex === i
            : !!layerActiveState?.[i];

        const shouldHideTransparent = !showAllLayers;
        if (shouldHideTransparent && isTransparentLayer && i !== selectedLayer && !isLayerActive) {
            return false;
        }
        return true;
    };

    const renderLayerTab = (i: number) => {
        if (!shouldRenderLayerTab(i)) return null;

        const layerShortName = svalService.getLayerNameNoLabel(keyboard, i);
        const isActive = selectedLayer === i;
        const isLayerActive = typeof activeLayerIndex === "number"
            ? activeLayerIndex === i
            : !!layerActiveState?.[i];

        return (
            <button
                key={`layer-tab-${i}`}
                onClick={handleSelectLayer(i)}
                onDoubleClick={(e) => {
                    e.stopPropagation();
                    onToggleLayerOn(i);
                }}
                className={cn(
                    "px-4 py-1 rounded-full transition-colors text-sm font-medium cursor-pointer border-none outline-none whitespace-nowrap",
                    isActive
                        ? "bg-gray-800 text-white shadow-md scale-105"
                        : "bg-transparent text-gray-600 hover:bg-gray-200"
                )}
            >
                <span className={cn("select-none", isLayerActive && "underline underline-offset-2")}>
                    {layerShortName}
                </span>
            </button>
        );
    };

    const allLayerIds = Array.from({ length: keyboard.layers || 16 }, (_, i) => i);
    const visibleLayerIds = allLayerIds.filter(shouldRenderLayerTab);
    const displayOrder = isLayerOrderReversed ? [...visibleLayerIds].reverse() : visibleLayerIds;

    // Single clean render - horizontal bar of layer tabs (single line, no wrap, no scroll)
    // When vertically constrained: hover-only mode with collapsed hint bar
    return (
        <div
            ref={containerRef}
            className={cn(
                "w-full flex-shrink-0 relative z-20 transition-all duration-200",
                showFullBar ? "pt-[22px]" : "pt-0"
            )}
            onClick={(e) => e.stopPropagation()}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <EditingTargetStatus />
            {importReview}
            {undoLabel && <button disabled={isSaving} onClick={() => void undo()} className="rounded border px-3 py-1 text-sm" title={undoLabel}>Undo {undoLabel}</button>}
            {/* Collapsed hint bar - shown when vertically constrained and not hovered */}
            {isVerticallyConstrained && !isHovered && (
                <div className="flex items-center justify-center text-gray-300 cursor-pointer h-3">
                    <ChevronDown className="h-3 w-3" />
                </div>
            )}

            {/* Full layer tabs - shown when not constrained or when hovered */}
            {showFullBar && (
                <div className="flex flex-col w-full bg-transparent">
                    <div className="relative w-full bg-transparent">
                        {/* Top Row: Connect/Import/Export + Live Controls + Tab Icon + Tabs */}
                        <div className="flex items-center gap-2 pl-5 py-2 whitespace-nowrap bg-transparent">

                            {/* File Input (Hidden) */}
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".svil,.viable,.vil,.json"
                                className="hidden"
                                onChange={handleFileImport}
                            />

                            {/* Export Dialog */}
                            <Dialog open={isExportOpen} onOpenChange={setIsExportOpen}>
                                <DialogContent className="sm:max-w-[425px]">
                                    <DialogHeader>
                                        <DialogTitle>Export Keyboard Configuration</DialogTitle>
                                        <DialogDescription>
                                            Choose the format and options for exporting your keyboard configuration.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="grid gap-4 py-4">
                                        <div className="grid grid-cols-4 items-center gap-4">
                                            <Label htmlFor="format" className="text-right">Format</Label>
                                            <Select value={exportFormat} onValueChange={(v) => setExportFormat(v as "svil" | "vil")}>
                                                <SelectTrigger className="col-span-3">
                                                    <SelectValue placeholder="Select format" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="svil">.svil (Recommended)</SelectItem>
                                                    <SelectItem value="vil">.vil (Vial compatible)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="grid grid-cols-4 items-center gap-4">
                                            <Label htmlFor="macros" className="text-right">Include Macros</Label>
                                            <Switch
                                                id="macros"
                                                checked={includeMacros}
                                                onCheckedChange={setIncludeMacros}
                                            />
                                        </div>
                                    </div>
                                    <DialogFooter>
                                        <Button variant="outline" onClick={() => setIsExportOpen(false)}>Cancel</Button>
                                        <Button onClick={handleExport}>Export</Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>

                            {/* Connect / Update Button Group */}
                            {!isConnected ? (
                                <button
                                    onClick={(e) => { e.stopPropagation(); connect(); }}
                                    className="flex items-center gap-2 text-sm font-medium cursor-pointer transition-all bg-black text-gray-200 hover:bg-gray-800 px-5 py-1.5 rounded-full mr-2"
                                    title="Click to Connect"
                                >
                                    <Unplug className="h-4 w-4 text-gray-200" />
                                    <span className="select-none">Connect</span>
                                </button>
                            ) : (
                                <div className="flex items-center gap-1">

                                    {saveError && (
                                        <div role="alert" className="max-w-xs text-xs text-red-700">
                                            <span>Not saved: {saveError}. Pending edits are retained. Retry before discarding; some writes may already have succeeded. </span>
                                            <button disabled={isSaving} onClick={() => void commit()} className="underline font-semibold">Retry</button>
                                        </div>
                                    )}
                                    {getPendingCount() > 0 && (
                                        <details className="relative text-xs">
                                            <summary className="cursor-pointer">Pending ({getPendingCount()})</summary>
                                            <ul className="absolute right-0 z-50 mt-2 max-h-64 w-72 overflow-auto rounded border bg-white p-3 shadow-lg">
                                                {getPendingChanges().map(change => <li key={change.writeKey || change.desc} className="py-1">{change.desc}</li>)}
                                            </ul>
                                        </details>
                                    )}
                                    {/* Mode Switch Button (Zap) - Only show when NOT live updating (to switch TO live) */}
                                    {!liveUpdating && (
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <button
                                                    disabled={isSaving}
                                                    onClick={async (e) => {
                                                        e.stopPropagation();
                                                        if (await setInstant(true)) updateSetting("live-updating", true);
                                                    }}
                                                    className="p-2 rounded-full transition-all cursor-pointer hover:bg-gray-100"
                                                    aria-label="Switch to Live Updating"
                                                >
                                                    <Zap className="h-4 w-4 fill-black text-black" />
                                                </button>
                                            </TooltipTrigger>
                                            <TooltipContent side="top">
                                                Switch to Live Updating
                                            </TooltipContent>
                                        </Tooltip>
                                    )}
                                    {/* Main Action Button */}
                                    {liveUpdating ? (
                                        <>
                                            {/* Zap button to switch to Manual/Update Now mode - inverted colors */}
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            void setInstant(false);
                                                            updateSetting("live-updating", false);
                                                        }}
                                                        className="p-2 rounded-full transition-all cursor-pointer bg-black hover:bg-gray-800"
                                                        aria-label="Switch to Manual Updates"
                                                    >
                                                        <Zap className="h-4 w-4 fill-kb-gray text-kb-gray" />
                                                    </button>
                                                </TooltipTrigger>
                                                <TooltipContent side="top">
                                                    Switch to Manual Updates
                                                </TooltipContent>
                                            </Tooltip>
                                            {/* Live Updating button - black text on transparent background */}
                                            <button
                                                disabled={true}
                                                className="flex items-center text-sm font-medium pl-2 pr-5 py-1.5 rounded-full bg-transparent text-black border border-transparent cursor-default"
                                            >
                                                <span className="select-none">{isSaving ? "Saving…" : saveError ? "Changes not saved" : "Live Updating"}</span>
                                            </button>
                                        </>
                                    ) : (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setIgnoreHover(true);
                                                // Handle "Update Changes"
                                                commit();
                                            }}
                                            onMouseLeave={() => setIgnoreHover(false)}
                                            disabled={isSaving || getPendingCount() === 0}
                                            className={cn(
                                                "flex items-center gap-2 text-sm font-medium transition-all px-5 py-1.5 rounded-full border",
                                                // Disabled state
                                                getPendingCount() === 0
                                                    ? "bg-gray-200 text-black border-gray-200 cursor-not-allowed"
                                                    : "bg-black text-gray-200 cursor-pointer",
                                                // Hover logic - Manual Mode: Red (only when enabled)
                                                getPendingCount() > 0 && (!ignoreHover) && "hover:bg-red-500 hover:text-white hover:border-red-500",

                                                // Pending Changes Ring (Manual Mode only)
                                                getPendingCount() > 0
                                                    ? `border-transparent ring-[3px] ring-red-500 ring-offset-2 ring-offset-kb-gray ${!ignoreHover ? "hover:ring-black" : ""}`
                                                    : "", // No ring when disabled

                                                // Active state (click) - only when enabled
                                                getPendingCount() > 0 && "active:bg-red-500 active:text-white"
                                            )}
                                        >
                                            <span className="select-none">
                                                {isSaving ? "Saving…" : getPendingCount() > 0
                                                    ? `Apply ${getPendingCount()} Change${getPendingCount() === 1 ? '' : 's'} `
                                                    : 'No pending changes'}
                                            </span>
                                        </button>
                                    )}

                                    {!liveUpdating && (
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (getPendingCount() > 0 && !saveError && window.confirm("Discard all pending edits in this draft? Changes already applied to the keyboard are not undone.")) {
                                                            clearAll();
                                                            resetToOriginal();
                                                        }
                                                    }}
                                                    disabled={isSaving || !!saveError || getPendingCount() === 0}
                                                    aria-label="Discard pending edits"
                                                    className={cn(
                                                        "p-2 rounded-full transition-all text-black ml-0",
                                                        getPendingCount() > 0 ? "cursor-pointer hover:bg-gray-100" : "opacity-30 cursor-not-allowed"
                                                    )}
                                                >
                                                    <Undo2 className="h-4 w-4" />
                                                </button>
                                            </TooltipTrigger>
                                            <TooltipContent side="top">
                                                Discard pending edits
                                            </TooltipContent>
                                        </Tooltip>
                                    )}
                                </div>
                            )}

                            {/* Divider */}
                            <div className="h-4 w-[1px] bg-slate-400 mx-0 flex-shrink-0" />

                            <div className="flex items-center gap-1">
                                {/* Import Button */}
                                <Tooltip delayDuration={500}>
                                    <TooltipTrigger asChild>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                                            className="p-2 rounded-full transition-all cursor-pointer hover:bg-gray-200"
                                            aria-label="Import Layout"
                                        >
                                            <LayoutImport className="h-5 w-5 text-black" />
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">
                                        Import Layout
                                    </TooltipContent>
                                </Tooltip>

                                {/* Export Button */}
                                <Tooltip delayDuration={500}>
                                    <TooltipTrigger asChild>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setIsExportOpen(true); }}
                                            className="p-2 rounded-full transition-all cursor-pointer hover:bg-gray-200"
                                            disabled={!keyboard}
                                            aria-label="Export Layout"
                                        >
                                            <LayoutExport className="h-5 w-5 text-black" />
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">
                                        Export Layout
                                    </TooltipContent>
                                </Tooltip>

                                {/* Matrix Tester Button */}
                                <Tooltip delayDuration={500}>
                                    <TooltipTrigger asChild>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (activePanel === "matrixtester") {
                                                    // If already in matrix tester mode, exit it
                                                    setActivePanel(null);
                                                } else {
                                                    // Enter matrix tester mode
                                                    setOpen(false);
                                                    setActivePanel("matrixtester");
                                                    setPanelToGoBack(null);
                                                    setItemToEdit(null);
                                                }
                                            }}
                                            className={cn(
                                                "p-2 rounded-full transition-all cursor-pointer",
                                                activePanel === "matrixtester"
                                                    ? "bg-black hover:bg-gray-800"
                                                    : "hover:bg-gray-200"
                                            )}
                                            aria-label={activePanel === "matrixtester" ? "Exit Matrix Tester" : "Matrix Tester"}
                                        >
                                            <MatrixTesterIcon className={cn(
                                                "h-5 w-5",
                                                activePanel === "matrixtester" ? "text-kb-gray" : "text-black"
                                            )} />
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">
                                        {activePanel === "matrixtester" ? "Exit Matrix Tester" : "Matrix Tester"}
                                    </TooltipContent>
                                </Tooltip>

                                {/* Divider */}
                                <div className="h-4 w-[1px] bg-slate-400 ml-2 mr-2 flex-shrink-0" />

                                {/* Multi Layers Button */}
                                <Tooltip delayDuration={500}>
                                    <TooltipTrigger asChild>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                disableOverviewWithoutRestore();
                                                if (activePanel === "matrixtester") {
                                                    setActivePanel(null);
                                                }
                                                onToggleMultiLayers();
                                            }}
                                            className={cn(
                                                "p-2 rounded-full transition-all cursor-pointer",
                                                isMultiLayersActive
                                                    ? "bg-black hover:bg-gray-800"
                                                    : "hover:bg-gray-200"
                                            )}
                                            aria-label={isMultiLayersActive ? "Show Single Layer" : "Show Multiple Layers"}
                                        >
                                            <LayoutMultiLayersIcon className={cn(
                                                "h-5 w-5",
                                                isMultiLayersActive ? "text-kb-gray" : "text-black"
                                            )} />
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">
                                        {isMultiLayersActive ? "Show Single Layer" : "Show Multiple Layers"}
                                    </TooltipContent>
                                </Tooltip>

                                {/* 3D View Toggle Button */}
                                <Tooltip delayDuration={500}>
                                    <TooltipTrigger asChild>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                disableOverviewWithoutRestore();
                                                setIs3DMode(!is3DMode);
                                            }}
                                            className={cn(
                                                "p-2 rounded-full transition-all cursor-pointer",
                                                is3DMode
                                                    ? "bg-black hover:bg-gray-800"
                                                    : "hover:bg-gray-200"
                                            )}
                                            aria-label={is3DMode ? "Exit 3D View" : "3D View"}
                                        >
                                            <BoxIcon className={cn(
                                                "h-5 w-5",
                                                is3DMode ? "text-kb-gray" : "text-gray-700"
                                            )} />
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">
                                        {is3DMode ? "Exit 3D View" : "3D View"}
                                    </TooltipContent>
                                </Tooltip>

                                {/* Thumb Offset Toggle (3D) */}
                                <Tooltip delayDuration={500}>
                                    <TooltipTrigger asChild>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                disableOverviewWithoutRestore();
                                                setIsThumb3DOffsetActive(!isThumb3DOffsetActive);
                                            }}
                                            className={cn(
                                                "p-2 rounded-full transition-all cursor-pointer",
                                                isThumb3DOffsetActive
                                                    ? "bg-black hover:bg-gray-800"
                                                    : "hover:bg-gray-200"
                                            )}
                                            aria-label="Hide Thumbs"
                                        >
                                            <ThumbGrid3x2Icon className={cn(
                                                "h-5 w-5",
                                                isThumb3DOffsetActive ? "text-kb-gray" : "text-gray-700"
                                            )} />
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">
                                        Hide Thumbs
                                    </TooltipContent>
                                </Tooltip>

                                {/* Show/Hide All Transparent Keys Button */}
                                <Tooltip delayDuration={500}>
                                    <TooltipTrigger asChild>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                disableOverviewWithoutRestore();
                                                onToggleAllTransparency();
                                            }}
                                            className={cn(
                                                "p-2 rounded-full transition-all cursor-pointer w-9 h-9 flex items-center justify-center",
                                                isAllTransparencyActive
                                                    ? "bg-black hover:bg-gray-800"
                                                    : "hover:bg-gray-200"
                                            )}
                                            aria-label={isAllTransparencyActive ? "Show All Transparent Keys" : "Hide All Transparent Keys"}
                                        >
                                            <span className={cn(
                                                "text-lg leading-none font-semibold translate-y-[2px]",
                                                isAllTransparencyActive ? "text-kb-gray" : "text-gray-700"
                                            )}>
                                                {transparentKeyGlyph}
                                            </span>
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">
                                        {isAllTransparencyActive ? "Show All Transparent Keys" : "Hide All Transparent Keys"}
                                    </TooltipContent>
                                </Tooltip>

                                {/* Overview Button */}
                                <Tooltip delayDuration={500}>
                                    <TooltipTrigger asChild>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleOverviewToggle();
                                            }}
                                            className={cn(
                                                "p-2 rounded-full transition-all cursor-pointer",
                                                isOverviewActive
                                                    ? "bg-black hover:bg-gray-800"
                                                    : "hover:bg-gray-200"
                                            )}
                                            aria-label={isOverviewActive ? "Disable Overview" : "Overview"}
                                        >
                                            <TelescopeIcon className={cn(
                                                "h-5 w-5",
                                                isOverviewActive ? "text-kb-gray" : "text-gray-700"
                                            )} />
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">
                                        Overview
                                    </TooltipContent>
                                </Tooltip>
                            </div>

                        </div>

                        {/* Matrix Tester Title - shown only when matrix tester is active */}
                        {activePanel === "matrixtester" && (
                            <div className="pl-[27px] pt-[7px] pb-2">
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setActivePanel(null)}
                                        className="flex items-center gap-2 p-1 pr-3 -ml-1 rounded-lg hover:bg-gray-200 transition-colors"
                                        title="Return to layer view"
                                    >
                                        <ArrowLeft className="h-5 w-5 text-black" />
                                        <span className="font-bold text-lg text-black">Matrix Tester</span>
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Layer Tabs Row - fixed position in 3D and/or multi-layer mode */}
                        {(isMultiLayersActive || is3DMode) && (
                            <div className="absolute left-0 right-0 top-full z-30 flex items-center gap-2 pl-5 pb-2 whitespace-nowrap bg-transparent pointer-events-auto">
                                <div className="flex items-center gap-1">
                                    <Tooltip delayDuration={500}>
                                        <TooltipTrigger asChild>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    disableOverviewWithoutRestore();
                                                    onToggleShowLayers();
                                                }}
                                                disabled={activePanel === "matrixtester"}
                                                className={cn(
                                                    "p-2 rounded-full transition-colors flex-shrink-0",
                                                    activePanel === "matrixtester"
                                                        ? "text-gray-400 cursor-not-allowed opacity-30"
                                                        : "text-black hover:bg-gray-200"
                                                )}
                                            aria-label={showAllLayers ? "Hide Transparent Layers" : "Show All Layers"}
                                        >
                                            {!showAllLayers ? <LayersActiveIcon className="h-5 w-5" /> : <LayersDefaultIcon className="h-5 w-5" />}
                                        </button>
                                    </TooltipTrigger>
                                        <TooltipContent side="top">
                                            {showAllLayers ? "Hide Transparent Layers" : "Show All Layers"}
                                        </TooltipContent>
                                    </Tooltip>
                                </div>

                                <div className={cn("flex items-center gap-1", activePanel === "matrixtester" && "opacity-30 pointer-events-none")}>
                                    {displayOrder.map((i) => renderLayerTab(i))}
                                </div>

                                <Tooltip delayDuration={500}>
                                    <TooltipTrigger asChild>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                disableOverviewWithoutRestore();
                                                onToggleLayerOrder();
                                            }}
                                            className={cn(
                                                "p-2 rounded-full transition-colors",
                                                "text-gray-500 hover:text-gray-800 hover:bg-gray-200"
                                            )}
                                            aria-label="Reverse Layer Order"
                                        >
                                            {isLayerOrderReversed
                                                ? <SquareArrowRightIcon className="h-5 w-5" />
                                                : <SquareArrowLeftIcon className="h-5 w-5" />}
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">
                                        Flip Layer View
                                    </TooltipContent>
                                </Tooltip>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default LayerSelector;
