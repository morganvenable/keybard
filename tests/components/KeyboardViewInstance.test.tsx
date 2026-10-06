import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import KeyboardViewInstance from "../../src/layout/KeyboardViewInstance";
import { LEGACY_FORWARD_ENTRY_MS, getLayerScenePose } from "../../src/layout/layer-scene";

const clipboard = vi.hoisted(() => ({copy: vi.fn(), paste: vi.fn()}));
vi.mock('@/hooks/useLayerClipboardActions', () => ({useLayerClipboardActions: () => clipboard}));

const mockLayoutSettings = vi.hoisted(() => ({
  is3DMode: false,
  keyVariant: "default",
}));

vi.mock("@/contexts/KeyboardContext", () => ({
  useKeyboard: () => ({
    keyboard: {
      rows: 1,
      cols: 1,
      layers: 2,
      keymap: [[4], [4]],
      cosmetic: { layer: {}, layer_colors: {} },
    },
    updateKey: vi.fn(),
    setKeyboard: vi.fn(),
    activeLayerIndex: 0,
    isConnected: false,
  }),
}));

vi.mock("@/contexts/KeyBindingContext", () => ({
  useKeyBinding: () => ({
    clearSelection: vi.fn(),
  }),
}));

vi.mock("@/contexts/ChangesContext", () => ({
  useChanges: () => ({
    queue: vi.fn(),
  }),
}));

vi.mock("@/contexts/LayoutSettingsContext", () => ({
  useLayoutSettings: () => mockLayoutSettings,
}));

vi.mock("@/contexts/PanelsContext", () => ({
  usePanels: () => ({
    activePanel: null,
  }),
}));

vi.mock("@/components/Keyboard", () => ({
  Keyboard: ({ instanceId }: { instanceId: string }) => (
    <div
      data-testid={`mock-keyboard-${instanceId}`}
      data-keyboard-instance={instanceId}
      className="pointer-events-auto"
    >
      keyboard
    </div>
  ),
}));

vi.mock("@/components/LayerNameBadge", () => ({
  LayerNameBadge: ({ trailingAction }: { trailingAction?: ReactNode }) => (
    <div data-testid="mock-layer-badge">
      badge
      {trailingAction}
    </div>
  ),
}));

vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/ui/context-menu", () => ({
  ContextMenu: ({ children }: { children: ReactNode }) => <>{children}</>,
  ContextMenuTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  ContextMenuContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  ContextMenuItem: ({ children, onSelect }: { children: ReactNode; onSelect: () => void }) => <button onClick={onSelect}>{children}</button>,
  ContextMenuSeparator: () => null,
}));

vi.mock("@/services/sval.service", () => ({
  svalService: {
    getLayerName: (_keyboard: unknown, layer: number) => `Layer ${layer}`,
    getLayerNameNoLabel: (_keyboard: unknown, layer: number) => `${layer}`,
  },
}));

describe("KeyboardViewInstance layer drop surface", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLayoutSettings.is3DMode = false;
    mockLayoutSettings.keyVariant = "default";
  });

  const defaultPose = getLayerScenePose({
    sceneState: "single2d",
    stackIndex: 0,
    isPrimary: true,
    totalVisibleLayers: 1,
    layerSpacingPx: 410,
    flowOffsetPx: 0,
    renderedInMultiScene: false,
  });

  const renderComponent = (props?: Partial<ComponentProps<typeof KeyboardViewInstance>>) => {
    const onLayerDropHover = vi.fn();
    const onLayerDrop = vi.fn();

    const view = render(
      <KeyboardViewInstance
        instanceId="test"
        selectedLayer={1}
        setSelectedLayer={vi.fn()}
        isPrimary={true}
        hideLayerTabs={true}
        layerActiveState={[true, false]}
        onToggleLayerOn={vi.fn()}
        transparencyByLayer={{}}
        onToggleTransparency={vi.fn()}
        showAllLayers={true}
        onToggleShowLayers={vi.fn()}
        isLayerOrderReversed={false}
        onToggleLayerOrder={vi.fn()}
        isOverviewSceneActive={false}
        show3DScene={false}
        scenePose={defaultPose}
        isAllTransparencyActive={false}
        onLayerDropHover={onLayerDropHover}
        onLayerDrop={onLayerDrop}
        {...props}
      />
    );

    const surface = view.container.querySelector('[data-layer-drop-surface="1"]');
    if (!(surface instanceof HTMLElement)) {
      throw new Error("Layer drop surface not found");
    }

    return {
      ...view,
      surface,
      onLayerDropHover,
      onLayerDrop,
    };
  };

  it("copies and pastes the right-clicked tab rather than the selected layer", () => {
    renderComponent({hideLayerTabs: false});
    fireEvent.click(screen.getAllByRole('button', {name: 'Copy Layer'})[0]);
    fireEvent.click(screen.getAllByRole('button', {name: 'Paste Layer'})[0]);
    expect(clipboard.copy).toHaveBeenCalledWith(0);
    expect(clipboard.paste).toHaveBeenCalledWith(0);
  });

  it("keeps the layer-wide drop surface inert when a layer drag is not active", () => {
    const { surface } = renderComponent({ isLayerDragActive: false });

    expect(surface).toHaveAttribute("data-drop-surface-active", "false");
    expect(surface).toHaveClass("pointer-events-none");
    expect(screen.getByTestId("mock-keyboard-test")).toBeInTheDocument();
  });

  it("activates the layer-wide drop surface only during layer drags", () => {
    const { surface, onLayerDropHover, onLayerDrop } = renderComponent({ isLayerDragActive: true });

    expect(surface).toHaveAttribute("data-drop-surface-active", "true");
    expect(surface).toHaveClass("pointer-events-auto");

    fireEvent.mouseEnter(surface);
    fireEvent.mouseUp(surface);

    expect(onLayerDropHover).toHaveBeenCalledWith(1);
    expect(onLayerDrop).toHaveBeenCalledWith(1);
  });

  it("keeps the legacy layer-wide drop surface inert in 3D mode", () => {
    mockLayoutSettings.is3DMode = true;

    const { surface } = renderComponent({ isLayerDragActive: true });

    expect(surface).toHaveAttribute("data-drop-surface-active", "false");
    expect(surface).toHaveClass("pointer-events-none");
  });
});

