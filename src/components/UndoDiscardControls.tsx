import { useEffect, useState, type FC } from "react";
import { Trash2, Undo2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const ICON_BUTTON = "p-2 rounded-full transition-all text-kb-ink";
const ENABLED = "cursor-pointer hover:bg-gray-100 dark:hover:bg-neutral-700";
const DISABLED = "opacity-30 cursor-not-allowed";

interface UndoControlProps {
    /** Label of the step Undo would reverse, or null when there is nothing to undo. */
    label: string | null;
    disabled?: boolean;
    onUndo: () => Promise<void> | void;
}

/** One-step Undo with an in-app "Undone" toast. */
export const UndoControl: FC<UndoControlProps> = ({ label, disabled, onUndo }) => {
    const [toast, setToast] = useState(false);
    useEffect(() => {
        if (!toast) return;
        const timer = setTimeout(() => setToast(false), 6000);
        return () => clearTimeout(timer);
    }, [toast]);
    const off = disabled || !label;
    return (
        <>
            <Tooltip>
                <TooltipTrigger asChild>
                    <button
                        type="button"
                        aria-label="Undo"
                        disabled={off}
                        onClick={async (e) => {
                            e.stopPropagation();
                            await onUndo();
                            setToast(true);
                        }}
                        className={cn(ICON_BUTTON, off ? DISABLED : ENABLED)}
                    >
                        <Undo2 className="h-4 w-4" />
                    </button>
                </TooltipTrigger>
                <TooltipContent side="top">{label ? `Undo ${label}` : "Nothing to undo"}</TooltipContent>
            </Tooltip>
            {toast && (
                <div
                    role="status"
                    className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full border border-kb-gray-border bg-kb-popover px-5 py-2 text-sm text-kb-ink shadow-lg"
                >
                    Undone
                </div>
            )}
        </>
    );
};

interface DiscardAllControlProps {
    pendingCount: number;
    disabled?: boolean;
    onDiscardAll: () => void;
}

/** Discard every pending edit. Asks first only when more than one change is pending. */
export const DiscardAllControl: FC<DiscardAllControlProps> = ({ pendingCount, disabled, onDiscardAll }) => {
    const [asking, setAsking] = useState(false);
    const off = disabled || pendingCount === 0;
    return (
        <>
            <Tooltip>
                <TooltipTrigger asChild>
                    <button
                        type="button"
                        aria-label="Discard all"
                        disabled={off}
                        onClick={(e) => {
                            e.stopPropagation();
                            if (pendingCount > 1) setAsking(true);
                            else onDiscardAll();
                        }}
                        className={cn(ICON_BUTTON, "ml-0", off ? DISABLED : ENABLED)}
                    >
                        <Trash2 className="h-4 w-4" />
                    </button>
                </TooltipTrigger>
                <TooltipContent side="top">Discard all</TooltipContent>
            </Tooltip>
            <Dialog open={asking} onOpenChange={setAsking}>
                <DialogContent className="sm:max-w-[420px] p-8">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold text-kb-ink">Discard {pendingCount} changes</DialogTitle>
                    </DialogHeader>
                    <DialogDescription className="text-base text-kb-ink">Changes already applied to the keyboard stay.</DialogDescription>
                    <DialogFooter className="mt-4 flex-col sm:flex-row gap-3">
                        <Button variant="outline" onClick={() => setAsking(false)} className="rounded-full px-8">
                            Cancel
                        </Button>
                        <Button
                            onClick={() => { setAsking(false); onDiscardAll(); }}
                            className="rounded-full px-8 font-bold bg-kb-active text-kb-active-fg hover:bg-kb-active"
                        >
                            Discard all
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
};
