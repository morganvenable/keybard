// A failed settings read shows as not read: never as "no settings", never as zeros.
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import TypingBehaviorPanel from "@/layout/SecondarySidebar/Panels/TypingBehaviorPanel";

const kb = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
vi.mock("@/contexts/KeyboardContext", () => ({ useKeyboard: () => ({ keyboard: kb.current, setKeyboard: vi.fn() }) }));
vi.mock("@/contexts/ChangesContext", () => ({ useChanges: () => ({ queue: vi.fn() }) }));
vi.mock("@/services/qmk.service", () => ({ qmkService: {} }));
vi.mock("@/services/keyboard.service", () => ({ keyboardService: {} }));

describe("QMK settings that weren't read", () => {
    it("say so, with no fields", () => {
        kb.current = { settings_unread: true };
        render(<TypingBehaviorPanel />);
        expect(screen.getByTestId("qmk-settings-not-read").textContent).toBe("Keybard couldn't read these settings from the keyboard. Reconnect it to try again.");
        expect(screen.queryByRole("spinbutton")).toBeNull();
        expect(screen.queryByRole("switch")).toBeNull();
        expect(screen.queryByText(/Some firmware doesn't report these settings/)).toBeNull();
    });

    it("show the read values when they were read", () => {
        kb.current = { settings: { 7: 200 } };
        render(<TypingBehaviorPanel />);
        expect(screen.queryByTestId("qmk-settings-not-read")).toBeNull();
        expect((screen.getByRole("spinbutton", { name: "Tapping Term" }) as HTMLInputElement).value).toBe("200");
    });
});
