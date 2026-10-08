import { useRef, useState } from 'react';
import { useKeyboard } from '@/contexts/KeyboardContext';
import { useChanges } from '@/contexts/ChangesContext';
import { svalService } from '@/services/sval.service';
import type { KeyboardInfo } from '@/types/keyboard.types';
import {
    defaultLayerCandidates, describeLayerReorder, invertLayerOrder, moveLayerOrder, permuteLayerMask,
    planLayerReorder, withLayerColorValues, type LayerReorderPlan,
} from '@/utils/layer-permute';

export interface LayerReorderReview {
    plan: LayerReorderPlan;
    lines: string[];
    defaultLayer: string;
    base: KeyboardInfo;
}

/**
 * Moves a layer to another number and rewrites the layout so it behaves the same.
 * onMoved gets each old layer's new number, so the caller can keep its selection on the moved layer.
 */
export function useLayerReorder(onMoved?: (newOf: number[]) => void) {
    const { keyboard, setKeyboard, isConnected } = useKeyboard();
    const { queue, todo, isInstant, commit, isSaving, registerUndo } = useChanges();
    const [review, setReview] = useState<LayerReorderReview | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [applying, setApplying] = useState(false);
    const current = useRef(keyboard);
    current.current = keyboard;
    const request = useRef(0);
    const name = (kb: KeyboardInfo) => (layer: number) => svalService.getLayerName(kb, layer);

    /** The layers that must keep their number: the board's default layer, or every layer that could be it. */
    const fixedLayers = async (kb: KeyboardInfo): Promise<{ layers: number[]; known: boolean }> => {
        if (isConnected) {
            try {
                const { keyboardService } = await import('@/services/keyboard.service');
                const { default: mask } = await keyboardService.getLayerStateMasks(kb);
                if (mask !== null) return { layers: [keyboardService.getActiveLayerIndexFromMask(mask)], known: true };
            } catch { /* Fall back to the layout's own hints. */ }
        }
        return { layers: defaultLayerCandidates(kb), known: false };
    };

    const prepare = async (from: number, to: number) => {
        const id = ++request.current;
        setError(null);
        setReview(null);
        if (!keyboard || from === to) return;
        if (Object.keys(todo).length || isSaving) {
            setError('Apply or discard your pending changes before moving a layer.');
            return;
        }
        const fixed = await fixedLayers(keyboard);
        if (id !== request.current) return;
        const plan = planLayerReorder(keyboard, moveLayerOrder(keyboard.layers ?? 16, from, to), { fixedLayers: fixed.layers, layerName: name(keyboard) });
        const defaultLayer = fixed.known
            ? `Default layer: ${name(keyboard)(fixed.layers[0])} (layer ${fixed.layers[0]}) stays the default.`
            : `This keyboard doesn't report its default layer, so layer 0 and every layer a DF or PDF key selects (${fixed.layers.join(', ')}) keep their numbers.`;
        setReview({ plan, lines: describeLayerReorder(plan, name(keyboard)), defaultLayer, base: keyboard });
    };

    const applyPlan = async (base: KeyboardInfo, plan: LayerReorderPlan) => {
        const next = plan.keyboard;
        setKeyboard(next);
        onMoved?.(invertLayerOrder(plan.order));
        if (isConnected) {
            const { importService } = await import('@/services/import.service');
            const { keyboardService } = await import('@/services/keyboard.service');
            const staged = (desc: string, cb: () => Promise<void>, metadata?: object) => queue(desc, cb, { ...metadata, deferCommit: true });
            await importService.syncWithKeyboard(withLayerColorValues(next), withLayerColorValues(base), staged, { keyboardService });
            // Locked or toggled layers stay on, under their new numbers.
            await staged('Keep active layers on', async () => {
                const { active } = await keyboardService.getLayerStateMasks(base);
                await keyboardService.setLayerStateMask(permuteLayerMask(active, plan.order));
            }, { writeKey: 'layer-state' });
            if (isInstant && !await commit()) throw new Error('Some changes could not be saved. They remain in pending changes. Retry Apply after restoring the connection.');
        }
        registerUndo('layer move', async () => {
            const now = current.current;
            if (!now) return;
            const back = planLayerReorder(now, invertLayerOrder(plan.order));
            if (back.errors.length) throw new Error(back.errors.join(' '));
            await applyPlan(now, back);
        });
    };

    /** Returns whether the move was made. */
    const apply = async (): Promise<boolean> => {
        if (!review || review.plan.errors.length) return false;
        if (review.base !== keyboard || Object.keys(todo).length || isSaving) {
            setError('The layout changed. Close this and move the layer again.');
            return false;
        }
        setApplying(true);
        try {
            await applyPlan(review.base, review.plan);
            setReview(null);
            return true;
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
            return false;
        } finally { setApplying(false); }
    };

    return { prepare, apply, review, cancel: () => { request.current++; setReview(null); }, error, clearError: () => setError(null), applying };
}
