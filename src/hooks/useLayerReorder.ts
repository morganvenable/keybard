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
    /** The board's default layer, when the board can renumber it. */
    movableDefault: number | null;
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

    /**
     * The board's default layer. It can move when the board reports it and can set it;
     * otherwise it keeps its number, and without a report so does every layer that could be it.
     */
    const defaultLayerOf = async (kb: KeyboardInfo): Promise<{ fixed: number[]; known: number | null; movable: boolean }> => {
        if (isConnected) {
            try {
                const { keyboardService } = await import('@/services/keyboard.service');
                const { default: mask } = await keyboardService.getLayerStateMasks(kb);
                if (mask !== null) {
                    const layer = keyboardService.getActiveLayerIndexFromMask(mask);
                    const movable = keyboardService.canSetDefaultLayer(kb);
                    return { fixed: movable ? [] : [layer], known: layer, movable };
                }
            } catch { /* Fall back to the layout's own hints. */ }
        }
        return { fixed: defaultLayerCandidates(kb), known: null, movable: false };
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
        const found = await defaultLayerOf(keyboard);
        if (id !== request.current) return;
        const order = moveLayerOrder(keyboard.layers ?? 16, from, to);
        const plan = planLayerReorder(keyboard, order, { fixedLayers: found.fixed, layerName: name(keyboard) });
        const d = found.known;
        const moved = d === null ? d : invertLayerOrder(order)[d];
        const defaultLayer = d === null
            ? `This keyboard doesn't report its default layer, so layer 0 and every layer a DF or PDF key selects (${found.fixed.join(', ')}) keep their numbers.`
            : moved !== d
                ? `Default layer: ${name(keyboard)(d)} becomes layer ${moved} and stays the default, now and after a restart.`
                : `Default layer: ${name(keyboard)(d)} (layer ${d}) stays the default.`;
        setReview({ plan, lines: describeLayerReorder(plan, name(keyboard)), defaultLayer, movableDefault: found.movable ? d : null, base: keyboard });
    };

    const applyPlan = async (base: KeyboardInfo, plan: LayerReorderPlan, defaultLayer: number | null) => {
        const newOf = invertLayerOrder(plan.order);
        const next = plan.keyboard;
        setKeyboard(next);
        onMoved?.(newOf);
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
            if (defaultLayer !== null && newOf[defaultLayer] !== defaultLayer) {
                await staged(`Default layer is now ${newOf[defaultLayer]}`, () => keyboardService.setDefaultLayer(newOf[defaultLayer]), { writeKey: 'default-layer' });
            }
            if (isInstant && !await commit()) throw new Error('Some changes could not be saved. They remain in pending changes. Retry Apply after restoring the connection.');
        }
        registerUndo('layer move', async () => {
            const now = current.current;
            if (!now) return;
            const back = planLayerReorder(now, invertLayerOrder(plan.order));
            if (back.errors.length) throw new Error(back.errors.join(' '));
            await applyPlan(now, back, defaultLayer === null ? null : newOf[defaultLayer]);
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
            await applyPlan(review.base, review.plan, review.movableDefault);
            setReview(null);
            return true;
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
            return false;
        } finally { setApplying(false); }
    };

    return { prepare, apply, review, cancel: () => { request.current++; setReview(null); }, error, clearError: () => setError(null), applying };
}
