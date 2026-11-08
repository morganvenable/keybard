import { useState } from "react";
import SpecialKeyGroup from "./SpecialKeyGroup";
import { useKeyboard } from "@/contexts/KeyboardContext";
import { customKeycodeShortName } from "@/constants/custom-keycode-labels";
import { customKeycodesAt } from "@/constants/custom-keycode-homes";
import {
    AUTO_SHIFT_TIMING_KEYS,
    BOARD_KEYS,
    MORE_KEYS_STORAGE,
    NOT_BUILT_GROUPS,
    NOT_BUILT_NOTE,
    type SpecialKeyDef,
} from "@/constants/special-key-groups";

interface Props {
    compact?: boolean;
    variant?: "small" | "medium" | "default";
}

function readOpen(): boolean {
    try {
        return localStorage.getItem(MORE_KEYS_STORAGE) === "1";
    } catch {
        return false;
    }
}

/** A closed group at the end of Special Keys. It remembers being opened. */
const MoreKeys = ({ compact, variant }: Props) => {
    const { keyboard } = useKeyboard();
    const [open, setOpen] = useState(readOpen);

    const firmwareBoardKeys: SpecialKeyDef[] = customKeycodesAt(keyboard?.custom_keycodes, "board").map((ck) => ({
        keycode: ck.name,
        label: customKeycodeShortName(ck).replace(/\n/g, " "),
        fixedLabel: true,
    }));
    const boardKeys = [...BOARD_KEYS, ...firmwareBoardKeys];
    const count =
        boardKeys.length + AUTO_SHIFT_TIMING_KEYS.length + NOT_BUILT_GROUPS.reduce((n, g) => n + g.keys.length, 0);

    return (
        <details
            className="flex flex-col gap-2"
            open={open}
            data-testid="special-more-keys"
            onToggle={(e) => {
                const isOpen = (e.currentTarget as HTMLDetailsElement).open;
                setOpen(isOpen);
                try {
                    localStorage.setItem(MORE_KEYS_STORAGE, isOpen ? "1" : "0");
                } catch {
                    /* storage can be blocked */
                }
            }}
        >
            <summary className="cursor-pointer select-none font-semibold text-lg text-kb-ink">
                More keys <span className="text-sm font-normal text-kb-gray-border">{count} keys</span>
            </summary>
            <div className="flex flex-col gap-4 pt-2">
                <SpecialKeyGroup nested title="Board and firmware" keys={boardKeys} compact={compact} variant={variant} sort={false} />
                <SpecialKeyGroup nested title="Auto Shift timing" keys={AUTO_SHIFT_TIMING_KEYS} compact={compact} variant={variant} sort={false} />
                <div className="flex flex-col gap-1">
                    <span className="text-xs text-kb-gray-border">{NOT_BUILT_NOTE}</span>
                    {NOT_BUILT_GROUPS.map((g) => (
                        <SpecialKeyGroup nested key={g.id} title={g.title} keys={g.keys} compact={compact} variant={variant} sort={false} />
                    ))}
                </div>
            </div>
        </details>
    );
};

export default MoreKeys;
