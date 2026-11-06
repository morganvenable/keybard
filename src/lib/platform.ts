/**
 * True on macOS (and iOS-family Apple platforms). Keybard has no other OS detection. The AltGr data
 * (LayoutDefinition.altgr) is the Windows level; the Mac Option layer differs, so AltGr features hide there.
 */
export function isMacOS(): boolean {
    if (typeof navigator === "undefined") return false;
    const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
    const platform = nav.userAgentData?.platform || nav.platform || "";
    return /mac|iphone|ipad|ipod/i.test(platform);
}
