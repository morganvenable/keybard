// ?fakeBoard: Keybard talks to a simulated Svalboard instead of a USB keyboard
// (for browser tests and the public test site). Without the parameter this
// does nothing at all.
//
// startFakeBoard() runs first thing on page load (main.tsx). With the
// parameter it puts a stand-in for navigator.hid in place right away, whose
// getDevices() and requestDevice() both answer with the simulated board, so
// Keybard's own connect, load, edit and Apply code runs unchanged against it.
// The simulation itself (install.ts) loads as a separate chunk, only then.
import { fakeBoardFromSearch } from "@/lib/deepLinks";

let ready: Promise<HIDDevice> | null = null;

/** navigator.hid while the simulated board is on: it is the only device there is. */
class FakeHid extends EventTarget {
    onconnect: ((ev: Event) => unknown) | null = null;
    ondisconnect: ((ev: Event) => unknown) | null = null;

    constructor(private readonly device: () => Promise<HIDDevice>) {
        super();
    }

    async getDevices(): Promise<HIDDevice[]> {
        return [await this.device()];
    }

    async requestDevice(): Promise<HIDDevice[]> {
        return [await this.device()];
    }
}

export function startFakeBoard(search: string = typeof window === "undefined" ? "" : window.location.search): void {
    const choice = fakeBoardFromSearch(search);
    if (!choice || ready) return;
    ready = import("./install").then((m) => m.installFakeBoard(choice));
    ready.catch((e) => console.error("[fake board] The simulated board did not start:", e));
    try {
        Object.defineProperty(navigator, "hid", { configurable: true, value: new FakeHid(() => ready!) });
    } catch (e) {
        console.error("[fake board] Could not put the simulated board in place of WebHID:", e);
    }
}

/** The simulated board once it is ready, or null without ?fakeBoard. */
export function fakeBoardReady(): Promise<HIDDevice> | null {
    return ready;
}
