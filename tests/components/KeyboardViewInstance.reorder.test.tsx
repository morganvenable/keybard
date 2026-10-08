import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import KeyboardViewInstance from "../../src/layout/KeyboardViewInstance";
import { getLayerScenePose } from "../../src/layout/layer-scene";

const reorder = vi.hoisted(() => ({
    guessConstraints: () => ({ fixed: [0], defaultLayer: null, movable: false }),
    loadConstraints: async () => ({ fixed: [0], defaultLayer: 0, movable: false }),
    prepare: (() => undefined) as (...args: unknown[]) => void,
    apply: async () => true, cancel: () => undefined, review: null, error: null, applying: false,
    canSetDefault: false,
    makeDefault: (() => undefined) as (...args: unknown[]) => void,
}));
const board = vi.hoisted(() => ({ isConnected: false, defaultLayerIndex: null as number | null }));
vi.mock("@/hooks/useLayerReorder", () => ({ useLayerReorder: () => reorder }));
vi.mock("@/components/LayerReorderDialog", () => ({ LayerReorderDialog: () => null }));
vi.mock("@/hooks/useLayerClipboardActions", () => ({ useLayerClipboardActions: () => ({ copy: vi.fn(), paste: vi.fn() }) }));
vi.mock("@/contexts/KeyboardContext", () => ({
    useKeyboard: () => ({
        keyboard: { rows: 1, cols: 1, layers: 6, keymap: [[4], [5], [6], [7], [8], [9]], cosmetic: { layer: {}, layer_colors: {} } },
        activeLayerIndex: 0, isConnected: board.isConnected, defaultLayerIndex: board.defaultLayerIndex,
    }),
}));
vi.mock("@/contexts/KeyBindingContext", () => ({ useKeyBinding: () => ({ clearSelection: vi.fn() }) }));
vi.mock("@/contexts/LayoutSettingsContext", () => ({ useLayoutSettings: () => ({ is3DMode: false, keyVariant: "default" }) }));
vi.mock("@/contexts/PanelsContext", () => ({ usePanels: () => ({ activePanel: null }) }));
vi.mock("@/components/Keyboard", () => ({ Keyboard: () => null }));
vi.mock("@/components/LayerNameBadge", () => ({ LayerNameBadge: () => null }));
vi.mock("@/components/ui/tooltip", () => ({
    Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
    TooltipTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
    TooltipContent: () => null,
}));
vi.mock("@/components/ui/context-menu", () => ({
    ContextMenu: ({ children }: { children: ReactNode }) => <>{children}</>,
    ContextMenuTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
    ContextMenuContent: ({ children }: { children: ReactNode }) => <div role="menu">{children}</div>,
    ContextMenuItem: ({ children, disabled, onSelect }: { children: ReactNode; disabled?: boolean; onSelect: () => void }) =>
        <div role="menuitem" aria-disabled={disabled} onClick={onSelect}>{children}</div>,
    ContextMenuSeparator: () => null,
}));
vi.mock("@/services/sval.service", () => ({
    svalService: {
        getLayerName: (_keyboard: unknown, layer: number) => `Layer ${layer}`,
        getLayerNameNoLabel: (_keyboard: unknown, layer: number) => `${layer}`,
    },
}));

const dataTransfer = () => ({ setData: vi.fn(), effectAllowed: "", dropEffect: "" });
/** Fires a drag event with a pointer position; jsdom's generic events don't carry clientX. */
const dragAt = (target: Element, type: "dragOver" | "drop", clientX: number) => {
    const event = new Event(type === "dragOver" ? "dragover" : "drop", { bubbles: true, cancelable: true });
    Object.assign(event, { clientX, dataTransfer: dataTransfer() });
    act(() => { target.dispatchEvent(event); });
    return event;
};

