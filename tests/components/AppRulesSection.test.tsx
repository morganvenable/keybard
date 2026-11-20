import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppRule, KeyboardInfo } from "@/types/keyboard.types";
import { appId } from "@/services/app-rules";

const state = vi.hoisted(() => ({
    keyboard: null as KeyboardInfo | null,
    connected: true,
    queue: vi.fn(async (_d: string, _cb: () => Promise<void>, _m?: unknown) => {}),
    write: vi.fn(async () => 1),
    hostApps: null as unknown,
}));

vi.mock("@/contexts/KeyboardContext", () => ({
    useKeyboard: () => ({
        keyboard: state.keyboard,
        isConnected: state.connected,
        setKeyboard: (next: KeyboardInfo | ((k: KeyboardInfo | null) => KeyboardInfo | null)) => {
            state.keyboard = typeof next === "function" ? next(state.keyboard) : next;
        },
    }),
}));
vi.mock("@/contexts/ChangesContext", () => ({ useChanges: () => ({ queue: state.queue }) }));
vi.mock("@/features/trainer/host-apps", () => ({ fetchHostApps: async () => state.hostApps }));
vi.mock("@/services/app-rules", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/services/app-rules")>()),
    writeAppRules: state.write,
    readAppForeground: async () => ({ appId: 0, msLeft: 0, rule: 0, frontLayer: null, onMask: 0, offMask: 0, flags: 1 }),
}));

import AppRulesSection, { APP_RULES_WRITE_DELAY_MS } from "@/layout/SecondarySidebar/Panels/AppRulesSection";

const board = (rules: AppRule[] | undefined, flags5 = 1): KeyboardInfo =>
    ({ rows: 1, cols: 1, layers: 16, feature_flags5: flags5, app_rules: rules, cosmetic: { layer: {} } } as unknown as KeyboardInfo);

const blank: AppRule = { appId: 0, defaultLayer: null, frontLayer: null, onMask: 0, offMask: 0, flags: 0, label: "", key: "" };

function renderSection(compact = false) {
    const view = render(<AppRulesSection compact={compact} />);
    const rerender = () => view.rerender(<AppRulesSection compact={compact} />);
    return { ...view, rerender };
}

