import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from "react";

import { usePanels } from "@/contexts/PanelsContext";
import { createWorkspaceStore, useWorkspaceActivation, useWorkspaceStore, type WorkspaceStore } from "@/layout/workspace-store";
import { useOverlayController, type OverlayModel } from "./useOverlayController";

// Overlay's always-mounted provider (docs/practice/spec.md §4.1 "Mounting", D15).
//
// Requirement: Keybard never contacts Keybard Host before Overlay is first opened. Overlay's state and
// its Host client (useHost) live in OverlayEngine, which the provider renders only once Overlay has been
// opened. The engine publishes its model through a store, so the page (OverlayWorkspace, in the
// workspace) and the panel (OverlayPanel, in SecondarySidebar) read the same state without the provider
// ever changing shape.

export interface OverlayEngineState {
    /** True while OverlayEngine is mounted, i.e. once Overlay has been opened. */
    running: boolean;
    /** Overlay's state and actions; null until the engine has run. */
    model: OverlayModel | null;
}

interface OverlayContextValue {
    /** Overlay has been opened at least once; its page and engine stay mounted from then on. */
    activated: boolean;
    store: WorkspaceStore<OverlayEngineState>;
}

const OverlayContext = createContext<OverlayContextValue | null>(null);

/** Renders nothing: runs Overlay's hooks and publishes the model. */
function OverlayEngine({ store }: { store: WorkspaceStore<OverlayEngineState> }) {
    const { workspace } = usePanels();
    // Recall publishing is gated on the Overlay workspace showing, not on its panel being open.
    const model = useOverlayController(workspace === "overlay");
    // Before paint, so the page never draws a frame without its model.
    useLayoutEffect(() => { store.set({ running: true, model }); });
    useEffect(() => () => store.set({ running: false, model: null }), [store]);
    return null;
}

export function OverlayProvider({ children }: { children: ReactNode }) {
    const activated = useWorkspaceActivation("overlay");
    const [store] = useState(() => createWorkspaceStore<OverlayEngineState>({ running: false, model: null }));
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

/** Overlay's model, or null before the engine has published it. */
export function useOverlay(): OverlayModel | null {
    return useOverlayEngine().model;
}