describe("dragging a layer tab between two others", () => {
    let prepare: ReturnType<typeof vi.fn>;
    beforeEach(() => {
        board.isConnected = false;
        board.defaultLayerIndex = null;
        prepare = vi.fn();
        reorder.prepare = prepare;
        vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { callback(0); return 0; });
        // Tab n sits at x = 50n, 40px wide.
        vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
            const n = Number(this.textContent);
            return { left: n * 50, width: 40, top: 0, height: 20, right: n * 50 + 40, bottom: 20, x: n * 50, y: 0, toJSON: () => ({}) } as DOMRect;
        });
    });
    afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

    const renderTabs = () => render(
        <KeyboardViewInstance
            instanceId="test" selectedLayer={0} setSelectedLayer={vi.fn()} isPrimary layerActiveState={[]}
            onToggleLayerOn={vi.fn()} transparencyByLayer={{}} onToggleTransparency={vi.fn()} showAllLayers
            onToggleShowLayers={vi.fn()} isLayerOrderReversed={false} onToggleLayerOrder={vi.fn()}
            isOverviewSceneActive={false} show3DScene={false} isAllTransparencyActive={false}
            scenePose={getLayerScenePose({ sceneState: "single2d", stackIndex: 0, isPrimary: true, totalVisibleLayers: 1, layerSpacingPx: 410, flowOffsetPx: 0, renderedInMultiScene: false })}
        />,
    );
    const openGaps = (row: Element) => [...row.querySelectorAll("span[aria-hidden]")].filter((gap) => (gap as HTMLElement).style.width === "40px");

    it("opens a gap only where the layer may go, and a drop there asks to move it", async () => {
        renderTabs();
        const tab = screen.getByText("4").closest("button")!;
        const row = tab.parentElement!;
        expect(tab.draggable).toBe(true);
        expect(screen.getByText("5").closest("button")!.draggable).toBe(false); // The last layer stays last.

        await act(async () => { fireEvent.dragStart(tab, { dataTransfer: dataTransfer() }); });

        // Between 1 and 2: allowed, so the tabs part and the drop is accepted.
        expect(dragAt(row, "dragOver", 100).defaultPrevented).toBe(true);
        expect(openGaps(row)).toHaveLength(1);
        // Before 0: would renumber the default layer, so nothing opens and the drop is refused.
        expect(dragAt(row, "dragOver", 10).defaultPrevented).toBe(false);
        expect(openGaps(row)).toHaveLength(0);
        // After the last layer: not allowed either.
        expect(dragAt(row, "dragOver", 300).defaultPrevented).toBe(false);

        dragAt(row, "dragOver", 100);
        dragAt(row, "drop", 100);
        expect(prepare).toHaveBeenCalledWith(4, 2, { fixed: [0], defaultLayer: 0, movable: false });
        expect(row.querySelectorAll("span[aria-hidden]")).toHaveLength(0);
    });

    it("marks the default layer and offers to make another layer the default", () => {
        board.isConnected = true;
        board.defaultLayerIndex = 2;
        reorder.canSetDefault = true;
        const makeDefault = vi.fn();
        reorder.makeDefault = makeDefault;
        renderTabs();
        expect(screen.getByRole("button", { name: "2, default layer" })).toBeTruthy();
        const items = screen.getAllByRole("menuitem").filter((item) => /Default Layer/.test(item.textContent ?? ""));
        expect(items.map((item) => [item.textContent, item.getAttribute("aria-disabled")])).toContainEqual(["Default Layer", "true"]);
        fireEvent.click(items.find((item) => item.textContent === "Make Default Layer")!);
        expect(makeDefault).toHaveBeenCalled();

        reorder.canSetDefault = false;
        renderTabs();
        expect(screen.getAllByText("Make Default Layer (needs newer firmware)").length).toBeGreaterThan(0);
    });

    it("does nothing when dropped where no gap is open", async () => {
        renderTabs();
        const tab = screen.getByText("4").closest("button")!;
        await act(async () => { fireEvent.dragStart(tab, { dataTransfer: dataTransfer() }); });
        dragAt(tab.parentElement!, "dragOver", 10);
        dragAt(tab.parentElement!, "drop", 10);
        expect(prepare).not.toHaveBeenCalled();
    });
});
