/**
 * Characters a macro's text can't type. The keyboard types printable ASCII,
 * tab and newline; it skips anything else, such as "µ" or curly quotes.
 */
export function untypableMacroChars(text: string): string[] {
    const found: string[] = [];
    for (const ch of text) {
        const code = ch.codePointAt(0)!;
        const typable = (code >= 0x20 && code <= 0x7e) || ch === "\t" || ch === "\n";
        if (!typable && !found.includes(ch)) found.push(ch);
    }
    return found;
}

/** How to show a character in a warning: itself, or its code point when it is invisible. */
export function macroCharLabel(ch: string): string {
    if (/^[\p{C}\p{Z}]$/u.test(ch)) {
        return "U+" + ch.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0");
    }
    return ch;
}
