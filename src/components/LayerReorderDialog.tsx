import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useKeyboard } from '@/contexts/KeyboardContext';
import { useChanges } from '@/contexts/ChangesContext';
import { useLayerReorder } from '@/hooks/useLayerReorder';
import { svalService } from '@/services/sval.service';
import { pinnedLayer } from '@/utils/layer-permute';

export interface LayerMoveRequest { from: number; to: number }

interface LayerReorderDialogProps {
    request: LayerMoveRequest | null;
    onClose: () => void;
    /** Gets each old layer's new number after a move. */
    onMoved: (newOf: number[]) => void;
}

/** Confirms moving one layer to another number, with a summary of what changes. */
export function LayerReorderDialog({ request, onClose, onMoved }: LayerReorderDialogProps) {
    const { keyboard, isConnected } = useKeyboard();
    const { isInstant } = useChanges();
    const { prepare, apply, review, cancel, error, clearError, applying } = useLayerReorder(onMoved);
    const [to, setTo] = useState<number | null>(null);

    useEffect(() => { setTo(request?.to ?? null); clearError(); }, [request]);
    useEffect(() => {
        if (request && to !== null) void prepare(request.from, to);
        else cancel();
    }, [request, to, keyboard]);

    if (!keyboard || !request) return null;
    const name = (layer: number) => svalService.getLayerName(keyboard, layer);
    const targets = Array.from({ length: pinnedLayer(keyboard) }, (_, layer) => layer);
    const plan = review?.plan;
    const close = () => { if (!applying) { cancel(); onClose(); } };
    const blocked = !plan || !!plan.errors.length || to === request.from;

    return (
        <Dialog open onOpenChange={open => { if (!open) close(); }}>
            <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Move {name(request.from)}</DialogTitle>
                    <DialogDescription>
                        Give this layer another number. The layers in between shift by one, and every key that switches layers is updated to match.
                    </DialogDescription>
                </DialogHeader>
                <div className="flex items-center gap-3">
                    <Label htmlFor="layer-move-target">Move to layer</Label>
                    <Select value={to === null ? undefined : String(to)} onValueChange={value => setTo(Number(value))}>
                        <SelectTrigger id="layer-move-target" className="w-56"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {targets.map(layer => (
                                <SelectItem key={layer} value={String(layer)}>
                                    {layer === request.from ? `${layer} (current)` : `${layer}, now ${name(layer)}`}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                {to === request.from && <p className="text-sm">Pick a different layer number.</p>}
                {plan && to !== request.from && <>
                    <ul className="list-disc pl-5 text-sm space-y-1">{review.lines.map((line, i) => <li key={i}>{line}</li>)}</ul>
                    <p className="text-sm">{review.defaultLayer}</p>
                    {!!plan.errors.length && <div role="alert" className="text-sm text-red-700 dark:text-red-400"><p className="font-semibold">Can't make this move</p><ul className="list-disc pl-5">{plan.errors.map((line, i) => <li key={i}>{line}</li>)}</ul></div>}
                    {!!plan.warnings.length && <ul className="list-disc pl-5 text-sm">{plan.warnings.map((line, i) => <li key={i}>{line}</li>)}</ul>}
                    <p className="text-sm text-muted-foreground">When more than one layer is on, the highest-numbered one wins, so a move can change which layer's keys come through.</p>
                </>}
                {error && <p role="alert" className="text-sm text-red-700 dark:text-red-400">{error}</p>}
                <p className="text-sm">{isConnected ? (isInstant ? 'Moving writes the changes to the keyboard. Undo moves it back.' : 'The changes are staged. Nothing is written until you use Apply.') : 'This changes the offline layout.'}</p>
                <DialogFooter>
                    <Button variant="secondary" disabled={applying} onClick={close}>Cancel</Button>
                    <Button disabled={applying || blocked} onClick={async () => { if (await apply()) onClose(); }}>{applying ? 'Moving…' : 'Move layer'}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
