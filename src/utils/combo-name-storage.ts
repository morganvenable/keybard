import type { KeyboardInfo } from "@/types/keyboard.types";

/** GET_INFO flags2 bit 7: the board stores combo names (label type 3). */
export const SVIL_FLAG2_COMBO_LABELS = 0x80;

/**
 * Whether this board stores combo names. On older firmware combo names stay in
 * Keybard (files, backups and this browser) and never reach the board.
 */
export function boardStoresComboNames(kb: Pick<KeyboardInfo, "svil_proto" | "feature_flags2"> | null | undefined): boolean {
    return !!kb && (kb.svil_proto ?? 1) >= 2 && ((kb.feature_flags2 ?? 0) & SVIL_FLAG2_COMBO_LABELS) !== 0;
}
