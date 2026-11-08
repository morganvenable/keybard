import type { KeyboardInfo } from "@/types/keyboard.types";

/**
 * Where Alt-Repeat shows in the rail. A board with any Alt-Repeat entry gets
 * its own rail item; otherwise Alt-Repeat waits under the rail's More item.
 * This only places the editor: alt-repeat entries on the board, in backups and
 * in import/export are kept and written exactly as before.
 */
export const ALT_REPEAT_PANEL = "altrepeat";
export const MORE_PANEL = "more";

const isSet = (code: string | undefined): boolean => !!code && code !== "KC_NO";

/** True when the connected board has at least one Alt-Repeat entry with a key in it. */
export const hasAltRepeatEntries = (keyboard: Pick<KeyboardInfo, "alt_repeat_keys"> | null | undefined): boolean =>
    (keyboard?.alt_repeat_keys ?? []).some((entry) => isSet(entry.keycode) || isSet(entry.alt_keycode));
