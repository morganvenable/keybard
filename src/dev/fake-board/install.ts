// Starts the simulated Svalboard for ?fakeBoard (see start.ts) and labels the
// page so nobody mistakes it for a real board.
import type { FakeBoardChoice } from "@/lib/deepLinks";
import { FAKE_BOARD_PRODUCT_NAME, FakeSvalboardDevice } from "./device";

declare global {
    interface Window {
        /** The simulated board, for tests and the console. */
        keybardFakeBoard?: { device: FakeSvalboardDevice; wipe: () => void };
    }
}

function showBadge(choice: FakeBoardChoice, wipe: () => void) {
    const badge = document.createElement("div");
    badge.setAttribute("role", "status");
    badge.dataset.fakeBoardBadge = choice;
    badge.className = "fixed bottom-2 right-2 z-[1000] flex items-center gap-2 rounded-full border border-kb-gray-border bg-kb-warn-bg px-3 py-1 text-xs font-medium text-kb-warn-ink shadow-sm";
    const label = document.createElement("span");
    label.textContent = choice === "old" ? `${FAKE_BOARD_PRODUCT_NAME}, firmware without combo names`
        : choice === "no-pause" ? `${FAKE_BOARD_PRODUCT_NAME}, firmware that can't pause typing` : FAKE_BOARD_PRODUCT_NAME;
    const reset = document.createElement("button");
    reset.type = "button";
    reset.textContent = "Reset";
    reset.title = "Put the simulated board back to its starting settings";
    reset.className = "cursor-pointer underline underline-offset-2 text-kb-warn-ink";
    reset.addEventListener("click", () => {
        if (window.confirm("Put the simulated board back to its starting settings? Its changes are lost.")) wipe();
    });
    badge.append(label, reset);
    const mount = () => document.body.appendChild(badge);
    if (document.body) mount();
    else document.addEventListener("DOMContentLoaded", mount, { once: true });
}

export function installFakeBoard(choice: FakeBoardChoice): HIDDevice {
    // "old" predates both combo names and the typing pause.
    // This firmware has 64-byte reports, the typing pause and the flicker latch; the older choices have neither.
    const current = choice === "combo-names";
    const device = new FakeSvalboardDevice({ comboLabels: choice !== "old", typingPause: current, flickerLatch: current, reportLength: current ? 64 : 32 });
    const wipe = () => {
        device.forgetSettings();
        window.location.reload();
    };
    window.keybardFakeBoard = { device, wipe };
    showBadge(choice, wipe);
    console.info(`[fake board] ${FAKE_BOARD_PRODUCT_NAME} (${choice === "old" ? "firmware without combo names" : choice === "no-pause" ? "firmware that can't pause typing" : "combo names on the board"}) in place of WebHID.`);
    return device.asHIDDevice();
}
