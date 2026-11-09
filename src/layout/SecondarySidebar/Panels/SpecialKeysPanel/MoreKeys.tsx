import SpecialKeyGroup from "./SpecialKeyGroup";
import MoreKeysDisclosure from "@/layout/SecondarySidebar/components/MoreKeysDisclosure";
import { AnyKeyTile } from "@/layout/SecondarySidebar/components/AnyKey";
import { useKeyboard } from "@/contexts/KeyboardContext";
import { customKeycodeShortName } from "@/constants/custom-keycode-labels";
import { customKeycodesAt } from "@/constants/custom-keycode-homes";
import {
    AUTO_SHIFT_TIMING_KEYS,
    BOARD_KEYS,
    MAGIC_KEYS,
    MODIFIER_TRICK_KEYS,
    MORE_SWITCH_KEYS,
    SYSTEM_EXTRA_KEYS,
    type SpecialKeyDef,
} from "@/constants/special-key-groups";

interface Props {
    compact?: boolean;
    variant?: "small" | "medium" | "default";
}

/** A closed group at the end of Special Keys. It remembers being opened. */
const MoreKeys = ({ compact, variant }: Props) => {
    const { keyboard } = useKeyboard();

    const firmwareBoardKeys: SpecialKeyDef[] = customKeycodesAt(keyboard?.custom_keycodes, "board").map((ck) => ({
        keycode: ck.name,
        label: customKeycodeShortName(ck).replace(/\n/g, " "),
        fixedLabel: true,
    }));
    const boardKeys = [...BOARD_KEYS, ...firmwareBoardKeys];
    const working = [MODIFIER_TRICK_KEYS, MAGIC_KEYS, MORE_SWITCH_KEYS, SYSTEM_EXTRA_KEYS];
    const count =
        boardKeys.length +
        AUTO_SHIFT_TIMING_KEYS.length +
        working.reduce((n, g) => n + g.length, 0);

    return (
        <MoreKeysDisclosure category="special" count={count} compact={compact}>
            <SpecialKeyGroup nested title="Board and firmware" keys={boardKeys} compact={compact} variant={variant} sort={false} />
            <SpecialKeyGroup nested title="Modifier tricks" keys={MODIFIER_TRICK_KEYS} compact={compact} variant={variant} sort={false} />
            <SpecialKeyGroup nested title="Magic and NKRO" keys={MAGIC_KEYS} compact={compact} variant={variant} sort={false} />
            <SpecialKeyGroup nested title="Overrides and One Shot" keys={MORE_SWITCH_KEYS} compact={compact} variant={variant} sort={false} />
            <SpecialKeyGroup nested title="Auto Shift timing" keys={AUTO_SHIFT_TIMING_KEYS} compact={compact} variant={variant} sort={false} />
            <SpecialKeyGroup nested title="System extras" keys={SYSTEM_EXTRA_KEYS} compact={compact} variant={variant} sort={false} />
            <AnyKeyTile />
        </MoreKeysDisclosure>
    );
};

export default MoreKeys;
