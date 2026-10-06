/**
 * LayoutsPanel - Browse and import layers from layout files
 *
 * Shows:
 * - Current keyboard (always at top)
 * - Imported .svil/.vil layouts (legacy .viable accepted)
 * - Import button and drag-drop zone
 */

import type { FC } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Search, Upload, X } from "lucide-react";
import { LayoutImport } from "@/components/icons/LayoutImport";

import { LayoutGroupCard } from "@/components/LayoutGroupCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useLayoutLibrary } from "@/contexts/LayoutLibraryContext";
import { useLayoutSettings } from "@/contexts/LayoutSettingsContext";
import { layerLibraryService } from "@/services/layer-library.service";
import type { LayoutGroup, ImportedLayer } from "@/types/layer-library";

// Dynamically discover all layout files placed in src/default-layouts
// No code changes are required when adding new files here!
const defaultLayoutModules = import.meta.glob('@/default-layouts/*.{svil,viable,vil,json}', {
    query: '?url',
    import: 'default',
    eager: true
}) as Record<string, string>;

// Transform the glob object into an array of { name, fileUrl }
const DEFAULT_LAYOUTS = Object.entries(defaultLayoutModules).map(([path, url]) => {
    // Extract just the filename without extension for the 'name'
    const name = path.split('/').pop()?.replace(/\.(svil|viable|vil|json)$/i, '') || 'unknown';
    return { name, fileUrl: url };
});

