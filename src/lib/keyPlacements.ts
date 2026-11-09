// Every key edit goes through ChangesContext.queue (picking a key, dragging one, Any key, swapping,
// pasting a layer, undo). queue announces each one here, offline drafts included, so a listener
// can react to what was placed wherever it came from.

export interface KeyPlacement {
    layer: number;
    row: number;
    col: number;
    keycode: number;
}

type Listener = (placement: KeyPlacement) => void;
const listeners = new Set<Listener>();

export function onKeyPlaced(listener: Listener): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}

export function announceKeyPlaced(placement: KeyPlacement): void {
    for (const listener of listeners) listener(placement);
}
