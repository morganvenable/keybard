import { createContext, lazy, Suspense, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";

import { createWorkspaceStore, useWorkspaceActivation, useWorkspaceStore, type WorkspaceStore } from "@/layout/workspace-store";
import type { PracticeController } from "./state/controller";

// Practice's always-mounted provider (docs/practice/spec.md §4.1 "Mounting", D15). It wraps the detail
// panel as well as the page, so PracticePanel and PracticeWorkspace read the same session. It does
// nothing until Practice is first opened; then PracticeEngine starts.
//
// The engine itself (the controller, the keybr engine and the content loader) is a lazy chunk, so the
// editor's initial bundle grows only by this shell (§9.8).

export interface PracticeEngineState {
    /** True while PracticeEngine is mounted, i.e. once Practice has been opened. */
    running: boolean;
    /** Practice's state and actions; null until the engine chunk has loaded and started. */
    controller: PracticeController | null;
}

interface PracticeContextValue {
    /** Practice has been opened at least once; its page and engine stay mounted from then on. */
    activated: boolean;
    store: WorkspaceStore<PracticeEngineState>;
}

const PracticeContext = createContext<PracticeContextValue | null>(null);

const PracticeEngineHost = lazy(() => import("./state/PracticeEngineHost"));

/** Renders nothing: marks the engine running and loads the engine chunk, which publishes the controller. */
function PracticeEngine({ store }: { store: WorkspaceStore<PracticeEngineState> }) {
    useEffect(() => {
        store.set((s) => ({ ...s, running: true }));
        return () => store.set({ running: false, controller: null });
    }, [store]);
    return (
        <Suspense fallback={null}>
            <PracticeEngineHost store={store} />
        </Suspense>
    );
}

export function PracticeProvider({ children }: { children: ReactNode }) {
    const activated = useWorkspaceActivation("practice");
    const [store] = useState(() => createWorkspaceStore<PracticeEngineState>({ running: false, controller: null }));
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

const noSubscription = () => () => {};
const noVersion = () => 0;

/**
 * Practice's controller, or null before the engine has started. The caller re-renders on every
 * controller change (it reads mutable fields, so the version is what React compares).
 */
export function usePractice(): PracticeController | null {
    const { controller } = usePracticeEngine();
    useSyncExternalStore(controller?.subscribe ?? noSubscription, controller?.getVersion ?? noVersion, controller?.getVersion ?? noVersion);
    return controller;
}
