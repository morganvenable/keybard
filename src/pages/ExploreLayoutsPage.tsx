/**
 * Layer Library Page - Full-page layer browser
 *
 * A dedicated page for browsing and copying individual keyboard layers.
 * Users can find layers, copy them, then paste with Ctrl+V.
 */

import type { FC } from "react";
import { ArrowLeft, RefreshCw, Search, X } from "lucide-react";

import { useLayerLibrary } from "@/contexts/LayoutLibraryContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LayerCard } from "@/components/LayoutCard";
import { LayerPreviewModal } from "@/components/LayerPreviewModal";
import type { LayerEntry } from "@/types/layer-library";
import { cn } from "@/lib/utils";

interface ExploreLayoutsPageProps {
    onBack: () => void;
}

const ExploreLayoutsPage: FC<ExploreLayoutsPageProps> = ({ onBack }) => {
    const {
        layers,
        isLoading,
        error,
        searchQuery,
        setSearchQuery,
        selectedTags,
        setSelectedTags,
        availableTags,
        refreshLayers,
        deleteLayer,
        copyLayer,
        layerClipboard,
        previewLayer,
        isPreviewOpen,
        openPreview,
        closePreview,
    } = useLayerLibrary();

    // Handle tag toggle
    const toggleTag = (tag: string) => {
        if (selectedTags.includes(tag)) {
            setSelectedTags(selectedTags.filter(t => t !== tag));
        } else {
            setSelectedTags([...selectedTags, tag]);
        }
    };

    // Handle copy - copies keymap to system clipboard and context
    const handleCopy = (layer: LayerEntry) => { copyLayer(layer); };

    // Handle delete - removes layer from library
    const handleDelete = async (layer: LayerEntry) => {
        if (confirm(`Delete "${layer.name}"? This cannot be undone.`)) {
            await deleteLayer(layer.id);
        }
    };

    return (
        <div className="h-full w-full bg-white flex flex-col">
            {/* Header */}
            <header className="border-b border-gray-200 px-6 py-4 flex items-center gap-4 shrink-0">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onBack}
                    className="shrink-0"
                >
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className="flex-1">
                    <h1 className="text-2xl font-semibold text-slate-800">Layer Library</h1>
                    <p className="text-sm text-gray-500">
                        {layerClipboard
                            ? `"${layerClipboard.layer.name}" copied — press Ctrl+V on any layer to paste`
                            : "Browse layers and copy them to paste into your keymap"}
                    </p>
                </div>
            </header>

            {/* Main Content */}
            <div className="flex-1 overflow-hidden flex">
                {/* Filters Sidebar */}
                <aside className="w-64 border-r border-gray-200 p-4 flex flex-col gap-4 shrink-0 overflow-auto">
                    {/* Search */}
                    <div>
                        <label className="text-sm font-medium text-gray-700 mb-2 block">Search</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <Input
                                type="text"
                                placeholder="Search layers..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9 pr-8"
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Tag Filters */}
                    {availableTags.length > 0 && (
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-sm font-medium text-gray-700">Tags</label>
                                {selectedTags.length > 0 && (
                                    <button
                                        onClick={() => setSelectedTags([])}
                                        className="text-xs text-gray-500 hover:text-gray-700"
                                    >
                                        Clear all
                                    </button>
                                )}
                            </div>
                            <div className="flex flex-wrap gap-1">
                                {availableTags.map(tag => (
                                    <button
                                        key={tag}
                                        onClick={() => toggleTag(tag)}
                                        className={cn(
                                            "text-xs px-2 py-1 rounded-full transition-colors",
                                            selectedTags.includes(tag)
                                                ? "bg-gray-900 text-white"
                                                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                        )}
                                    >
                                        {tag}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Local Storage Notice */}
                    <div className="mt-auto pt-4 border-t border-gray-200">
                        <p className="text-xs text-gray-400 text-center mb-3">
                            Layers are stored locally on this PC.
                        </p>
                        <button
                            onClick={refreshLayers}
                            disabled={isLoading}
                            className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-2 w-full justify-center"
                        >
                            <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
                            Refresh
                        </button>
                    </div>
                </aside>

                {/* Layer Grid */}
                <main className="flex-1 overflow-auto p-6">
                    {/* Error State */}
                    {error && (
                        <div className="mb-6">
                            <div className="bg-red-50 text-red-600 p-4 rounded-lg text-sm">
                                {error}
                            </div>
                        </div>
                    )}

                    {/* Layer Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {layers.map(layer => (
                            <LayerCard
                                key={layer.id}
                                layer={layer}
                                onCopy={handleCopy}
                                onDelete={handleDelete}
                                onClick={openPreview}
                            />
                        ))}
                    </div>

                    {/* Empty State */}
                    {!isLoading && layers.length === 0 && !error && (
                        <div className="text-center text-gray-500 mt-20">
                            <div className="text-6xl mb-4">
                                <Search className="w-16 h-16 mx-auto text-gray-300" />
                            </div>
                            <p className="text-lg mb-2">No layers found</p>
                            {searchQuery || selectedTags.length > 0 ? (
                                <p className="text-sm">Try adjusting your search or filters.</p>
                            ) : (
                                <p className="text-sm">
                                    Publish a layer from the layer dropdown to add it here!
                                </p>
                            )}
                        </div>
                    )}

                    {/* Loading State */}
                    {isLoading && layers.length === 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                                <div
                                    key={i}
                                    className="border rounded-lg p-4 bg-gray-50 animate-pulse"
                                >
                                    <div className="h-5 bg-gray-200 rounded w-3/4 mb-2" />
                                    <div className="h-4 bg-gray-200 rounded w-full mb-3" />
                                    <div className="flex gap-2">
                                        <div className="h-8 bg-gray-200 rounded flex-1" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </main>
            </div>

            {/* Layer Preview Modal */}
            <LayerPreviewModal
                layer={previewLayer}
                isOpen={isPreviewOpen}
                onClose={closePreview}
                onCopy={handleCopy}
            />
        </div>
    );
};

export default ExploreLayoutsPage;
