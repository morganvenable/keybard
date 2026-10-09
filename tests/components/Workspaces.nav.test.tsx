import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useRef } from "react";
import { Gauge, PictureInPicture2 } from "lucide-react";

import { SidebarProvider } from "@/components/ui/sidebar";
import { PanelsProvider, usePanels } from "@/contexts/PanelsContext";
import AppSidebar from "../../src/layout/Sidebar";
import SecondarySidebar from "../../src/layout/SecondarySidebar/SecondarySidebar";

// Workspace and nav behavior (docs/practice/spec.md §4.1, §4.2, §9.9 "Workspace and nav"). The real
// nav, PanelsProvider and detail panel; panel contents are stand-ins.

vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));
vi.mock("@/contexts/KeyboardContext", () => ({ useKeyboard: () => ({ keyboard: null }) }));
vi.mock("../../src/layout/PanelContent", () => ({
    getPanelTitle: (panel: string | null, _menus: unknown, page?: string) =>
        panel === "practice" ? (page === "progress" ? "Progress" : "Lesson") : panel ?? "Details",
    PanelContent: ({ panel }: { panel: string | null }) => (
        <div>
            <p>{`${panel} content`}</p>
            <button type="button">{`${panel} control`}</button>
        </div>
    ),
}));
vi.mock("../../src/layout/SecondarySidebar/components/BindingEditor/BindingEditorContainer", () => ({ default: () => null }));
vi.mock("../../src/layout/SecondarySidebar/components/EditorSidePanel", () => ({ default: () => null }));
vi.mock("../../src/layout/SecondarySidebar/Panels/BasicKeyboards", () => ({ default: () => null }));
vi.mock("../../src/layout/SecondarySidebar/Panels/LayersPanel", () => ({ default: () => null }));
vi.mock("../../src/layout/SecondarySidebar/Panels/MacrosPanel", () => ({ default: () => null }));
vi.mock("../../src/layout/SecondarySidebar/Panels/QmkKeysPanel", () => ({ default: () => null }));
vi.mock("../../src/layout/SecondarySidebar/Panels/OneShotComposerPanel", () => ({ default: () => null }));
vi.mock("../../src/layout/SecondarySidebar/Panels/PointingPanel", () => ({ default: () => null }));
vi.mock("../../src/layout/SecondarySidebar/Panels/MousePanel", () => ({ default: () => null }));
vi.mock("../../src/layout/SecondarySidebar/Panels/SpecialKeysPanel/SpecialKeysPanel", () => ({ default: () => null }));

/** Shows the routing state and offers the non-nav entry points (Matrix Tester, page pills, override). */
function Probe() {
    const panels = usePanels();
    const surface = useRef<HTMLInputElement>(null);
    return (
        <div>
            <output data-testid="workspace">{panels.workspace}</output>
            <output data-testid="active">{String(panels.activePanel)}</output>
            <output data-testid="open">{String(panels.open)}</output>
            <output data-testid="page">{panels.practicePage}</output>
            <button type="button" onClick={() => { panels.setOpen(false); panels.setActivePanel("matrixtester"); }}>Matrix Tester</button>
            <button type="button" onClick={() => panels.setPracticePage("progress")}>Progress page</button>
            <button type="button" onClick={() => panels.setPracticePage("lessons")}>Lessons page</button>
            <input aria-label="Typing surface" ref={surface} />
            <button type="button" onClick={() => { panels.returnFocusOverride.current = surface.current; }}>Use surface</button>
        </div>
    );
}

function renderApp() {
    return render(
        <SidebarProvider defaultOpen={false}>
            <PanelsProvider>
                <AppSidebar />
                <SecondarySidebar />
                <Probe />
            </PanelsProvider>
        </SidebarProvider>,
    );
}

const nav = (name: string) => screen.getByRole("button", { name });
const value = (id: string) => screen.getByTestId(id).textContent;
const panel = () => document.querySelector("aside.detail-panel") as HTMLElement;
const panelOpen = () => panel().getAttribute("aria-hidden") === "false";

beforeEach(() => {
    // Focusing a nav button opens its tooltip, which measures itself.
    vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1280 });
    window.history.replaceState(null, "", "/");
});

afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    window.history.replaceState(null, "", "/");
    for (const name of ["primary-nav", "details-panel"]) document.cookie = `${name}:state=; path=/; max-age=0`;
});

