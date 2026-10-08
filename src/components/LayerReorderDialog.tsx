import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useKeyboard } from '@/contexts/KeyboardContext';
import { useChanges } from '@/contexts/ChangesContext';
import type { LayerReorder } from '@/hooks/useLayerReorder';
import { svalService } from '@/services/sval.service';

/** Confirms a layer move made by dragging a tab, with a summary of what changes. */
export function LayerReorderDialog({ reorder }: { reorder: LayerReorder }) {
    const { keyboard, isConnected } = useKeyboard();
    const { isInstant } = useChanges();
    const { review, apply, cancel, error, applying } = reorder;
    if (!keyboard || (!review && !error)) return null;
    const plan = review?.plan;
    const close = () => { if (!applying) cancel(); };

    return (
        <Dialog open onOpenChange={open => { if (!open) close(); }}>
            <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>{review ? `Move ${svalService.getLayerName(review.base, review.from)} to layer ${review.to}` : 'Move layer'}</DialogTitle>
                    <DialogDescription>The layers in between shift by one, and every key that switches layers is updated to match.</DialogDescription>
                </DialogHeader>
                {review && plan && <>
                    <ul className="list-disc pl-5 text-sm space-y-1">{review.lines.map((line, i) => <li key={i}>{line}</li>)}</ul>
                    <p className="text-sm">{review.defaultLayer}</p>
                    {!!plan.errors.length && <div role="alert" className="text-sm text-red-700 dark:text-red-400"><p className="font-semibold">Can't make this move</p><ul className="list-disc pl-5">{plan.errors.map((line, i) => <li key={i}>{line}</li>)}</ul></div>}
                    {!!plan.warnings.length && <ul className="list-disc pl-5 text-sm">{plan.warnings.map((line, i) => <li key={i}>{line}</li>)}</ul>}
                    <p className="text-sm text-muted-foreground">When more than one layer is on, the highest-numbered one wins, so a move can change which layer's keys come through.</p>
                    <p className="text-sm">{isConnected ? (isInstant ? 'Moving writes the changes to the keyboard. Undo moves it back.' : 'The changes are staged. Nothing is written until you use Apply.') : 'This changes the offline layout.'}</p>
                </>}
                {error && <p role="alert" className="text-sm text-red-700 dark:text-red-400">{error}</p>}
                <DialogFooter>
                    <Button variant="secondary" disabled={applying} onClick={close}>Cancel</Button>
                    {review && <Button disabled={applying || !!plan?.errors.length} onClick={() => void apply()}>{applying ? 'Moving…' : 'Move layer'}</Button>}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
