import type { KeyboardInfo } from '@/types/vial.types';
import { getKeyLabel } from '@/utils/layers';
import { geometry, resolveBinding } from './core';
export function surfaceKeys(board: KeyboardInfo & { trainerLabels?: Record<string, string> }, active: number, defaults: number, hands: string) {
    if (!board.keymap?.length) return [];
    return geometry(board).filter(k => hands === 'Both' || k.hand === hands).map(k => {
        const binding = resolveBinding(board.keymap!, k.id, active, defaults);
        return { ...k, ...binding, label: board.trainerLabels?.[String(binding.code)] ?? (binding.code === 0 ? '—' : getKeyLabel(board, binding.code).label) };
    });
}
