import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { createWorkspaceStore, useWorkspaceActivation, useWorkspaceStore, type WorkspaceStore } from "@/layout/workspace-store";

// Overlay's always-mounted provider (docs/practice/spec.md §4.1 "Mounting", D15).
//
// Requirement: Keybard never contacts Keybard Host before Overlay is first opened. Until MO, all of
// Overlay's state and its Host client (useHost) still live in TrainerPage, which EditorLayout mounts
// only on the first visit, so that holds. MO moves TrainerPage.tsx:19-62 (useHost, preferences,
// Host config mirroring, Recall publishing) into OverlayEngine below, which starts on the same
// first visit.

export interface OverlayEngineState {
    /** True while OverlayEngine is mounted, i.e. once Overlay has been opened. */
    running: boolean;
}

interface OverlayContextValue {
    /** Overlay has been opened at least once; its page and engine stay mounted from then on. */
    activated: boolean;
    store: WorkspaceStore<OverlayEngineState>;
}

const OverlayContext = createContext<OverlayContextValue | null>(null);

/** Renders nothing. TODO(practice): MO lifts TrainerPage's hooks and effects in here. */
function OverlayEngine({ store }: { store: WorkspaceStore<OverlayEngineState> }) {
    useEffect(() => {
        store.set({ running: true });
        return () => store.set({ running: false });
    }, [store]);
    return null;
}

export function OverlayProvider({ children }: { children: ReactNode }) {
    const activated = useWorkspaceActivation("overlay");
    const [store] = useState(() => createWorkspaceStore<OverlayEngineState>({ running: false }));
    const value = useMemo(() => ({ activated, store }), [activated, store]);
    return (
        <OverlayContext.Provider value={value}>
            {activated && <OverlayEngine store={store} />}
            {children}
        </OverlayContext.Provider>
    );
}

export function useOverlayWorkspace(): OverlayContextValue {
    const context = useContext(OverlayContext);
    if (!context) throw new Error("useOverlayWorkspace must be used within an OverlayProvider");
    return context;
}

export function useOverlayEngine(): OverlayEngineState {
    return useWorkspaceStore(useOverlayWorkspace().store);
}
