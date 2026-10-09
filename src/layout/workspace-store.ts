import { useState, useSyncExternalStore } from "react";

import { usePanels } from "@/contexts/PanelsContext";
import type { PageWorkspace } from "./workspaces";

// Plumbing shared by the Practice and Overlay providers (docs/practice/spec.md §4.1 "Mounting", D15).
//
// Each provider is mounted once, around all of EditorLayoutInner's output, and always renders the same
// element so nothing under it remounts. It stays a cheap shell until its workspace is first opened;
// then it renders its engine, a component that renders nothing, runs the workspace's hooks and
// publishes their values through a small store read with useSyncExternalStore.

export interface WorkspaceStore<T> {
    get: () => T;
    set: (next: T | ((previous: T) => T)) => void;
    subscribe: (listener: () => void) => () => void;
}

export function createWorkspaceStore<T>(initial: T): WorkspaceStore<T> {
    let value = initial;
    const listeners = new Set<() => void>();
    return {
        get: () => value,
        set: (next) => {
            const resolved = typeof next === "function" ? (next as (previous: T) => T)(value) : next;
            if (Object.is(resolved, value)) return;
            value = resolved;
            listeners.forEach((listener) => listener());
        },
        subscribe: (listener) => {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
    };
}

export function useWorkspaceStore<T>(store: WorkspaceStore<T>): T {
    return useSyncExternalStore(store.subscribe, store.get, store.get);
}

/**
 * True from the first time the workspace shows (a nav click, a deep link, or a reconnect restoring
 * the hash) for as long as this EditorLayout lives. Nothing runs for a workspace before that.
 */
export function useWorkspaceActivation(id: PageWorkspace): boolean {
    const { workspace } = usePanels();
    const [activated, setActivated] = useState(workspace === id);
    if (!activated && workspace === id) setActivated(true);
    return activated || workspace === id;
}
