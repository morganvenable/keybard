// Sval TYPING_PAUSE (0x3C): while the matrix tester is open, the board sends no
// keyboard output to the computer (keyboards/svalboard/docs/protocol.md, "Typing pause").
//
//   [0x3C][op]  op 0 off, 1 on (also renews; the sender owns the pause), 2 status
//   -> [0x3C][op][status][state][last end][flags][lease ms:2][keyboard blocked:2]
//      [extra blocked:2][mouse passed:2][keys released][empty reports][keys ignored]
//
// Only the client that turned it on keeps it alive: the board ends it about 1.5 s
// after that client's last packet. Keybard renews it while the tester is open
// and in front of you, and turns it off the moment it isn't.

/** GET_INFO byte 20 (the third feature byte), bit 2. */
export const SVIL_FLAG3_TYPING_PAUSE = 0x04;
export const CMD_SVIL_TYPING_PAUSE = 0x3c;

export const TYPING_PAUSE_OFF = 0;
export const TYPING_PAUSE_ON = 1;
export const TYPING_PAUSE_STATUS = 2;

/** How often Keybard renews the pause; the board's lease is 1.5 s. */
export const TYPING_PAUSE_RENEW_MS = 500;

export type TypingPauseState = "off" | "paused" | "ending";

export interface TypingPauseReply {
    ok: boolean;
    state: TypingPauseState;
    /** The pause is on and this client owns it. */
    owned: boolean;
    leaseMs: number;
    keyboardBlocked: number;
    extraBlocked: number;
    mousePassed: number;
}

export const hasTypingPause = (featureFlags3: number | undefined | null): boolean => ((featureFlags3 ?? 0) & SVIL_FLAG3_TYPING_PAUSE) !== 0;

/** The reply after the wrapper (it starts at the command echo); null if it isn't one. */
export function parseTypingPauseReply(reply: Uint8Array | null | undefined): TypingPauseReply | null {
    if (!reply || reply.length < 17 || reply[0] !== CMD_SVIL_TYPING_PAUSE) return null;
    const u16 = (o: number) => reply[o] | (reply[o + 1] << 8);
    const state: TypingPauseState = reply[3] === 1 ? "paused" : reply[3] === 2 ? "ending" : "off";
    return {
        ok: reply[2] === 0,
        state,
        owned: (reply[5] & 1) !== 0,
        leaseMs: u16(6),
        keyboardBlocked: u16(8),
        extraBlocked: u16(10),
        mousePassed: u16(12),
    };
}
