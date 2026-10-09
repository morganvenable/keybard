import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { createWorkspaceStore, useWorkspaceActivation, useWorkspaceStore, type WorkspaceStore } from "@/layout/workspace-store";

// Practice's always-mounted provider (docs/practice/spec.md §4.1 "Mounting", D15). It wraps the detail
// panel as well as the page, so PracticePanel and PracticeWorkspace read the same session. It does
// nothing until Practice is first opened; then PracticeEngine starts.

export interface PracticeEngineState {
    /** True while PracticeEngine is mounted, i.e. once Practice has been opened. */
    running: boolean;
}

interface PracticeContextValue {
    /** Practice has been opened at least once; its page and engine stay mounted from then on. */
    activated: boolean;
    store: WorkspaceStore<PracticeEngineState>;
}

const PracticeContext = createContext<PracticeContextValue | null>(null);

/** Renders nothing. TODO(practice): M1b runs the engine session here, and M2 the sampler. */
function PracticeEngine({ store }: { store: WorkspaceStore<PracticeEngineState> }) {
    useEffect(() => {
        store.set({ running: true });
        return () => store.set({ running: false });
    }, [store]);
    return null;
}

export function PracticeProvider({ children }: { children: ReactNode }) {
    const activated = useWorkspaceActivation("practice");
    const [store] = useState(() => createWorkspaceStore<PracticeEngineState>({ running: false }));
    const value = useMemo(() => ({ activated, store }), [activated, store]);
    return (
        <PracticeContext.Provider value={value}>
            {activated && <PracticeEngine store={store} />}
            {children}
        </PracticeContext.Provider>
    );
}

export function usePracticeWorkspace(): PracticeContextValue {
    const context = useContext(PracticeContext);
    if (!context) throw new Error("usePracticeWorkspace must be used within a PracticeProvider");
    return context;
}

export function usePracticeEngine(): PracticeEngineState {
    return useWorkspaceStore(usePracticeWorkspace().store);
}