describe("nav items", () => {
    it("uses icons that exist in the installed lucide-react", () => {
        // §4.1 left their presence UNVERIFIED; MW checks them.
        expect(Gauge).toBeTruthy();
        expect(PictureInPicture2).toBeTruthy();
        renderApp();
        expect(nav("Practice").querySelector("svg.lucide-gauge")).not.toBeNull();
        expect(nav("Overlay").querySelector("svg.lucide-picture-in-picture-2, svg.lucide-picture-in-picture2")).not.toBeNull();
    });

    it("replaces Trainer with Practice and Overlay in the layout group", () => {
        renderApp();
        expect(screen.queryByRole("button", { name: "Trainer" })).not.toBeInTheDocument();
        expect(nav("Practice")).toBeInTheDocument();
        expect(nav("Overlay")).toBeInTheDocument();
        const labels = screen.getAllByRole("button").map((b) => b.getAttribute("aria-label"));
        expect(labels.indexOf("Practice")).toBe(labels.indexOf("Layouts") + 1);
        expect(labels.indexOf("Overlay")).toBe(labels.indexOf("Practice") + 1);
    });
});

describe("Practice nav item", () => {
    it("opens the page and its panel; a second click closes the panel and keeps the page", () => {
        renderApp();
        fireEvent.click(nav("Practice"));
        expect(value("workspace")).toBe("practice");
        expect(value("active")).toBe("practice");
        expect(panelOpen()).toBe(true);
        expect(panel()).toHaveAccessibleName("Lesson");
        expect(window.location.hash).toBe("#practice");

        fireEvent.click(nav("Practice"));
        expect(panelOpen()).toBe(false);
        expect(value("workspace")).toBe("practice");
        expect(window.location.hash).toBe("#practice");

        fireEvent.click(nav("Practice"));
        expect(panelOpen()).toBe(true);
        expect(value("active")).toBe("practice");
    });

    it("keeps its indicator while its panel is closed and while Settings is open over it", () => {
        renderApp();
        fireEvent.click(nav("Practice"));
        fireEvent.click(nav("Practice"));
        expect(nav("Practice")).toHaveAttribute("aria-pressed", "true");

        fireEvent.click(nav("Settings"));
        expect(value("workspace")).toBe("practice");
        expect(value("active")).toBe("settings");
        expect(panelOpen()).toBe(true);
        expect(nav("Practice")).toHaveAttribute("aria-pressed", "true");
        expect(nav("Settings")).toHaveAttribute("aria-pressed", "true");

        // Its own nav item swaps the panel content back without leaving the page.
        fireEvent.click(nav("Practice"));
        expect(value("active")).toBe("practice");
        expect(panelOpen()).toBe(true);
    });

    it("titles the panel after the page and swaps it in place", () => {
        renderApp();
        fireEvent.click(nav("Practice"));
        fireEvent.click(screen.getByRole("button", { name: "Progress page" }));
        expect(panel()).toHaveAccessibleName("Progress");
        expect(panelOpen()).toBe(true);
        expect(window.location.hash).toBe("#practice/progress");
    });
});

describe("editor and footer items", () => {
    it("an editor item returns to the editor and clears the hash", () => {
        renderApp();
        fireEvent.click(nav("Practice"));
        fireEvent.click(nav("Layouts"));
        expect(value("workspace")).toBe("editor");
        expect(value("active")).toBe("layouts");
        expect(panelOpen()).toBe(true);
        expect(window.location.hash).toBe("");
        expect(nav("Practice")).toHaveAttribute("aria-pressed", "false");
        expect(nav("Layouts")).toHaveAttribute("aria-pressed", "true");
    });

    it.each(["Quick Start", "About", "Settings"])("%s opens over a workspace without leaving it", (item) => {
        renderApp();
        fireEvent.click(nav("Overlay"));
        fireEvent.click(nav(item));
        expect(value("workspace")).toBe("overlay");
        expect(panelOpen()).toBe(true);
        expect(window.location.hash).toBe("#overlay");
        fireEvent.click(nav(item));
        expect(panelOpen()).toBe(false);
        expect(value("workspace")).toBe("overlay");
    });
});

describe("Overlay nav item (until MO)", () => {
    it("opens the page with the panel closed, like today's Trainer", () => {
        renderApp();
        fireEvent.click(nav("Layouts"));
        expect(panelOpen()).toBe(true);
        fireEvent.click(nav("Overlay"));
        expect(value("workspace")).toBe("overlay");
        expect(value("active")).toBe("overlay");
        expect(panelOpen()).toBe(false);
        expect(window.location.hash).toBe("#overlay");
        expect(nav("Overlay")).toHaveAttribute("aria-pressed", "true");
        // A second click keeps the page.
        fireEvent.click(nav("Overlay"));
        expect(value("workspace")).toBe("overlay");
    });

    it("Matrix Tester, then Overlay, then an editor item leaves Matrix Tester off", () => {
        renderApp();
        fireEvent.click(screen.getByRole("button", { name: "Matrix Tester" }));
        expect(value("active")).toBe("matrixtester");
        fireEvent.click(nav("Overlay"));
        fireEvent.click(nav("Standard Keys"));
        expect(value("workspace")).toBe("editor");
        expect(value("active")).toBe("keyboard");
    });
});