describe("KeyboardViewInstance scene pose rendering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLayoutSettings.is3DMode = true;
    mockLayoutSettings.keyVariant = "default";
  });

  const baseProps = {
    setSelectedLayer: vi.fn(),
    hideLayerTabs: true,
    layerActiveState: [true, false, false],
    onToggleLayerOn: vi.fn(),
    transparencyByLayer: {},
    onToggleTransparency: vi.fn(),
    showAllLayers: true,
    onToggleShowLayers: vi.fn(),
    isLayerOrderReversed: false,
    onToggleLayerOrder: vi.fn(),
    isOverviewSceneActive: true,
    show3DScene: true,
    isAllTransparencyActive: false,
    baseBadgeOffsetY: 462,
  } satisfies Partial<ComponentProps<typeof KeyboardViewInstance>>;

  it("renders non-primary layers hidden at the primary pose during legacy forward entry", () => {
    const entryPose = getLayerScenePose({
      sceneState: "multi3d",
      stackIndex: 1,
      isPrimary: false,
      totalVisibleLayers: 3,
      layerSpacingPx: 410,
      flowOffsetPx: 0,
      renderedInMultiScene: true,
    });

    const { container } = render(
      <KeyboardViewInstance
        {...baseProps}
        instanceId="multi-1"
        selectedLayer={1}
        isPrimary={false}
        stackIndex={1}
        scenePose={entryPose}
        legacyForwardEntryActive={true}
      />
    );

    const root = container.querySelector('[data-keyboard-view-instance="multi-1"]') as HTMLElement;
    const badgeRow = root.querySelector(".relative.z-20") as HTMLElement;
    const keyboard3d = root.querySelector(".keyboard-3d-active") as HTMLElement;

    expect(root.style.transform).toBe("translateY(calc(-100%*1))");
    expect(root.style.opacity).toBe("0");
    expect(root.style.transition).toBe(`opacity ${LEGACY_FORWARD_ENTRY_MS}ms ease-in-out, transform ${LEGACY_FORWARD_ENTRY_MS}ms ease-in-out`);
    expect(badgeRow.style.transform).toBe("translateY(462px)");
    expect(badgeRow.style.transition).toBe(`transform ${LEGACY_FORWARD_ENTRY_MS}ms ease-in-out`);
    expect(keyboard3d.style.transform).toContain("translateZ(0px)");
    expect(keyboard3d.style.transition).toBe(`transform ${LEGACY_FORWARD_ENTRY_MS}ms ease-in-out`);
  });

  it("applies final stacked depth and projected offset once the multi3d pose is active", () => {
    const stackedPose = getLayerScenePose({
      sceneState: "multi3d",
      stackIndex: 1,
      isPrimary: false,
      totalVisibleLayers: 3,
      layerSpacingPx: 410,
      flowOffsetPx: 656,
      renderedInMultiScene: true,
    });

    const { container } = render(
      <KeyboardViewInstance
        {...baseProps}
        instanceId="multi-1"
        selectedLayer={1}
        isPrimary={false}
        stackIndex={1}
        scenePose={stackedPose}
      />
    );

    const root = container.querySelector('[data-keyboard-view-instance="multi-1"]') as HTMLElement;
    const badgeRow = root.querySelector(".relative.z-20") as HTMLElement;
    const keyboard3d = root.querySelector(".keyboard-3d-active") as HTMLElement;
    const badgeTranslateMatch = badgeRow.style.transform.match(/translateY\(([-\d.]+)px\)/);

    expect(root.style.transform).toBe("translateY(0px)");
    expect(badgeTranslateMatch).not.toBeNull();
    expect(Number(badgeTranslateMatch?.[1])).toBeCloseTo(126.128, 3);
    expect(keyboard3d.style.transform).toContain("translateZ(410px)");
  });
});
