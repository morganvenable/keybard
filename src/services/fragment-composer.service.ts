/**
 * Fragment Composer Service
 *
 * Composes keyboard layouts from fragment definitions and user selections.
 * This enables dynamic layout rendering based on which physical components
 * (e.g., 5-key vs 6-key finger clusters) are installed or selected.
 */

import type { KeyboardInfo, FragmentInstance } from "../types/keyboard.types";
import { KleService } from "./kle.service";
import { FragmentService } from "./fragment.service";
import { FRAGMENT_THUMB_GAP_REDUCTION_U } from "../constants/keyboard-visuals";

/**
 * A composed key layout entry with position and matrix information
 */
export interface ComposedKeyLayout {
    x: number;
    y: number;
    w: number;
    h: number;
    row: number;
    col: number;
    // Additional KLE properties that may be useful for rendering
    color?: string;
    textColor?: string[];
    labels?: string[];
    rotation_angle?: number;
    rotation_x?: number;
    rotation_y?: number;
}

export class FragmentComposerService {
    constructor(
        private kleService: KleService,
        private fragmentService: FragmentService
    ) {}

    /**
     * Compose a complete keyboard layout from fragment definitions
     *
     * @param kbinfo - Keyboard info with fragments and composition
     * @returns Record keyed by matrix position (row * cols + col)
     */
    composeLayout(kbinfo: KeyboardInfo): Record<number, ComposedKeyLayout> {
        let layout: Record<number, ComposedKeyLayout> = {};

        // Check if keyboard has fragment composition
        if (!kbinfo.composition?.instances || !kbinfo.fragments) {
            return layout;
        }

        const cols = kbinfo.cols;

        for (let idx = 0; idx < kbinfo.composition.instances.length; idx++) {
            const instance = kbinfo.composition.instances[idx];

            // Expand this instance and merge into layout
            const instanceKeys = this.expandInstance(kbinfo, idx, instance, cols);
            Object.assign(layout, instanceKeys);
        }

        // Apply GUI-side placement corrections for thumb clusters
        layout = this.applyPlacementCorrections(layout, kbinfo);

        return layout;
    }

    /**
     * Expand a single fragment instance to key layouts
     */
    private expandInstance(
        kbinfo: KeyboardInfo,
        instanceIdx: number,
        instance: FragmentInstance,
        cols: number
    ): Record<number, ComposedKeyLayout> {
        const layout: Record<number, ComposedKeyLayout> = {};

        // Resolve which fragment to use for this instance
        const fragmentName = this.fragmentService.resolveFragment(kbinfo, instanceIdx, instance);
        if (!fragmentName) {
            return layout;
        }

        // Get fragment definition
        const fragment = kbinfo.fragments?.[fragmentName];
        if (!fragment?.kle) {
            console.warn(`Fragment "${fragmentName}" not found or has no KLE data`);
            return layout;
        }

        // Get placement and matrix map
        const { placement, matrixMap } = this.getPlacementAndMatrixMap(instance, fragmentName);
        if (!placement || !matrixMap) {
            console.warn(`Missing placement or matrix_map for instance "${instance.id}"`);
            return layout;
        }

        // Deserialize fragment KLE data
        let keys;
        try {
            const deserialized = this.kleService.deserialize(fragment.kle as any[]);
            keys = deserialized.keys;
        } catch (e) {
            console.error(`Failed to deserialize KLE for fragment "${fragmentName}":`, e);
            return layout;
        }

        // Map keys to matrix positions with placement offset
        for (let i = 0; i < keys.length && i < matrixMap.length; i++) {
            const key = keys[i];
            const [row, col] = matrixMap[i];
            const matrixPos = row * cols + col;

            layout[matrixPos] = {
                x: key.x + placement.x,
                y: key.y + placement.y,
                w: key.width,
                h: key.height,
                row,
                col,
                // Copy additional properties for rendering
                color: key.color,
                textColor: key.textColor?.filter((c): c is string => c !== undefined),
                labels: key.labels?.filter((l): l is string => l !== undefined),
                rotation_angle: key.rotation_angle,
                rotation_x: key.rotation_x,
                rotation_y: key.rotation_y,
            };
        }

        return layout;
    }

