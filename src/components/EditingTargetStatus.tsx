import { useVial } from "@/contexts/VialContext";

/** Announce target changes without reserving a row in the editor. */
export default function EditingTargetStatus() {
    const { keyboard, isConnected, loadedFrom, connectionState, connectionError, isChangingTarget } = useVial();
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
            {connectionError && <p role="alert" className="absolute right-4 top-full z-50 max-w-sm whitespace-normal rounded-md border border-red-200 dark:border-red-900 bg-kb-surface p-3 text-sm text-red-700 dark:text-red-400 shadow-sm">{connectionError}</p>}
        </>
    );
}
