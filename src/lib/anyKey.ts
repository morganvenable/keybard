import { keyService } from "@/services/key.service";

export type AnyKeyResult =
    | { status: "empty" }
    | { status: "invalid"; message: string }
    | { status: "known"; code: number; name: string; message: string }
    | { status: "unknown"; code: number; message: string };

export const formatKeycodeHex = (code: number): string =>
    "0x" + code.toString(16).toUpperCase().padStart(4, "0");

const MAX_KEYCODE = 0xffff;

/** A bare number the way people write it: 0x hex or decimal. */
function parseNumber(text: string): number | null {
    if (/^0x[0-9a-f]+$/i.test(text)) return parseInt(text, 16);
    if (/^\d+$/.test(text)) return parseInt(text, 10);
    return null;
}

/**
 * Resolve what someone typed into Any key: a 0x hex or decimal number, a QMK
 * name such as QK_BOOT, or an expression such as LCTL(KC_A) or MO(3).
 */
export function resolveAnyKey(input: string): AnyKeyResult {
    const text = input.trim();
    if (!text) return { status: "empty" };

    let code = parseNumber(text);
    if (code === null) {
        const parsed = [text, text.toUpperCase()]
            .map((t) => keyService.parse(t))
            .find((n) => Number.isFinite(n));
        if (parsed === undefined) {
            return { status: "invalid", message: `"${text}" is not a keycode name, expression or number.` };
        }
        code = parsed;
    }

    if (!Number.isInteger(code) || code < 0 || code > MAX_KEYCODE) {
        return { status: "invalid", message: "Keycodes go up to 0xFFFF (65535)." };
    }

    const name = keyService.stringify(code);
    if (/^0x/i.test(name)) {
        return {
            status: "unknown",
            code,
            message: `${formatKeycodeHex(code)} is not a keycode Keybard knows. The board may ignore it or do something unexpected.`,
        };
    }
    return { status: "known", code, name, message: `${name} is ${formatKeycodeHex(code)}.` };
}
