import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { useKeyboard } from "@/contexts/KeyboardContext";
import { onKeyPlaced } from "@/lib/keyPlacements";
import { keyService } from "@/services/key.service";
import { pinnedLayer } from "@/utils/layer-permute";
import { mouseLayerNoticeText } from "@/constants/pointing-key-info";

const SHOW_MS = 12000;

/**
 * A short notice when a key the firmware ignores on the mouse layer is placed there, by any path
 * (picking, dragging, Any key, swapping, pasting a layer). The mouse layer is the board's last
 * layer (MH_AUTO_BUTTONS_LAYER = DYNAMIC_KEYMAP_LAYER_COUNT - 1). The key is still placed: the
 * firmware keeps it, it just ignores it while Auto Mouse has the layer on.
 */
export default function MouseLayerNotice() {
    const { keyboard } = useKeyboard();
    const [text, setText] = useState<string | null>(null);
    const mouseLayer = keyboard ? pinnedLayer(keyboard) : null;
    const layerRef = useRef(mouseLayer);
    layerRef.current = mouseLayer;
    // One notice for everything placed in one go (a pasted layer queues a key at a time).
    const batch = useRef<string[]>([]);

    useEffect(() => onKeyPlaced(({ layer, keycode }) => {
        if (layerRef.current === null || layer !== layerRef.current) return;
        if (!batch.current.length) {
            queueMicrotask(() => {
                const next = mouseLayerNoticeText(batch.current);
                batch.current = [];
                if (next) setText(next);
            });
        }
        batch.current.push(keyService.stringify(keycode));
    }), []);

    useEffect(() => {
        if (!text) return;
        const timer = setTimeout(() => setText(null), SHOW_MS);
        return () => clearTimeout(timer);
    }, [text]);

    return (
        <div role="status" aria-live="polite" className={text ? "fixed bottom-6 left-1/2 z-50 w-[min(32rem,calc(100vw-2rem))] -translate-x-1/2" : "sr-only"}>
            {text && (
                <div data-testid="mouse-layer-notice" className="flex items-start gap-3 rounded-md border border-amber-300 dark:border-amber-800 bg-kb-popover px-4 py-3 text-sm text-kb-ink shadow-lg">
                    <p className="flex-1">{text}</p>
                    <button type="button" aria-label="Dismiss" onClick={() => setText(null)} className="shrink-0 rounded p-0.5 text-slate-500 hover:text-kb-ink dark:text-neutral-400">
                        <X className="h-4 w-4" />
                    </button>
                </div>
            )}
        </div>
    );
}
