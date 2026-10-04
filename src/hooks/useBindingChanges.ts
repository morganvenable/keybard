import { useChanges } from "@/contexts/ChangesContext";
import { useVial } from "@/contexts/VialContext";
import { vialService } from "@/services/vial.service";
import type { KeyboardInfo } from "@/types/vial.types";

export type BindingKind = "combo" | "tapdance" | "macro" | "override" | "altrepeat" | "leader";
const fields = { combo: "combos", tapdance: "tapdances", macro: "macros", override: "key_overrides", altrepeat: "alt_repeat_keys", leader: "leaders" } as const;

/** Coalesce by the unit written by the firmware, not the individual UI control. */
export function useBindingChanges() {
    const { queue, registerUndo } = useChanges();
    const { keyboard: previous, setKeyboard, getKeyboardSnapshot } = useVial();
    const persist = (keyboard: KeyboardInfo, kind: BindingKind, index: number): Promise<void> => {
        const field = fields[kind];
        const oldEntry = previous?.[field]?.[index];
        if (oldEntry) {
            const restore = structuredClone(oldEntry);
            registerUndo?.(`${kind} ${index}`, async () => {
                const current = getKeyboardSnapshot?.() ?? keyboard;
                if (!current) return;
                // Restore just this entry, preserving unrelated edits made afterward.
                const entries = [...(current[field] ?? [])];
                entries[index] = restore;
                const restored = { ...current, [field]: entries } as KeyboardInfo;
                setKeyboard(restored);
                await persist(restored, kind, index);
            });
        }
        return queue(`${kind} ${index}`, async () => {
            switch (kind) {
                case "combo": await vialService.updateCombo(keyboard, index); break;
                case "tapdance": await vialService.updateTapdance(keyboard, index); break;
                case "macro": await vialService.updateMacros(keyboard); break;
                case "override": await vialService.updateKeyoverride(keyboard, index); break;
                case "altrepeat": await vialService.updateAltRepeatKey(keyboard, index); break;
                case "leader": await vialService.updateLeader(keyboard, index); break;
            }
            await vialService.saveSvil();
        }, { type: kind === "altrepeat" || kind === "leader" ? "key" : kind,
            writeKey: kind === "macro" ? "macros" : `${kind}:${index}` });
    };
    return persist;
}
