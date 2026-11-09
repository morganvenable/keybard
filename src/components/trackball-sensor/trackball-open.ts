import { useSyncExternalStore } from "react";

/**
 * Whether the Trackball sensor dialog is open (Settings > Pointing > Advanced >
 * Live view, or ?panel=trackball). One dialog per page, mounted once
 * (TrackballSensorDialog in EditorLayout). Like the touchpad live view, it is
 * a modal over Settings, so closing it leaves Settings as it was.
 */
let open = false;
const listeners = new Set<() => void>();

function set(next: boolean) {
    if (open === next) return;
    open = next;
    for (const l of [...listeners]) l();
}

export function openTrackballSensor(): void {
    set(true);
}

export function closeTrackballSensor(): void {
    set(false);
}

export function useTrackballSensorOpen(): boolean {
    return useSyncExternalStore(
        (l) => { listeners.add(l); return () => { listeners.delete(l); }; },
        () => open,
        () => false,
    );
}
