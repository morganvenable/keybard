import { useVial } from "@/contexts/VialContext";

/** Always-visible target identity, independent of the toolbar's compact mode. */
export default function EditingTargetStatus() {
    const { keyboard, isConnected, loadedFrom, connectionState, connectionError, isChangingTarget } = useVial();
    if (!keyboard) return null;
    return (
        <div className="min-w-0 px-5 pb-1 text-xs leading-5 text-slate-600">
            <div role="status" className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-medium break-words [overflow-wrap:anywhere]">
                    {isConnected ? "Editing keyboard" : "Offline draft"}: {loadedFrom || keyboard.name || "Layout"}
                </span>
                {!isConnected && <span>No keyboard writes. Export to keep edits.</span>}
                {(isChangingTarget || connectionState === "loading") && <span>Changing connection…</span>}
            </div>
            {connectionError && <p role="alert" className="break-words text-red-700">{connectionError}</p>}
        </div>
    );
}
