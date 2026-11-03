// Settings the board adjusted or didn't keep, and ones Keybard couldn't read back, have
// their own notes: never "isn't available on this firmware".
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ImportSettingsNotes } from "@/components/ImportSettingsNotes";

describe("the settings notes after a restore", () => {
    it("names what the board adjusted or didn't keep, apart from what this firmware lacks", () => {
        render(<ImportSettingsNotes unavailable={["Old setting"]} notKept={["Pointing: Left DPI"]} unchecked={["Tapping term"]} done />);
        expect(screen.getByTestId("settings-not-kept")).toHaveTextContent("The keyboard adjusted or didn't keep: Pointing: Left DPI");
        expect(screen.getByTestId("settings-not-kept")).not.toHaveTextContent("available on this firmware");
        expect(screen.getByTestId("settings-unchecked")).toHaveTextContent("couldn't be checked: Tapping term");
        expect(screen.getByTestId("settings-unavailable")).toHaveTextContent("isn't available on this firmware");
    });
});