describe("AppRulesSection", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        state.queue.mockClear();
        state.write.mockClear();
        state.connected = true;
        state.hostApps = null;
        localStorage.clear();
    });
    afterEach(() => vi.useRealTimers());

    it("is hidden on firmware without the feature bit", () => {
        state.keyboard = board([], 0);
        const { container } = renderSection();
        expect(container.querySelector("[data-app-rules]")).toBeNull();
    });

    it("says when the rules couldn't be read", () => {
        state.keyboard = board(undefined);
        renderSection();
        expect(screen.getByRole("alert").textContent).toMatch(/couldn't read the app rules/);
    });

    it("adds a rule, defaults the label from the app, and writes a burst of edits once", async () => {
        state.keyboard = board([]);
        const view = renderSection();
        expect(screen.getByTestId("app-rules-count").textContent).toBe("0 of 64 max");
        fireEvent.click(screen.getByRole("button", { name: /Add rule/ }));
        view.rerender();
        fireEvent.change(screen.getByLabelText("Rule 1 app"), { target: { value: "Notepad.exe" } });
        view.rerender();
        const r = state.keyboard!.app_rules![0];
        expect(r).toMatchObject({ key: "Notepad.exe", appId: appId("notepad.exe"), label: "Notepad.exe" });
        fireEvent.change(screen.getByTestId("app-rule-default"), { target: { value: "2" } });
        view.rerender();
        fireEvent.change(screen.getByTestId("app-rule-front"), { target: { value: "5" } });
        view.rerender();
        expect(state.queue).not.toHaveBeenCalled();
        await act(async () => { vi.advanceTimersByTime(APP_RULES_WRITE_DELAY_MS); });
        expect(state.queue).toHaveBeenCalledTimes(1);
        const [desc, cb, meta] = state.queue.mock.calls[0];
        expect(desc).toBe("App rules");
        expect(meta).toMatchObject({ writeKey: "app-rules" });
        await cb();
        expect(state.write).toHaveBeenCalledWith(expect.anything(), [expect.objectContaining({ defaultLayer: 2, frontLayer: 5, label: "Notepad.exe" })]);
    });

    it("pills cycle neutral, on, off and say so", () => {
        state.keyboard = board([{ ...blank }]);
        const view = renderSection();
        const pill = () => document.querySelector('[data-app-rule-pills] [data-layer="3"]') as HTMLButtonElement;
        // The mouse layer (15, the last) is Auto Mouse's: no pill, as on the Auto Mouse pills.
        expect(document.querySelectorAll("[data-app-rule-pills] [data-layer]")).toHaveLength(15);
        expect(document.querySelector('[data-app-rule-pills] [data-layer="15"]')).toBeNull();
        expect(pill().dataset.state).toBe("neutral");
        expect(pill().getAttribute("aria-label")).toMatch(/Layer 3 .*: unchanged/);
        fireEvent.click(pill());
        view.rerender();
        expect(pill().dataset.state).toBe("on");
        expect(state.keyboard!.app_rules![0].onMask).toBe(8);
        fireEvent.click(pill());
        view.rerender();
        expect(pill().dataset.state).toBe("off");
        expect(pill().querySelector("span")!.className).toMatch(/line-through/);
        expect(state.keyboard!.app_rules![0]).toMatchObject({ onMask: 0, offMask: 8 });
        fireEvent.click(pill());
        view.rerender();
        expect(pill().dataset.state).toBe("neutral");
    });

    it("reorders and deletes; the first rule can't move up", () => {
        state.keyboard = board([{ ...blank, label: "A" }, { ...blank, label: "B" }]);
        const view = renderSection();
        expect((screen.getByRole("button", { name: "Move rule 1 up" }) as HTMLButtonElement).disabled).toBe(true);
        fireEvent.click(screen.getByRole("button", { name: "Move rule 1 down" }));
        view.rerender();
        expect(state.keyboard!.app_rules!.map((r) => r.label)).toEqual(["B", "A"]);
        fireEvent.click(screen.getByRole("button", { name: "Delete rule 1" }));
        view.rerender();
        expect(state.keyboard!.app_rules!.map((r) => r.label)).toEqual(["A"]);
    });

    it("can't add past 64", () => {
        // Two layers keep 64 rules' pills quick to render.
        state.keyboard = { ...board(Array.from({ length: 64 }, () => ({ ...blank }))), layers: 2 };
        renderSection(true);
        expect((screen.getByRole("button", { name: /Add rule/ }) as HTMLButtonElement).disabled).toBe(true);
    });

    it("an unknown app shows its label and ID; the Host's running apps name it and offer a picker", async () => {
        state.keyboard = board([{ ...blank, appId: appId("firefox"), label: "Fox", key: undefined }]);
        const view = renderSection();
        expect((screen.getByLabelText("Rule 1 app") as HTMLInputElement).placeholder).toBe("Fox (ID F4D4D03A)");
        expect(screen.queryByTestId("app-rule-pick")).toBeNull();
        state.hostApps = { platform: "linux", foreground: null, apps: [{ key: "firefox", name: "Firefox" }, { key: "gedit", name: "Text Editor" }] };
        view.unmount();
        const again = renderSection();
        await act(async () => { await Promise.resolve(); });
        again.rerender();
        expect(state.keyboard!.app_rules![0].key).toBe("firefox");
        again.rerender();
        fireEvent.change(screen.getByTestId("app-rule-pick"), { target: { value: "gedit" } });
        again.rerender();
        expect(state.keyboard!.app_rules![0]).toMatchObject({ key: "gedit", appId: appId("gedit") });
        expect(screen.getByText(/WM_CLASS/)).toBeTruthy();
    });

    it("marks the rule that applies now", async () => {
        state.keyboard = board([{ ...blank }]);
        renderSection();
        await act(async () => { await Promise.resolve(); });
        expect(screen.getByTestId("app-rule-active")).toBeTruthy();
    });

    it("offline (no board connected) edits show but nothing is queued", async () => {
        state.connected = false;
        state.keyboard = board([]);
        renderSection();
        fireEvent.click(screen.getByRole("button", { name: /Add rule/ }));
        await act(async () => { vi.advanceTimersByTime(APP_RULES_WRITE_DELAY_MS * 2); });
        expect(state.keyboard!.app_rules).toHaveLength(1);
        expect(state.queue).not.toHaveBeenCalled();
    });
    it("a Website rule: the site sets the ID and the label, with the hint, and a site that doesn't fit is flagged", async () => {
        state.hostApps = { platform: "windows", foreground: null, apps: [] }; // the hint is Windows' (CI runs on Linux)
        state.keyboard = board([{ ...blank }]);
        const view = renderSection();
        await act(async () => { await Promise.resolve(); });
        expect(screen.queryByTestId("app-rule-site")).toBeNull();
        fireEvent.change(screen.getByTestId("app-rule-kind"), { target: { value: "site" } });
        view.rerender();
        fireEvent.change(screen.getByLabelText("Rule 1 website"), { target: { value: "https://cad.Onshape.com/documents" } });
        view.rerender();
        // cad.onshape.com is 15 bytes: its ID is the whole site's, and its label is its end.
        expect(state.keyboard!.app_rules![0]).toMatchObject({ key: "site:https://cad.Onshape.com/documents", appId: 0x7E364D67, label: "…nshape.com" });
        expect(screen.getByTestId("app-rule-site-hint").textContent).toMatch(/Matches cad.onshape.com and every address under it \(\*\.cad\.onshape\.com\), not the rest of onshape.com/);
        fireEvent.change(screen.getByLabelText("Rule 1 website"), { target: { value: "onshape.com" } });
        view.rerender();
        expect(state.keyboard!.app_rules![0]).toMatchObject({ appId: 0xB2AF5B45, label: "onshape.com" });
        expect((screen.getByLabelText("Rule 1 label") as HTMLInputElement).readOnly).toBe(true);
        expect(screen.getByTestId("app-rule-site-hint").textContent).toMatch(/Matches onshape.com and every address under it/);
        expect(screen.queryByTestId("app-rule-pick")).toBeNull();
        fireEvent.change(screen.getByLabelText("Rule 1 website"), { target: { value: "on shape.com" } });
        view.rerender();
        expect(screen.getByRole("alert").textContent).toMatch(/without spaces/);
        expect(state.keyboard!.app_rules![0].appId).toBe(0);
        fireEvent.change(screen.getByTestId("app-rule-kind"), { target: { value: "program" } });
        view.rerender();
        expect(state.keyboard!.app_rules![0]).toMatchObject({ key: "", appId: 0, label: "" });
        expect(screen.getByLabelText("Rule 1 app")).toBeTruthy();
    });

    it("a website rule read from the board shows as one", () => {
        state.keyboard = board([{ ...blank, appId: appId("site:onshape.com"), label: "onshape.com", key: "site:onshape.com" }]);
        renderSection();
        expect((screen.getByTestId("app-rule-kind") as HTMLSelectElement).value).toBe("site");
        expect((screen.getByLabelText("Rule 1 website") as HTMLInputElement).value).toBe("onshape.com");
    });

    it("off Windows, a website rule says the browser counts as its program", async () => {
        state.hostApps = { platform: "macos", foreground: null, apps: [] };
        state.keyboard = board([{ ...blank, key: "site:onshape.com", appId: appId("site:onshape.com"), label: "onshape.com" }]);
        const view = renderSection();
        await act(async () => { await Promise.resolve(); });
        view.rerender();
        expect(screen.getByTestId("app-rule-site-hint").textContent).toMatch(/only on Windows for now: here the browser counts as its program/);
    });
});
