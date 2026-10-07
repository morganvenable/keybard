import { useKeyboard } from "@/contexts/KeyboardContext";
import { isKnownKeycodeVersion, LATEST_KEYCODE_VERSION } from "@/constants/keycode-numbering";

/** Announce target changes without reserving a row in the editor. */
export default function EditingTargetStatus() {
    const { keyboard, isConnected, loadedFrom, connectionState, connectionError, isChangingTarget } = useKeyboard();
    if (!keyboard) return null;
    return (
        <>
            <div role="status" className="sr-only">
                <span className="font-medium break-words [overflow-wrap:anywhere]">
                    {isConnected ? "Editing keyboard" : "Offline draft"}: {loadedFrom || keyboard.name || "Layout"}
                </span>
                {!isConnected && <span>No keyboard writes. Export to keep edits.</span>}
                {(isChangingTarget || connectionState === "loading") && <span>Changing connection…</span>}
            </div>
            {isConnected && keyboard.keycode_version && !isKnownKeycodeVersion(keyboard.keycode_version) && (
                <p role="alert" className="absolute left-4 top-full z-50 max-w-sm whitespace-normal rounded-md border border-amber-300 dark:border-amber-800 bg-kb-surface p-3 text-sm text-amber-800 dark:text-amber-300 shadow-sm">
                    This keyboard numbers keycodes as QMK {keyboard.keycode_version}; this Keybard knows up to {LATEST_KEYCODE_VERSION}. Keys QMK has renumbered since may show or save as the wrong key. Update Keybard before editing.
                </p>
            )}
            {connectionError && <p role="alert" className="absolute right-4 top-full z-50 max-w-sm whitespace-normal rounded-md border border-red-200 dark:border-red-900 bg-kb-surface p-3 text-sm text-red-700 dark:text-red-400 shadow-sm">{connectionError}</p>}
        </>
    );
}
