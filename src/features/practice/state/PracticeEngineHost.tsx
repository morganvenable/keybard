import { useEffect, useLayoutEffect, useState } from "react";

import { useKeyboard } from "@/contexts/KeyboardContext";
import { useLayoutSettings } from "@/contexts/LayoutSettingsContext";
import { usePanels } from "@/contexts/PanelsContext";
import type { WorkspaceStore } from "@/layout/workspace-store";
import { loadEnglishContent } from "../content/loader";
import type { PracticeEngineState } from "../PracticeProvider";
import { openPracticeStore } from "../store/db";
import { MemoryPracticeStore } from "../store/memory";
import { type KeymapInput, PracticeController } from "./controller";
import { loadSettings, saveSettings } from "./settings";

// The engine half of PracticeProvider, in Practice's lazy chunk (docs/practice/spec.md §4.1, §9.8).
// It owns the PracticeController and feeds it what the editor's contexts know: the keymap Practice
// follows (§5.4 sources), the OS layout, and whether the Lessons page is showing. It renders nothing.

/** The QWERTY example's loadedFrom (KeyboardContext.loadFromFile with source "demo"). */
export const EXAMPLE_LOADED_FROM = "QWERTY example (demo)";

export default function PracticeEngineHost({ store }: { store: WorkspaceStore<PracticeEngineState> }) {
    const { keyboard, originalKeyboard, isConnected, hasUnsavedChanges, loadedFrom, defaultLayerIndex, isWebHIDSupported } = useKeyboard();
    const { internationalLayout } = useLayoutSettings();
    const { workspace, practicePage } = usePanels();
    const [controller, setController] = useState<PracticeController | null>(null);

    useEffect(() => {
        const created = new PracticeController({
            loadSettings,
            saveSettings,
            openStore: () => openPracticeStore(() => new MemoryPracticeStore()),
            loadContent: loadEnglishContent,
        });
        setController(created);
        void created.start();
        return () => {
            created.dispose();
            setController(null);
        };
    }, []);

    // Publish before paint, so the page never draws a frame without its controller.
    useLayoutEffect(() => {
        store.set((s) => ({ ...s, controller }));
    }, [store, controller]);

    // The keymap Practice follows (§5.4): what a connected board runs, otherwise the loaded draft.
    const board = isConnected ? originalKeyboard ?? keyboard : keyboard;
    useEffect(() => {
        if (!controller || !board) return;
        const input: KeymapInput = {
            board,
            source: isConnected ? "connected" : loadedFrom === EXAMPLE_LOADED_FROM ? "example" : "file",
            sourceLabel: loadedFrom ?? "",
            layoutId: internationalLayout,
            defaultLayer: isConnected ? defaultLayerIndex ?? 0 : 0,
            connected: isConnected,
            unsentChanges: isConnected && hasUnsavedChanges,
            hidSupported: isWebHIDSupported,
        };
        controller.setKeymap(input);
    }, [controller, board, isConnected, loadedFrom, internationalLayout, defaultLayerIndex, hasUnsavedChanges, isWebHIDSupported]);

    // Leaving the Lessons page or the Practice workspace pauses the lesson (§5.3).
    useEffect(() => {
        controller?.setActive(workspace === "practice" && practicePage === "lessons");
    }, [controller, workspace, practicePage]);

    // A hidden tab pauses too (D10).
    useEffect(() => {
        if (!controller) return;
        const onVisibility = () => {
            if (document.visibilityState !== "visible") controller.pause();
        };
        document.addEventListener("visibilitychange", onVisibility);
        return () => document.removeEventListener("visibilitychange", onVisibility);
    }, [controller]);

    return null;
}
