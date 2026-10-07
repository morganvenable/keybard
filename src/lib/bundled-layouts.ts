// Saved copies of bundled layouts that earlier builds named after their built asset URL:
// a Keybard Paranoid data: URL, or a Vite file name with its content hash ("sval-default-AbC123xy").
// Current builds name them after the source file, so these copies would otherwise appear twice.
export function isStaleBundledLayoutName(name: string, bundledNames: readonly string[]): boolean {
    if (/;base64,/.test(name)) return true;
    return bundledNames.some(bundled => name.startsWith(`${bundled}-`) && /^[A-Za-z0-9_-]{8}$/.test(name.slice(bundled.length + 1)));
}
