import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
const { keyboardState, binding, service, DEFAULTS } = vi.hoisted(() => {
    const DEFAULTS = {
        scrollOwner: "windows", swipeOwner: "windows", pinchOwner: "windows", spanPads: true, hostAlwaysMerge: false,
        swipeFingers: 3, sustainMin: 1, swipeMm: 12, swipeRatioX10: 20, settleMs: 40, swipeWindow10ms: 60,
        swipeRepeatMm: 0, pinchStartX2: 8, pinchStepX2: 6, keycodes: [0x094f, 0x0950, 0x082b, 0x0807, 0x01d9, 0x01da],
    };
    return {
        DEFAULTS,
        keyboardState: { keyboard: { feature_flags2: 0x1f }, isConnected: true },
        binding: { selectCustomKey: vi.fn(), selectedTarget: null, clearSelection: vi.fn() },
        service: {
            get: vi.fn(async () => ({ ...DEFAULTS, keycodes: [...DEFAULTS.keycodes] })),
            set: vi.fn(async (_c: unknown) => undefined),
            defaults: vi.fn(async () => DEFAULTS),
            status: vi.fn(),
        },
    };
});

vi.mock("@/contexts/KeyboardContext", () => ({ useKeyboard: () => keyboardState }));
vi.mock("@/contexts/KeyBindingContext", () => ({ useKeyBinding: () => binding }));
vi.mock("@/services/touch-gestures.service", async (orig) => ({
    ...(await orig<typeof import("../../src/services/touch-gestures.service")>()),
    touchGesturesService: service,
}));
vi.mock("@/services/key.service", () => ({
    keyService: { stringify: (k: number) => `KC_${k.toString(16)}`, parse: (s: string) => (s === "LGUI(KC_TAB)" ? 0x082b : NaN) },
}));

import TouchGesturesSection from "../../src/layout/SecondarySidebar/Panels/TouchGesturesSection";
import { DEFAULT_TOUCH_GESTURES } from "../../src/services/touch-gestures.service";

it("the test's defaults are the service's", () => expect(DEFAULTS).toEqual(DEFAULT_TOUCH_GESTURES));

describe("TouchGesturesSection", () => {
    beforeEach(() => { service.set.mockClear(); binding.selectCustomKey.mockClear(); });

    it("renders nothing when the board doesn't advertise 0x2E", () => {
        keyboardState.keyboard = { feature_flags2: 0x0f };
        const { container } = render(<TouchGesturesSection />);
        expect(container).toBeEmptyDOMElement();
        keyboardState.keyboard = { feature_flags2: 0x1f };
    });

    it("an owner toggle sends SET at once", async () => {
        render(<TouchGesturesSection />);
        const group = await screen.findByRole("group", { name: "Three-finger swipe" });
        fireEvent.click(group.querySelectorAll("button")[1]);
        await waitFor(() => expect(service.set).toHaveBeenCalledTimes(1));
        expect(service.set.mock.calls[0][0]).toMatchObject({ swipeOwner: "firmware" });
    });

    it("an output slot uses the shared key picker, and a typed keycode is parsed", async () => {
        render(<TouchGesturesSection horizontal />);
        const row = await screen.findByTestId("touch-output-swipeUp");
        fireEvent.click(row.querySelector("button")!);
        expect(binding.selectCustomKey).toHaveBeenCalledWith("touch-gesture-2", 0x082b, expect.any(Function));
        const input = screen.getByLabelText("Swipe left keycode");
        fireEvent.change(input, { target: { value: "LGUI(KC_TAB)" } });
        fireEvent.keyDown(input, { key: "Enter" });
        await waitFor(() => expect(service.set).toHaveBeenCalledTimes(1));
        expect((service.set.mock.calls[0][0] as { keycodes: number[] }).keycodes[0]).toBe(0x082b);
    });
});
