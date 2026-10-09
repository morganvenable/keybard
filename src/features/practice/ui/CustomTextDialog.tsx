import { useEffect, useId, useMemo, useState } from "react";

import { PILL_INK } from "@/components/shared/pills";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import type { KeymapResolution } from "../keymap/resolver";
import { untypeableChars } from "../lessons/custom";
import { MAX_CUSTOM_TEXT } from "../state/settings";
import { charLabel } from "./format";

// P6 Custom text (docs/practice/spec.md §5.10): a textarea with a character counter, and under it the
// characters this keymap can't type as chips (they are stripped at lesson time). Space, newline and tab
// have paths through the whitespace table, so ordinary text never lists them. Cancel keeps the old text;
// Use text saves it, which starts a new Custom lesson.

const CHIP = "px-2 py-0.5 rounded-full bg-kb-gray-medium text-xs text-kb-ink whitespace-nowrap";
const count = new Intl.NumberFormat("en-US");

interface CustomTextDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    text: string;
    resolution: KeymapResolution | null;
    onUse: (text: string) => void;
}

export function CustomTextDialog({ open, onOpenChange, text, resolution, onUse }: CustomTextDialogProps) {
    const [draft, setDraft] = useState(text);
    const counterId = useId();
    // Each opening starts from the saved text.
    useEffect(() => { if (open) setDraft(text); }, [open, text]);
    const missing = useMemo(() => (resolution ? untypeableChars(draft, resolution) : []), [draft, resolution]);
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl" data-practice-custom-dialog>
                <DialogHeader>
                    <DialogTitle>Custom text</DialogTitle>
                </DialogHeader>
                <div className="flex flex-col gap-2 min-w-0">
                    <Textarea
                        aria-label="Custom text"
                        aria-describedby={counterId}
                        rows={12}
                        value={draft}
                        maxLength={MAX_CUSTOM_TEXT}
                        spellCheck={false}
                        className="resize-y max-h-[50vh] text-sm"
                        onChange={(event) => setDraft(event.target.value.slice(0, MAX_CUSTOM_TEXT))}
                    />
                    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                        {missing.length > 0 ? (
                            <p className="flex flex-wrap items-center gap-1.5 text-sm text-red-700 dark:text-red-400" data-practice-untypeable>
                                <span>Not on this keymap:</span>
                                {missing.map((c) => <span key={c} className={CHIP}>{charLabel(c)}</span>)}
                            </p>
                        ) : <span />}
                        <span id={counterId} className="ml-auto text-xs text-muted-foreground tabular-nums">
                            {count.format([...draft].length)} / {count.format(MAX_CUSTOM_TEXT)}
                        </span>
                    </div>
                </div>
                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <button type="button" className={PILL_INK} onClick={() => { onUse(draft); onOpenChange(false); }}>Use text</button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export default CustomTextDialog;
