/**
 * LayoutGroupCard - Expandable card showing a layout group with its layers
 * Used in the Layouts panel to display imported layouts and the current keyboard
 */

import type { FC } from "react";
import { useState } from "react";
import { ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import LayoutLayersIcon from "@/components/icons/LayoutLayersIcon";

import type { LayoutGroup, ImportedLayer } from "@/types/layer-library";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import LayerRow from "./LayerRow";

interface LayoutGroupCardProps {
    /** The layout group to display */
    group: LayoutGroup;
    /** Whether the group is initially expanded */
    defaultExpanded?: boolean;
    /** Callback when delete is clicked (only for imported layouts) */
    onDelete?: (group: LayoutGroup) => void;
    /** Callback when deleting a single imported layer */
    onDeleteLayer?: (group: LayoutGroup, layer: ImportedLayer) => void;
    /** Optional search query for highlighting matches */
    searchQuery?: string;
    /** Compact mode for horizontal/bottom bar layout */
    compact?: boolean;
}

export const LayoutGroupCard: FC<LayoutGroupCardProps> = ({
    group,
    defaultExpanded = false,
    onDelete,
    onDeleteLayer,
    searchQuery = "",
    compact = false,
}) => {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

    // Filter layers based on search query
    const filteredLayers = searchQuery && !group.name.toLowerCase().includes(searchQuery.toLowerCase())
        ? group.layers.filter(layer =>
            layer.name.toLowerCase().includes(searchQuery.toLowerCase())
        )
        : group.layers;

    // Don't show card if no layers match search
    if (searchQuery && filteredLayers.length === 0) {
        return null;
    }

    const canDelete = group.source === "imported";
    const handleOpenDeleteConfirm = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsDeleteConfirmOpen(true);
    };
    const handleConfirmDelete = () => {
        if (!canDelete || !onDelete) return;
        onDelete(group);
        setIsDeleteConfirmOpen(false);
    };

    return (
        <>
            <div className="border border-gray-200 dark:border-neutral-700 rounded-lg overflow-hidden bg-kb-surface shadow-sm">
                {/* Header */}
                <div
                    role="button"
                    aria-expanded={isExpanded}
                    tabIndex={0}
                    onClick={() => setIsExpanded(!isExpanded)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setIsExpanded(!isExpanded); } }}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                >
                    <div className="flex min-w-0 items-center gap-2">
                        {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-gray-500 dark:text-neutral-400" />
                        ) : (
                            <ChevronRight className="w-4 h-4 text-gray-500 dark:text-neutral-400" />
                        )}
                        <LayoutLayersIcon className="w-5 h-5 text-gray-500 dark:text-neutral-400" />
                        <span className="min-w-0 break-words font-medium text-gray-900 dark:text-neutral-100">
                            {group.name}
                        </span>
                        {group.source === "current" && (
                            <span className="text-xs px-2 py-0.5 bg-kb-gray-medium text-kb-ink rounded">
                                Active
                            </span>
                        )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                        <span className="text-sm text-gray-500 dark:text-neutral-400">
                            {filteredLayers.length} layer{filteredLayers.length !== 1 ? 's' : ''}
                        </span>
                        {canDelete && onDelete && (
                            <button
                                type="button"
                                className="h-8 w-8 rounded-full flex items-center justify-center p-0 text-gray-500 dark:text-neutral-400 transition-all hover:bg-red-500 hover:text-white dark:hover:text-white focus:outline-none cursor-pointer bg-kb-surface"
                                onClick={handleOpenDeleteConfirm}
                                title="Delete layout"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                    <div className={compact ? "grid grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))] gap-2 p-2" : "flex flex-col"}>
                        {filteredLayers.map((layer) => (
                            <LayerRow
                                key={`${group.id}-${layer.index}`}
                                layer={layer}
                                sourceLayout={group.name}
                                onDelete={canDelete && onDeleteLayer ? () => onDeleteLayer(group, layer) : undefined}
                                searchQuery={searchQuery}
                                compact={compact}
                            />
                        ))}
                        {filteredLayers.length === 0 && (
                            <div className="px-4 py-3 text-sm text-gray-500 dark:text-neutral-400 text-center">
                                No layers
                            </div>
                        )}
                    </div>
                )}
            </div>

            <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
                <DialogContent className="sm:max-w-[425px]" aria-describedby={undefined}>
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold">
                            Clear Layouts {group.name}
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
                            onClick={handleConfirmDelete}
                            className="rounded-full px-8 py-5 text-base font-bold bg-red-600 hover:bg-red-700 transition-colors border-none"
                        >
                            Clear
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
};

export default LayoutGroupCard;