    /**
     * Get placement offset and matrix map for an instance
     *
     * For fixed instances, these come directly from the instance.
     * For selectable instances, we need to find the matching option.
     */
    private getPlacementAndMatrixMap(
        instance: FragmentInstance,
        fragmentName: string
    ): { placement: { x: number; y: number } | undefined; matrixMap: [number, number][] | undefined } {
        // Fixed instance - values come directly from instance
        if (instance.fragment) {
            return {
                placement: instance.placement,
                matrixMap: instance.matrix_map,
            };
        }

        // Selectable instance - find matching option
        if (instance.fragment_options) {
            const option = instance.fragment_options.find(opt => opt.fragment === fragmentName);
            if (option) {
                return {
                    placement: option.placement,
                    matrixMap: option.matrix_map,
                };
            }
        }

        return { placement: undefined, matrixMap: undefined };
    }

    /**
     * Check if a keyboard has fragment composition defined
     */
    hasFragments(kbinfo: KeyboardInfo): boolean {
        return Boolean(kbinfo.fragments) &&
               Boolean(kbinfo.composition?.instances?.length);
    }

    /**
     * Apply placement corrections to thumb clusters to match GUI-side visual design.
     *
     * Alignment strategy:
     * - Calculate the midline between left and right index clusters
     * - Align left thumb's rightmost key edge symmetrically about midline
     * - Align right thumb's leftmost key edge symmetrically about midline
     *
     * This keeps the internal cluster structure intact while centering thumbs properly.
     *
     * @param layout - The composed layout to correct
     * @param _kbinfo - Keyboard info (unused, kept for API compatibility)
     * @returns Corrected layout with thumb clusters in the right positions
     */
    applyPlacementCorrections(
        layout: Record<number, ComposedKeyLayout>,
        _kbinfo: KeyboardInfo
    ): Record<number, ComposedKeyLayout> {
        // Cluster row definitions for Svalboard
        const leftThumbRow = 0;
        const rightThumbRow = 5;
        const leftIndexRow = 1;   // Row containing V key
        const rightIndexRow = 6;  // Row containing M key

        // Group keys by matrix row
        const keysByRow: Record<number, number[]> = {};
        for (const [matrixPosStr, key] of Object.entries(layout)) {
            const matrixPos = Number(matrixPosStr);
            if (!keysByRow[key.row]) {
                keysByRow[key.row] = [];
            }
            keysByRow[key.row].push(matrixPos);
        }

        // Find the midline between left and right index clusters
        // Left index innermost key's right edge, right index innermost key's left edge
        let leftIndexRightEdge = 0;
        let rightIndexLeftEdge = Infinity;

        // Find rightmost edge of left index cluster
        for (const matrixPos of (keysByRow[leftIndexRow] || [])) {
            const key = layout[matrixPos];
            const rightEdge = key.x + key.w;
            if (rightEdge > leftIndexRightEdge) {
                leftIndexRightEdge = rightEdge;
            }
        }

        // Find leftmost edge of right index cluster
        for (const matrixPos of (keysByRow[rightIndexRow] || [])) {
            const key = layout[matrixPos];
            if (key.x < rightIndexLeftEdge) {
                rightIndexLeftEdge = key.x;
            }
        }

        // Calculate midline between index clusters
        const midline = (leftIndexRightEdge + rightIndexLeftEdge) / 2;

        // Find current thumb cluster edges
        let leftThumbRightEdge = 0;
        let rightThumbLeftEdge = Infinity;

        for (const matrixPos of (keysByRow[leftThumbRow] || [])) {
            const key = layout[matrixPos];
            const rightEdge = key.x + key.w;
            if (rightEdge > leftThumbRightEdge) {
                leftThumbRightEdge = rightEdge;
            }
        }

        for (const matrixPos of (keysByRow[rightThumbRow] || [])) {
            const key = layout[matrixPos];
            if (key.x < rightThumbLeftEdge) {
                rightThumbLeftEdge = key.x;
            }
        }

        // Calculate independent X shifts for each thumb cluster
        // This handles asymmetric configurations (e.g., 6-key thumb on left, 5-key finger on right)
        const desiredXGap = 0.4; // Gap between thumb clusters horizontally (in units)

        // Left thumb: align rightmost edge to be (desiredXGap/2) left of midline
        const leftThumbShiftX = (midline - desiredXGap / 2) - leftThumbRightEdge;

        // Right thumb: align leftmost edge to be (desiredXGap/2) right of midline
        const rightThumbShiftX = (midline + desiredXGap / 2) - rightThumbLeftEdge;

        // Calculate Y positioning dynamically based on index finger cluster bottom edges
        // Find bottom edge of left index cluster (max Y + height)
        let leftIndexBottomEdge = 0;
        for (const matrixPos of (keysByRow[leftIndexRow] || [])) {
            const key = layout[matrixPos];
            const bottomEdge = key.y + key.h;
            if (bottomEdge > leftIndexBottomEdge) {
                leftIndexBottomEdge = bottomEdge;
            }
        }

        // Find bottom edge of right index cluster
        let rightIndexBottomEdge = 0;
        for (const matrixPos of (keysByRow[rightIndexRow] || [])) {
            const key = layout[matrixPos];
            const bottomEdge = key.y + key.h;
            if (bottomEdge > rightIndexBottomEdge) {
                rightIndexBottomEdge = bottomEdge;
            }
        }

        // Find top edge of left thumb cluster (min Y)
        let leftThumbTopEdge = Infinity;
        for (const matrixPos of (keysByRow[leftThumbRow] || [])) {
            const key = layout[matrixPos];
            if (key.y < leftThumbTopEdge) {
                leftThumbTopEdge = key.y;
            }
        }

        // Find top edge of right thumb cluster
        let rightThumbTopEdge = Infinity;
        for (const matrixPos of (keysByRow[rightThumbRow] || [])) {
            const key = layout[matrixPos];
            if (key.y < rightThumbTopEdge) {
                rightThumbTopEdge = key.y;
            }
        }

        // Desired gap between index bottom and thumb top (in key units)
        const desiredYGap = 1.0 + FRAGMENT_THUMB_GAP_REDUCTION_U;

        // Use the maximum index cluster bottom edge so both thumbs stay horizontally aligned
        // If either index cluster is taller (e.g., 6-key), both thumbs move down together
        const maxIndexBottomEdge = Math.max(leftIndexBottomEdge, rightIndexBottomEdge);

        // Calculate a single Y shift for both thumb clusters to keep them aligned
        // Use the minimum thumb top edge to ensure proper gap from the tallest index cluster
        const minThumbTopEdge = Math.min(leftThumbTopEdge, rightThumbTopEdge);
        const thumbShiftY = (maxIndexBottomEdge + desiredYGap) - minThumbTopEdge;

        const correctedLayout = { ...layout };

        // Apply corrections to both thumb clusters
        for (const row of [leftThumbRow, rightThumbRow]) {
            const clusterKeys = keysByRow[row] || [];
            if (clusterKeys.length === 0) continue;

            const isLeftThumb = row === leftThumbRow;

            // Use independent X shifts but shared Y shift to keep thumbs horizontally aligned
            const shiftX = isLeftThumb ? leftThumbShiftX : rightThumbShiftX;

            for (const matrixPos of clusterKeys) {
                const key = correctedLayout[matrixPos];
                correctedLayout[matrixPos] = {
                    ...key,
                    x: key.x + shiftX,
                    y: key.y + thumbShiftY,
                };
            }

            console.log(`Thumb cluster row ${row}: shiftX=${shiftX.toFixed(2)}, shiftY=${thumbShiftY.toFixed(2)}`);
        }

        console.log(`Midline: ${midline.toFixed(2)}, maxIndexBottom: ${maxIndexBottomEdge.toFixed(2)}, desiredYGap: ${desiredYGap.toFixed(2)}`);

        return correctedLayout;
    }
}
