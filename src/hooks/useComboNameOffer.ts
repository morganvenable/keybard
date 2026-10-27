import { useEffect, useRef } from "react";
import { useChanges } from "@/contexts/ChangesContext";
import { useKeyboard } from "@/contexts/KeyboardContext";
import { LabelService } from "@/services/label.service";
import { boardStoresComboNames } from "@/utils/combo-name-storage";
import { usbInstance } from "@/services/usb.service";
import { comboName } from "@/utils/combo-names";
import type { KeyboardInfo } from "@/types/keyboard.types";

const labels = new LabelService(usbInstance);

/**
 * Combo names Keybard kept (this browser's memory and the board's backups)
 * for a board whose firmware stores combo names but has none yet: each one
 * not on the board, and not offered yet in this session, as a pending label
 * write. Nothing is written until Apply, even with live updating on.
 */
export function comboNamesToOffer(draft: KeyboardInfo | null, board: KeyboardInfo | null, offered: ReadonlySet<number>): Array<[number, string]> {
    if (!draft || !board || !boardStoresComboNames(board)) return [];
    if (Object.keys(board.cosmetic?.combos ?? {}).length) return [];
    const out: Array<[number, string]> = [];
    (draft.combos ?? []).forEach((_combo, index) => {
        const name = comboName(draft.cosmetic, index);
        if (name && !offered.has(index)) out.push([index, name]);
    });
    return out;
}

export function useComboNameOffer() {
    const { keyboard, originalKeyboard, isConnected, connectionSessionId } = useKeyboard();
    const { queue } = useChanges();
    const offered = useRef<{ session: number; indices: Set<number> }>({ session: -1, indices: new Set() });

    useEffect(() => {
        if (offered.current.session !== connectionSessionId) offered.current = { session: connectionSessionId, indices: new Set() };
        if (!isConnected) return;
        const indices = offered.current.indices;
        for (const [index, name] of comboNamesToOffer(keyboard, originalKeyboard, indices)) {
            indices.add(index);
            // Same description and write key as a rename, so a later rename or
            // removal replaces this offer instead of adding to it.
            void queue(`combo ${index} name`, async () => {
                await labels.saveName(originalKeyboard!, "combo", index, name);
            }, { type: "label", writeKey: `label:combo:${index}`, deferCommit: true });
        }
    }, [keyboard, originalKeyboard, isConnected, connectionSessionId, queue]);
}

/** Mounts useComboNameOffer inside the keyboard and changes providers. */
export function ComboNameOffer() {
    useComboNameOffer();
    return null;
}
