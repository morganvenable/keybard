import { useEffect } from "react";

import { useSettings } from "@/contexts/SettingsContext";
import { applyTheme, normalizeThemePref, resolveTheme, THEME_SETTING_NAME, watchSystemTheme } from "@/lib/theme";

/**
 * Keeps the `dark` class on <html> in step with the Appearance setting.
 * Does nothing until settings have loaded, so it never overrides the no-flash
 * head script with the pre-load default. While the preference is "system" it
 * follows prefers-color-scheme live.
 */
export default function ThemeSync() {
    const { getSetting, isLoaded } = useSettings();
    const pref = normalizeThemePref(getSetting(THEME_SETTING_NAME));

    useEffect(() => {
        if (!isLoaded) return;
        applyTheme(resolveTheme(pref));
        if (pref !== "system") return;
        return watchSystemTheme((prefersDark) => applyTheme(prefersDark ? "dark" : "light"));
    }, [pref, isLoaded]);

    return null;
}