describe("focus", () => {
    it("moves into the panel when an open editor panel switches to Practice", () => {
        renderApp();
        fireEvent.click(nav("Layouts"));
        expect(document.activeElement).toBe(panel());
        // The user works in the editor panel, then picks Practice from the nav.
        nav("Practice").focus();
        fireEvent.click(nav("Practice"));
        expect(panelOpen()).toBe(true);
        expect(document.activeElement).toBe(panel());
    });

    it("stays where it was when Lessons and Progress switch with the panel open", () => {
        renderApp();
        fireEvent.click(nav("Practice"));
        const control = screen.getByRole("button", { name: "practice control" });
        control.focus();
        fireEvent.click(screen.getByRole("button", { name: "Progress page" }));
        expect(document.activeElement).toBe(control);
    });

    it("returns to the opener on close, or to the override Practice sets", () => {
        renderApp();
        nav("Practice").focus();
        fireEvent.click(nav("Practice"));
        fireEvent.click(screen.getByRole("button", { name: "Close details panel" }));
        expect(document.activeElement).toBe(nav("Practice"));

        fireEvent.click(nav("Practice"));
        fireEvent.click(screen.getByRole("button", { name: "Use surface" }));
        fireEvent.click(screen.getByRole("button", { name: "Close details panel" }));
        expect(document.activeElement).toBe(screen.getByLabelText("Typing surface"));
    });
});

describe("Esc", () => {
    it("closes the Practice panel and keeps the page", () => {
        renderApp();
        fireEvent.click(nav("Practice"));
        fireEvent.keyDown(panel(), { key: "Escape" });
        expect(panelOpen()).toBe(false);
        expect(value("workspace")).toBe("practice");
    });

    it("leaves editor panels open", () => {
        renderApp();
        fireEvent.click(nav("Layouts"));
        fireEvent.keyDown(panel(), { key: "Escape" });
        expect(panelOpen()).toBe(true);
    });
});

describe("deep links", () => {
    const openAt = (url: string) => {
        window.history.replaceState(null, "", url);
        return renderApp();
    };

    it("#practice opens Lessons with the Lesson panel and focus in it", () => {
        openAt("/#practice");
        expect(value("workspace")).toBe("practice");
        expect(value("page")).toBe("lessons");
        expect(panelOpen()).toBe(true);
        expect(panel()).toHaveAccessibleName("Lesson");
        expect(document.activeElement).toBe(panel());
    });

    it("#practice/progress opens Progress with the Progress panel", () => {
        openAt("/#practice/progress");
        expect(value("page")).toBe("progress");
        expect(panel()).toHaveAccessibleName("Progress");
    });

    it.each(["#trainer", "#overlay"])("%s opens Overlay and the hash reads #overlay", (hash) => {
        openAt(`/${hash}`);
        expect(value("workspace")).toBe("overlay");
        expect(value("active")).toBe("overlay");
        expect(window.location.hash).toBe("#overlay");
        expect(nav("Overlay")).toHaveAttribute("aria-pressed", "true");
    });

    it("#practice/lab without ?practiceLab=1 opens Practice", () => {
        openAt("/#practice/lab");
        expect(value("page")).toBe("lessons");
        expect(window.location.hash).toBe("#practice");
    });

    it("a workspace hash entered while open acts like a nav click; other hashes are ignored", () => {
        openAt("/");
        fireEvent.click(nav("Layouts"));
        act(() => {
            window.history.replaceState(null, "", "/#practice/progress");
            window.dispatchEvent(new HashChangeEvent("hashchange"));
        });
        expect(value("workspace")).toBe("practice");
        expect(value("page")).toBe("progress");
        expect(value("active")).toBe("practice");
        expect(panelOpen()).toBe(true);
        act(() => {
            window.history.replaceState(null, "", "/#trainer");
            window.dispatchEvent(new HashChangeEvent("hashchange"));
        });
        expect(value("workspace")).toBe("overlay");
        expect(window.location.hash).toBe("#overlay");
        act(() => {
            window.history.replaceState(null, "", "/#unrelated");
            window.dispatchEvent(new HashChangeEvent("hashchange"));
        });
        expect(value("workspace")).toBe("overlay");
    });

    it("a remount reopens the same workspace and page (a board connect remounts EditorLayout)", () => {
        const view = openAt("/");
        fireEvent.click(nav("Practice"));
        fireEvent.click(screen.getByRole("button", { name: "Progress page" }));
        view.unmount();
        act(() => { renderApp(); });
        expect(value("workspace")).toBe("practice");
        expect(value("page")).toBe("progress");
        expect(panelOpen()).toBe(true);
    });
});
