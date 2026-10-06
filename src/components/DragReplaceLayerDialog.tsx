import type { FC } from "react";

import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface DragReplaceLayerDialogProps {
    open: boolean;
    sourceLayerName: string;
    targetLayerName: string;
    onConfirm: () => void;
    onCancel: () => void;
}

export const DragReplaceLayerDialog: FC<DragReplaceLayerDialogProps> = ({
    open,
    sourceLayerName,
    targetLayerName,
    onConfirm,
    onCancel,
}) => {
    const startsWithLayer = (name: string) => name.trim().toLowerCase().startsWith("layer");
    const targetText = startsWithLayer(targetLayerName) ? targetLayerName : `${targetLayerName} layer`;
    const sourceText = startsWithLayer(sourceLayerName) ? sourceLayerName : `${sourceLayerName} layer`;

    return (
        <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onCancel()}>
            <DialogContent className="sm:max-w-[420px] p-8">
                <DialogHeader className="space-y-3">
                    <DialogTitle className="text-xl font-bold text-gray-900 dark:text-neutral-100">
                        Replace
                    </DialogTitle>
                </DialogHeader>

                <div className="py-1 text-xl text-gray-900 dark:text-neutral-100 leading-tight">
                    <p>Current {targetText} with {sourceText}.</p>
                </div>

                <DialogFooter className="mt-6 flex-col sm:flex-row gap-3">
                    <Button
                        variant="outline"
                        onClick={onCancel}
                        className="rounded-full px-8 py-5 text-base font-medium border-gray-200 hover:bg-gray-50 dark:border-neutral-500 dark:hover:bg-neutral-800 flex-1 sm:flex-none"
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={onConfirm}
                        className="rounded-full px-8 py-5 text-base font-bold bg-gray-900 hover:bg-black text-white dark:bg-neutral-200 dark:hover:bg-neutral-300 dark:text-neutral-900 flex-1 sm:flex-none"
                    >
                        OK
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default DragReplaceLayerDialog;
