// The board reads Live · USB makes (spec §9.3): keyboardService's matrix and layer-mask reads on the
// connected board, called directly. Never KeyboardContext's pollMatrix wrapper, which sets a heartbeat
// state on every poll and would re-render every useKeyboard() consumer about 100 times a second.
// Practice's engine and the M0 lab both read through this.
import { PARANOID, userIsLooking } from "@/lib/paranoid";
import { keyboardService } from "@/services/keyboard.service";
import type { KeyboardInfo } from "@/types/keyboard.types";

/** Reads the connected board's matrix and layer masks for Live · USB; null when no board is connected. */
export function boardReader(board: () => KeyboardInfo | null) {
    return {
        pollMatrix: async () => {
            const kb = board();
            return kb ? keyboardService.pollMatrix(kb) : [];
        },
        getLayerMasks: async () => {
            const kb = board();
            if (!kb) throw new Error("No board connected");
            return keyboardService.getLayerStateMasks(kb);
        },
        // D10 in every build: never while the tab is hidden. Paranoid: only while Keybard is in front.
        canRead: () => (typeof document === "undefined" || document.visibilityState === "visible") && (!PARANOID || userIsLooking()),
    };
}
