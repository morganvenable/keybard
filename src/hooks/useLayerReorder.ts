import { useRef, useState } from 'react';
import { useKeyboard } from '@/contexts/KeyboardContext';
import { useChanges } from '@/contexts/ChangesContext';
import { svalService } from '@/services/sval.service';
import type { KeyboardInfo } from '@/types/keyboard.types';
import {
    defaultLayerCandidates, describeLayerReorder, invertLayerOrder, moveLayerOrder, permuteLayerMask,
    planLayerReorder, withLayerColorValues, type LayerReorderPlan,
} from '@/utils/layer-permute';

/** What limits a move: the layers that must keep their number, and the board's default layer. */
export interface LayerMoveConstraints {
    fixed: number[];
    /** The board's default layer, when it reports one. */
    defaultLayer: number | null;
    /** Whether the board can renumber its saved default layer. */
    movable: boolean;
}

export interface LayerReorderReview {
    from: number;
    to: number;
    plan: LayerReorderPlan;
    lines: string[];
    defaultLayer: string;
    /** The default layer to renumber on the board, when the board can. */
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
    const name = (kb: KeyboardInfo) => (layer: number) => svalService.getLayerName(kb, layer);

    /** Without a report from the board, layer 0 and every layer a DF or PDF key selects could be the default. */
    const guessConstraints = (kb: KeyboardInfo): LayerMoveConstraints => ({ fixed: defaultLayerCandidates(kb), defaultLayer: null, movable: false });

    /** Asks the board for its default layer. The default can move only if the board can also set it. */
    const loadConstraints = async (kb: KeyboardInfo): Promise<LayerMoveConstraints> => {
        if (isConnected) {
            try {
                const { keyboardService } = await import('@/services/keyboard.service');
                const { default: mask } = await keyboardService.getLayerStateMasks(kb);
                if (mask !== null) {
                    const layer = keyboardService.getActiveLayerIndexFromMask(mask);
                    const movable = keyboardService.canSetDefaultLayer(kb);
                    return { fixed: movable ? [] : [layer], defaultLayer: layer, movable };
                }
            } catch { /* Fall back to the layout's own hints. */ }
        }
        return guessConstraints(kb);
    };

    /** Opens the confirmation for moving layer from to number to. */
    const prepare = (from: number, to: number, constraints: LayerMoveConstraints) => {
        setError(null);
        if (!keyboard || from === to) return;
        if (Object.keys(todo).length || isSaving) {
            setError('Apply or discard your pending changes before moving a layer.');
            return;
        }
        const order = moveLayerOrder(keyboard.layers ?? 16, from, to);
        const plan = planLayerReorder(keyboard, order, { fixedLayers: constraints.fixed, layerName: name(keyboard) });
        const d = constraints.defaultLayer;
        const moved = d === null ? d : invertLayerOrder(order)[d];
        const defaultLayer = d === null
            ? `This keyboard doesn't report its default layer, so layer 0 and every layer a DF or PDF key selects (${constraints.fixed.join(', ')}) keep their numbers.`
            : moved !== d
                ? `Default layer: ${name(keyboard)(d)} becomes layer ${moved} and stays the default, now and after a restart.`
                : `Default layer: ${name(keyboard)(d)} (layer ${d}) stays the default.`;
        setReview({ from, to, plan, lines: describeLayerReorder(plan, name(keyboard)), defaultLayer, movableDefault: constraints.movable ? d : null, base: keyboard });
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
            setError('The layout changed. Drag the layer again.');
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

    return {
        guessConstraints, loadConstraints, prepare, apply, review, applying, error,
        cancel: () => { setReview(null); setError(null); },
    };
}

export type LayerReorder = ReturnType<typeof useLayerReorder>;
