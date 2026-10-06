/**
 * PublishLayerDialog - Dialog for publishing the current layer to the local library
 */

import type { FC } from "react";
import { useState, useEffect } from "react";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useVial } from "@/contexts/VialContext";
import { useLayerLibrary } from "@/contexts/LayoutLibraryContext";
import { svalService } from "@/services/sval.service";
import { layerLibraryService } from "@/services/layer-library.service";
import type { LayerEntry } from "@/types/layer-library";

interface PublishLayerDialogProps {
    isOpen: boolean;
    onClose: () => void;
    layerIndex: number;
}

export const PublishLayerDialog: FC<PublishLayerDialogProps> = ({
    isOpen,
    onClose,
    layerIndex,
}) => {
    const { keyboard } = useVial();
    const { refreshLayers } = useLayerLibrary();

    // Form state
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [author, setAuthor] = useState("");
    const [tags, setTags] = useState("");

    // UI state
    const [isPublishing, setIsPublishing] = useState(false);

    // Initialize form with layer name when dialog opens
    useEffect(() => {
        if (isOpen && keyboard) {
            const layerName = svalService.getLayerName(keyboard, layerIndex);
            setName(layerName);
            setDescription("");
            setTags("");
        }
    }, [isOpen, keyboard, layerIndex]);

    const handleClose = () => {
        onClose();
    };

    const handlePublish = async () => {
        if (!keyboard || !keyboard.keymap) return;

        setIsPublishing(true);

        try {
            // Extract the layer keymap
            const keymap = keyboard.keymap[layerIndex] || [];
            const layerColor = keyboard.cosmetic?.layer_colors?.[layerIndex.toString()];
            const ledColor = keyboard.layer_colors?.[layerIndex];

            // Create the layer entry
            const layerEntry: LayerEntry = {
                id: layerLibraryService.generateId(),
                name: name.trim(),
                description: description.trim(),
                author: author.trim() || "Anonymous",
                tags: tags.split(',').map(t => t.trim()).filter(Boolean),
                keyboardType: keyboard.kbid || "svalboard",
                keyCount: keymap.length,
                keymap: [...keymap],
                layerColor: layerColor,
                ledColor: ledColor,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };

            // Add to local library
            await layerLibraryService.addLayer(layerEntry);

            // Refresh the layer library context so the new layer appears
            await refreshLayers();

            handleClose();
        } catch (error) {
            console.error("Failed to publish layer:", error);
        } finally {
            setIsPublishing(false);
        }
    };

    // Get layer info for display
    const keyCount = keyboard?.keymap?.[layerIndex]?.length || 0;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Save Layer</DialogTitle>
                    <DialogDescription>
                        Layer will be saved locally to the Layouts panel.
                    </DialogDescription>
                </DialogHeader>

                {!keyboard ? (
                    <div className="py-6 text-center text-gray-500 dark:text-neutral-400">
                        No keyboard loaded.
                    </div>
                ) : (
                    <div className="space-y-4 py-2">
                        {/* Layer Info */}
                        <div className="bg-gray-50 dark:bg-neutral-800/60 rounded-lg p-3 text-sm">
                            <p className="text-gray-600 dark:text-neutral-300">
                                Saving layer {layerIndex} with {keyCount} keys
                            </p>
                        </div>

                        {/* Name */}
                        <div className="space-y-2">
                            <Label htmlFor="layer-name">Layer Name *</Label>
                            <Input
                                id="layer-name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Gaming WASD"
                            />
                        </div>

                        {/* Description */}
                        <div className="space-y-2">
                            <Label htmlFor="layer-description">Description</Label>
                            <textarea
                                id="layer-description"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="What is this layer for?"
                                className="w-full border rounded-md p-2 text-sm bg-kb-surface dark:border-neutral-500 min-h-[80px]"
                            />
                        </div>

                        {/* Author */}
                        <div className="space-y-2">
                            <Label htmlFor="layer-author">Author</Label>
                            <Input
                                id="layer-author"
                                value={author}
                                onChange={(e) => setAuthor(e.target.value)}
                                placeholder="Your name"
                            />
                        </div>

                        {/* Tags */}
                        <div className="space-y-2">
                            <Label htmlFor="layer-tags">Tags (comma-separated)</Label>
                            <Input
                                id="layer-tags"
                                value={tags}
                                onChange={(e) => setTags(e.target.value)}
                                placeholder="gaming, fps, navigation"
                            />
                        </div>
                    </div>
                )}

                <DialogFooter className="mt-8 flex-col sm:flex-row gap-3">
                    <Button
                        variant="outline"
                        onClick={handleClose}
                        className="rounded-full px-8 py-5 text-base font-medium border-gray-200 hover:bg-gray-50 dark:border-neutral-500 dark:hover:bg-neutral-800 flex-1 sm:flex-none"
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handlePublish}
                        disabled={!keyboard || isPublishing || !name.trim()}
                        className="rounded-full px-8 py-5 text-base font-bold bg-gray-900 hover:bg-black text-white dark:bg-neutral-200 dark:hover:bg-neutral-300 dark:text-neutral-900 flex-1 sm:flex-none"
                    >
                        {isPublishing ? (
                            <>
                                <div className="w-4 h-4 mr-2 border-2 border-kb-surface border-t-transparent rounded-full animate-spin" />
                                Saving...
                            </>
                        ) : (
                            "Save"
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default PublishLayerDialog;
