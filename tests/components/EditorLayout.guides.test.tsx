vi.mock("@/hooks/useLayerClipboardActions", () => ({ useLayerClipboardActions: () => ({apply: vi.fn(), clearClipboardError: vi.fn()}) }));
import { act, fireEvent, render, screen } from "@testing-library/react";
import { createContext, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import EditorLayout from "../../src/layout/EditorLayout";
import { LEGACY_FORWARD_ENTRY_MS, SCENE_COLLAPSE_MS } from "../../src/layout/layer-scene";

const mockLayoutSettings = vi.hoisted(() => ({
  keyVariant: "default",
  layoutMode: "sidebar",
  setSecondarySidebarOpen: vi.fn(),
  setPrimarySidebarExpanded: vi.fn(),
  registerPrimarySidebarControl: vi.fn(),
  setMeasuredDimensions: vi.fn(),
  is3DMode: true,
  fingerClusterSqueeze: 0,
  isThumb3DOffsetActive: true,
}));

const mockPanels = vi.hoisted(() => ({
  isMobile: false,
  state: "collapsed",
  activePanel: null as string | null,
  workspace: "editor" as "editor" | "practice" | "overlay",
  practicePage: "lessons" as const,
  setPracticePage: vi.fn(),
  itemToEdit: null,
  setItemToEdit: vi.fn(),
  handleCloseEditor: vi.fn(),
}));

// Mount counters for the always-mounted parts (docs/practice/spec.md §9.9: switching workspaces
// never remounts the detail panel or the editor content).
const mounts = vi.hoisted(() => ({ secondarySidebar: 0, layerSelector: 0 }));

const mockLayer = vi.hoisted(() => ({
  selectedLayer: 0,
  setSelectedLayer: vi.fn(),
}));

// TrainerPage stand-in that keeps a session counter and runs the real Host client, as the real page
// does, so the tests can see when Keybard first contacts Keybard Host.
vi.mock("@/features/trainer/TrainerPage", async () => {
  const { useState } = await import("react");
  const { useHost } = await import("@/features/trainer/host");
  return { default: ({ active }: { active: boolean }) => {
    useHost();
    const [attempts, setAttempts] = useState(0);
    return <button data-testid="trainer-session" data-active={active} onClick={() => setAttempts(n => n + 1)}>{attempts}</button>;
  } };
});

vi.mock("@/components/ui/sidebar", () => ({
  SidebarProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  useSidebar: () => ({
    isMobile: false,
    state: "collapsed",
    setOpen: vi.fn(),
  }),
}));

vi.mock("@/contexts/PanelsContext", () => ({
  PanelsProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  usePanels: () => mockPanels,
}));

vi.mock("@/contexts/LayoutSettingsContext", () => ({
  LayoutSettingsProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  useLayoutSettings: () => mockLayoutSettings,
}));

vi.mock("@/contexts/LayerContext", () => ({
  LayerProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  useLayer: () => mockLayer,
}));

vi.mock("@/contexts/DragContext", () => ({
  DragContext: createContext({ isDragging: false }),
  DragProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  useDrag: () => ({
    isDragging: false,
    draggedItem: null,
    markDropConsumed: vi.fn(),
  }),
}));

vi.mock("@/contexts/KeyboardContext", () => ({
  useKeyboard: () => ({
    keyboard: {
      rows: 1,
      cols: 1,
      layers: 2,
      keymap: [[4], [5]],
      keylayout: {
        0: { x: 0, y: 0, w: 1, h: 1, row: 0, col: 0 },
      },
      cosmetic: { layer: {}, layer_colors: {} },
    },
    setKeyboard: vi.fn(),
    updateKey: vi.fn(),
    activeLayerIndex: 0,
    isConnected: false,
  }),
}));

vi.mock("@/contexts/SettingsContext", () => ({
  useSettings: () => ({ getSetting: () => false }),
}));

vi.mock("@/contexts/KeyBindingContext", () => ({
  useKeyBinding: () => ({
    assignKeycodeTo: vi.fn(),
    clearSelection: vi.fn(),
  }),
}));

vi.mock("@/hooks/useChanges", () => ({
  useChanges: () => ({
    queue: vi.fn(),
  }),
}));

const mockLayoutLibrary = vi.hoisted(() => ({
  layerClipboard: null as unknown,
  openPasteDialog: vi.fn(),
}));

vi.mock("@/contexts/LayoutLibraryContext", () => ({
  useLayoutLibrary: () => mockLayoutLibrary,
}));

vi.mock("@/components/DragOverlay", () => ({
  DragOverlay: () => null,
}));

vi.mock("../../src/layout/Sidebar", () => ({
  default: () => null,
}));

vi.mock("../../src/layout/SecondarySidebar/SecondarySidebar", async () => {
  const { useEffect } = await import("react");
  return {
    default: () => {
      useEffect(() => { mounts.secondarySidebar++; }, []);
      return null;
    },
    DETAIL_SIDEBAR_WIDTH: "360px",
    getDetailPanelHeight: (_panel: unknown, height: number) => height,
  };
});

vi.mock("../../src/layout/BottomPanel", () => ({
  BottomPanel: () => null,
  BOTTOM_PANEL_HEIGHT: 200,
}));

vi.mock("../../src/layout/SecondarySidebar/components/BindingEditor/BindingEditorContainer", () => ({
  default: () => null,
}));

vi.mock("../../src/layout/SecondarySidebar/components/EditorSidePanel", () => ({
  default: () => null,
}));

vi.mock("../../src/layout/EditorControls", () => ({
  EditorControls: () => null,
}));

vi.mock("@/components/PasteLayerDialog", () => ({
  PasteLayerDialog: () => null,
}));

vi.mock("@/components/DragReplaceLayerDialog", () => ({
  DragReplaceLayerDialog: () => null,
}));

vi.mock("@/components/InfoPanelWidget", () => ({
  InfoPanelWidget: () => null,
}));

vi.mock("@/components/MatrixTester", () => ({
  MatrixTester: () => null,
}));

vi.mock("@/utils/layer-drop-target", () => ({
  getBackdropLayerFromElements: () => null,
}));

vi.mock("@/services/sval.service", () => ({
  svalService: {
    getLayerName: (_keyboard: unknown, layer: number) => `Layer ${layer}`,
    getLayerNameNoLabel: (_keyboard: unknown, layer: number) => `${layer}`,
  },
}));

vi.mock("../../src/layout/LayerSelector", async () => {
  const { useEffect } = await import("react");
  return {
    default: ({ onToggleMultiLayers }: { onToggleMultiLayers: () => void }) => {
      useEffect(() => { mounts.layerSelector++; }, []);
      return (
        <button data-testid="toggle-multi" onClick={onToggleMultiLayers}>
          toggle multi
        </button>
      );
    },
  };
});

vi.mock("../../src/layout/KeyboardViewInstance", () => ({
  default: ({
    instanceId,
    scenePose,
    legacyForwardEntryActive,
  }: {
    instanceId: string;
    scenePose: { opacity: number; rootTranslateY: number };
    legacyForwardEntryActive?: boolean;
  }) => (
    <div
      data-testid={`view-${instanceId}`}
      data-keyboard-instance={instanceId}
      data-opacity={scenePose.opacity}
      data-root-translate-y={scenePose.rootTranslateY}
      data-legacy-forward-entry={legacyForwardEntryActive ? "true" : "false"}
    >
      {instanceId}
    </div>
  ),
}));

describe("EditorLayout 3D guide sequencing", () => {
  const queuedRafs: FrameRequestCallback[] = [];

  beforeEach(() => {
    mockPanels.activePanel = null;
    mockPanels.workspace = "editor";
    mockPanels.state = "collapsed";
    mounts.secondarySidebar = 0;
    mounts.layerSelector = 0;
    vi.useFakeTimers();
    vi.stubGlobal("__GIT_BRANCH__", "test");
    vi.stubGlobal("ResizeObserver", class {
      observe() {}
      disconnect() {}
      unobserve() {}
    });
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb: FrameRequestCallback) => {
      queuedRafs.push(cb);
      return queuedRafs.length;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => ({ branch: "test" }),
      })
    );
  });

  afterEach(() => {
    queuedRafs.length = 0;
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const flushRaf = async () => {
    const callbacks = queuedRafs.splice(0, queuedRafs.length);
    await act(async () => {
      callbacks.forEach((cb) => cb(0));
    });
  };

  it("retains the Overlay session when returning to the editor", () => {
    mockPanels.workspace = "overlay";
    mockPanels.activePanel = "overlay";
    const { rerender } = render(<EditorLayout />);
    fireEvent.click(screen.getByTestId("trainer-session"));
    expect(screen.getByTestId("trainer-session")).toHaveTextContent("1");
    mockPanels.workspace = "editor";
    mockPanels.activePanel = "keyboard";
    rerender(<EditorLayout />);
    expect(screen.getByTestId("trainer-session")).not.toBeVisible();
    expect(screen.getByTestId("trainer-session")).toHaveAttribute("data-active", "false");
    mockPanels.workspace = "overlay";
    mockPanels.activePanel = "overlay";
    rerender(<EditorLayout />);
    expect(screen.getByTestId("trainer-session")).toBeVisible();
    expect(screen.getByTestId("trainer-session")).toHaveTextContent("1");
  });

  it("keeps the Overlay page showing while Settings is open over it", () => {
    mockPanels.workspace = "overlay";
    mockPanels.activePanel = "settings";
    mockPanels.state = "expanded";
    render(<EditorLayout />);
    expect(screen.getByTestId("trainer-session")).toBeVisible();
    expect(screen.getByTestId("trainer-session")).toHaveAttribute("data-active", "true");
  });

  it.each(["practice", "overlay"] as const)("Ctrl+V does not open the layer paste dialog in %s", (workspace) => {
    mockLayoutLibrary.layerClipboard = { layer: { keymap: [] } };
    mockLayoutLibrary.openPasteDialog.mockClear();
    try {
      mockPanels.workspace = workspace;
      mockPanels.activePanel = workspace;
      const { rerender } = render(<EditorLayout />);
      fireEvent.keyDown(document.body, { key: "v", ctrlKey: true });
      expect(mockLayoutLibrary.openPasteDialog).not.toHaveBeenCalled();
      // The same keystroke in the editor still pastes, so the gate is the workspace.
      mockPanels.workspace = "editor";
      mockPanels.activePanel = null;
      rerender(<EditorLayout />);
      fireEvent.keyDown(document.body, { key: "v", ctrlKey: true });
      expect(mockLayoutLibrary.openPasteDialog).toHaveBeenCalledTimes(1);
    } finally {
      mockLayoutLibrary.layerClipboard = null;
    }
  });

  it("fits the interim Overlay page to its box so a docked panel shortens it", () => {
    mockPanels.workspace = "overlay";
    mockPanels.activePanel = "overlay";
    render(<EditorLayout />);
    const box = document.querySelector(".overlay-workspace") as HTMLElement;
    expect(box.className).toContain("[&>.trainer-page]:!h-full");
  });

  it("never remounts the detail panel or the editor content when switching workspaces", () => {
    const { rerender } = render(<EditorLayout />);
    expect(mounts).toEqual({ secondarySidebar: 1, layerSelector: 1 });
    for (const workspace of ["overlay", "editor", "practice", "overlay", "editor"] as const) {
      mockPanels.workspace = workspace;
      mockPanels.activePanel = workspace === "editor" ? "keyboard" : workspace;
      rerender(<EditorLayout />);
    }
    expect(mounts).toEqual({ secondarySidebar: 1, layerSelector: 1 });
    expect(screen.getByTestId("trainer-session")).not.toBeVisible();
    expect(screen.getByRole("heading", { name: "Practice", hidden: true })).not.toBeVisible();
  });

  it("mounts the Practice page on its first visit and keeps it mounted", () => {
    const { rerender } = render(<EditorLayout />);
    expect(screen.queryByRole("heading", { name: "Practice", hidden: true })).not.toBeInTheDocument();
    mockPanels.workspace = "practice";
    mockPanels.activePanel = "practice";
    rerender(<EditorLayout />);
    expect(screen.getByRole("heading", { name: "Practice" })).toBeVisible();
    mockPanels.workspace = "editor";
    mockPanels.activePanel = null;
    rerender(<EditorLayout />);
    expect(screen.getByRole("heading", { name: "Practice", hidden: true })).not.toBeVisible();
  });

  it("does not contact Keybard Host before Overlay is first opened", async () => {
    // A Host-served page starts its Host client at once; it must still wait for the first visit (D15).
    document.documentElement.dataset.keybardHost = "true";
    try {
      const hostCalls = () => vi.mocked(fetch).mock.calls.map(([url]) => String(url)).filter((url) => url.includes("/api/host/"));
      const { rerender } = render(<EditorLayout />);
      mockPanels.workspace = "practice";
      mockPanels.activePanel = "practice";
      rerender(<EditorLayout />);
      await act(async () => { await Promise.resolve(); });
      expect(hostCalls()).toEqual([]);
      mockPanels.workspace = "overlay";
      mockPanels.activePanel = "overlay";
      rerender(<EditorLayout />);
      await act(async () => { await Promise.resolve(); });
      expect(hostCalls()).toContain("/api/host/bootstrap");
    } finally {
      delete document.documentElement.dataset.keybardHost;
    }
  });

  it("keeps guides hidden during legacy forward entry and only shows them once settled", async () => {
    const { queryByTestId } = render(<EditorLayout />);

    expect(queryByTestId("multi-layer-guides")).not.toBeInTheDocument();
    expect(queryByTestId("view-multi-1")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("toggle-multi"));

    expect(queryByTestId("view-multi-1")).toBeInTheDocument();
    // Initial check: legacy entry should be active
    const multiView = queryByTestId("view-multi-1");
    expect(multiView).toHaveAttribute("data-legacy-forward-entry", "true");
    expect(queryByTestId("multi-layer-guides")).not.toBeInTheDocument();

    // Force all timers to run, ensuring the safety timeout in the component fires
    await act(async () => {
      vi.runAllTimers();
    });

    expect(queryByTestId("view-multi-1")).toHaveAttribute("data-legacy-forward-entry", "false");
    expect(queryByTestId("multi-layer-guides")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("toggle-multi"));

    expect(queryByTestId("view-multi-1")).toBeInTheDocument();
    expect(queryByTestId("view-multi-1")).toHaveAttribute("data-opacity", "1");
    expect(queryByTestId("multi-layer-guides")).not.toBeInTheDocument();

    await flushRaf();

    expect(queryByTestId("view-multi-1")).toHaveAttribute("data-opacity", "0");
    expect(queryByTestId("multi-layer-guides")).not.toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(SCENE_COLLAPSE_MS - 1);
    });
    expect(queryByTestId("view-multi-1")).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(queryByTestId("view-multi-1")).not.toBeInTheDocument();
  });
});