const LayoutsPanel: FC = () => {
    const { layoutMode } = useLayoutSettings();
    const isHorizontal = layoutMode === "bottombar";
    const {
        layers: publishedLayers,
        isLoading: isPublishedLoading,
        deleteLayer,
    } = useLayoutLibrary();

    const [searchQuery, setSearchQuery] = useState("");
    const [importedLayouts, setImportedLayouts] = useState<LayoutGroup[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [importError, setImportError] = useState<string | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const dropZoneRef = useRef<HTMLDivElement>(null);

    // Load imported layouts on mount and handle defaults
    useEffect(() => {
        const loadInitialLayouts = async () => {
            let currentLayouts = layerLibraryService.getImportedLayouts();

            for (const layout of DEFAULT_LAYOUTS) {
                // Check if layout with this name is already imported
                if (!currentLayouts.find(l => l.name === layout.name)) {
                    try {
                        const response = await fetch(layout.fileUrl);
                        if (response.ok) {
                            const blob = await response.blob();
                            // Generate a proper filename from the URL or name
                            const filename = layout.fileUrl.split('/').pop()?.split('?')[0] || `${layout.name}.svil`;
                            const file = new File([blob], filename, { type: "application/json" });
                            await layerLibraryService.importLayoutFromFile(file);

                            // Refresh layouts list from service after saving
                            currentLayouts = layerLibraryService.getImportedLayouts();
                        }
                    } catch (e) {
                        console.error(`Failed to load default layout ${layout.name}:`, e);
                    }
                }
            }

            setImportedLayouts(currentLayouts);
        };

        loadInitialLayouts();
    }, []);

    // Handle file import
    const handleFileImport = useCallback(async (file: File) => {
        if (!file.name.match(/\.(svil|viable|vil|json)$/i)) {
            setImportError("Please select a .svil, .vil, or .json file");
            return;
        }

        setIsImporting(true);
        setImportError(null);

        try {
            const layout = await layerLibraryService.importLayoutFromFile(file);
            setImportedLayouts(prev => [layout, ...prev]);
        } catch (e) {
            console.error("Failed to import layout:", e);
            setImportError(e instanceof Error ? e.message : "Failed to import layout");
        } finally {
            setIsImporting(false);
        }
    }, []);

    // Handle file input change
    const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            handleFileImport(file);
        }
        // Reset input
        if (e.target) {
            e.target.value = '';
        }
    };

    // Handle drag events
    const handleDragEnter = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        // Only set dragging to false if we're leaving the drop zone
        if (dropZoneRef.current && !dropZoneRef.current.contains(e.relatedTarget as Node)) {
            setIsDragging(false);
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        const file = e.dataTransfer.files?.[0];
        if (file) {
            handleFileImport(file);
        }
    };

    // Handle delete layout
    const handleDeleteLayout = (group: LayoutGroup) => {
        if (layerLibraryService.deleteImportedLayout(group.id)) {
            setImportedLayouts(prev => prev.filter(l => l.id !== group.id));
        }
    };

    const handleDeleteImportedLayer = (group: LayoutGroup, layer: ImportedLayer) => {
        if (!layerLibraryService.deleteImportedLayer(group.id, layer.index)) return;
        const nextLayouts = layerLibraryService.getImportedLayouts();
        setImportedLayouts(nextLayouts);
    };


    // Filter layouts based on search query
    const hasMatchingLayers = (group: LayoutGroup | null) => {
        if (!group) return false;
        if (!searchQuery) return true;
        return group.layers.some(l =>
            l.name.toLowerCase().includes(searchQuery.toLowerCase())
        ) || group.name.toLowerCase().includes(searchQuery.toLowerCase());
    };

    // Filter published layers
    const filteredPublishedLayers = publishedLayers.filter(l =>
        !searchQuery || l.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const savedLayerRows = useMemo<ImportedLayer[]>(
        () => filteredPublishedLayers.map((layer, index) => ({
            index,
            name: layer.name,
            keymap: layer.keymap,
            color: layer.layerColor,
            ledColor: layer.ledColor,
        })),
        [filteredPublishedLayers]
    );

    const savedLayerGroup = useMemo<LayoutGroup | null>(
        () => {
            if (savedLayerRows.length === 0) return null;
            return {
                id: "saved-layer-group",
                name: "Saved Layers",
                source: "imported",
                layers: savedLayerRows,
            };
        },
        [savedLayerRows]
    );

    const handleDeleteSavedLayer = useCallback(async (_group: LayoutGroup, layer: ImportedLayer) => {
        const target = filteredPublishedLayers[layer.index];
        if (!target) return;
        await deleteLayer(target.id);
    }, [filteredPublishedLayers, deleteLayer]);

    const handleDeleteSavedLayersGroup = useCallback((_group: LayoutGroup) => {
        const deleteAll = async () => {
            await Promise.all(publishedLayers.map((layer) => deleteLayer(layer.id)));
        };
        void deleteAll();
    }, [publishedLayers, deleteLayer]);

    // ==========================================
    // VERTICAL LAYOUT (Sidebar Mode)
    // ==========================================
    return (
        <section
            ref={dropZoneRef}
            className="space-y-3 flex flex-col min-w-0 pt-0"
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
        >
            {/* Header Description */}
            <div className="pl-0 pr-3">
                <span className="text-sm text-gray-500 dark:text-neutral-400">
                    Drag and drop to apply a layout to one of your layers or drag and drop individual keys. Default layouts are provided by Svalboard. You can save any of your own layers here, or import any .svil file.
                </span>
            </div>

            {/* Controls (Search + Import) */}
            <div className="pl-0 pr-3 flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-0">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-neutral-400" />
                    <Input
                        className="pl-9 bg-gray-50/50 dark:bg-neutral-800/60 border-gray-200 dark:border-neutral-500 focus:ring-1 focus:ring-blue-500/20 rounded-full h-9"
                        aria-label="Search layouts"
                        placeholder="Search layouts..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-neutral-400 dark:hover:text-neutral-300"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>
                <Button
                    variant="outline"
                    className="rounded-full h-9 !px-4 shadow-sm flex-shrink-0"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isImporting}
                >
                    <LayoutImport className="size-5 mr-1.5" />
                    Import
                </Button>
            </div>

            {/* Hidden file input */}
            <input
                ref={fileInputRef}
                type="file"
                accept=".svil,.viable,.vil,.json"
                className="hidden"
                onChange={handleFileInputChange}
            />

            {/* Error Message */}
            {
                importError && (
                    <div className="pl-0 pr-3">
                        <div className="bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 p-3 rounded-md text-sm flex items-center justify-between">
                            <span>{importError}</span>
                            <button onClick={() => setImportError(null)} className="ml-2">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )
            }

            {/* Drag overlay */}
            {
                isDragging && (
                    <div className="absolute inset-0 bg-blue-500/10 border-2 border-dashed border-blue-500 rounded-lg flex items-center justify-center z-10">
                        <div className="text-center">
                            <Upload className="w-12 h-12 text-blue-500 mx-auto mb-2" />
                            <p className="text-blue-700 dark:text-blue-300 font-medium">
                                Drop .svil file to import
                            </p>
                        </div>
                    </div>
                )
            }

            {/* Layout List */}
            <div className="pl-0 pr-3 pb-3 space-y-3 scrollbar-thin">
                {/* Imported Layouts */}
                {importedLayouts
                    .filter(hasMatchingLayers)
                    .filter((layout, index, self) =>
                        index === self.findIndex((t) => t.name === layout.name)
                    )
                    .map(layout => (
                        <LayoutGroupCard
                            key={layout.id}
                            group={layout}
                            defaultExpanded={true}
                            onDelete={handleDeleteLayout}
                            onDeleteLayer={handleDeleteImportedLayer}
                            searchQuery={searchQuery}
                            compact={isHorizontal}
                        />
                    ))
                }

                {/* Saved Layers */}
                {savedLayerGroup && (
                    <LayoutGroupCard
                        key={savedLayerGroup.id}
                        group={savedLayerGroup}
                        defaultExpanded={true}
                        onDelete={handleDeleteSavedLayersGroup}
                        onDeleteLayer={handleDeleteSavedLayer}
                        searchQuery={searchQuery}
                            compact={isHorizontal}
                    />
                )}

                {/* Empty State */}
                {importedLayouts.length === 0 && publishedLayers.length === 0 && (
                    <div className="text-center text-gray-500 dark:text-neutral-400 mt-20">
                        <LayoutImport className="w-16 h-16 mx-auto mb-6 text-gray-200 dark:text-neutral-700" />
                        <p className="text-base font-medium mb-2">No layouts loaded</p>
                        <p className="text-sm max-w-[300px] mx-auto opacity-70">
                            Import a .svil file <br></br>or save one of your current layers from it's contextual menu.
                        </p>
                    </div>
                )}

                {/* No search results */}
                {searchQuery && importedLayouts.filter(hasMatchingLayers).length === 0 && filteredPublishedLayers.length === 0 && (
                    <div className="text-center text-gray-500 dark:text-neutral-400 mt-10">
                        <p className="mb-2">No layers match "{searchQuery}"</p>
                        <button
                            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                            onClick={() => setSearchQuery('')}
                        >
                            Clear search
                        </button>
                    </div>
                )}

                {/* Loading State */}
                {(isImporting || isPublishedLoading) && (
                    <div className="text-center text-gray-500 dark:text-neutral-400 py-4">
                        <div className="w-6 h-6 border-2 border-gray-300 border-t-blue-500 dark:border-neutral-600 dark:border-t-blue-500 rounded-full animate-spin mx-auto mb-2" />
                        <p className="text-sm">{isImporting ? "Importing layout..." : "Loading..."}</p>
                    </div>
                )}
            </div>
        </section >
    );
};

export default LayoutsPanel;
