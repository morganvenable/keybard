import type { FC } from "react";
import ClipboardIcon from "@/components/icons/ClipboardIcon";

import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useLayoutLibrary } from "@/contexts/LayoutLibraryContext";

interface PasteLayerDialogProps {
    /** Current layer name (the one being replaced) - No longer used in new design but kept for prop compatibility if needed */
    currentLayerName?: string;
    /** Callback when paste is confirmed */
    onConfirm: () => void;
}

export const PasteLayerDialog: FC<PasteLayerDialogProps> = ({
    currentLayerName,
    onConfirm,
}) => {
    const { layerClipboard, isPasteDialogOpen, closePasteDialog } = useLayoutLibrary();

    if (!layerClipboard) return null;

    const handlePaste = () => {
        onConfirm();
        closePasteDialog();
    };

    return (
        <Dialog open={isPasteDialogOpen} onOpenChange={(open) => !open && closePasteDialog()}>
            <DialogContent className="sm:max-w-[520px] p-8">
                <DialogHeader className="space-y-4">
                    <DialogTitle className="flex items-center gap-3 text-xl font-bold text-gray-900 dark:text-neutral-100 leading-tight">
                        <ClipboardIcon className="w-6 h-6 text-kb-ink" />
                        <div>
                            Clipboard has a copy of {layerClipboard.layer.name}
                        </div>
                    </DialogTitle>
                </DialogHeader>

                <div className="py-2">
                    <p className="text-gray-600 dark:text-neutral-300 leading-relaxed">
                        Replace your <b>{currentLayerName}</b> now or select another layer later and paste it manually using its contextual menu.
                    </p>
                </div>

                <DialogFooter className="mt-8 flex-col sm:flex-row gap-3">
                    <Button
                        variant="outline"
                        onClick={closePasteDialog}
                        className="rounded-full px-8 py-5 text-base font-medium border-gray-200 hover:bg-gray-50 dark:border-neutral-500 dark:hover:bg-neutral-800 flex-1 sm:flex-none"
                    >
                        Later
                    </Button>
                    <Button
                        onClick={handlePaste}
                        className="rounded-full px-8 py-5 text-base font-bold bg-gray-900 hover:bg-black text-white dark:bg-neutral-200 dark:hover:bg-neutral-300 dark:text-neutral-900 flex-1 sm:flex-none"
                    >
                        Now
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default PasteLayerDialog;
