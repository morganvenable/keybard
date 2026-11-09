/**
 * Opening Settings at a section from elsewhere (an old ?panel= link). The
 * request is held until the Settings page mounts, or delivered at once if it
 * is already open.
 */
const EVENT = "keybard-settings-section";
let pending: string | null = null;

export function requestSettingsSection(id: string): void {
    pending = id;
    window.dispatchEvent(new CustomEvent(EVENT, { detail: id }));
}

/** Takes the pending request, if any. */
export function takeSettingsSectionRequest(): string | null {
    const id = pending;
    pending = null;
    return id;
}

export function onSettingsSectionRequest(handler: (id: string) => void): () => void {
    const listener = (e: Event) => {
        pending = null;
        handler((e as CustomEvent<string>).detail);
    };
    window.addEventListener(EVENT, listener);
    return () => window.removeEventListener(EVENT, listener);
}

/**
 * Panels that became sections of Settings, by their old panel name, with the
 * section an old link (?panel=typing) or a stale caller opens instead.
 */
export const PANELS_IN_SETTINGS: Record<string, string> = {
    typing: "typing",
    clusters: "hardware",
    fragments: "hardware",
    hardware: "hardware",
    about: "about",
    // Not an old panel: lets a review link open Settings at Firmware (?panel=firmware).
    firmware: "firmware",
    // Not an old panel either: Settings at Backups (?panel=backups).
    backups: "backups",
};

/** The Settings section an old panel name opens, if it is one. */
export function settingsSectionForPanel(panel: string): string | undefined {
    return Object.prototype.hasOwnProperty.call(PANELS_IN_SETTINGS, panel) ? PANELS_IN_SETTINGS[panel] : undefined;
}

/**
 * Opening the Pointing Devices panel's AutoMouse disclosure for this visit
 * (?panel=pointing-automouse, or its old name pointing-advanced). Held until the card mounts, like the
 * section request above.
 */
const AUTOMOUSE_EVENT = "keybard-pointing-automouse";
let autoMousePending = false;

export function requestPointingAutoMouse(): void {
    autoMousePending = true;
    window.dispatchEvent(new CustomEvent(AUTOMOUSE_EVENT));
}

export function takePointingAutoMouseRequest(): boolean {
    const pending = autoMousePending;
    autoMousePending = false;
    return pending;
}

export function onPointingAutoMouseRequest(handler: () => void): () => void {
    const listener = () => { autoMousePending = false; handler(); };
    window.addEventListener(AUTOMOUSE_EVENT, listener);
    return () => window.removeEventListener(AUTOMOUSE_EVENT, listener);
}
