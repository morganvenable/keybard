import { useSyncExternalStore } from "react";

/**
 * Whether the Trackball sensors dialog is open (opened from the Pointing Devices
 * panel or tray, Settings > Hardware, or ?tune=trackball). One dialog per page,
 * mounted once (TrackballSensorDialog in EditorLayout). It is a modal over the
 * panel that opened it and changes no navigation, so closing it returns there.
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
