import { act, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { OverlayProvider, useOverlayEngine, useOverlayWorkspace } from "@/features/trainer/OverlayProvider";
import { PracticeProvider, usePracticeEngine, usePracticeWorkspace } from "@/features/practice/PracticeProvider";
import { createWorkspaceStore } from "@/layout/workspace-store";

// The always-mounted provider shells (docs/practice/spec.md §4.1 "Mounting", D15).

const panels = vi.hoisted(() => ({ workspace: "editor" as "editor" | "practice" | "overlay" }));
vi.mock("@/contexts/PanelsContext", () => ({ usePanels: () => panels }));

const mounts = { child: 0 };
function Child() {
    useEffect(() => { mounts.child++; }, []);
    const overlay = useOverlayWorkspace();
    const overlayEngine = useOverlayEngine();
    const practice = usePracticeWorkspace();
    const practiceEngine = usePracticeEngine();
    return (
        <p data-testid="state">
            {`overlay ${overlay.activated}/${overlayEngine.running} practice ${practice.activated}/${practiceEngine.running}`}
        </p>
    );
}

const tree = () => (
    <OverlayProvider>
        <PracticeProvider>
            <Child />
        </PracticeProvider>
    </OverlayProvider>
);

beforeEach(() => {
    panels.workspace = "editor";
    mounts.child = 0;
});

describe("workspace providers", () => {
    it("start nothing until their workspace is first opened, then stay started", () => {
        const view = render(tree());
        expect(screen.getByTestId("state")).toHaveTextContent("overlay false/false practice false/false");

        panels.workspace = "overlay";
        view.rerender(tree());
        expect(screen.getByTestId("state")).toHaveTextContent("overlay true/true practice false/false");

        panels.workspace = "editor";
        view.rerender(tree());
        expect(screen.getByTestId("state")).toHaveTextContent("overlay true/true practice false/false");

        panels.workspace = "practice";
        view.rerender(tree());
        expect(screen.getByTestId("state")).toHaveTextContent("overlay true/true practice true/true");
    });

    it("never remount what they wrap", () => {
        const view = render(tree());
        for (const workspace of ["overlay", "practice", "editor"] as const) {
            panels.workspace = workspace;
            view.rerender(tree());
        }
        expect(mounts.child).toBe(1);
    });

    it("start at once when a deep link opened their workspace", () => {
        panels.workspace = "practice";
        render(tree());
        expect(screen.getByTestId("state")).toHaveTextContent("practice true/true");
    });

    it("throw outside their provider", () => {
        vi.spyOn(console, "error").mockImplementation(() => undefined);
        function Orphan() { useOverlayWorkspace(); return null; }
        expect(() => render(<Orphan />)).toThrow(/OverlayProvider/);
    });
});

describe("createWorkspaceStore", () => {
    it("notifies subscribers of changes only", () => {
        const store = createWorkspaceStore({ n: 0 });
        const listener = vi.fn();
        const unsubscribe = store.subscribe(listener);
        const same = store.get();
        store.set(same);
        expect(listener).not.toHaveBeenCalled();
        act(() => store.set((previous) => ({ n: previous.n + 1 })));
        expect(store.get()).toEqual({ n: 1 });
        expect(listener).toHaveBeenCalledTimes(1);
        unsubscribe();
        store.set({ n: 2 });
        expect(listener).toHaveBeenCalledTimes(1);
    });
});
