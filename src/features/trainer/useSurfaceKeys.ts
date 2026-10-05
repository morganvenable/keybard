import type { KeyboardInfo } from '@/types/vial.types';
import { getKeyDisplayText } from '@/utils/key-display';
import { keyService } from '@/services/key.service';
import { getLabelForKeycode } from '@/components/Keyboards/layouts';
import { getKeyLabel } from '@/utils/layers';
import { geometry, resolveBinding } from './core';
export function surfaceKeys(board: KeyboardInfo & { trainerLabels?: Record<string, string> }, active: number, defaults: number, hands: string, layoutId = 'us') {
    if (!board.keymap?.length) return [];
    return geometry(board).filter(k => hands === 'Both' || k.hand === hands).map(k => {
        const binding = resolveBinding(board.keymap!, k.id, active, defaults);
        const keycode = keyService.stringify(binding.code);
        const { label: defaultLabel, keyContents } = getKeyLabel(board, binding.code);
        const label = getLabelForKeycode(keycode, layoutId) || defaultLabel;
        const text = getKeyDisplayText(keycode, label, keyContents, false, layoutId);
        // Host-only behavior definitions can supply details absent from the editor snapshot.
        const deviceLabel = board.trainerLabels?.[String(binding.code)];
        const needsDeviceLabel = (keycode.startsWith('TD(') && !board.tapdances?.length) ||
            ((binding.code >= 0x7e00 && binding.code <= 0x7fff) && !board.custom_keycodes?.length);
        return { ...k, ...binding, label: needsDeviceLabel && deviceLabel ? deviceLabel :
            [text.topLabel, text.displayLabel, text.bottomStr].filter(Boolean).join('\n') };
    });
}
