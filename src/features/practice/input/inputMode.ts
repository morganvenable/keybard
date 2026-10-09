// The input mode (spec §3.2, §5.6): Live · USB when every condition holds, else
// Keymap only. Paused is a lesson state shown in the pill instead of the mode,
// not a mode of its own. Live · Host is M5 (OWNER_Q3).
//
// Live · USB needs: WebHID; a connected board, practiced as Connected board
// (§5.4); Read key presses on; in Paranoid, OWNER_Q4; the sampler answering; and,
// for reading to actually run, the practice text focused, the tab visible and
// the Lessons page showing (D10). The first group decides what the P4 rows say
// ("available"); the second only whether the board is read right now.

export type InputMode = 'usb' | 'keymap';

export interface InputConditions {
    /** navigator.hid exists. */
    hidSupported: boolean;
    /** A board is connected over WebHID. */
    connected: boolean;
    /** The practiced keymap is the connected board's (§5.4). */
    connectedSource: boolean;
    /** The Read key presses setting (§5.5). */
    readKeyPresses: boolean;
    /** The Paranoid build. */
    paranoid: boolean;
    /** OWNER_Q4: Paranoid may read key presses while Practice is open and focused. */
    paranoidReads: boolean;
    /** A sampler exists (Practice's engine is running). */
    sampler: boolean;
    /** Three reads in a row failed; retrying (§9.3 Errors). */
    failed: boolean;
    /** The practice text has focus. */
    focused: boolean;
    /** document.visibilityState is visible. */
    visible: boolean;
    /** The Lessons page shows in the Practice workspace. */
    active: boolean;
}

/** P4 Pressed keys values (§5.6). The last two are additions: Paranoid with OWNER_Q4 off, and a board that stopped answering. */
export const PRESSED_KEYS = {
    shown: 'Shown',
    noHid: 'Not shown · needs Chrome or Edge',
    connect: 'Not shown · connect the board',
    off: 'Not shown · reading is off',
    paranoid: 'Not shown · off in Paranoid',
    failed: "Not shown · the board isn't answering",
} as const;

/** Whether Live · USB is available, with the Pressed keys value that says so or why not. */
export function liveAvailability(c: InputConditions): { available: boolean; pressedKeys: string } {
    const no = (pressedKeys: string) => ({ available: false, pressedKeys });
    if (!c.hidSupported) return no(PRESSED_KEYS.noHid);
    if (c.paranoid && !c.paranoidReads) return no(PRESSED_KEYS.paranoid);
    if (!c.connected || !c.connectedSource || !c.sampler) return no(PRESSED_KEYS.connect);
    if (!c.readKeyPresses) return no(PRESSED_KEYS.off);
    if (c.failed) return no(PRESSED_KEYS.failed);
    return { available: true, pressedKeys: PRESSED_KEYS.shown };
}

/** The §3.2 mode. */
export function inputMode(c: InputConditions): InputMode {
    return liveAvailability(c).available && c.focused && c.visible && c.active ? 'usb' : 'keymap';
}
