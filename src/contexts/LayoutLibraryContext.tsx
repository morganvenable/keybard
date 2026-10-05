import { writeLayerClipboard } from "@/utils/layer-clipboard";
/**
 * Layer Library Context
 * Manages state for browsing individual layers in the Explore panel
 */

import { createContext, useCallback, useContext, useEffect, useState } from "react";

import type {
    LayerEntry,
    LayerClipboard,
    LayerSearchOptions,
} from "@/types/layer-library";
import { layerLibraryService } from "@/services/layer-library.service";

interface LayerLibraryContextType {
    // Layer list
    layers: LayerEntry[];
    isLoading: boolean;
    error: string | null;

    // Search/filter state
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    selectedTags: string[];
    setSelectedTags: (tags: string[]) => void;
    availableTags: string[];

    // Actions
    loadLayers: () => Promise<void>;
    refreshLayers: () => Promise<void>;
    deleteLayer: (id: string) => Promise<boolean>;

    // Layer clipboard (for copy/paste)
    layerClipboard: LayerClipboard | null;
    copyLayer: (layer: LayerEntry, showDialog?: boolean) => void;
    clearClipboard: () => void;

    // Preview modal state
    previewLayer: LayerEntry | null;
    isPreviewOpen: boolean;
    openPreview: (layer: LayerEntry) => void;
    closePreview: () => void;

    // Paste dialog state
    isPasteDialogOpen: boolean;
    openPasteDialog: () => void;
    closePasteDialog: () => void;
}

const LayerLibraryContext = createContext<LayerLibraryContextType | undefined>(undefined);

export const LayerLibraryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // Layer list state
    const [layers, setLayers] = useState<LayerEntry[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Search/filter state
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [availableTags, setAvailableTags] = useState<string[]>([]);

    // Layer clipboard state
    const [layerClipboard, setLayerClipboard] = useState<LayerClipboard | null>(null);

    // Preview modal state
    const [previewLayer, setPreviewLayer] = useState<LayerEntry | null>(null);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);

    // Paste dialog state
    const [isPasteDialogOpen, setIsPasteDialogOpen] = useState(false);

    // Load layers with current filters
    const loadLayers = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const searchOptions: LayerSearchOptions = {
                query: searchQuery || undefined,
                tags: selectedTags.length > 0 ? selectedTags : undefined,
                sortBy: 'recent',
            };

            const results = await layerLibraryService.searchLayers(searchOptions);
            setLayers(results.layers);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to load layers');
            setLayers([]);
        } finally {
            setIsLoading(false);
        }
    }, [searchQuery, selectedTags]);

    // Refresh layers (clear cache and reload)
    const refreshLayers = useCallback(async () => {
        layerLibraryService.clearCache();
        await loadLayers();
    }, [loadLayers]);

    // Delete a layer
    const deleteLayer = useCallback(async (id: string): Promise<boolean> => {
        const success = await layerLibraryService.deleteLayer(id);
        if (success) {
            // Refresh the list and tags
            await loadLayers();
            const tags = await layerLibraryService.getAllTags();
            setAvailableTags(tags);
        }
        return success;
    }, [loadLayers]);

    // Copy a layer to clipboard
    const copyLayer = useCallback((layer: LayerEntry, showDialog = false) => {
        setLayerClipboard({
            layer: structuredClone(layer),
            copiedAt: Date.now(),
        });

        void writeLayerClipboard(layer).catch(error => console.error("Could not copy layer", error));

        if (showDialog) {
            setIsPasteDialogOpen(true);
        }
    }, []);

    // Clear clipboard
    const clearClipboard = useCallback(() => {
        setLayerClipboard(null);
    }, []);

    // Open preview modal
    const openPreview = useCallback((layer: LayerEntry) => {
        setPreviewLayer(layer);
        setIsPreviewOpen(true);
    }, []);

    // Close preview modal
    const closePreview = useCallback(() => {
        setIsPreviewOpen(false);
    }, []);

    // Open paste dialog
    const openPasteDialog = useCallback(() => {
        if (layerClipboard) {
            setIsPasteDialogOpen(true);
        }
    }, [layerClipboard]);

    // Close paste dialog
    const closePasteDialog = useCallback(() => {
        setIsPasteDialogOpen(false);
    }, []);

    // Load layers on mount
    useEffect(() => {
        loadLayers();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Load available tags on mount
    useEffect(() => {
        layerLibraryService.getAllTags().then(tags => {
            setAvailableTags(tags);
        }).catch(e => {
            console.warn('Failed to load tags:', e);
        });
    }, []);

    // Reload when search or tags change (with debounce)
    useEffect(() => {
        const timer = setTimeout(() => {
            loadLayers();
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery, selectedTags]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <LayerLibraryContext.Provider
            value={{
                layers,
                isLoading,
                error,
                searchQuery,
                setSearchQuery,
                selectedTags,
                setSelectedTags,
                availableTags,
                loadLayers,
                refreshLayers,
                deleteLayer,
                layerClipboard,
                copyLayer,
                clearClipboard,
                previewLayer,
                isPreviewOpen,
                openPreview,
                closePreview,
                isPasteDialogOpen,
                openPasteDialog,
                closePasteDialog,
            }}
        >
            {children}
        </LayerLibraryContext.Provider>
    );
};

export const useLayerLibrary = (): LayerLibraryContextType => {
    const context = useContext(LayerLibraryContext);
    if (!context) {
        throw new Error("useLayerLibrary must be used within a LayerLibraryProvider");
    }
    return context;
};

// Keep old export name for backwards compatibility during transition
export const LayoutLibraryProvider = LayerLibraryProvider;
export const useLayoutLibrary = useLayerLibrary;
